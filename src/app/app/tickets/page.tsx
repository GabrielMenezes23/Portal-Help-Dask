import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { TicketCard } from '@/components/ticket-ui';
import { requireActiveUser } from '@/lib/auth/current-user';
import { listTickets } from '@/lib/tickets/query';

export const metadata: Metadata = { title: 'Chamados' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';

export default async function TicketsPage({ searchParams }: Props) {
  const { profile } = await requireActiveUser();
  const params = await searchParams;
  const filters = {
    query: one(params.q), status: one(params.status), priority: one(params.priority), requestType: one(params.type),
    dateFrom: one(params.from), dateTo: one(params.to), page: Number(one(params.page) || 1), pageSize: 20,
  };
  const result = await listTickets(filters);
  const base = new URLSearchParams();
  for (const [key, value] of Object.entries({ q: filters.query, status: filters.status, priority: filters.priority, type: filters.requestType, from: filters.dateFrom, to: filters.dateTo })) if (value) base.set(key, String(value));
  const pageLink = (page: number) => { const copy = new URLSearchParams(base); copy.set('page', String(page)); return `/app/tickets?${copy}`; };

  return (
    <AppShell active="tickets" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
      <section className="page-heading"><div><p className="page-heading__context">Chamados</p><h1>{profile.role === 'requester' ? 'Meus chamados' : 'Chamados da operação'}</h1><p>Use os filtros para localizar protocolos, usuários, categorias e situações.</p></div><Link className="button button--primary" href="/app/tickets/new">Novo chamado</Link></section>
      <form className="filter-panel" method="get">
        <input name="q" defaultValue={filters.query} placeholder="Protocolo, título, nome ou e-mail" />
        <select name="status" defaultValue={filters.status}><option value="">Todos os status</option><option value="open">Abertos</option><option value="in_progress">Em andamento</option><option value="resolved">Resolvidos</option><option value="cancelled">Cancelados</option></select>
        <select name="priority" defaultValue={filters.priority}><option value="">Todas as prioridades</option><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select>
        <input name="type" defaultValue={filters.requestType} placeholder="Tipo/categoria" />
        <input name="from" type="date" defaultValue={filters.dateFrom} /><input name="to" type="date" defaultValue={filters.dateTo} />
        <button className="button button--primary" type="submit">Filtrar</button><Link className="button button--ghost" href="/app/tickets">Limpar</Link>
      </form>
      <div className="result-meta">{result.total} chamado(s) encontrado(s)</div>
      <section className="ticket-list">{result.items.length ? result.items.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />) : <div className="empty-state">Nenhum chamado corresponde aos filtros.</div>}</section>
      {result.totalPages > 1 && <nav className="pagination" aria-label="Paginação"><Link className={result.page <= 1 ? 'disabled' : ''} href={pageLink(Math.max(1, result.page - 1))}>Anterior</Link><span>Página {result.page} de {result.totalPages}</span><Link className={result.page >= result.totalPages ? 'disabled' : ''} href={pageLink(Math.min(result.totalPages, result.page + 1))}>Próxima</Link></nav>}
    </AppShell>
  );
}
