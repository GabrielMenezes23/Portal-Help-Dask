import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { requireSupport } from '@/lib/auth/current-user';
import { formatDuration, inferTicketOrigin } from '@/lib/executive/analytics';
import {
  EXECUTIVE_PERIODS,
  getExecutiveDashboard,
  parseExecutivePeriod,
  recentCompletedWeeks,
  type ExecutivePeriod,
} from '@/lib/executive/query';

import styles from './executive.module.css';

export const metadata: Metadata = { title: 'Painel Executivo TI' };
export const dynamic = 'force-dynamic';

type Section = 'overview' | 'backlog' | 'performance' | 'demand' | 'origin' | 'satisfaction' | 'base' | 'quality';

const SECTIONS: Array<{ value: Section; label: string }> = [
  { value: 'overview', label: 'Visão Geral' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'performance', label: 'Performance' },
  { value: 'demand', label: 'Demanda' },
  { value: 'origin', label: 'Origem' },
  { value: 'satisfaction', label: 'Satisfação' },
  { value: 'base', label: 'Base' },
  { value: 'quality', label: 'Qualidade' },
];

function parseSection(value: unknown): Section {
  const candidate = String(value ?? 'overview') as Section;
  return SECTIONS.some((section) => section.value === candidate) ? candidate : 'overview';
}

function href(section: Section, period: ExecutivePeriod) {
  return `/admin/executive?section=${section}&period=${period}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

function Metric({ label, value, foot }: { label: string; value: string | number; foot: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{foot}</small></article>;
}

function Bars({ rows, total }: { rows: Array<[string, number]>; total: number }) {
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return <div className={styles.bars}>{rows.map(([label, count]) => (
    <div className={styles.barRow} key={label} title={`${label}: ${count}`}>
      <span>{label}</span>
      <div className={styles.track}><i style={{ width: `${Math.max(2, (count / max) * 100)}%` }} /></div>
      <strong>{count}</strong>
    </div>
  ))}{rows.length === 0 && <span className={styles.caption}>Sem dados no período.</span>}<div className={styles.caption}>{total} registro(s) no universo filtrado.</div></div>;
}

export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; period?: string }>;
}) {
  const { profile } = await requireSupport();
  const params = await searchParams;
  const section = parseSection(params.section);
  const period = parseExecutivePeriod(params.period);
  const dashboard = await getExecutiveDashboard(period);
  const completedWeeks = recentCompletedWeeks(dashboard.weeklyOrigin).slice(-12);
  const lastWeek = completedWeeks.at(-1);
  const previousWeek = completedWeeks.at(-2);
  const maxQuality = Math.max(1, dashboard.totals.total);

  return (
    <AppShell active="executive" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
      <section className="page-heading">
        <div>
          <p className="page-heading__context">Operação TI · Inteligência</p>
          <h1>Painel Executivo</h1>
          <p>Indicadores atualizados diretamente do Supabase após as sincronizações do Monday.</p>
        </div>
        <Link className="button button--ghost" href="/admin/tickets">Abrir chamados</Link>
      </section>

      <div className={styles.toolbar}>
        <nav className={styles.tabs} aria-label="Módulos do Painel Executivo">
          {SECTIONS.map((item) => <Link key={item.value} className={`${styles.tab} ${section === item.value ? styles.active : ''}`} href={href(item.value, period)}>{item.label}</Link>)}
        </nav>
        <nav className={styles.periods} aria-label="Período do Painel Executivo">
          {EXECUTIVE_PERIODS.map((item) => <Link key={item.value} className={`${styles.period} ${period === item.value ? styles.active : ''}`} href={href(section, item.value)}>{item.label}</Link>)}
        </nav>
      </div>

      {section === 'overview' && <>
        <div className={styles.grid4}>
          <Metric label="Chamados" value={dashboard.totals.total} foot="No período selecionado" />
          <Metric label="Backlog" value={dashboard.totals.active} foot="Abertos + em andamento" />
          <Metric label="Resolvidos" value={dashboard.totals.resolved} foot={`${dashboard.totals.resolutionRate}% do período`} />
          <Metric label="Aberturas por usuários" value={`${dashboard.totals.userShare}%`} foot={`${dashboard.totals.users} inferidas como usuário`} />
        </div>
        <div className={styles.grid3}>
          <section className={styles.panel}><h2>Categorias</h2><p>Natureza principal da demanda registrada.</p><Bars rows={dashboard.byCategory.slice(0, 8)} total={dashboard.totals.total} /></section>
          <section className={styles.panel}><h2>Prioridades</h2><p>Classificação informada na abertura.</p><Bars rows={dashboard.byPriority.slice(0, 8)} total={dashboard.totals.total} /></section>
          <section className={styles.panel}><h2>Principais temas</h2><p>Concentração de chamados por tag.</p><Bars rows={dashboard.byTag.slice(0, 8)} total={dashboard.totals.total} /></section>
        </div>
        <div className={styles.grid2}>
          <section className={styles.panel}><h2>Performance de resolução</h2><p>Tempo calendário entre criação e resolução.</p><div className={styles.split}><div><span>No mesmo dia</span><strong>{dashboard.resolution.sameDayPct}%</strong><small>dos resolvidos com duração válida</small></div><div><span>Até 3 dias</span><strong>{dashboard.resolution.within3DaysPct}%</strong><small>dos resolvidos com duração válida</small></div><div><span>Mediana</span><strong>{formatDuration(dashboard.resolution.medianSeconds)}</strong><small>tempo de resolução</small></div><div><span>P90</span><strong>{formatDuration(dashboard.resolution.p90Seconds)}</strong><small>90% resolvidos até aqui</small></div></div></section>
          <section className={styles.panel}><h2>Origem das aberturas</h2><p>Regra histórica inferida pela completude do formulário.</p><div className={styles.split}><div><span>Usuários</span><strong className={styles.good}>{dashboard.totals.users}</strong><small>{dashboard.totals.userShare}% do total</small></div><div><span>TI</span><strong>{dashboard.totals.ti}</strong><small>{(100 - dashboard.totals.userShare).toFixed(1)}% do total</small></div></div><div className={styles.caption}>A origem é inferida; ainda não existe um campo histórico explícito de origem no Monday.</div></section>
        </div>
      </>}

      {section === 'backlog' && <>
        <div className={styles.grid4}>
          <Metric label="Backlog atual" value={dashboard.totals.active} foot="Não resolvidos/cancelados" />
          <Metric label="Até 3 dias" value={dashboard.aging.filter(([bucket]) => bucket === '0-1 dia' || bucket === '2-3 dias').reduce((sum, [, count]) => sum + count, 0)} foot="Chamados recentes" />
          <Metric label="Acima de 14 dias" value={dashboard.aging.filter(([bucket]) => bucket === '15-30 dias' || bucket === '>30 dias').reduce((sum, [, count]) => sum + count, 0)} foot="Atenção de aging" />
          <Metric label="Acima de 30 dias" value={dashboard.aging.find(([bucket]) => bucket === '>30 dias')?.[1] || 0} foot="Backlog envelhecido" />
        </div>
        <div className={styles.grid2}>
          <section className={styles.panel}><h2>Aging do backlog</h2><p>Tempo desde a abertura dos chamados ainda ativos.</p><Bars rows={dashboard.aging} total={dashboard.totals.active} /></section>
          <section className={styles.panel}><h2>Backlog por responsável</h2><p>Volume total do período por responsável; use a base para detalhar o backlog.</p><Bars rows={dashboard.byResponsible} total={dashboard.totals.total} /></section>
        </div>
        <section className={styles.panel}><h2>Chamados ativos mais antigos</h2><p>Fila ordenada pela data de abertura.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Abertura</th><th>Chamado</th><th>Status</th><th>Prioridade</th><th>Responsável</th></tr></thead><tbody>{dashboard.openOldest.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.reference}</strong></td><td>{formatDate(ticket.openedAt)}</td><td>{ticket.title}</td><td>{ticket.status}</td><td>{ticket.priorityRaw || '—'}</td><td>{ticket.responsibleName || '—'}</td></tr>)}</tbody></table></div></section>
      </>}

      {section === 'performance' && <>
        <div className={styles.grid4}>
          <Metric label="Mesmo dia" value={`${dashboard.resolution.sameDayPct}%`} foot="Resolvidos no mesmo dia" />
          <Metric label="Até 3 dias" value={`${dashboard.resolution.within3DaysPct}%`} foot="Resolvidos até 72h" />
          <Metric label="Mediana" value={formatDuration(dashboard.resolution.medianSeconds)} foot="Criação → resolução" />
          <Metric label="P90" value={formatDuration(dashboard.resolution.p90Seconds)} foot="Percentil 90" />
        </div>
        <div className={styles.grid3}>
          <section className={styles.panel}><h2>Tempo médio</h2><p>Média calendário dos chamados resolvidos.</p><div className={styles.split}><div><span>Resolução</span><strong>{formatDuration(dashboard.resolution.averageSeconds)}</strong><small>{dashboard.resolution.resolvedWithDuration} com duração válida</small></div><div><span>Time Tracking TI</span><strong>{formatDuration(dashboard.operationalTime.averageWorkSeconds)}</strong><small>{dashboard.operationalTime.workTracked} com apontamento</small></div></div></section>
          <section className={styles.panel}><h2>Por responsável</h2><p>Volume atendido/atribuído no período.</p><Bars rows={dashboard.byResponsible} total={dashboard.totals.total} /></section>
          <section className={styles.panel}><h2>Por tipo</h2><p>Mix de solicitações no período.</p><Bars rows={dashboard.byType} total={dashboard.totals.total} /></section>
        </div>
        <div className={styles.notice}><strong>Interpretação de tempo</strong>“Criação → resolução” é tempo calendário do ticket. “Time Tracking TI” usa a coluna de apontamento do Monday; são métricas diferentes e não devem ser somadas.</div>
      </>}

      {section === 'demand' && <>
        <div className={styles.grid3}>
          <section className={styles.panel}><h2>Categorias</h2><p>Onde a demanda está concentrada.</p><Bars rows={dashboard.byCategory} total={dashboard.totals.total} /></section>
          <section className={styles.panel}><h2>Tags / sistemas</h2><p>Temas mais recorrentes.</p><Bars rows={dashboard.byTag} total={dashboard.totals.total} /></section>
          <section className={styles.panel}><h2>Solicitantes</h2><p>Usuários com maior volume registrado.</p><Bars rows={dashboard.byRequester} total={dashboard.totals.total} /></section>
        </div>
        <div className={styles.notice}><strong>Leitura para redução de demanda</strong>Priorize documentação, automação e causa raiz nos temas que aparecem repetidamente no topo. O painel apresenta os dados; a decisão de ação permanece com a equipe de TI.</div>
      </>}

      {section === 'origin' && <>
        <div className={styles.grid4}>
          <Metric label="Usuários" value={dashboard.totals.users} foot={`${dashboard.totals.userShare}% das aberturas`} />
          <Metric label="TI" value={dashboard.totals.ti} foot={`${(100 - dashboard.totals.userShare).toFixed(1)}% das aberturas`} />
          <Metric label="Semana passada" value={lastWeek ? `${lastWeek.userPct}%` : '—'} foot={lastWeek ? `${lastWeek.users} de ${lastWeek.total} por usuários` : 'Sem semana completa'} />
          <Metric label="Variação semanal" value={lastWeek && previousWeek ? `${lastWeek.userPct - previousWeek.userPct >= 0 ? '+' : ''}${(lastWeek.userPct - previousWeek.userPct).toFixed(1)} p.p.` : '—'} foot="Participação dos usuários" />
        </div>
        <div className={styles.grid2}>
          <section className={styles.panel}><h2>Participação semanal</h2><p>Semanas completas, de segunda a domingo.</p>{completedWeeks.map((week) => <div className={styles.weekRow} key={week.start}><span>{formatDate(`${week.start}T12:00:00Z`)}</span><div className={styles.shareBar}><i style={{ width: `${week.userPct}%` }} /><i style={{ width: `${week.tiPct}%` }} /></div><span>{week.users} usuário / {week.ti} TI</span><strong>{week.userPct}%</strong></div>)}</section>
          <section className={styles.panel}><h2>Regra de classificação</h2><p>Mantém continuidade com o portal executivo anterior.</p><div className={styles.notice}><strong>Usuário</strong>E-mail, descrição, solicitante, prioridade e tipo preenchidos. Se a prioridade for Alta ou Crítica, a justificativa também precisa estar preenchida.</div><div className={styles.caption}>Qualquer registro fora desse conjunto é classificado como TI. Para novos tickets do portal, a próxima evolução será persistir uma origem explícita em vez de inferir.</div></section>
        </div>
      </>}

      {section === 'satisfaction' && <section className={styles.panel}><h2>Satisfação / NPS</h2><p>Este módulo existia no portal executivo anterior, mas sua fonte é separada da base de tickets.</p><div className={styles.notice}><strong>Fonte ainda não integrada</strong>O Helpdesk não vai calcular um NPS artificial a partir de status ou tempo. A próxima etapa deste módulo é conectar a fonte real da pesquisa de satisfação e então reproduzir NPS geral, mensal e distribuição de notas.</div></section>}

      {section === 'base' && <section className={styles.panel}><h2>Base de tickets</h2><p>50 chamados mais recentes no período. A base completa continua disponível em “Gerenciar chamados”.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Data</th><th>Chamado</th><th>Solicitante</th><th>Status</th><th>Prioridade</th><th>Categoria</th><th>Tema</th><th>Origem</th></tr></thead><tbody>{dashboard.recent.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.reference}</strong></td><td>{formatDate(ticket.openedAt)}</td><td>{ticket.title}</td><td>{ticket.requesterName || '—'}</td><td>{ticket.status}</td><td>{ticket.priorityRaw || '—'}</td><td>{ticket.category || '—'}</td><td>{ticket.tags[0] || '—'}</td><td>{inferTicketOrigin(ticket).origin}</td></tr>)}</tbody></table></div></section>}

      {section === 'quality' && <>
        <div className={styles.grid4}>
          <Metric label="Causa raiz" value={`${dashboard.quality.rootCausePct}%`} foot={`${dashboard.quality.rootCauseFilled} preenchidos`} />
          <Metric label="Fornecedor" value={dashboard.quality.supplierTickets} foot="Com nº de chamado externo" />
          <Metric label="Alta/Crítica" value={dashboard.quality.highCritical} foot="No período" />
          <Metric label="Sem justificativa" value={dashboard.quality.highCriticalMissingJustification} foot="Alta/Crítica sem justificativa" />
        </div>
        <section className={styles.panel}><h2>Completude dos dados</h2><p>Percentual preenchido por campo relevante ao Painel Executivo.</p><div className={styles.bars}>{dashboard.quality.completeness.map((row) => <div className={styles.barRow} key={row.field}><span>{row.field}</span><div className={styles.track}><i style={{ width: `${row.pct}%` }} /></div><strong>{row.pct}%</strong></div>)}</div><div className={styles.caption}>Universo: {maxQuality} ticket(s). Campos vazios são mantidos como lacunas de qualidade, não preenchidos artificialmente.</div></section>
      </>}
    </AppShell>
  );
}
