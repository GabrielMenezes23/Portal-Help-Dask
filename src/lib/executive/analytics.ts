export type ExecutiveOrigin = 'Usuário' | 'TI';

export type ExecutiveTicketInput = {
  id: string;
  openedAt: string | null;
  resolvedAt: string | null;
  requesterName: string;
  requesterEmail: string;
  description: string;
  priorityKey: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  priorityRaw: string;
  requestType: string;
  priorityJustification: string;
};

export type OriginInference = {
  origin: ExecutiveOrigin;
  reason: string;
  missingFields: string[];
};

function present(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return false;
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return !['nao informado', 'não informado', 'unknown', 'desconhecido'].includes(normalized);
}

export function inferTicketOrigin(ticket: ExecutiveTicketInput): OriginInference {
  const missingFields: string[] = [];
  if (!present(ticket.requesterEmail)) missingFields.push('e-mail');
  if (!present(ticket.description)) missingFields.push('descrição');
  if (!present(ticket.requesterName)) missingFields.push('solicitante');
  if (ticket.priorityKey === 'unknown' || !present(ticket.priorityRaw)) missingFields.push('prioridade');
  if (!present(ticket.requestType)) missingFields.push('tipo');

  const elevated = ticket.priorityKey === 'high' || ticket.priorityKey === 'critical';
  if (elevated && !present(ticket.priorityJustification)) {
    missingFields.push('justificativa da prioridade');
  }

  if (missingFields.length > 0) {
    return {
      origin: 'TI',
      missingFields,
      reason: `Registro sem o conjunto obrigatório do formulário: ${missingFields.join(', ')}.`,
    };
  }

  return {
    origin: 'Usuário',
    missingFields: [],
    reason: elevated
      ? 'Campos obrigatórios do formulário preenchidos e justificativa informada para prioridade elevada.'
      : 'Campos obrigatórios do formulário preenchidos.',
  };
}

function durationSeconds(ticket: ExecutiveTicketInput): number | null {
  if (!ticket.openedAt || !ticket.resolvedAt) return null;
  const opened = new Date(ticket.openedAt).getTime();
  const resolved = new Date(ticket.resolvedAt).getTime();
  if (!Number.isFinite(opened) || !Number.isFinite(resolved) || resolved < opened) return null;
  return Math.round((resolved - opened) / 1000);
}

function calendarDateInSaoPaulo(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function resolvedSameCalendarDay(ticket: ExecutiveTicketInput): boolean {
  const opened = calendarDateInSaoPaulo(ticket.openedAt);
  const resolved = calendarDateInSaoPaulo(ticket.resolvedAt);
  return Boolean(opened && resolved && opened === resolved);
}

function percentileNearestRank(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil(percentile * sorted.length));
  return sorted[Math.min(sorted.length - 1, rank - 1)];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function calculateResolutionStats(tickets: ExecutiveTicketInput[]) {
  const resolvedTickets = tickets.filter((ticket) => durationSeconds(ticket) !== null);
  const durations = resolvedTickets
    .map(durationSeconds)
    .filter((value): value is number => value !== null);
  const total = durations.length;
  const day = 86_400;
  return {
    resolvedWithDuration: total,
    sameDayPct: total ? Math.round((resolvedTickets.filter(resolvedSameCalendarDay).length / total) * 100) : 0,
    within3DaysPct: total ? Math.round((durations.filter((seconds) => seconds <= 3 * day).length / total) * 100) : 0,
    medianSeconds: median(durations),
    averageSeconds: total ? Math.round(durations.reduce((sum, value) => sum + value, 0) / total) : null,
    p90Seconds: percentileNearestRank(durations, 0.9),
  };
}

export type AgingBucket = '0-1 dia' | '2-3 dias' | '4-7 dias' | '8-14 dias' | '15-30 dias' | '>30 dias';

export const AGING_BUCKETS: AgingBucket[] = [
  '0-1 dia',
  '2-3 dias',
  '4-7 dias',
  '8-14 dias',
  '15-30 dias',
  '>30 dias',
];

export function ticketAgeDays(openedAt: string | null, now = new Date()): number | null {
  if (!openedAt) return null;
  const opened = new Date(openedAt).getTime();
  if (!Number.isFinite(opened)) return null;
  return Math.max(0, Math.floor((now.getTime() - opened) / 86_400_000));
}

export function agingBucket(openedAt: string | null, now = new Date()): AgingBucket {
  const ageDays = ticketAgeDays(openedAt, now);
  if (ageDays == null) return '>30 dias';
  if (ageDays < 2) return '0-1 dia';
  if (ageDays < 4) return '2-3 dias';
  if (ageDays < 8) return '4-7 dias';
  if (ageDays < 15) return '8-14 dias';
  if (ageDays <= 30) return '15-30 dias';
  return '>30 dias';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isDependencyStatus(status: string): boolean {
  const normalized = normalizeText(status);
  if (!normalized) return false;
  return [
    'bloquead',
    'aguard',
    'pendente',
    'espera',
    'fornecedor',
    'terceiro',
    'usuario',
    'cliente',
  ].some((signal) => normalized.includes(signal));
}

export function cycleBucket(seconds: number | null): 'Mesmo dia' | '1-3 dias' | '4-7 dias' | '8-14 dias' | '>14 dias' | 'Sem duração' {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return 'Sem duração';
  if (seconds < 86_400) return 'Mesmo dia';
  if (seconds <= 3 * 86_400) return '1-3 dias';
  if (seconds <= 7 * 86_400) return '4-7 dias';
  if (seconds <= 14 * 86_400) return '8-14 dias';
  return '>14 dias';
}

export function ticketResolutionSeconds(ticket: ExecutiveTicketInput): number | null {
  return durationSeconds(ticket);
}

function isoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayStart(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  const day = date.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + delta);
  return isoDateUtc(date);
}

export type WeeklyOriginRow = {
  start: string;
  users: number;
  ti: number;
  total: number;
  userPct: number;
  tiPct: number;
};

function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export function buildWeeklyOriginSeries(tickets: ExecutiveTicketInput[]): WeeklyOriginRow[] {
  const rows = new Map<string, { users: number; ti: number }>();
  for (const ticket of tickets) {
    if (!ticket.openedAt) continue;
    const parsed = new Date(ticket.openedAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const start = mondayStart(isoDateUtc(parsed));
    const current = rows.get(start) || { users: 0, ti: 0 };
    if (inferTicketOrigin(ticket).origin === 'Usuário') current.users += 1;
    else current.ti += 1;
    rows.set(start, current);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([start, value]) => {
      const total = value.users + value.ti;
      return {
        start,
        users: value.users,
        ti: value.ti,
        total,
        userPct: pct(value.users, total),
        tiPct: pct(value.ti, total),
      };
    });
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const value = Math.max(0, Math.round(seconds));
  if (value < 3600) return `${Math.round(value / 60)} min`;
  if (value < 86_400) return `${(value / 3600).toFixed(1).replace('.0', '')} h`;
  return `${(value / 86_400).toFixed(1).replace('.0', '')} d`;
}
