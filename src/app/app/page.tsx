import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { requireActiveUser } from '@/lib/auth/current-user';
import { getDashboardData, listTickets } from '@/lib/tickets/query';

export const metadata: Metadata = { title: 'Visão geral' };
export const dynamic = 'force-dynamic';

export default async function ApplicationPage() {
  const { profile } = await requireActiveUser();
  const [dashboard, recent] = await Promise.all([getDashboardData(90), listTickets({ pageSize: 5 })]);

  return (
    <AppShell active="overview" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
      <section className="page-heading">
        <div><p className="page-heading__context">CAF TI Helpdesk</p><h1>Olá, {profile.fullName?.split(' ')[0] || profile.email.split('@')[0]}</h1><p>Acompanhe seus chamados e fale com a TI sem depender de planilhas ou formulários externos.</p></div>
        <Link className="button button--primary" href="/app/tickets/new">Abrir chamado</Link>
      </section>
      <section className="metrics-grid">
        <article className="metric-card"><span>Total no período</span><strong>{dashboard.total}</strong><small>Últimos 90 dias</small></article>
        <article className="metric-card"><span>Abertos</span><strong>{dashboard.open}</strong><small>Aguardando atendimento</small></article>
        <article className="metric-card"><span>Em andamento</span><strong>{dashboard.inProgress}</strong><small>Em tratamento pela TI</small></article>
        <article className="metric-card"><span>Resolvidos</span><strong>{dashboard.resolved}</strong><small>Concluídos no período</small></article>
      </section>
      <section className="panel">
        <div className="panel__heading"><div><span>Atividade recente</span><h2>Últimos chamados</h2></div><Link href="/app/tickets">Ver todos</Link></div>
        {recent.items.length ? <div className="compact-ticket-list">{recent.items.map((ticket) => <Link key={ticket.id} href={`/app/tickets/${ticket.id}`}><span>{ticket.reference}</span><strong>{ticket.title}</strong><small>{ticket.status}</small></Link>)}</div> : <div className="empty-state">Nenhum chamado encontrado.</div>}
      </section>
    </AppShell>
  );
}
