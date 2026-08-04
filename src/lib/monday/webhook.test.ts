import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMondayWebhook, shouldRetryWebhookStatus } from './webhook.ts';

test('reconhece challenge de verificação', () => {
  const result = parseMondayWebhook({ challenge: 'abc123' });
  assert.deepEqual(result, { kind: 'challenge', challenge: 'abc123' });
});

test('normaliza evento de item e chave de deduplicação', () => {
  const result = parseMondayWebhook({
    event: {
      boardId: 18389222247,
      pulseId: 9988,
      type: 'update_column_value',
      triggerUuid: 'uuid-1',
    },
  });

  assert.equal(result.kind, 'event');
  if (result.kind === 'event') {
    assert.equal(result.boardId, '18389222247');
    assert.equal(result.itemId, '9988');
    assert.equal(result.dedupeKey, 'uuid-1');
  }
});

test('rejeita payload sem identificador de item', () => {
  assert.throws(() => parseMondayWebhook({ event: { type: 'x' } }), /item/i);
});


test('reprocessa somente eventos recebidos ou que falharam', () => {
  assert.equal(shouldRetryWebhookStatus('received'), true);
  assert.equal(shouldRetryWebhookStatus('failed'), true);
  assert.equal(shouldRetryWebhookStatus('processing'), false);
  assert.equal(shouldRetryWebhookStatus('processed'), false);
  assert.equal(shouldRetryWebhookStatus('ignored'), false);
});

test('gera deduplicação distinta quando o Monday não envia UUID', () => {
  const first = parseMondayWebhook({
    event: {
      boardId: 99,
      pulseId: 123,
      type: 'update_column_value',
      value: { text: 'primeiro' },
    },
  });
  const second = parseMondayWebhook({
    event: {
      boardId: 99,
      pulseId: 123,
      type: 'update_column_value',
      value: { text: 'segundo' },
    },
  });
  assert.equal(first.kind, 'event');
  assert.equal(second.kind, 'event');
  if (first.kind === 'event' && second.kind === 'event') {
    assert.notEqual(first.dedupeKey, second.dedupeKey);
  }
});
