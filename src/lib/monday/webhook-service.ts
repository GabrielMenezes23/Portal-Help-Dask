import 'server-only';

import { readMondayEnv } from '@/lib/env/server-env';
import { createAdminClient } from '@/lib/supabase/admin';

import { fetchMondayItemSnapshot } from './client';
import { MondaySyncRepository } from './repository';
import type { ParsedMondayWebhook } from './webhook';
import { isRemovalEvent, shouldRetryWebhookStatus } from './webhook';

type WebhookStatus = 'received' | 'processing' | 'processed' | 'ignored' | 'failed';

type ExistingWebhookRow = {
  id: string;
  status: WebhookStatus;
  attempts: number;
};

async function claimWebhookEvent(
  event: Extract<ParsedMondayWebhook, { kind: 'event' }>,
): Promise<string | null> {
  const supabase = createAdminClient();
  const inserted = await supabase
    .from('monday_webhook_events')
    .insert({
      dedupe_key: event.dedupeKey,
      board_id: event.boardId,
      monday_item_id: event.itemId,
      event_type: event.eventType,
      status: 'processing',
      attempts: 1,
      payload: event.payload,
    })
    .select('id')
    .single();

  if (!inserted.error) return String(inserted.data.id);
  if (inserted.error.code !== '23505') {
    throw new Error(`Falha ao registrar webhook: ${inserted.error.message}`);
  }

  const existing = await supabase
    .from('monday_webhook_events')
    .select('id,status,attempts')
    .eq('dedupe_key', event.dedupeKey)
    .single();
  if (existing.error || !existing.data) {
    throw new Error(
      `Falha ao recuperar webhook duplicado: ${existing.error?.message || 'registro ausente'}`,
    );
  }

  const row = existing.data as ExistingWebhookRow;
  if (!shouldRetryWebhookStatus(row.status)) return null;

  const claimed = await supabase
    .from('monday_webhook_events')
    .update({
      status: 'processing',
      attempts: Number(row.attempts || 0) + 1,
      processed_at: null,
      error_message: null,
      payload: event.payload,
    })
    .eq('id', row.id)
    .in('status', ['received', 'failed'])
    .select('id')
    .maybeSingle();
  if (claimed.error) {
    throw new Error(`Falha ao retomar webhook: ${claimed.error.message}`);
  }
  return claimed.data ? String(claimed.data.id) : null;
}

export async function processMondayWebhookEvent(
  event: Extract<ParsedMondayWebhook, { kind: 'event' }>,
) {
  const env = readMondayEnv();
  const supabase = createAdminClient();
  const webhookId = await claimWebhookEvent(event);
  if (!webhookId) return { status: 'duplicate' as const };

  let runId: string | null = null;
  try {
    if (event.boardId !== env.boardId) {
      const ignored = await supabase
        .from('monday_webhook_events')
        .update({
          status: 'ignored',
          processed_at: new Date().toISOString(),
          error_message: 'Board não autorizado.',
        })
        .eq('id', webhookId);
      if (ignored.error) throw new Error(ignored.error.message);
      return { status: 'ignored' as const };
    }

    if (isRemovalEvent(event.eventType)) {
      const deactivated = await supabase
        .from('tickets')
        .update({
          source_active: false,
          archived_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq('board_id', event.boardId)
        .eq('monday_item_id', event.itemId);
      if (deactivated.error) {
        throw new Error(`Falha ao desativar item removido: ${deactivated.error.message}`);
      }
      const completed = await supabase
        .from('monday_webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', webhookId);
      if (completed.error) throw new Error(completed.error.message);
      return { status: 'processed' as const, operation: 'deactivate' as const };
    }

    const repository = new MondaySyncRepository(supabase);
    runId = await repository.createRun(
      { triggerSource: 'webhook', triggeredBy: null },
      env.boardId,
      env.apiVersion,
    );
    const snapshot = await fetchMondayItemSnapshot(event.itemId);
    const persisted = await repository.persistSnapshot(runId, snapshot);
    const result = {
      runId,
      itemsReceived: snapshot.items.length,
      ticketsUpserted: persisted.ticketsUpserted,
      attachmentsUpserted: persisted.attachmentsUpserted,
      ticketsDeactivated: 0,
      attachmentsDeactivated: 0,
      ticketIds: persisted.ticketIds,
    };
    await repository.completeRun(runId, result);

    const completed = await supabase
      .from('monday_webhook_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', webhookId);
    if (completed.error) throw new Error(completed.error.message);
    return { status: 'processed' as const, operation: 'upsert' as const };
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (runId) await new MondaySyncRepository(supabase).failRun(runId, error);
    const failed = await supabase
      .from('monday_webhook_events')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: error.message.slice(0, 1500),
      })
      .eq('id', webhookId);
    if (failed.error) {
      console.error('Falha adicional ao registrar erro de webhook.', failed.error.message);
    }
    throw error;
  }
}
