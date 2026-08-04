import Link from 'next/link';

import type { TicketSummary } from '@/lib/tickets/query';

const statusLabels = { open: 'Aberto', in_progress: 'Em andamento', resolved: 'Resolvido', cancelled: 'Cancelado' } as const;
const priorityLabels = { critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa', unknown: 'Sem prioridade' } as const;
const slaLabels = {
  unavailable: 'SLA indisponível', open_within: 'Dentro do SLA', open_warning: 'SLA em alerta', open_breach: 'SLA estourado', resolved_ok: 'Resolvido no SLA', resolved_late: 'Resolvido fora do SLA',
} as const;

export function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

export function TicketBadges({ ticket }: { ticket: TicketSummary }) {
  return (
    <div className="badge-row">
      <span className={`status-pill status-pill--${ticket.statusBucket}`}>{statusLabels[ticket.statusBucket]}</span>
      <span className={`priority-pill priority-pill--${ticket.priorityKey}`}>{priorityLabels[ticket.priorityKey]}</span>
      <span className={`sla-pill sla-pill--${ticket.slaState}`}>{slaLabels[ticket.slaState]}</span>
      {ticket.externalSyncStatus !== 'synced' && <span className="sync-pill">Monday: {ticket.externalSyncStatus === 'failed' ? 'falhou' : 'pendente'}</span>}
    </div>
  );
}

export function TicketCard({ ticket }: { ticket: TicketSummary }) {
  return (
    <article className="ticket-card">
      <div className="ticket-card__top">
        <div><span className="ticket-reference">{ticket.reference}</span><h2><Link href={`/app/tickets/${ticket.id}`}>{ticket.title}</Link></h2></div>
        <TicketBadges ticket={ticket} />
      </div>
      <div className="ticket-card__meta">
        <span><b>Tipo:</b> {ticket.requestType || 'Não informado'}</span>
        <span><b>Solicitante:</b> {ticket.requesterName || ticket.requesterEmail}</span>
        <span><b>Responsável:</b> {ticket.responsibleName || 'Aguardando atribuição'}</span>
        <span><b>Abertura:</b> {formatDateTime(ticket.openedAt)}</span>
      </div>
    </article>
  );
}
