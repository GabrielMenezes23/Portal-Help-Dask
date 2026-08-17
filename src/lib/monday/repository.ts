import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

import {
  mapMondayItem,
  type MappedMondayItem,
  type MondayAsset,
} from './domain';
import type {
  DeactivateMissingResult,
  MondaySnapshot,
  PersistSnapshotResult,
  SyncRequest,
  SyncResult,
} from './sync-workflow';

const UPSERT_BATCH_SIZE = 200;
const FILTER_BATCH_SIZE = 100;

type TicketIdentity = {
  id: string;
  monday_item_id: string;
};

function databaseError(operation: string, error: { message: string }): Error {
  return new Error(`${operation}: ${error.message}`);
}

function chunks<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function extensionFromName(name: string): string | null {
  const match = name.trim().match(/\.([a-zA-Z0-9]{1,12})$/);
  return match?.[1]?.toLowerCase() ?? null;
}

export class MondaySyncRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase: SupabaseClient = createAdminClient()) {
    this.supabase = supabase;
  }

  async createRun(request: SyncRequest, boardId: string, apiVersion: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('integration_runs')
      .insert({
        integration: 'monday',
        status: 'running',
        trigger_source: request.triggerSource,
        triggered_by: request.triggeredBy,
        board_id: boardId,
        metadata: { api_version: apiVersion, mode: request.triggerSource === 'webhook' ? 'incremental_item' : 'full_snapshot' },
      })
      .select('id')
      .single();

    if (error) throw databaseError('Falha ao abrir execução', error);
    return String(data.id);
  }

  async persistSnapshot(
    runId: string,
    snapshot: MondaySnapshot,
  ): Promise<PersistSnapshotResult> {
    const syncedAt = new Date();
    const mapped = snapshot.items.map((item) =>
      mapMondayItem(item, snapshot.boardId, runId, syncedAt),
    );
    const ticketIds = new Map<string, string>();
    const existingMondayItemIds = new Set<string>();

    for (const batch of chunks(mapped, FILTER_BATCH_SIZE)) {
      const { data, error } = await this.supabase
        .from('tickets')
        .select('monday_item_id')
        .eq('board_id', snapshot.boardId)
        .in('monday_item_id', batch.map((entry) => entry.ticket.monday_item_id));

      if (error) throw databaseError('Falha ao identificar novos tickets', error);
      for (const row of data || []) {
        existingMondayItemIds.add(String(row.monday_item_id));
      }
    }

    for (const batch of chunks(mapped, UPSERT_BATCH_SIZE)) {
      const { data, error } = await this.supabase
        .from('tickets')
        .upsert(
          batch.map((entry) => entry.ticket),
          { onConflict: 'board_id,monday_item_id' },
        )
        .select('id,monday_item_id');

      if (error) throw databaseError('Falha ao gravar tickets', error);

      for (const row of (data || []) as TicketIdentity[]) {
        ticketIds.set(String(row.monday_item_id), String(row.id));
      }
    }

    const attachmentRows = this.buildAttachmentRows(
      runId,
      mapped,
      snapshot.assets,
      ticketIds,
      syncedAt,
    );

    for (const batch of chunks(attachmentRows, UPSERT_BATCH_SIZE)) {
      const { error } = await this.supabase
        .from('ticket_attachments')
        .upsert(batch, { onConflict: 'ticket_id,monday_asset_id' });

      if (error) throw databaseError('Falha ao gravar anexos', error);
    }

    return {
      ticketsUpserted: mapped.length,
      attachmentsUpserted: attachmentRows.length,
      ticketIds: [...ticketIds.values()],
      newTicketIds: mapped
        .filter((entry) => !existingMondayItemIds.has(entry.ticket.monday_item_id))
        .map((entry) => ticketIds.get(entry.ticket.monday_item_id))
        .filter((ticketId): ticketId is string => Boolean(ticketId)),
    };
  }

  private buildAttachmentRows(
    runId: string,
    mapped: MappedMondayItem[],
    assets: Map<string, MondayAsset>,
    ticketIds: Map<string, string>,
    syncedAt: Date,
  ) {
    const timestamp = syncedAt.toISOString();

    return mapped.flatMap((entry) => {
      const ticketId = ticketIds.get(entry.ticket.monday_item_id);
      if (!ticketId) return [];

      return entry.assetIds.map((assetId) => {
        const asset = assets.get(assetId);
        const name = String(asset?.name || `asset_${assetId}`).trim();

        return {
          ticket_id: ticketId,
          monday_asset_id: assetId,
          file_name: name,
          file_extension: extensionFromName(name),
          mime_type: null,
          size_bytes: null,
          source_url: asset?.public_url || asset?.url || null,
          source_created_at: null,
          source_active: true,
          last_seen_at: timestamp,
          last_synced_at: timestamp,
          last_sync_run_id: runId,
          raw_payload: asset || { id: assetId, metadata_missing: true },
        };
      });
    });
  }

  async deactivateMissing(
    runId: string,
    snapshot: MondaySnapshot,
    persisted: PersistSnapshotResult,
  ): Promise<DeactivateMissingResult> {
    const now = new Date().toISOString();
    const missingRunFilter = `last_sync_run_id.is.null,last_sync_run_id.neq.${runId}`;

    const { count: ticketCount, error: ticketError } = await this.supabase
      .from('tickets')
      .update({ source_active: false, last_synced_at: now }, { count: 'exact' })
      .eq('board_id', snapshot.boardId)
      .eq('source_system', 'monday')
      .eq('source_active', true)
      .or(missingRunFilter);

    if (ticketError) throw databaseError('Falha ao desativar tickets ausentes', ticketError);

    let attachmentsDeactivated = 0;
    for (const ticketBatch of chunks(persisted.ticketIds || [], FILTER_BATCH_SIZE)) {
      if (ticketBatch.length === 0) continue;

      const { count, error } = await this.supabase
        .from('ticket_attachments')
        .update({ source_active: false, last_synced_at: now }, { count: 'exact' })
        .in('ticket_id', ticketBatch)
        .eq('upload_source', 'monday')
        .eq('source_active', true)
        .or(missingRunFilter);

      if (error) throw databaseError('Falha ao desativar anexos ausentes', error);
      attachmentsDeactivated += count || 0;
    }

    return {
      ticketsDeactivated: ticketCount || 0,
      attachmentsDeactivated,
    };
  }

  async completeRun(runId: string, result: SyncResult): Promise<void> {
    const { error } = await this.supabase
      .from('integration_runs')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        items_received: result.itemsReceived,
        items_upserted: result.ticketsUpserted,
        attachments_upserted: result.attachmentsUpserted,
        attachments_deactivated: result.attachmentsDeactivated,
        items_deactivated: result.ticketsDeactivated,
        error_summary: null,
      })
      .eq('id', runId);

    if (error) throw databaseError('Falha ao concluir execução', error);
  }

  async failRun(runId: string, error: Error): Promise<void> {
    const safeMessage = error.message.slice(0, 1500);

    const { error: logError } = await this.supabase.from('integration_errors').insert({
      integration_run_id: runId,
      operation: 'full_sync',
      error_code: error.name || null,
      error_message: safeMessage,
    });

    const { error: runError } = await this.supabase
      .from('integration_runs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error_summary: safeMessage,
      })
      .eq('id', runId);

    if (logError || runError) {
      console.error('Falha adicional ao registrar erro da integração.', {
        logError: logError?.message,
        runError: runError?.message,
      });
    }
  }
}
