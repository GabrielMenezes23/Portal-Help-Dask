import type { MondayAsset, MondayItem } from './domain.ts';

export type SyncTriggerSource = 'manual' | 'cron' | 'cli' | 'webhook';

export type SyncRequest = {
  triggerSource: SyncTriggerSource;
  triggeredBy: string | null;
};

export type MondaySnapshot = {
  boardId: string;
  items: MondayItem[];
  assets: Map<string, MondayAsset>;
};

export type PersistSnapshotResult = {
  ticketsUpserted: number;
  attachmentsUpserted: number;
  ticketIds?: string[];
};

export type DeactivateMissingResult = {
  ticketsDeactivated: number;
  attachmentsDeactivated: number;
};

export type SyncResult = PersistSnapshotResult & DeactivateMissingResult & {
  runId: string;
  itemsReceived: number;
};

export type SyncWorkflowDependencies = {
  createRun(request: SyncRequest): Promise<string>;
  fetchSnapshot(runId: string): Promise<MondaySnapshot>;
  persistSnapshot(
    runId: string,
    snapshot: MondaySnapshot,
  ): Promise<PersistSnapshotResult>;
  deactivateMissing(
    runId: string,
    snapshot: MondaySnapshot,
    persisted: PersistSnapshotResult,
  ): Promise<DeactivateMissingResult>;
  completeRun(runId: string, result: SyncResult): Promise<void>;
  failRun(runId: string, error: Error): Promise<void>;
};

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export async function runSyncWorkflow(
  request: SyncRequest,
  dependencies: SyncWorkflowDependencies,
): Promise<SyncResult> {
  const runId = await dependencies.createRun(request);

  try {
    const snapshot = await dependencies.fetchSnapshot(runId);
    const persisted = await dependencies.persistSnapshot(runId, snapshot);
    const deactivated = await dependencies.deactivateMissing(
      runId,
      snapshot,
      persisted,
    );

    const result: SyncResult = {
      runId,
      itemsReceived: snapshot.items.length,
      ticketsUpserted: persisted.ticketsUpserted,
      attachmentsUpserted: persisted.attachmentsUpserted,
      ticketsDeactivated: deactivated.ticketsDeactivated,
      attachmentsDeactivated: deactivated.attachmentsDeactivated,
      ticketIds: persisted.ticketIds,
    };

    await dependencies.completeRun(runId, result);
    return result;
  } catch (cause) {
    const error = asError(cause);
    await dependencies.failRun(runId, error);
    throw error;
  }
}
