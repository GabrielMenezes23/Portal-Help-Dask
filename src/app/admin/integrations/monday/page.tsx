import Link from 'next/link';
import type { Metadata } from 'next';

import { AppShell } from '@/components/app-shell';
import { MondaySyncPanel } from '@/components/monday-sync-panel';
import { RetryPendingButton } from '@/components/retry-pending-button';
import { requireAdmin } from '@/lib/auth/current-user';
import { getMondayIntegrationOverview } from '@/lib/monday/overview';

export const metadata: Metadata = { title: 'Integração Monday' };
export const dynamic = 'force-dynamic';

const statusLabels = {
  running: 'Em execução',
  succeeded: 'Concluída',
  failed: 'Falhou',
} as const;

const triggerLabels = {
  manual: 'Manual',
  cron: 'Agendada',
  cli: 'PowerShell/CLI',
  webhook: 'Webhook',
} as const;

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

export default async function MondayIntegrationPage() {
  const { profile } = await requireAdmin();
  const overview = await getMondayIntegrationOverview();
  const manualConfigurationReady =
    overview.configuration.supabaseAdminConfigured &&
    overview.configuration.mondayTokenConfigured &&
    overview.configuration.mondayBoardConfigured;
  const syncDisabled = !manualConfigurationReady || !overview.migrationReady;

  return (
    <AppShell
      active="integration"
      user={{
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
      }}
    >
      <section className="page-heading">
        <div>
          <p className="page-heading__context">Administração · Integrações</p>
          <h1>Monday → Supabase</h1>
          <p>
            O Supabase é a fonte de verdade. Esta integração mantém o Monday atualizado, recebe webhooks e reconcilia os dados sem Google Apps Script, Sheets ou Drive.
          </p>
        </div>
        <div className="page-heading__actions">
          <Link className="button button--ghost" href="/admin/integrations/monday/schema">
            Explorar estrutura do Monday
          </Link>
          <span className={`tag ${syncDisabled ? '' : 'tag--success'}`}>
            {syncDisabled ? 'Configuração pendente' : 'Integração pronta'}
          </span>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Resumo da integração">
        <article className="metric-card">
          <span>Tickets armazenados</span>
          <strong>{overview.ticketCount}</strong>
          <small>Total histórico no Supabase</small>
        </article>
        <article className="metric-card">
          <span>Tickets ativos</span>
          <strong>{overview.activeTicketCount}</strong>
          <small>Encontrados na última execução</small>
        </article>
        <article className="metric-card">
          <span>Anexos catalogados</span>
          <strong>{overview.attachmentCount}</strong>
          <small>Metadados e arquivos no Storage privado</small>
        </article>
        <article className="metric-card">
          <span>Execuções</span>
          <strong>{overview.runs.length}</strong>
          <small>Últimas 10 exibidas</small>
        </article>
      </section>

      <div className="content-grid content-grid--wide-left">
        <section className="panel">
          <div className="panel__heading">
            <div>
              <span>Operação</span>
              <h2>Sincronização completa</h2>
            </div>
          </div>

          <p className="panel-copy">
            A desativação de registros ausentes só acontece depois que todas as
            páginas do Monday e todos os upserts terminam sem erro.
          </p>

          <MondaySyncPanel disabled={syncDisabled} />
          <RetryPendingButton />
          <div className="pending-summary"><span>Chamados pendentes: <b>{overview.pendingTickets}</b></span><span>Comentários pendentes: <b>{overview.pendingComments}</b></span><span>Anexos pendentes: <b>{overview.pendingAttachments}</b></span><span>Webhooks com falha: <b>{overview.failedWebhooks}</b></span></div>

          {overview.loadError && (
            <div className="notice notice--warning">
              <strong>Estrutura da integração ainda não confirmada.</strong>
              <span>
                Aplique o arquivo SQL antes de sincronizar. Detalhe técnico:{' '}
                {overview.loadError}
              </span>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel__heading">
            <div>
              <span>Configuração segura</span>
              <h2>Variáveis do servidor</h2>
            </div>
          </div>

          <div className="configuration-list">
            {[
              ['Supabase secreto', overview.configuration.supabaseAdminConfigured],
              ['Token Monday', overview.configuration.mondayTokenConfigured],
              ['Board Monday', overview.configuration.mondayBoardConfigured],
              ['Grupo padrão', overview.configuration.mondayGroupConfigured],
              ['Segredo do webhook', overview.configuration.mondayWebhookSecretConfigured],
              ['Segredo do cron', overview.configuration.cronSecretConfigured],
            ].map(([label, configured]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <strong className={configured ? 'text-success' : 'text-warning'}>
                  {configured ? 'Configurado' : 'Pendente'}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel integration-history">
        <div className="panel__heading">
          <div>
            <span>Auditoria</span>
            <h2>Últimas execuções</h2>
          </div>
        </div>

        {overview.runs.length === 0 ? (
          <div className="empty-state">
            Nenhuma execução foi registrada no Supabase.
          </div>
        ) : (
          <div className="admin-table" role="table" aria-label="Execuções da integração">
            <div className="admin-table__row admin-table__head integration-row" role="row">
              <span role="columnheader">Início</span>
              <span role="columnheader">Origem</span>
              <span role="columnheader">Estado</span>
              <span role="columnheader">Itens</span>
              <span role="columnheader">Anexos</span>
            </div>
            {overview.runs.map((run) => (
              <div className="admin-table__row integration-row" role="row" key={run.id}>
                <span role="cell">{formatDate(run.startedAt)}</span>
                <span role="cell">{triggerLabels[run.triggerSource]}</span>
                <strong
                  role="cell"
                  className={
                    run.status === 'succeeded'
                      ? 'text-success'
                      : run.status === 'failed'
                        ? 'text-danger'
                        : 'text-warning'
                  }
                  title={run.errorSummary || undefined}
                >
                  {statusLabels[run.status]}
                </strong>
                <span role="cell">{run.itemsUpserted}/{run.itemsReceived}</span>
                <span role="cell">{run.attachmentsUpserted}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
