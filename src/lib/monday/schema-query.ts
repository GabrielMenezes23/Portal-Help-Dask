import 'server-only';

import { createClient } from '@/lib/supabase/server';

import { buildExecutiveFieldMap, type ExecutiveFieldMapping } from './executive-field-map';
import type { MondaySchemaColumnRecord } from './schema-domain';

const MAIN_BOARD_ID = '18389222247';

type SchemaRunRow = {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  started_at: string;
  finished_at: string | null;
  error_summary: string | null;
};

type BoardRow = {
  board_id: string;
  workspace_id: string | null;
  name: string;
  board_kind: string;
  state: string;
  url: string;
  is_priority: boolean;
  priority_reason: string;
};

type ColumnRow = {
  board_id: string;
  column_id: string;
  title: string;
  type: string;
  description: string;
  settings: Record<string, unknown> | null;
  revision: string;
  archived: boolean;
  semantic_hint: string;
  internal_field: string | null;
  mapping_status: string;
};

type RelationRow = {
  source_board_id: string;
  source_column_id: string;
  target_board_id: string;
  relation_type: string;
  target_unresolved: boolean;
};

export type MondaySchemaOverview = {
  latestRun: null | {
    id: string;
    status: 'running' | 'succeeded' | 'failed';
    startedAt: string;
    finishedAt: string | null;
    errorSummary: string | null;
  };
  counts: {
    workspaces: number;
    boards: number;
    priorityBoards: number;
    groups: number;
    columns: number;
    relations: number;
  };
  boards: Array<{
    id: string;
    name: string;
    workspaceId: string | null;
    kind: string;
    state: string;
    url: string;
    isPriority: boolean;
    priorityReason: string;
    relationCount: number;
  }>;
  columns: Array<{
    boardId: string;
    id: string;
    title: string;
    type: string;
    semanticHint: string;
    internalField: string | null;
    mappingStatus: string;
    settings: Record<string, unknown>;
    archived: boolean;
  }>;
  relations: Array<{
    sourceBoardId: string;
    sourceColumnId: string;
    targetBoardId: string;
    relationType: string;
    targetUnresolved: boolean;
  }>;
  executiveMap: ExecutiveFieldMapping[];
};

export async function getMondaySchemaOverview(): Promise<MondaySchemaOverview> {
  const supabase = await createClient();
  const [
    runResult,
    workspaceResult,
    boardsResult,
    groupsResult,
    columnsResult,
    relationsResult,
  ] = await Promise.all([
    supabase
      .from('monday_schema_runs')
      .select('id,status,started_at,finished_at,error_summary')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('monday_workspaces').select('workspace_id', { count: 'exact', head: true }).eq('source_active', true),
    supabase
      .from('monday_boards')
      .select('board_id,workspace_id,name,board_kind,state,url,is_priority,priority_reason')
      .eq('source_active', true)
      .order('is_priority', { ascending: false })
      .order('name', { ascending: true }),
    supabase.from('monday_groups').select('id', { count: 'exact', head: true }).eq('source_active', true),
    supabase
      .from('monday_columns')
      .select('board_id,column_id,title,type,description,settings,revision,archived,semantic_hint,internal_field,mapping_status')
      .eq('source_active', true)
      .order('title', { ascending: true }),
    supabase
      .from('monday_board_relations')
      .select('source_board_id,source_column_id,target_board_id,relation_type,target_unresolved')
      .eq('source_active', true),
  ]);

  const firstError = [runResult.error, workspaceResult.error, boardsResult.error, groupsResult.error, columnsResult.error, relationsResult.error]
    .find(Boolean);
  if (firstError) throw new Error(`Não foi possível carregar o inventário do Monday: ${firstError.message}`);

  const boards = (boardsResult.data || []) as BoardRow[];
  const columns = (columnsResult.data || []) as ColumnRow[];
  const relations = (relationsResult.data || []) as RelationRow[];
  const relationCounts = new Map<string, number>();
  for (const relation of relations) {
    relationCounts.set(
      relation.source_board_id,
      (relationCounts.get(relation.source_board_id) || 0) + 1,
    );
  }

  const mappedColumns = columns.map((column) => ({
    boardId: column.board_id,
    id: column.column_id,
    title: column.title,
    type: column.type,
    semanticHint: column.semantic_hint,
    internalField: column.internal_field,
    mappingStatus: column.mapping_status,
    settings: column.settings || {},
    archived: column.archived,
  }));

  const mainBoardColumns: MondaySchemaColumnRecord[] = columns
    .filter((column) => column.board_id === MAIN_BOARD_ID)
    .map((column) => ({
      boardId: column.board_id,
      id: column.column_id,
      title: column.title,
      type: column.type,
      description: column.description,
      settings: column.settings || {},
      revision: column.revision,
      archived: column.archived,
      semanticHint: column.semantic_hint as never,
    }));

  const latestRun = runResult.data as SchemaRunRow | null;
  return {
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          startedAt: latestRun.started_at,
          finishedAt: latestRun.finished_at,
          errorSummary: latestRun.error_summary,
        }
      : null,
    counts: {
      workspaces: workspaceResult.count || 0,
      boards: boards.length,
      priorityBoards: boards.filter((board) => board.is_priority).length,
      groups: groupsResult.count || 0,
      columns: columns.length,
      relations: relations.length,
    },
    boards: boards.map((board) => ({
      id: board.board_id,
      name: board.name,
      workspaceId: board.workspace_id,
      kind: board.board_kind,
      state: board.state,
      url: board.url,
      isPriority: board.is_priority,
      priorityReason: board.priority_reason,
      relationCount: relationCounts.get(board.board_id) || 0,
    })),
    columns: mappedColumns,
    relations: relations.map((relation) => ({
      sourceBoardId: relation.source_board_id,
      sourceColumnId: relation.source_column_id,
      targetBoardId: relation.target_board_id,
      relationType: relation.relation_type,
      targetUnresolved: relation.target_unresolved,
    })),
    executiveMap: buildExecutiveFieldMap(mainBoardColumns),
  };
}
