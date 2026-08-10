import 'server-only';

import { createClient } from '@/lib/supabase/server';
import {
  AGING_BUCKETS,
  agingBucket,
  buildWeeklyOriginSeries,
  calculateResolutionStats,
  inferTicketOrigin,
  type AgingBucket,
  type ExecutiveTicketInput,
  type WeeklyOriginRow,
} from './analytics';

export type ExecutivePeriod = '30' | '90' | '180' | '365' | 'all';

export const EXECUTIVE_PERIODS: Array<{ value: ExecutivePeriod; label: string }> = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '12 meses' },
  { value: 'all', label: 'Todo histórico' },
];

export type ExecutiveTicket = ExecutiveTicketInput & {
  reference: string;
  mondayItemId: string | null;
  title: string;
  status: string;
  statusBucket: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  category: string;
  tags: string[];
  responsibleName: string;
  rootCause: string;
  supplierTicket: string;
  supplierLink: string;
  workTimeSeconds: number;
  openTimeSeconds: number;
  hardwareIssue: string;
  softwareIssue: string;
  serviceSubtype: string;
  lastActivityAt: string;
  sourceSystem: string;
};

type TicketRow = {
  id: string;
  portal_reference: string | null;
  monday_item_id: string | null;
  title: string;
  status_raw: string;
  status_bucket: ExecutiveTicket['statusBucket'];
  priority_raw: string;
  priority_key: ExecutiveTicketInput['priorityKey'];
  request_type: string;
  requester_name: string;
  requester_email: string;
  responsible_name: string;
  description: string;
  priority_justification: string;
  root_cause: string;
  category: string;
  tags: string[] | null;
  supplier_ticket: string;
  supplier_link: string;
  work_time_seconds: number;
  open_time_seconds: number;
  hardware_issue: string;
  software_issue: string;
  service_subtype: string;
  opened_at: string | null;
  resolved_at: string | null;
  last_activity_at: string;
  source_system: string;
};

const EXECUTIVE_FIELDS = [
  'id',
  'portal_reference',
  'monday_item_id',
  'title',
  'status_raw',
  'status_bucket',
  'priority_raw',
  'priority_key',
  'request_type',
  'requester_name',
  'requester_email',
  'responsible_name',
  'description',
  'priority_justification',
  'root_cause',
  'category',
  'tags',
  'supplier_ticket',
  'supplier_link',
  'work_time_seconds',
  'open_time_seconds',
  'hardware_issue',
  'software_issue',
  'service_subtype',
  'opened_at',
  'resolved_at',
  'last_activity_at',
  'source_system',
].join(',');

function periodStart(period: ExecutivePeriod): string | null {
  if (period === 'all') return null;
  const days = Number(period);
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function normalizePeriod(value: unknown): ExecutivePeriod {
  const candidate = String(value ?? 'all');
  return ['30', '90', '180', '365', 'all'].includes(candidate)
    ? candidate as ExecutivePeriod
    : 'all';
}

export function parseExecutivePeriod(value: unknown): ExecutivePeriod {
  return normalizePeriod(value);
}

function mapTicket(row: TicketRow): ExecutiveTicket {
  return {
    id: String(row.id),
    reference: row.portal_reference || row.monday_item_id || String(row.id).slice(0, 8).toUpperCase(),
    mondayItemId: row.monday_item_id ? String(row.monday_item_id) : null,
    title: String(row.title || ''),
    status: String(row.status_raw || row.status_bucket || ''),
    statusBucket: row.status_bucket,
    priorityRaw: String(row.priority_raw || ''),
    priorityKey: row.priority_key,
    requestType: String(row.request_type || ''),
    requesterName: String(row.requester_name || ''),
    requesterEmail: String(row.requester_email || ''),
    responsibleName: String(row.responsible_name || ''),
    description: String(row.description || ''),
    priorityJustification: String(row.priority_justification || ''),
    rootCause: String(row.root_cause || ''),
    category: String(row.category || ''),
    tags: Array.isArray(row.tags) ? row.tags.map(String).filter(Boolean) : [],
    supplierTicket: String(row.supplier_ticket || ''),
    supplierLink: String(row.supplier_link || ''),
    workTimeSeconds: Math.max(0, Number(row.work_time_seconds || 0)),
    openTimeSeconds: Math.max(0, Number(row.open_time_seconds || 0)),
    hardwareIssue: String(row.hardware_issue || ''),
    softwareIssue: String(row.software_issue || ''),
    serviceSubtype: String(row.service_subtype || ''),
    openedAt: row.opened_at ? String(row.opened_at) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    lastActivityAt: String(row.last_activity_at || row.opened_at || ''),
    sourceSystem: String(row.source_system || ''),
  };
}

async function loadTickets(period: ExecutivePeriod): Promise<ExecutiveTicket[]> {
  const supabase = await createClient();
  const start = periodStart(period);
  const pageSize = 1000;
  const output: ExecutiveTicket[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from('tickets')
      .select(EXECUTIVE_FIELDS)
      .eq('source_active', true)
      .order('opened_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (start) query = query.gte('opened_at', start);

    const { data, error } = await query;
    if (error) throw new Error(`Não foi possível carregar o Painel Executivo: ${error.message}`);
    const rows = (data || []) as TicketRow[];
    output.push(...rows.map(mapTicket));
    if (rows.length < pageSize) break;
  }

  return output;
}

function ranked(values: string[], limit = 10): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim() || 'Não informado';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

function averagePositive(values: number[]): number | null {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}

function completeness(tickets: ExecutiveTicket[]) {
  const total = Math.max(1, tickets.length);
  const fields = [
    ['Categoria', (ticket: ExecutiveTicket) => Boolean(ticket.category)],
    ['Tags', (ticket: ExecutiveTicket) => ticket.tags.length > 0],
    ['Solicitante', (ticket: ExecutiveTicket) => Boolean(ticket.requesterName && ticket.requesterName !== 'Não informado')],
    ['E-mail', (ticket: ExecutiveTicket) => Boolean(ticket.requesterEmail)],
    ['Responsável', (ticket: ExecutiveTicket) => Boolean(ticket.responsibleName)],
    ['Tipo', (ticket: ExecutiveTicket) => Boolean(ticket.requestType)],
    ['Causa raiz', (ticket: ExecutiveTicket) => Boolean(ticket.rootCause)],
    ['Tempo de trabalho', (ticket: ExecutiveTicket) => ticket.workTimeSeconds > 0],
  ] as const;
  return fields.map(([field, predicate]) => {
    const filled = tickets.filter(predicate).length;
    return { field, filled, missing: tickets.length - filled, pct: Math.round((filled / total) * 1000) / 10 };
  });
}

export type ExecutiveDashboard = Awaited<ReturnType<typeof buildExecutiveDashboard>>;

function buildExecutiveDashboard(tickets: ExecutiveTicket[], period: ExecutivePeriod, now = new Date()) {
  const active = tickets.filter((ticket) => !['resolved', 'cancelled'].includes(ticket.statusBucket));
  const resolved = tickets.filter((ticket) => ticket.statusBucket === 'resolved');
  const cancelled = tickets.filter((ticket) => ticket.statusBucket === 'cancelled');
  const resolution = calculateResolutionStats(tickets);
  const origin = tickets.map((ticket) => ({ ticket, inference: inferTicketOrigin(ticket) }));
  const users = origin.filter((row) => row.inference.origin === 'Usuário').length;
  const ti = origin.length - users;
  const aging = new Map<AgingBucket, number>(AGING_BUCKETS.map((bucket) => [bucket, 0]));
  for (const ticket of active) {
    const bucket = agingBucket(ticket.openedAt, now);
    aging.set(bucket, (aging.get(bucket) || 0) + 1);
  }

  const tags = tickets.flatMap((ticket) => ticket.tags);
  const rootCauseFilled = tickets.filter((ticket) => ticket.rootCause).length;
  const supplierTickets = tickets.filter((ticket) => ticket.supplierTicket).length;
  const highCritical = tickets.filter((ticket) => ticket.priorityKey === 'high' || ticket.priorityKey === 'critical');
  const highCriticalMissingJustification = highCritical.filter((ticket) => !ticket.priorityJustification).length;

  return {
    period,
    generatedAt: now.toISOString(),
    tickets,
    totals: {
      total: tickets.length,
      active: active.length,
      resolved: resolved.length,
      cancelled: cancelled.length,
      resolutionRate: tickets.length ? Math.round((resolved.length / tickets.length) * 1000) / 10 : 0,
      users,
      ti,
      userShare: tickets.length ? Math.round((users / tickets.length) * 1000) / 10 : 0,
    },
    resolution,
    operationalTime: {
      averageWorkSeconds: averagePositive(tickets.map((ticket) => ticket.workTimeSeconds)),
      averageOpenTrackingSeconds: averagePositive(tickets.map((ticket) => ticket.openTimeSeconds)),
      workTracked: tickets.filter((ticket) => ticket.workTimeSeconds > 0).length,
      openTracked: tickets.filter((ticket) => ticket.openTimeSeconds > 0).length,
    },
    aging: [...aging.entries()],
    byCategory: ranked(tickets.map((ticket) => ticket.category || 'Sem categoria')),
    byPriority: ranked(tickets.map((ticket) => ticket.priorityRaw || 'Não informada')),
    byType: ranked(tickets.map((ticket) => ticket.requestType || 'Sem tipo')),
    byRequester: ranked(tickets.map((ticket) => ticket.requesterName || 'Não informado')),
    byResponsible: ranked(tickets.map((ticket) => ticket.responsibleName || 'Não informado')),
    byTag: ranked(tags),
    weeklyOrigin: buildWeeklyOriginSeries(tickets),
    origin: {
      users,
      ti,
      rows: origin,
    },
    quality: {
      completeness: completeness(tickets),
      rootCauseFilled,
      rootCausePct: tickets.length ? Math.round((rootCauseFilled / tickets.length) * 1000) / 10 : 0,
      supplierTickets,
      highCritical: highCritical.length,
      highCriticalMissingJustification,
    },
    recent: [...tickets]
      .sort((a, b) => String(b.openedAt || '').localeCompare(String(a.openedAt || '')))
      .slice(0, 50),
    openOldest: [...active]
      .sort((a, b) => String(a.openedAt || '').localeCompare(String(b.openedAt || '')))
      .slice(0, 25),
  };
}

export async function getExecutiveDashboard(periodInput: unknown = 'all') {
  const period = normalizePeriod(periodInput);
  const tickets = await loadTickets(period);
  return buildExecutiveDashboard(tickets, period);
}

export function buildExecutiveDashboardForTest(
  tickets: ExecutiveTicket[],
  period: ExecutivePeriod = 'all',
  now = new Date(),
) {
  return buildExecutiveDashboard(tickets, period, now);
}

export function recentCompletedWeeks(rows: WeeklyOriginRow[], referenceDate: Date = new Date()): WeeklyOriginRow[] {
  const referenceIso = referenceDate.toISOString().slice(0, 10);
  const currentMonday = (() => {
    const date = new Date(`${referenceIso}T12:00:00.000Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day));
    return date.toISOString().slice(0, 10);
  })();
  return rows.filter((row) => row.start < currentMonday);
}
