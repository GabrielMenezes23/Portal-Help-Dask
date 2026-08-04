import 'server-only';

import { readMondayEnv } from '@/lib/env/server-env';

import { fetchMondaySnapshot } from './client';
import { MondaySyncRepository } from './repository';
import {
  runSyncWorkflow,
  type SyncRequest,
  type SyncResult,
} from './sync-workflow';

export async function runMondaySync(request: SyncRequest): Promise<SyncResult> {
  const environment = readMondayEnv();
  const repository = new MondaySyncRepository();

  return runSyncWorkflow(request, {
    createRun: () =>
      repository.createRun(request, environment.boardId, environment.apiVersion),
    fetchSnapshot: () => fetchMondaySnapshot(),
    persistSnapshot: (runId, snapshot) =>
      repository.persistSnapshot(runId, snapshot),
    deactivateMissing: (runId, snapshot, persisted) =>
      repository.deactivateMissing(runId, snapshot, persisted),
    completeRun: (runId, result) => repository.completeRun(runId, result),
    failRun: (runId, error) => repository.failRun(runId, error),
  });
}
