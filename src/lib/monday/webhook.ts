import { createHash } from 'node:crypto';

export type ParsedMondayWebhook =
  | { kind: 'challenge'; challenge: string }
  | {
      kind: 'event';
      boardId: string;
      itemId: string;
      eventType: string;
      dedupeKey: string;
      payload: Record<string, unknown>;
    };

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Payload do webhook inválido.');
  }
  return value as Record<string, unknown>;
}


function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, sortObjectKeys(nested)]),
  );
}

export function parseMondayWebhook(payload: unknown): ParsedMondayWebhook {
  const root = asRecord(payload);
  const challenge = String(root.challenge ?? '').trim();
  if (challenge) return { kind: 'challenge', challenge };

  const event = asRecord(root.event);
  const boardId = String(event.boardId ?? event.board_id ?? '').trim();
  const itemId = String(
    event.pulseId ?? event.itemId ?? event.pulse_id ?? event.item_id ?? '',
  ).trim();
  const eventType = String(event.type ?? '').trim();
  if (!itemId) throw new Error('Webhook sem item identificado.');
  if (!boardId) throw new Error('Webhook sem board identificado.');
  if (!eventType) throw new Error('Webhook sem tipo identificado.');

  const triggerUuid = String(event.triggerUuid ?? event.trigger_uuid ?? '').trim();
  const subscriptionId = String(event.subscriptionId ?? event.subscription_id ?? '').trim();
  const changedAt = String(event.changedAt ?? event.triggerTime ?? '').trim();
  const payloadHash = createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(event)))
    .digest('hex');
  const dedupeKey =
    triggerUuid ||
    ['fallback', subscriptionId, eventType, itemId, changedAt, payloadHash].join(':');

  return { kind: 'event', boardId, itemId, eventType, dedupeKey, payload: event };
}


export function shouldRetryWebhookStatus(status: string): boolean {
  return status === 'received' || status === 'failed';
}

export function isRemovalEvent(eventType: string): boolean {
  return ['item_deleted', 'item_archived', 'delete_pulse', 'archive_pulse'].includes(
    eventType.trim().toLowerCase(),
  );
}
