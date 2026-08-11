import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { requireSupport } from '@/lib/auth/current-user';
import { formatDuration, inferTicketOrigin, isDependencyStatus, ticketAgeDays } from '@/lib/executive/analytics';
import { buildExecutiveParity } from '@/lib/executive/parity';
import {
  EXECUTIVE_PERIODS,
  getExecutiveDashboard,
  parseExecutivePeriod,
  recentCompletedWeeks,
  type ExecutivePeriod,
  type ExecutiveTicket,
} from '@/lib/executive/query';
import { ExecutiveCsvButton, TicketDetailButton } from './executive-client';
import styles from './executive.module.css';
import parityStyles from './executive-parity.module.css';

export const metadata: Metadata = { title: 'Painel Executivo TI' };
export const dynamic = 'force-dynamic';

type Section = 'overview' | 'backlog' | 'performance' | 'demand' | 'origin' | 'satisfaction' | 'base' | 'quality';
type OriginTab = 'summary' | 'ti' | 'share' | 'users';
type NpsTab = 'general' | 'monthly';

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

function parseOriginTab(value: unknown): OriginTab {
  const candidate = String(value ?? 'summary') as OriginTab;
  return ['summary', 'ti', 'share', 'users'].includes(candidate) ? candidate : 'summary';
}

function parseNpsTab(value: unknown): NpsTab {
  return String(value ?? 'general') === 'monthly' ? 'monthly' : 'general';
}

function href(section: Section, period: ExecutivePeriod) {
  return `/admin/executive?section=${section}&period=${period}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

function Metric({ label, value, foot }: { label: string; value: string | number; foot: string }) {
  return <article className={styles.metric}><span>{label}</span><strong>{value}</strong><small>{foot}</small></article>;
}

function Bars({ rows, total }: { rows: Array<[string, number]>; total: number }) {
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return <div className={styles.bars}>{rows.map(([label, count]) => (
    <div className={styles.barRow} key={label} title={`${label}: ${count}`}>
      <span>{label}</span><div className={styles.track}><i style={{ width: `${Math.max(2, (count / max) * 100)}%` }} /></div><strong>{count}</strong>
    </div>
  ))}{rows.length === 0 && <span className={styles.caption}>Sem dados no período.</span>}<div className={styles.caption}>{total} registro(s) no universo filtrado.</div></div>;
}

function TicketRows({ tickets, limit = 20 }: { tickets: ExecutiveTicket[]; limit?: number }) {
  return <tbody>{tickets.slice(0, limit).map((ticket) => <tr key={ticket.id}>
    <td><TicketDetailButton ticket={ticket} /></td><td>{formatDate(ticket.openedAt)}</td><td>{ticket.title}</td><td>{ticket.status}</td><td>{ticket.priorityRaw || '—'}</td><td>{ticket.requesterName || '—'}</td><td>{ticket.responsibleName || '—'}</td>
  </tr>)}</tbody>;
}

export default async function ExecutiveView({ searchParams }: { searchParams: Promise<{ section?: string; period?: string; originTab?: string; npsTab?: string }> }) {
  const { profile } = await requireSupport();
  const params = await searchParams;
  const section = parseSection(params.section);
  const period = parseExecutivePeriod(params.period);
  const originTab = parseOriginTab(params.originTab);
  const npsTab = parseNpsTab(params.npsTab);
  const dashboard = await getExecutiveDashboard(period);
  const parity = buildExecutiveParity(dashboard.tickets);
  const completedWeeks = recentCompletedWeeks(dashboard.weeklyOrigin).slice(-12);
  const lastWeek = completedWeeks.at(-1);
  const previousWeek = completedWeeks.at(-2);

  return <AppShell active="executive" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
    <section className="page-heading"><div><p className="page-heading__context">Operação TI · Inteligência</p><h1>Painel Executivo</h1><p>Indicadores calculados a partir do Supabase após as sincronizações do Monday.</p></div><Link className="button button--ghost" href="/admin/tickets">Abrir chamados</Link></section>

    <div className={styles.toolbar}>
      <nav className={styles.tabs} aria-label="Módulos do Painel Executivo">{SECTIONS.map((item) => <Link key={item.value} className={`${styles.tab} ${section === item.value ? styles.active : ''}`} href={href(item.value, period)}>{item.label}</Link>)}</nav>
      <nav className={styles.periods} aria-label="Período">{EXECUTIVE_PERIODS.map((item) => <Link key={item.value} className={`${styles.period} ${period === item.value ? styles.active : ''}`} href={href(section, item.value)}>{item.label}</Link>)}</nav>
    </div>

    {section === 'overview' && <>
      <div className={styles.grid4}><Metric label="Chamados" value={dashboard.totals.total} foot="No período" /><Metric label="Backlog" value={dashboard.totals.active} foot="Ativos" /><Metric label="Resolvidos" value={dashboard.totals.resolved} foot={`${dashboard.totals.resolutionRate}% do período`} /><Metric label="Usuários" value={`${dashboard.totals.userShare}%`} foot={`${dashboard.totals.users} aberturas inferidas`} /></div>
      <div className={styles.grid2}>
        <section className={styles.panel}><h2>CEO briefing</h2><p>Leitura automática e determinística dos principais sinais do período.</p><div className={parityStyles.briefing}>{parity.briefing.map((item) => <div className={parityStyles.briefingItem} key={item}>{item}</div>)}</div></section>
        <section className={styles.panel}><h2>Performance de resolução</h2><p>Tempo calendário entre criação e resolução.</p><div className={styles.split}><div><span>Mesmo dia</span><strong>{dashboard.resolution.sameDayPct}%</strong><small>dos resolvidos</small></div><div><span>Até 3 dias</span><strong>{dashboard.resolution.within3DaysPct}%</strong><small>dos resolvidos</small></div><div><span>Mediana</span><strong>{formatDuration(dashboard.resolution.medianSeconds)}</strong><small>tempo de resolução</small></div><div><span>P90</span><strong>{formatDuration(dashboard.resolution.p90Seconds)}</strong><small>percentil 90</small></div></div></section>
      </div>
      <div className={styles.grid3}><section className={styles.panel}><h2>Categorias</h2><Bars rows={dashboard.byCategory.slice(0,8)} total={dashboard.totals.total} /></section><section className={styles.panel}><h2>Prioridades</h2><Bars rows={dashboard.byPriority.slice(0,8)} total={dashboard.totals.total} /></section><section className={styles.panel}><h2>Principais temas</h2><Bars rows={dashboard.byTag.slice(0,8)} total={dashboard.totals.total} /></section></div>
      <section className={styles.panel}><h2>Tickets que exigem atenção</h2><p>Priorização por criticidade, dependência e envelhecimento.</p><div className={parityStyles.attention}>{parity.attention.slice(0,10).map(({ ticket, ageDays, dependency }) => <div className={parityStyles.attentionRow} key={ticket.id}><TicketDetailButton ticket={ticket} /><strong>{ticket.title}</strong><span>{ticket.priorityRaw || '—'}</span><span className={dependency ? parityStyles.dependency : ''}>{dependency ? 'Dependência' : ticket.status}</span><span>{ageDays ?? '—'} d</span></div>)}</div></section>
    </>}

    {section === 'backlog' && <>
      <div className={styles.grid4}><Metric label="Backlog atual" value={dashboard.totals.active} foot="Não resolvidos/cancelados" /><Metric label="Em execução" value={parity.executable} foot="Sem sinal de espera" /><Metric label="Dependências" value={parity.dependencies.length} foot="Bloqueado/aguardando/pendente" /><Metric label="> 30 dias" value={dashboard.aging.find(([bucket]) => bucket === '>30 dias')?.[1] || 0} foot="Backlog envelhecido" /></div>
      <div className={styles.grid3}><section className={styles.panel}><h2>Aging do backlog</h2><Bars rows={dashboard.aging} total={dashboard.totals.active} /></section><section className={styles.panel}><h2>Status e dependências</h2><Bars rows={parity.backlogByStatus} total={dashboard.totals.active} /></section><section className={styles.panel}><h2>Backlog por responsável</h2><Bars rows={parity.backlogByResponsible} total={dashboard.totals.active} /></section></div>
      <section className={styles.panel}><h2>Fila completa do backlog</h2><p>Ordenada da abertura mais antiga para a mais recente.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Abertura</th><th>Chamado</th><th>Status</th><th>Prioridade</th><th>Idade</th><th>Solicitante</th><th>Responsável</th><th>Dependência</th></tr></thead><tbody>{parity.active.sort((a,b)=>String(a.openedAt||'').localeCompare(String(b.openedAt||''))).map((ticket)=><tr key={ticket.id}><td><TicketDetailButton ticket={ticket}/></td><td>{formatDate(ticket.openedAt)}</td><td>{ticket.title}</td><td>{ticket.status}</td><td>{ticket.priorityRaw||'—'}</td><td>{ticketAgeDays(ticket.openedAt) ?? '—'} d</td><td>{ticket.requesterName||'—'}</td><td>{ticket.responsibleName||'—'}</td><td>{isDependencyStatus(ticket.status)?'Sim':'Não'}</td></tr>)}</tbody></table></div></section>
    </>}

    {section === 'performance' && <>
      <div className={styles.grid4}><Metric label="Mesmo dia" value={`${dashboard.resolution.sameDayPct}%`} foot="Resolvidos no mesmo dia" /><Metric label="Até 3 dias" value={`${dashboard.resolution.within3DaysPct}%`} foot="Resolvidos até 72h" /><Metric label="Mediana" value={formatDuration(dashboard.resolution.medianSeconds)} foot="Criação → resolução" /><Metric label="P90" value={formatDuration(dashboard.resolution.p90Seconds)} foot="Percentil 90" /></div>
      <div className={styles.grid3}><section className={styles.panel}><h2>Distribuição do tempo</h2><Bars rows={parity.cycleDistribution} total={dashboard.totals.resolved} /></section><section className={styles.panel}><h2>Prioridade x situação</h2><Bars rows={parity.prioritySituation} total={dashboard.totals.total} /></section><section className={styles.panel}><h2>Time Tracking TI</h2><div className={styles.split}><div><span>Média apontada</span><strong>{formatDuration(dashboard.operationalTime.averageWorkSeconds)}</strong><small>{dashboard.operationalTime.workTracked} ticket(s)</small></div><div><span>Tempo aberto</span><strong>{formatDuration(dashboard.operationalTime.averageOpenTrackingSeconds)}</strong><small>{dashboard.operationalTime.openTracked} ticket(s)</small></div></div></section></div>
      <PerformanceTable title="Desempenho por tipo" rows={parity.performanceByType} />
      <PerformanceTable title="Desempenho por responsável" rows={parity.performanceByResponsible} />
    </>}

    {section === 'demand' && <>
      <div className={styles.grid3}><section className={styles.panel}><h2>Categorias</h2><Bars rows={dashboard.byCategory} total={dashboard.totals.total}/></section><section className={styles.panel}><h2>Tags / sistemas</h2><Bars rows={dashboard.byTag} total={dashboard.totals.total}/></section><section className={styles.panel}><h2>Solicitantes</h2><Bars rows={dashboard.byRequester} total={dashboard.totals.total}/></section></div>
      <div className={styles.grid3}><section className={styles.panel}><h2>Tipos</h2><Bars rows={dashboard.byType} total={dashboard.totals.total}/></section><section className={styles.panel}><h2>Prioridades</h2><Bars rows={dashboard.byPriority} total={dashboard.totals.total}/></section><section className={styles.panel}><h2>Causas raiz</h2><Bars rows={parity.byRootCause} total={dashboard.totals.total}/></section></div>
      <section className={styles.panel}><h2>Insights para decisão</h2><p>Leituras baseadas somente nos dados estruturados do período.</p><div className={parityStyles.insightGrid}><div className={parityStyles.insight}>Temas recorrentes no topo de Tags/Categorias são candidatos a documentação, automação ou ação de causa raiz.</div><div className={parityStyles.insight}>Compare Causa Raiz com Tipo e Prioridade para separar volume repetitivo de impacto operacional.</div><div className={parityStyles.insight}>Solicitantes com concentração elevada podem indicar necessidade de treinamento, melhoria de processo ou problema sistêmico local.</div><div className={parityStyles.insight}>A distribuição de prioridades deve ser confrontada com tempo de ciclo para verificar se criticidade está sendo refletida na velocidade do atendimento.</div></div></section>
    </>}

    {section === 'origin' && <>
      <nav className={parityStyles.subtabs}><Link className={`${parityStyles.subtab} ${originTab==='summary'?parityStyles.subtabActive:''}`} href={`/admin/executive?section=origin&period=${period}&originTab=summary`}>Resumo</Link><Link className={`${parityStyles.subtab} ${originTab==='ti'?parityStyles.subtabActive:''}`} href={`/admin/executive?section=origin&period=${period}&originTab=ti`}>Abertos pela TI</Link><Link className={`${parityStyles.subtab} ${originTab==='share'?parityStyles.subtabActive:''}`} href={`/admin/executive?section=origin&period=${period}&originTab=share`}>% de aberturas</Link><Link className={`${parityStyles.subtab} ${originTab==='users'?parityStyles.subtabActive:''}`} href={`/admin/executive?section=origin&period=${period}&originTab=users`}>Abertos pelos usuários</Link></nav>
      {originTab==='summary' && <><div className={styles.grid4}><Metric label="Usuários" value={dashboard.totals.users} foot={`${dashboard.totals.userShare}% das aberturas`}/><Metric label="TI" value={dashboard.totals.ti} foot={`${(100-dashboard.totals.userShare).toFixed(1)}% das aberturas`}/><Metric label="Semana passada" value={lastWeek?`${lastWeek.userPct}%`:'—'} foot="Participação usuários"/><Metric label="Variação semanal" value={lastWeek&&previousWeek?`${lastWeek.userPct-previousWeek.userPct>=0?'+':''}${(lastWeek.userPct-previousWeek.userPct).toFixed(1)} p.p.`:'—'} foot="Usuários vs semana anterior"/></div><div className={styles.grid2}><section className={styles.panel}><h2>Usuários: principais solicitantes</h2><Bars rows={parity.origin.userRequesters} total={parity.origin.userTickets.length}/></section><section className={styles.panel}><h2>TI: principais temas</h2><Bars rows={parity.origin.tiTags} total={parity.origin.tiTickets.length}/></section></div></>}
      {originTab==='ti' && <><div className={styles.grid2}><section className={styles.panel}><h2>Principais temas</h2><Bars rows={parity.origin.tiTags} total={parity.origin.tiTickets.length}/></section><section className={styles.panel}><h2>Solicitantes registrados</h2><Bars rows={parity.origin.tiRequesters} total={parity.origin.tiTickets.length}/></section></div><section className={styles.panel}><h2>Últimos chamados abertos pela TI</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Data</th><th>Chamado</th><th>Status</th><th>Prioridade</th><th>Solicitante</th><th>Responsável</th></tr></thead><TicketRows tickets={parity.origin.tiTickets}/></table></div></section></>}
      {originTab==='users' && <><div className={styles.grid2}><section className={styles.panel}><h2>Principais solicitantes</h2><Bars rows={parity.origin.userRequesters} total={parity.origin.userTickets.length}/></section><section className={styles.panel}><h2>Principais temas</h2><Bars rows={parity.origin.userTags} total={parity.origin.userTickets.length}/></section></div><section className={styles.panel}><h2>Últimos chamados abertos pelos usuários</h2><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Data</th><th>Chamado</th><th>Status</th><th>Prioridade</th><th>Solicitante</th><th>Responsável</th></tr></thead><TicketRows tickets={parity.origin.userTickets}/></table></div></section></>}
      {originTab==='share' && <section className={styles.panel}><h2>Histórico semanal de aberturas</h2><p>Semanas completas de segunda a domingo.</p><div className={styles.tableWrap}><table className={parityStyles.weeklyTable}><thead><tr><th>Semana</th><th>Total</th><th>Usuários</th><th>% usuários</th><th>TI</th><th>% TI</th><th>Variação usuários</th></tr></thead><tbody>{completedWeeks.map((week,index)=>{const prev=completedWeeks[index-1];const variation=prev?week.userPct-prev.userPct:null;return <tr key={week.start}><td>{formatDate(`${week.start}T12:00:00Z`)}</td><td>{week.total}</td><td>{week.users}</td><td>{week.userPct}%</td><td>{week.ti}</td><td>{week.tiPct}%</td><td>{variation==null?'—':`${variation>=0?'+':''}${variation.toFixed(1)} p.p.`}</td></tr>})}</tbody></table></div></section>}
    </>}

    {section === 'satisfaction' && <><nav className={parityStyles.subtabs}><Link className={`${parityStyles.subtab} ${npsTab==='general'?parityStyles.subtabActive:''}`} href={`/admin/executive?section=satisfaction&period=${period}&npsTab=general`}>NPS Geral</Link><Link className={`${parityStyles.subtab} ${npsTab==='monthly'?parityStyles.subtabActive:''}`} href={`/admin/executive?section=satisfaction&period=${period}&npsTab=monthly`}>NPS Mensal</Link></nav><section className={styles.panel}><h2>{npsTab==='general'?'NPS geral':'NPS por mês'}</h2><p>O módulo está preservado no novo painel, mas exige a fonte real da pesquisa de satisfação.</p><div className={parityStyles.sourceState}><strong>Fonte de satisfação ainda não conectada</strong><span>Não calculamos NPS a partir de status, prazo ou volume de tickets. Assim que a base real for integrada, esta aba receberá NPS, promotores, neutros, detratores, respostas e evolução mensal.</span></div></section></>}

    {section === 'base' && <section className={styles.panel}><div className={parityStyles.tableActions}><ExecutiveCsvButton tickets={dashboard.tickets}/></div><h2>Base completa de tickets</h2><p>{dashboard.tickets.length} registro(s) ativos no período selecionado. Clique no número do ticket para abrir todos os detalhes estruturados.</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Ticket</th><th>Data</th><th>Chamado</th><th>Status</th><th>Prioridade</th><th>Tipo</th><th>Categoria</th><th>Solicitante</th><th>Responsável</th><th>Origem</th></tr></thead><tbody>{[...dashboard.tickets].sort((a,b)=>String(b.openedAt||'').localeCompare(String(a.openedAt||''))).map((ticket)=><tr key={ticket.id}><td><TicketDetailButton ticket={ticket}/></td><td>{formatDate(ticket.openedAt)}</td><td>{ticket.title}</td><td>{ticket.status}</td><td>{ticket.priorityRaw||'—'}</td><td>{ticket.requestType||'—'}</td><td>{ticket.category||'—'}</td><td>{ticket.requesterName||'—'}</td><td>{ticket.responsibleName||'—'}</td><td>{inferTicketOrigin(ticket).origin}</td></tr>)}</tbody></table></div></section>}

    {section === 'quality' && <><div className={styles.grid4}><Metric label="Causa raiz" value={`${dashboard.quality.rootCausePct}%`} foot={`${dashboard.quality.rootCauseFilled} preenchidos`}/><Metric label="Alta/Crítica" value={dashboard.quality.highCritical} foot="No período"/><Metric label="Sem justificativa" value={dashboard.quality.highCriticalMissingJustification} foot="Alta/Crítica sem justificativa"/><Metric label="Chamados fornecedor" value={dashboard.quality.supplierTickets} foot="Com referência externa"/></div><section className={styles.panel}><h2>Completude dos dados</h2><p>Percentual preenchido dos principais campos usados pelos indicadores.</p><div className={parityStyles.matrix}>{dashboard.quality.completeness.map((item)=><div className={parityStyles.matrixItem} key={item.field}><span>{item.field}</span><strong>{item.pct}%</strong><small>{item.filled} preenchido(s) · {item.missing} ausente(s)</small></div>)}</div></section></>}
  </AppShell>;
}

function PerformanceTable({ title, rows }: { title: string; rows: ReturnType<typeof buildExecutiveParity>['performanceByType'] }) {
  return <section className={styles.panel} style={{ marginBottom: 18 }}><h2>{title}</h2><p>Volume, backlog e velocidade de resolução.</p><div className={styles.tableWrap}><table className={parityStyles.performanceTable}><thead><tr><th>Grupo</th><th>Total</th><th>Resolvidos</th><th>Backlog</th><th>Mesmo dia</th><th>Até 3 dias</th><th>Mediana</th><th>Média</th></tr></thead><tbody>{rows.map((row)=><tr key={row.label}><td>{row.label}</td><td>{row.total}</td><td>{row.resolved}</td><td>{row.backlog}</td><td>{row.sameDayPct}%</td><td>{row.within3DaysPct}%</td><td>{formatDuration(row.medianSeconds)}</td><td>{formatDuration(row.averageSeconds)}</td></tr>)}</tbody></table></div></section>;
}
