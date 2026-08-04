import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { requireSupport } from '@/lib/auth/current-user';
import { getDashboardData } from '@/lib/tickets/query';

export const metadata: Metadata = { title: 'Dashboard TI' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { profile } = await requireSupport();
  const dashboard = await getDashboardData(30);
  return (
    <AppShell active="admin" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
      <section className="page-heading"><div><p className="page-heading__context">Operação TI</p><h1>Dashboard de atendimento</h1><p>Indicadores calculados diretamente do PostgreSQL no Supabase.</p></div><Link className="button button--primary" href="/admin/tickets">Gerenciar chamados</Link></section>
      <section className="metrics-grid metrics-grid--five"><article className="metric-card"><span>Total</span><strong>{dashboard.total}</strong><small>Últimos 30 dias</small></article><article className="metric-card"><span>Abertos</span><strong>{dashboard.open}</strong><small>Fila inicial</small></article><article className="metric-card"><span>Em andamento</span><strong>{dashboard.inProgress}</strong><small>Em tratamento</small></article><article className="metric-card"><span>Resolvidos</span><strong>{dashboard.resolved}</strong><small>Concluídos</small></article><article className="metric-card"><span>SLA</span><strong>{dashboard.slaCompliance == null ? '—' : `${dashboard.slaCompliance}%`}</strong><small>{dashboard.openBreach} estourado(s)</small></article></section>
      <div className="content-grid">
        <section className="panel"><div className="panel__heading"><div><span>Demanda</span><h2>Chamados por tipo</h2></div></div><div className="bar-list">{dashboard.byType.map(([label, count]) => <div key={label}><span>{label}</span><div><i style={{ width: `${Math.max(4, Math.round((count / Math.max(1, dashboard.total)) * 100))}%` }} /></div><strong>{count}</strong></div>)}</div></section>
        <section className="panel"><div className="panel__heading"><div><span>Criticidade</span><h2>Por prioridade</h2></div></div><div className="priority-summary">{dashboard.byPriority.map(([label, count]) => <div key={label}><span className={`priority-dot priority-dot--${label}`} /><strong>{count}</strong><small>{label}</small></div>)}</div><div className="notice notice--warning"><strong>Atenção operacional</strong><span>{dashboard.openWarning} chamado(s) em alerta e {dashboard.openBreach} com SLA estourado.</span></div></section>
      </div>
    </AppShell>
  );
}
