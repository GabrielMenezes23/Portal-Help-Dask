import 'server-only';

import { readMondayEnv, readMondayWebhookSecret } from '@/lib/env/server-env';
import { createAdminClient } from '@/lib/supabase/admin';

import { mondayRequest } from './client';

export const REQUIRED_MONDAY_WEBHOOK_EVENTS = [
  'create_item',
  'change_column_value',
  'change_name',
  'item_archived',
  'item_deleted',
  'item_restored',
  'item_moved_to_any_group',
  'create_update',
  'edit_update',
  'delete_update',
] as const;

type ManagedWebhookEvent = (typeof REQUIRED_MONDAY_WEBHOOK_EVENTS)[number];

type MondayWebhook = {
  id: string;
  event: string;
  board_id: string;
  config?: string | null;
};

const WEBHOOKS_QUERY = `
  query BoardWebhooks($boardId: ID!) {
    webhooks(board_id: $boardId) { id event board_id config }
  }
`;

const CREATE_WEBHOOK_MUTATION = `
  mutation CreatePortalWebhook($boardId: ID!, $url: String!, $event: WebhookEventType!) {
    create_webhook(board_id: $boardId, url: $url, event: $event) { id board_id }
  }
`;

const DELETE_WEBHOOK_MUTATION = `
  mutation DeletePortalWebhook($webhookId: ID!) {
    delete_webhook(id: $webhookId) { id board_id }
  }
`;

function callbackUrl(): string {
  const base = String(process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(base)) {
    throw new Error('NEXT_PUBLIC_APP_URL precisa ser uma URL HTTPS válida.');
  }
  const secret = readMondayWebhookSecret();
  const url = `${base}/api/webhooks/monday?secret=${encodeURIComponent(secret)}`;
  if (url.length > 255) throw new Error('A URL do webhook ultrapassa o limite de 255 caracteres.');
  return url;
}

async function listBoardWebhooks(boardId: string): Promise<MondayWebhook[]> {
  const data = await mondayRequest<{ webhooks: MondayWebhook[] }>(WEBHOOKS_QUERY, { boardId });
  return data.webhooks || [];
}

async function createWebhook(
  boardId: string,
  url: string,
  event: ManagedWebhookEvent,
): Promise<string> {
  const data = await mondayRequest<{ create_webhook: { id: string } }>(
    CREATE_WEBHOOK_MUTATION,
    { boardId, url, event },
  );
  if (!data.create_webhook?.id) throw new Error(`Monday não retornou o ID do webhook ${event}.`);
  return String(data.create_webhook.id);
}

async function deleteWebhook(webhookId: string): Promise<void> {
  await mondayRequest(DELETE_WEBHOOK_MUTATION, { webhookId });
}

export async function ensureMondayWebhooks(): Promise<{
  created: number;
  reused: number;
  replaced: number;
}> {
  const { boardId } = readMondayEnv();
  const url = callbackUrl();
  const supabase = createAdminClient();
  const [remote, managedResult] = await Promise.all([
    listBoardWebhooks(boardId),
    supabase
      .from('monday_managed_webhooks')
      .select('event_type,monday_webhook_id,callback_url,active')
      .eq('board_id', boardId),
  ]);
  if (managedResult.error) {
    throw new Error(`Falha ao carregar webhooks gerenciados: ${managedResult.error.message}`);
  }

  const remoteIds = new Set(remote.map((webhook) => String(webhook.id)));
  const managedByEvent = new Map(
    (managedResult.data || []).map((row) => [String(row.event_type), row]),
  );
  const result = { created: 0, reused: 0, replaced: 0 };

  for (const event of REQUIRED_MONDAY_WEBHOOK_EVENTS) {
    const managed = managedByEvent.get(event);
    const managedId = managed ? String(managed.monday_webhook_id) : '';
    const valid =
      Boolean(managed?.active) &&
      managed?.callback_url === url &&
      remoteIds.has(managedId);

    if (valid) {
      result.reused += 1;
      await supabase
        .from('monday_managed_webhooks')
        .update({ last_verified_at: new Date().toISOString() })
        .eq('event_type', event);
      continue;
    }

    if (managedId && remoteIds.has(managedId)) {
      await deleteWebhook(managedId);
      result.replaced += 1;
    }

    const webhookId = await createWebhook(boardId, url, event);
    const persisted = await supabase.from('monday_managed_webhooks').upsert(
      {
        event_type: event,
        monday_webhook_id: webhookId,
        board_id: boardId,
        callback_url: url,
        active: true,
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: 'event_type' },
    );
    if (persisted.error) {
      try {
        await deleteWebhook(webhookId);
      } catch {
        // Best effort rollback; the database error remains the primary failure.
      }
      throw new Error(`Falha ao registrar webhook ${event}: ${persisted.error.message}`);
    }
    result.created += 1;
  }

  return result;
}
