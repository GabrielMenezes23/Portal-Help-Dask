import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { AppShell } from '@/components/app-shell';
import { CommentForm } from '@/components/comment-form';
import { formatDateTime, TicketBadges } from '@/components/ticket-ui';
import { TicketManagementForm } from '@/components/ticket-management-form';
import { requireActiveUser } from '@/lib/auth/current-user';
import { getTicketDetail } from '@/lib/tickets/query';

export const metadata: Metadata = { title: 'Detalhes do chamado' };
export const dynamic = 'force-dynamic';

export default async function TicketDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const { profile } = await requireActiveUser();
  const { id } = await params; const query = await searchParams;
  const ticket = await getTicketDetail(id); if (!ticket) notFound();
  return (
    <AppShell active="tickets" user={{ email: profile.email, fullName: profile.fullName, role: profile.role }}>
      {query.created === '1' && <div className="success-banner">Chamado registrado com sucesso. Protocolo: <strong>{ticket.reference}</strong></div>}
      <section className="page-heading"><div><p className="page-heading__context"><Link href="/app/tickets">Chamados</Link> · {ticket.reference}</p><h1>{ticket.title}</h1><TicketBadges ticket={ticket} /></div></section>
      <div className="detail-grid">
        <section className="panel detail-main"><h2>Descrição</h2><p className="preserve-lines">{ticket.description || 'Sem descrição.'}</p>{ticket.priorityJustification && <><h3>Justificativa da prioridade</h3><p>{ticket.priorityJustification}</p></>}{ticket.currentUpdate && <><h3>Atualização da TI</h3><p className="preserve-lines">{ticket.currentUpdate}</p></>}</section>
        <aside className="panel detail-sidebar"><h2>Informações</h2><dl><div><dt>Protocolo</dt><dd>{ticket.reference}</dd></div><div><dt>Solicitante</dt><dd>{ticket.requesterName || ticket.requesterEmail}</dd></div><div><dt>Tipo</dt><dd>{ticket.requestType || '—'}</dd></div><div><dt>Responsável</dt><dd>{ticket.responsibleName || 'Aguardando atribuição'}</dd></div><div><dt>Abertura</dt><dd>{formatDateTime(ticket.openedAt)}</dd></div><div><dt>Prazo SLA</dt><dd>{formatDateTime(ticket.slaDeadline)}</dd></div><div><dt>Monday</dt><dd>{ticket.mondayItemId || ticket.externalSyncStatus}</dd></div></dl></aside>
      </div>
      {(profile.role === 'ti_agent' || profile.role === 'admin') && <section className="panel"><TicketManagementForm ticketId={ticket.id} status={ticket.statusBucket} rootCause={ticket.rootCause} currentUpdate={ticket.currentUpdate} /></section>}
      <section className="panel"><div className="panel__heading"><div><span>Comunicação</span><h2>Comentários</h2></div></div><div className="timeline">{ticket.comments.map((comment) => <article key={comment.id}><div><strong>{comment.authorEmail || 'Sistema'}</strong><small>{formatDateTime(comment.createdAt)} · {comment.source}</small></div><p className="preserve-lines">{comment.body || 'Anexo sem texto.'}</p>{comment.syncStatus !== 'synced' && <span className="sync-note">Sincronização Monday: {comment.syncStatus}</span>}</article>)}{ticket.legacyHistory && ticket.comments.length === 0 && <article className="timeline__legacy"><div><strong>Histórico legado importado</strong></div><p className="preserve-lines">{ticket.legacyHistory}</p></article>}</div><CommentForm ticketId={ticket.id} /></section>
      <section className="panel"><div className="panel__heading"><div><span>Documentos</span><h2>Anexos</h2></div></div>{ticket.attachments.length ? <div className="attachment-list">{ticket.attachments.map((file) => <a key={file.id} href={file.url || '#'} target="_blank" rel="noreferrer" aria-disabled={!file.url}><span>📎</span><div><strong>{file.name}</strong><small>{file.sizeBytes ? `${Math.ceil(file.sizeBytes / 1024)} KB` : 'Tamanho não informado'} · Monday {file.syncStatus}</small></div></a>)}</div> : <div className="empty-state">Nenhum anexo.</div>}</section>
    </AppShell>
  );
}
