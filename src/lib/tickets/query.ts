import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { addBusinessMinutes, classifySla, type SlaState } from './sla';
import { getSlaPolicy, loadSlaConfiguration, type RuntimeSlaConfiguration } from './sla-config';

export type TicketSummary = {
  id: string;
  reference: string;
  mondayItemId: string | null;
  title: string;
  status: string;
  statusBucket: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  priority: string;
  priorityKey: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  requestType: string;
  requesterName: string;
  requesterEmail: string;
  responsibleName: string;
  openedAt: string | null;
  resolvedAt: string | null;
  lastActivityAt: string;
  externalSyncStatus: 'not_required' | 'pending' | 'synced' | 'failed';
  slaDeadline: string | null;
  slaState: SlaState;
};

export type TicketFilters = {
  query?: string;
  status?: string;
  priority?: string;
  requestType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type TicketListResult = {
  items: TicketSummary[];
  total: number;
  page: number;
  totalPages: number;
};

type TicketAttachmentRow = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  source_url: string | null;
  monday_sync_status: string;
  created_at: string;
};

type TicketCommentRow = {
  id: string;
  body: string;
  author_email_snapshot: string;
  source: string;
  monday_sync_status: string;
  created_at: string;
};

type TicketHistoryRow = {
  id: number;
  previous_status: string | null;
  new_status: string;
  changed_at: string;
};

type TicketRow = {
  id: string;
  portal_reference: string | null;
  monday_item_id: string | null;
  title: string;
  status_raw: string;
  status_bucket: TicketSummary['statusBucket'];
  priority_raw: string;
  priority_key: TicketSummary['priorityKey'];
  request_type: string;
  requester_name: string;
  requester_email: string;
  responsible_name: string;
  opened_at: string | null;
  resolved_at: string | null;
  last_activity_at: string;
  external_sync_status: TicketSummary['externalSyncStatus'];
  sla_deadline: string | null;
  sla_warning_minutes: number;
};

function safeSearch(value: string): string {
  return value.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function deriveSla(
  row: TicketRow,
  configuration: RuntimeSlaConfiguration,
): { deadline: string | null; warningMinutes: number } {
  if (row.sla_deadline) {
    return {
      deadline: row.sla_deadline,
      warningMinutes: Number(row.sla_warning_minutes || 120),
    };
  }
  if (!row.opened_at) return { deadline: null, warningMinutes: 120 };
  const policy = getSlaPolicy(configuration, row.priority_key);
  return policy
    ? {
        deadline: addBusinessMinutes(
          new Date(row.opened_at),
          policy.targetBusinessMinutes,
          configuration.calendar,
        ).toISOString(),
        warningMinutes: policy.warningMinutes,
      }
    : { deadline: null, warningMinutes: 120 };
}

function mapSummary(
  row: TicketRow,
  configuration: RuntimeSlaConfiguration,
): TicketSummary {
  const sla = deriveSla(row, configuration);
  return {
    id: row.id,
    reference: row.portal_reference || row.monday_item_id || row.id.slice(0, 8).toUpperCase(),
    mondayItemId: row.monday_item_id,
    title: row.title,
    status: row.status_raw || row.status_bucket,
    statusBucket: row.status_bucket,
    priority: row.priority_raw || row.priority_key,
    priorityKey: row.priority_key,
    requestType: row.request_type,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    responsibleName: row.responsible_name,
    openedAt: row.opened_at,
    resolvedAt: row.resolved_at,
    lastActivityAt: row.last_activity_at,
    externalSyncStatus: row.external_sync_status,
    slaDeadline: sla.deadline,
    slaState: classifySla({
      deadline: sla.deadline ? new Date(sla.deadline) : null,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
      warningMinutes: sla.warningMinutes,
    }),
  };
}

const SUMMARY_FIELDS = 'id,portal_reference,monday_item_id,title,status_raw,status_bucket,priority_raw,priority_key,request_type,requester_name,requester_email,responsible_name,opened_at,resolved_at,last_activity_at,external_sync_status,sla_deadline,sla_warning_minutes';

export async function listTickets(filters: TicketFilters = {}): Promise<TicketListResult> {
  const supabase = await createClient();
  const pageSize = Math.min(100, Math.max(5, Number(filters.pageSize || 20)));
  const page = Math.max(1, Number(filters.page || 1));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('tickets')
    .select(SUMMARY_FIELDS, { count: 'exact' })
    .eq('source_active', true)
    .order('last_activity_at', { ascending: false });

  const q = safeSearch(String(filters.query || ''));
  if (q) query = query.or(`title.ilike.%${q}%,requester_name.ilike.%${q}%,requester_email.ilike.%${q}%,portal_reference.ilike.%${q}%,monday_item_id.ilike.%${q}%`);
  if (filters.status && ['open', 'in_progress', 'resolved', 'cancelled'].includes(filters.status)) {
    query = query.eq('status_bucket', filters.status);
  }
  if (filters.priority && ['critical', 'high', 'medium', 'low', 'unknown'].includes(filters.priority)) {
    query = query.eq('priority_key', filters.priority);
  }
  if (filters.requestType) query = query.ilike('request_type', `%${safeSearch(filters.requestType)}%`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateFrom || '')) query = query.gte('opened_at', `${filters.dateFrom}T00:00:00-03:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(filters.dateTo || '')) query = query.lte('opened_at', `${filters.dateTo}T23:59:59-03:00`);

  const [slaConfiguration, queryResult] = await Promise.all([
    loadSlaConfiguration(supabase),
    query.range(from, to),
  ]);
  const { data, error, count } = queryResult;
  if (error) throw new Error(`Não foi possível carregar os chamados: ${error.message}`);
  const total = count || 0;
  return {
    items: ((data || []) as TicketRow[]).map((row) =>
      mapSummary(row, slaConfiguration),
    ),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type TicketDetail = TicketSummary & {
  description: string;
  priorityJustification: string;
  rootCause: string;
  currentUpdate: string;
  legacyHistory: string;
  comments: Array<{
    id: string;
    body: string;
    authorEmail: string;
    source: string;
    syncStatus: string;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    name: string;
    mimeType: string | null;
    sizeBytes: number | null;
    url: string | null;
    syncStatus: string;
    createdAt: string;
  }>;
  history: Array<{
    id: number;
    previousStatus: string | null;
    newStatus: string;
    changedAt: string;
  }>;
};

export async function getTicketDetail(ticketId: string): Promise<TicketDetail | null> {
  const supabase = await createClient();
  const [slaConfiguration, ticketResult, commentsResult, attachmentsResult, historyResult] = await Promise.all([
    loadSlaConfiguration(supabase),
    supabase.from('tickets').select(`${SUMMARY_FIELDS},description,priority_justification,root_cause,current_update,user_reply_raw`).eq('id', ticketId).maybeSingle(),
    supabase.from('ticket_comments').select('id,body,author_email_snapshot,source,monday_sync_status,created_at').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    supabase.from('ticket_attachments').select('id,file_name,mime_type,size_bytes,storage_bucket,storage_path,source_url,monday_sync_status,created_at').eq('ticket_id', ticketId).eq('source_active', true).order('created_at', { ascending: true }),
    supabase.from('ticket_status_history').select('id,previous_status,new_status,changed_at').eq('ticket_id', ticketId).order('changed_at', { ascending: false }).limit(30),
  ]);

  if (ticketResult.error) throw new Error(`Não foi possível carregar o chamado: ${ticketResult.error.message}`);
  if (!ticketResult.data) return null;
  if (commentsResult.error || attachmentsResult.error || historyResult.error) {
    throw new Error('Não foi possível carregar o histórico completo do chamado.');
  }

  const attachmentRows = (attachmentsResult.data || []) as TicketAttachmentRow[];
  const attachments = await Promise.all(attachmentRows.map(async (row) => {
    let url = row.source_url || null;
    if (row.storage_bucket && row.storage_path) {
      const signed = await supabase.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 3600);
      if (!signed.error) url = signed.data.signedUrl;
    }
    return {
      id: String(row.id),
      name: String(row.file_name),
      mimeType: row.mime_type ? String(row.mime_type) : null,
      sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
      url,
      syncStatus: String(row.monday_sync_status),
      createdAt: String(row.created_at),
    };
  }));

  const row = ticketResult.data as TicketRow & {
    description: string;
    priority_justification: string;
    root_cause: string;
    current_update: string;
    user_reply_raw: string;
  };

  return {
    ...mapSummary(row, slaConfiguration),
    description: row.description,
    priorityJustification: row.priority_justification,
    rootCause: row.root_cause,
    currentUpdate: row.current_update,
    legacyHistory: row.user_reply_raw,
    comments: ((commentsResult.data || []) as TicketCommentRow[]).map((comment) => ({
      id: String(comment.id),
      body: String(comment.body || ''),
      authorEmail: String(comment.author_email_snapshot || ''),
      source: String(comment.source),
      syncStatus: String(comment.monday_sync_status),
      createdAt: String(comment.created_at),
    })),
    attachments,
    history: ((historyResult.data || []) as TicketHistoryRow[]).map((entry) => ({
      id: Number(entry.id),
      previousStatus: entry.previous_status ? String(entry.previous_status) : null,
      newStatus: String(entry.new_status),
      changedAt: String(entry.changed_at),
    })),
  };
}

export async function getDashboardData(days = 30) {
  const supabase = await createClient();
  const safeDays = Math.min(3650, Math.max(1, Number(days || 30)));
  const start = new Date(Date.now() - safeDays * 86_400_000).toISOString();
  const [slaConfiguration, ticketResult] = await Promise.all([
    loadSlaConfiguration(supabase),
    supabase
      .from('tickets')
      .select(SUMMARY_FIELDS)
      .eq('source_active', true)
      .gte('opened_at', start),
  ]);
  const { data, error } = ticketResult;
  if (error) {
    throw new Error(`Não foi possível carregar o dashboard: ${error.message}`);
  }
  const items = ((data || []) as TicketRow[]).map((row) =>
    mapSummary(row, slaConfiguration),
  );
  const byType = new Map<string, number>();
  const byPriority = new Map<string, number>();
  for (const item of items) {
    const type = item.requestType || 'Sem tipo';
    byType.set(type, (byType.get(type) || 0) + 1);
    byPriority.set(item.priorityKey, (byPriority.get(item.priorityKey) || 0) + 1);
  }
  const resolved = items.filter((item) => item.statusBucket === 'resolved');
  const resolvedOk = resolved.filter(
    (item) => item.slaState === 'resolved_ok',
  ).length;
  return {
    days: safeDays,
    total: items.length,
    open: items.filter((item) => item.statusBucket === 'open').length,
    inProgress: items.filter((item) => item.statusBucket === 'in_progress').length,
    resolved: resolved.length,
    cancelled: items.filter((item) => item.statusBucket === 'cancelled').length,
    slaCompliance: resolved.length
      ? Math.round((resolvedOk / resolved.length) * 100)
      : null,
    openBreach: items.filter((item) => item.slaState === 'open_breach').length,
    openWarning: items.filter((item) => item.slaState === 'open_warning').length,
    byType: [...byType.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
    byPriority: [...byPriority.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export async function getAuditEvents(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('audit_events')
    .select('id,actor_email,action,entity_type,entity_id,success,error_message,metadata,created_at')
    .order('created_at', { ascending: false })
    .limit(Math.min(250, Math.max(10, limit)));
  if (error) throw new Error(`Não foi possível carregar a auditoria: ${error.message}`);
  return data || [];
}
