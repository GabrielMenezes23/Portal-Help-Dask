import assert from 'node:assert/strict';
import test from 'node:test';

import { getRateLimitPolicy } from './rate-limit.ts';

test('define limites distintos para operações de usuário e administração', () => {
  assert.deepEqual(getRateLimitPolicy('ticket.create'), {
    maxCount: 5,
    windowSeconds: 600,
  });
  assert.deepEqual(getRateLimitPolicy('ticket.comment'), {
    maxCount: 20,
    windowSeconds: 600,
  });
  assert.deepEqual(getRateLimitPolicy('ticket.manage'), {
    maxCount: 60,
    windowSeconds: 600,
  });
});
