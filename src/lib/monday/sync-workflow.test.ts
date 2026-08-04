import assert from 'node:assert/strict';
import test from 'node:test';

import { runSyncWorkflow } from './sync-workflow.ts';

const snapshot = {
  boardId: '18389222247',
  items: [],
  assets: new Map(),
};

test('finalizes and deactivates missing records only after persistence succeeds', async () => {
  const calls: string[] = [];

  const result = await runSyncWorkflow(
    { triggerSource: 'manual', triggeredBy: 'user-1' },
    {
      createRun: async () => {
        calls.push('create');
        return 'run-1';
      },
      fetchSnapshot: async () => {
        calls.push('fetch');
        return snapshot;
      },
      persistSnapshot: async () => {
        calls.push('persist');
        return { ticketsUpserted: 3, attachmentsUpserted: 2 };
      },
      deactivateMissing: async () => {
        calls.push('deactivate');
        return { ticketsDeactivated: 1, attachmentsDeactivated: 1 };
      },
      completeRun: async () => {
        calls.push('complete');
      },
      failRun: async () => {
        calls.push('fail');
      },
    },
  );

  assert.deepEqual(calls, ['create', 'fetch', 'persist', 'deactivate', 'complete']);
  assert.equal(result.runId, 'run-1');
  assert.equal(result.ticketsUpserted, 3);
  assert.equal(result.ticketsDeactivated, 1);
});

test('records failure and never deactivates records after a partial persistence error', async () => {
  const calls: string[] = [];

  await assert.rejects(
    () =>
      runSyncWorkflow(
        { triggerSource: 'cron', triggeredBy: null },
        {
          createRun: async () => 'run-2',
          fetchSnapshot: async () => snapshot,
          persistSnapshot: async () => {
            calls.push('persist');
            throw new Error('database unavailable');
          },
          deactivateMissing: async () => {
            calls.push('deactivate');
            return { ticketsDeactivated: 0, attachmentsDeactivated: 0 };
          },
          completeRun: async () => {
            calls.push('complete');
          },
          failRun: async (_runId, error) => {
            calls.push(`fail:${error.message}`);
          },
        },
      ),
    /database unavailable/,
  );

  assert.deepEqual(calls, ['persist', 'fail:database unavailable']);
});
