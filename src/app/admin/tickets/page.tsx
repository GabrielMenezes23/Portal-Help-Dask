import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { TicketCard } from '@/components/ticket-ui';
import { requireSupport } from '@/lib/auth/current-user';
import { listTickets } from '@/lib/tickets/query';

export const metadata: Metadata = { title: 'Gerenciar chamados' };
export const dynamic = 'force-dynamic';
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await requireSupport(); const params = await searchParams;
  const filters = { query: one(params.q), status: one(params.status), priority: one(params.priority), requestType: one(params.type), page: Number(one(params.page) || 1), pageSize: 25 };
  const result = await listTickets(filters);
  return <AppShell active="adminTickets" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}><section className="page-heading"><div><p className="page-heading__context">Operação TI</p><h1>Gerenciar chamados</h1><p>Lista operacional completa com filtros, SLA e estado da integração.</p></div><Link className="button button--primary" href="/app/tickets/new">Novo chamado</Link></section><form className="filter-panel filter-panel--compact" method="get"><input name="q" defaultValue={filters.query} placeholder="Protocolo, título, nome ou e-mail" /><select name="status" defaultValue={filters.status}><option value="">Todos os status</option><option value="open">Abertos</option><option value="in_progress">Em andamento</option><option value="resolved">Resolvidos</option><option value="cancelled">Cancelados</option></select><select name="priority" defaultValue={filters.priority}><option value="">Todas as prioridades</option><option value="critical">Crítica</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select><input name="type" defaultValue={filters.requestType} placeholder="Tipo" /><button className="button button--primary">Filtrar</button><Link className="button button--ghost" href="/admin/tickets">Limpar</Link></form><div className="result-meta">{result.total} chamado(s)</div><section className="ticket-list">{result.items.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)}</section></AppShell>;
}
