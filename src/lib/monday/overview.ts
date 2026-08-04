import 'server-only';

import { getServerConfigurationStatus } from '@/lib/env/server-env';
import { createClient } from '@/lib/supabase/server';

export type IntegrationRunSummary = {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  triggerSource: 'manual' | 'cron' | 'cli' | 'webhook';
  startedAt: string;
  finishedAt: string | null;
  itemsReceived: number;
  itemsUpserted: number;
  attachmentsUpserted: number;
  itemsDeactivated: number;
  errorSummary: string | null;
};

export type MondayIntegrationOverview = {
  configuration: ReturnType<typeof getServerConfigurationStatus>;
  migrationReady: boolean;
  ticketCount: number;
  activeTicketCount: number;
  attachmentCount: number;
  pendingTickets: number;
  pendingComments: number;
  pendingAttachments: number;
  failedWebhooks: number;
  runs: IntegrationRunSummary[];
  loadError: string | null;
};

type RunRow = {
  id: string; status: 'running' | 'succeeded' | 'failed'; trigger_source: IntegrationRunSummary['triggerSource']; started_at: string; finished_at: string | null;
  items_received: number; items_upserted: number; attachments_upserted: number; items_deactivated: number; error_summary: string | null;
};

export async function getMondayIntegrationOverview(): Promise<MondayIntegrationOverview> {
  const configuration = getServerConfigurationStatus();
  const supabase = await createClient();
  const [tickets, activeTickets, attachments, pendingTickets, pendingComments, pendingAttachments, failedWebhooks, runs] = await Promise.all([
    supabase.from('tickets').select('id', { count: 'exact', head: true }),
    supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('source_active', true),
    supabase.from('ticket_attachments').select('id', { count: 'exact', head: true }).eq('source_active', true),
    supabase.from('tickets').select('id', { count: 'exact', head: true }).in('external_sync_status', ['pending', 'failed']),
    supabase.from('ticket_comments').select('id', { count: 'exact', head: true }).in('monday_sync_status', ['pending', 'failed']),
    supabase.from('ticket_attachments').select('id', { count: 'exact', head: true }).in('monday_sync_status', ['pending', 'failed']),
    supabase.from('monday_webhook_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('integration_runs').select('id,status,trigger_source,started_at,finished_at,items_received,items_upserted,attachments_upserted,items_deactivated,error_summary').order('started_at', { ascending: false }).limit(15),
  ]);
  const firstError = tickets.error || activeTickets.error || attachments.error || pendingTickets.error || pendingComments.error || pendingAttachments.error || failedWebhooks.error || runs.error;
  if (firstError) return { configuration, migrationReady: false, ticketCount: 0, activeTicketCount: 0, attachmentCount: 0, pendingTickets: 0, pendingComments: 0, pendingAttachments: 0, failedWebhooks: 0, runs: [], loadError: firstError.message };
  return {
    configuration,
    migrationReady: true,
    ticketCount: tickets.count || 0,
    activeTicketCount: activeTickets.count || 0,
    attachmentCount: attachments.count || 0,
    pendingTickets: pendingTickets.count || 0,
    pendingComments: pendingComments.count || 0,
    pendingAttachments: pendingAttachments.count || 0,
    failedWebhooks: failedWebhooks.count || 0,
    runs: ((runs.data || []) as RunRow[]).map((run) => ({ id: run.id, status: run.status, triggerSource: run.trigger_source, startedAt: run.started_at, finishedAt: run.finished_at, itemsReceived: run.items_received, itemsUpserted: run.items_upserted, attachmentsUpserted: run.attachments_upserted, itemsDeactivated: run.items_deactivated, errorSummary: run.error_summary })),
    loadError: null,
  };
}
