import 'server-only';

import { readMondayEnv } from '@/lib/env/server-env';
import { createAdminClient } from '@/lib/supabase/admin';

import { fetchMondaySchemaSnapshot } from './schema-client';
import { classifySemanticHint } from './schema-domain';

export type MondaySchemaSyncResult = {
  runId: string;
  workspaces: number;
  boards: number;
  groups: number;
  columns: number;
  relations: number;
};

type SchemaTriggerSource = 'manual' | 'cron';

const UPSERT_CHUNK_SIZE = 500;

function chunks<T>(rows: T[], size = UPSERT_CHUNK_SIZE): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }
  return output;
}

function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'Falha inesperada.');
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9._~-]{20,}\b/g, '[redacted]')
    .slice(0, 1000);
}

async function upsertChunks(
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createAdminClient();
  for (const batch of chunks(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`Falha ao persistir ${table}: ${error.message}`);
  }
}

async function deactivateMissing(table: string, runId: string): Promise<void> {
  const supabase = createAdminClient();
  const current = await supabase
    .from(table)
    .update({ source_active: false })
    .neq('last_seen_run_id', runId);
  if (current.error) throw new Error(`Falha ao reconciliar ${table}: ${current.error.message}`);

  const neverSeen = await supabase
    .from(table)
    .update({ source_active: false })
    .is('last_seen_run_id', null);
  if (neverSeen.error) throw new Error(`Falha ao reconciliar ${table}: ${neverSeen.error.message}`);
}

export async function runMondaySchemaSync(input: {
  triggerSource: SchemaTriggerSource;
  triggeredBy?: string | null;
}): Promise<MondaySchemaSyncResult> {
  const supabase = createAdminClient();
  const environment = readMondayEnv();
  const started = await supabase
    .from('monday_schema_runs')
    .insert({
      trigger_source: input.triggerSource,
      triggered_by: input.triggeredBy || null,
      status: 'running',
      metadata: {
        api_version: environment.apiVersion,
        main_board_id: environment.boardId,
      },
    })
    .select('id')
    .single();

  if (started.error || !started.data?.id) {
    throw new Error(`Não foi possível iniciar o inventário do Monday: ${started.error?.message || 'ID ausente'}`);
  }

  const runId = String(started.data.id);
  try {
    const snapshot = await fetchMondaySchemaSnapshot(environment.boardId);
    const accessibleBoardIds = new Set(snapshot.boards.map((board) => board.id));

    await upsertChunks(
      'monday_workspaces',
      snapshot.workspaces.map((workspace) => ({
        workspace_id: workspace.id,
        name: workspace.name,
        kind: workspace.kind,
        state: workspace.state,
        description: workspace.description || '',
        last_seen_run_id: runId,
        source_active: true,
        raw_settings: {},
      })),
      'workspace_id',
    );

    await upsertChunks(
      'monday_boards',
      snapshot.boards.map((board) => ({
        board_id: board.id,
        workspace_id: board.workspaceId,
        name: board.name,
        board_kind: board.boardKind,
        state: board.state,
        url: board.url,
        source_updated_at: board.updatedAt,
        is_priority: board.priority,
        priority_reason: board.priorityReason,
        last_seen_run_id: runId,
        source_active: true,
        raw_settings: {},
      })),
      'board_id',
    );

    await upsertChunks(
      'monday_groups',
      snapshot.groups.map((group) => ({
        board_id: group.boardId,
        group_id: group.id,
        title: group.title,
        position: group.position,
        archived: group.archived,
        last_seen_run_id: runId,
        source_active: true,
      })),
      'board_id,group_id',
    );

    // Deliberately omit internal_field/mapping_status so confirmed manual mappings survive discovery.
    await upsertChunks(
      'monday_columns',
      snapshot.columns.map((column) => ({
        board_id: column.boardId,
        column_id: column.id,
        title: column.title,
        type: column.type,
        description: column.description || '',
        settings: column.settings || {},
        revision: column.revision || '',
        archived: column.archived,
        semantic_hint: classifySemanticHint(column),
        last_seen_run_id: runId,
        source_active: true,
      })),
      'board_id,column_id',
    );

    await upsertChunks(
      'monday_board_relations',
      snapshot.relations.map((relation) => ({
        source_board_id: relation.sourceBoardId,
        source_column_id: relation.sourceColumnId,
        target_board_id: relation.targetBoardId,
        relation_type: relation.relationType,
        target_unresolved: !accessibleBoardIds.has(relation.targetBoardId),
        metadata: {},
        last_seen_run_id: runId,
        source_active: true,
      })),
      'source_board_id,source_column_id,target_board_id',
    );

    // Only a complete API read + all upserts may deactivate entries missing from this snapshot.
    for (const table of [
      'monday_workspaces',
      'monday_boards',
      'monday_groups',
      'monday_columns',
      'monday_board_relations',
    ]) {
      await deactivateMissing(table, runId);
    }

    const result: MondaySchemaSyncResult = {
      runId,
      workspaces: snapshot.workspaces.length,
      boards: snapshot.boards.length,
      groups: snapshot.groups.length,
      columns: snapshot.columns.length,
      relations: snapshot.relations.length,
    };

    const completed = await supabase
      .from('monday_schema_runs')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        workspace_count: result.workspaces,
        board_count: result.boards,
        group_count: result.groups,
        column_count: result.columns,
        relation_count: result.relations,
        error_summary: null,
      })
      .eq('id', runId);
    if (completed.error) throw new Error(`Falha ao finalizar inventário: ${completed.error.message}`);

    return result;
  } catch (cause) {
    const errorSummary = sanitizeError(cause);
    await supabase
      .from('monday_schema_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_summary: errorSummary,
      })
      .eq('id', runId);
    throw cause;
  }
}
