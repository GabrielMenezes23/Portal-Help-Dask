import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { MondaySchemaRefreshButton } from '@/components/monday-schema-refresh-button';
import { requireSupport } from '@/lib/auth/current-user';
import { getMondaySchemaOverview } from '@/lib/monday/schema-query';

export const metadata: Metadata = { title: 'Estrutura do Monday' };
export const dynamic = 'force-dynamic';

const MAIN_BOARD_ID = '18389222247';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function mappingLabel(status: string): string {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'probable') return 'Provável';
  if (status === 'ambiguous') return 'Ambíguo';
  return 'Não mapeado';
}

function mappingClass(status: string): string {
  if (status === 'confirmed') return 'tag tag--success';
  if (status === 'ambiguous') return 'tag tag--danger';
  return 'tag';
}

function settingsSummary(settings: Record<string, unknown>): string {
  const keys = Object.keys(settings || {});
  if (!keys.length) return '—';
  return keys.slice(0, 5).join(', ') + (keys.length > 5 ? ` +${keys.length - 5}` : '');
}

export default async function MondaySchemaPage() {
  const { profile } = await requireSupport();
  const overview = await getMondaySchemaOverview();
  const mainColumns = overview.columns.filter((column) => column.boardId === MAIN_BOARD_ID);

  return (
    <AppShell active="integration" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
      <section className="page-heading">
        <div>
          <p className="page-heading__context">Operação TI · Integrações</p>
          <h1>Estrutura do Monday</h1>
          <p>Inventário read-only de boards, grupos, colunas, IDs e relações usados para integrar o Helpdesk e o Painel Executivo.</p>
        </div>
        <div className="page-heading__actions">
          <Link className="button button--ghost" href="/admin/integrations/monday">Voltar para integração</Link>
        </div>
      </section>

      <section className="metrics-grid metrics-grid--five" aria-label="Resumo da estrutura">
        <article className="metric-card"><span>Workspaces</span><strong>{overview.counts.workspaces}</strong><small>Acessíveis pelo token</small></article>
        <article className="metric-card"><span>Boards</span><strong>{overview.counts.boards}</strong><small>{overview.counts.priorityBoards} prioritário(s)</small></article>
        <article className="metric-card"><span>Grupos</span><strong>{overview.counts.groups}</strong><small>Inventariados</small></article>
        <article className="metric-card"><span>Colunas</span><strong>{overview.counts.columns}</strong><small>ID + tipo + settings</small></article>
        <article className="metric-card"><span>Relações</span><strong>{overview.counts.relations}</strong><small>Connect Boards</small></article>
      </section>

      <section className="panel">
        <div className="panel__heading">
          <div><span>Atualização</span><h2>Último inventário</h2></div>
          <span className={`tag ${overview.latestRun?.status === 'succeeded' ? 'tag--success' : ''}`}>
            {overview.latestRun?.status === 'succeeded' ? 'Concluído' : overview.latestRun?.status === 'failed' ? 'Falhou' : overview.latestRun?.status === 'running' ? 'Em execução' : 'Nunca executado'}
          </span>
        </div>
        <p className="panel-copy">
          {overview.latestRun
            ? `Iniciado em ${formatDate(overview.latestRun.startedAt)}${overview.latestRun.finishedAt ? ` · finalizado em ${formatDate(overview.latestRun.finishedAt)}` : ''}.`
            : 'O catálogo ainda está vazio. Execute a primeira descoberta com uma conta administradora.'}
        </p>
        {overview.latestRun?.errorSummary && <div className="notice notice--warning"><strong>Última falha</strong><span>{overview.latestRun.errorSummary}</span></div>}
        <MondaySchemaRefreshButton canRefresh={profile.role === 'admin'} />
        {profile.role !== 'admin' && <div className="notice"><strong>Modo leitura</strong><span>A equipe de TI pode consultar o inventário; somente administradores podem atualizá-lo manualmente.</span></div>}
      </section>

      <section className="panel integration-history">
        <div className="panel__heading"><div><span>Conta Monday</span><h2>Boards encontrados</h2></div></div>
        {overview.boards.length === 0 ? <div className="empty-state">Nenhum board catalogado ainda.</div> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Board</th><th>ID</th><th>Workspace</th><th>Tipo</th><th>Estado</th><th>Relações</th><th>Prioridade</th></tr></thead>
              <tbody>
                {overview.boards.map((board) => (
                  <tr key={board.id}>
                    <td><strong>{board.name}</strong></td>
                    <td><code>{board.id}</code></td>
                    <td>{board.workspaceId || 'Main / não exposto'}</td>
                    <td>{board.kind || '—'}</td>
                    <td>{board.state || '—'}</td>
                    <td>{board.relationCount}</td>
                    <td>{board.isPriority ? <span className="tag tag--success">{board.priorityReason || 'Sim'}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel integration-history">
        <div className="panel__heading"><div><span>Board principal · {MAIN_BOARD_ID}</span><h2>Colunas reais</h2></div><span>{mainColumns.length} coluna(s)</span></div>
        {mainColumns.length === 0 ? <div className="empty-state">Execute o inventário para descobrir os IDs das colunas.</div> : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead><tr><th>Título</th><th>Column ID</th><th>Tipo</th><th>Semântica</th><th>Settings</th></tr></thead>
              <tbody>
                {mainColumns.map((column) => (
                  <tr key={`${column.boardId}:${column.id}`}>
                    <td><strong>{column.title}</strong>{column.archived ? <small> · arquivada</small> : null}</td>
                    <td><code>{column.id}</code></td>
                    <td>{column.type}</td>
                    <td>{column.semanticHint || 'unknown'}</td>
                    <td title={JSON.stringify(column.settings)}>{settingsSummary(column.settings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel integration-history">
        <div className="panel__heading"><div><span>API × Excel × Supabase</span><h2>Mapa Executivo</h2></div><span>36 campos de referência</span></div>
        <p className="panel-copy">Mapeamentos prováveis e ambíguos servem apenas para homologação. Somente IDs confirmados podem entrar no pipeline operacional.</p>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>#</th><th>Campo Excel</th><th>Status</th><th>Column ID</th><th>Tipo</th><th>Campo interno</th></tr></thead>
            <tbody>
              {overview.executiveMap.map((entry) => (
                <tr key={`${entry.excelIndex}:${entry.excelField}`}>
                  <td>{entry.excelIndex + 1}</td>
                  <td><strong>{entry.excelField}</strong>{entry.candidates.length > 1 ? <small> · {entry.candidates.length} candidatos</small> : null}</td>
                  <td><span className={mappingClass(entry.status)}>{mappingLabel(entry.status)}</span></td>
                  <td><code>{entry.columnId || '—'}</code></td>
                  <td>{entry.columnType || '—'}</td>
                  <td><code>{entry.internalField || '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {overview.relations.length > 0 && (
        <section className="panel integration-history">
          <div className="panel__heading"><div><span>Connect Boards</span><h2>Relações encontradas</h2></div></div>
          <div className="table-wrapper"><table className="data-table"><thead><tr><th>Board origem</th><th>Coluna</th><th>Board destino</th><th>Tipo</th><th>Resolvido</th></tr></thead><tbody>{overview.relations.map((relation) => <tr key={`${relation.sourceBoardId}:${relation.sourceColumnId}:${relation.targetBoardId}`}><td><code>{relation.sourceBoardId}</code></td><td><code>{relation.sourceColumnId}</code></td><td><code>{relation.targetBoardId}</code></td><td>{relation.relationType}</td><td>{relation.targetUnresolved ? 'Não' : 'Sim'}</td></tr>)}</tbody></table></div>
        </section>
      )}
    </AppShell>
  );
}
