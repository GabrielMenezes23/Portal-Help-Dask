import {
  calculateResolutionStats,
  cycleBucket,
  inferTicketOrigin,
  isDependencyStatus,
  ticketAgeDays,
  ticketResolutionSeconds,
} from './analytics';
import type { ExecutiveTicket } from './query';

export type GroupPerformanceRow = {
  label: string;
  total: number;
  resolved: number;
  backlog: number;
  sameDayPct: number;
  within3DaysPct: number;
  medianSeconds: number | null;
  averageSeconds: number | null;
};

function ranked(values: string[], limit = 12): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw.trim() || 'Não informado';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function performanceRows(
  tickets: ExecutiveTicket[],
  active: ExecutiveTicket[],
  key: (ticket: ExecutiveTicket) => string,
): GroupPerformanceRow[] {
  const labels = new Set(tickets.map((ticket) => key(ticket).trim() || 'Não informado'));
  return [...labels].map((label) => {
    const group = tickets.filter((ticket) => (key(ticket).trim() || 'Não informado') === label);
    const stats = calculateResolutionStats(group);
    return {
      label,
      total: group.length,
      resolved: group.filter((ticket) => ticket.statusBucket === 'resolved').length,
      backlog: active.filter((ticket) => (key(ticket).trim() || 'Não informado') === label).length,
      sameDayPct: stats.sameDayPct,
      within3DaysPct: stats.within3DaysPct,
      medianSeconds: stats.medianSeconds,
      averageSeconds: stats.averageSeconds,
    };
  }).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, 20);
}

function attentionScore(ticket: ExecutiveTicket, now: Date): number {
  const priority = ticket.priorityKey === 'critical' ? 80 : ticket.priorityKey === 'high' ? 55 : ticket.priorityKey === 'medium' ? 25 : 10;
  const dependency = isDependencyStatus(ticket.status) ? 35 : 0;
  const age = Math.min(60, ticketAgeDays(ticket.openedAt, now) || 0);
  return priority + dependency + age;
}

export function buildExecutiveParity(tickets: ExecutiveTicket[], now = new Date()) {
  const active = tickets.filter((ticket) => !['resolved', 'cancelled'].includes(ticket.statusBucket));
  const resolved = tickets.filter((ticket) => ticket.statusBucket === 'resolved');
  const dependencies = active.filter((ticket) => isDependencyStatus(ticket.status));
  const originRows = tickets.map((ticket) => ({ ticket, inference: inferTicketOrigin(ticket) }));
  const userTickets = originRows.filter((row) => row.inference.origin === 'Usuário').map((row) => row.ticket);
  const tiTickets = originRows.filter((row) => row.inference.origin === 'TI').map((row) => row.ticket);
  const byTag = ranked(tickets.flatMap((ticket) => ticket.tags));
  const aged = active.filter((ticket) => (ticketAgeDays(ticket.openedAt, now) || 0) > 14).length;
  const criticalHigh = active.filter((ticket) => ticket.priorityKey === 'critical' || ticket.priorityKey === 'high').length;
  const userPct = tickets.length ? Math.round((userTickets.length / tickets.length) * 1000) / 10 : 0;

  const briefing = [
    active.length ? `${active.length} chamado(s) permanecem no backlog; ${aged} estão acima de 14 dias.` : '',
    criticalHigh ? `${criticalHigh} chamado(s) ativos têm prioridade Alta ou Crítica.` : '',
    dependencies.length ? `${dependencies.length} chamado(s) ativos indicam bloqueio, espera ou dependência pelo status atual.` : '',
    byTag[0] ? `O tema mais recorrente é “${byTag[0][0]}”, com ${byTag[0][1]} ocorrência(s).` : '',
    tickets.length ? `${userPct}% das aberturas foram inferidas como originadas pelos usuários.` : '',
  ].filter(Boolean);

  return {
    active,
    dependencies,
    executable: Math.max(0, active.length - dependencies.length),
    backlogByResponsible: ranked(active.map((ticket) => ticket.responsibleName || 'Não informado')),
    backlogByStatus: ranked(active.map((ticket) => ticket.status || 'Não informado')),
    byRootCause: ranked(tickets.map((ticket) => ticket.rootCause || 'Não informada')),
    cycleDistribution: ['Mesmo dia', '1-3 dias', '4-7 dias', '8-14 dias', '>14 dias'].map((bucket) => [
      bucket,
      resolved.filter((ticket) => cycleBucket(ticketResolutionSeconds(ticket)) === bucket).length,
    ] as [string, number]),
    prioritySituation: ranked(tickets.map((ticket) => `${ticket.priorityRaw || 'Não informada'} · ${ticket.statusBucket === 'resolved' ? 'Resolvido' : ticket.statusBucket === 'cancelled' ? 'Cancelado' : 'Ativo'}`), 30),
    performanceByType: performanceRows(tickets, active, (ticket) => ticket.requestType),
    performanceByResponsible: performanceRows(tickets, active, (ticket) => ticket.responsibleName),
    attention: [...active]
      .sort((a, b) => attentionScore(b, now) - attentionScore(a, now) || String(a.openedAt || '').localeCompare(String(b.openedAt || '')))
      .slice(0, 20)
      .map((ticket) => ({ ticket, score: attentionScore(ticket, now), ageDays: ticketAgeDays(ticket.openedAt, now), dependency: isDependencyStatus(ticket.status) })),
    origin: {
      userTickets: [...userTickets].sort((a, b) => String(b.openedAt || '').localeCompare(String(a.openedAt || ''))),
      tiTickets: [...tiTickets].sort((a, b) => String(b.openedAt || '').localeCompare(String(a.openedAt || ''))),
      userRequesters: ranked(userTickets.map((ticket) => ticket.requesterName || 'Não informado')),
      userTags: ranked(userTickets.flatMap((ticket) => ticket.tags)),
      tiRequesters: ranked(tiTickets.map((ticket) => ticket.requesterName || 'Não informado')),
      tiTags: ranked(tiTickets.flatMap((ticket) => ticket.tags)),
    },
    briefing: briefing.length ? briefing : ['Não há volume suficiente no período para gerar uma leitura executiva consistente.'],
  };
}
