import 'server-only';

import type { ApiActor } from '@/lib/auth/api-authorization';
import { readNotificationEnv } from '@/lib/env/server-env';
import { createAdminClient } from '@/lib/supabase/admin';

type NotificationRecipient = {
  email: string;
  name: string | null;
};

type PortalTicketNotification = {
  id: string;
  reference: string;
  title: string;
  description: string;
  requesterEmail: string;
  requesterName: string | null;
};

type NotificationDraft = {
  dedupeKey: string;
  eventType: 'ticket_created' | 'ticket_commented';
  ticketId: string;
  commentId?: string;
  recipient: NotificationRecipient;
  subject: string;
  textBody: string;
  htmlBody: string;
};

type OutboxRow = {
  id: string;
  recipient_email: string;
  subject: string;
  text_body: string;
  html_body: string;
  attempts: number;
};

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safePreview(value: string, maxLength = 600): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
}

function getTicketUrl(ticketId: string): string {
  const base = clean(process.env.NEXT_PUBLIC_APP_URL) ||
    (clean(process.env.VERCEL_URL) ? `https://${clean(process.env.VERCEL_URL)}` : '');
  return base ? `${base.replace(/\/+$/, '')}/app/tickets/${ticketId}` : `/app/tickets/${ticketId}`;
}

function renderEmail(input: {
  eventType: NotificationDraft['eventType'];
  ticket: PortalTicketNotification;
  actorEmail: string;
  actorName: string | null;
  message?: string;
  attachmentCount?: number;
}): { subject: string; textBody: string; htmlBody: string } {
  const title = input.ticket.title || 'Chamado sem título';
  const actor = input.actorName || input.actorEmail;
  const link = getTicketUrl(input.ticket.id);
  const isNewTicket = input.eventType === 'ticket_created';
  const subject = `${isNewTicket ? '[Novo chamado]' : '[Novo comentário]'} ${input.ticket.reference} · ${title}`;
  const message = safePreview(input.message || (isNewTicket ? input.ticket.description || 'Chamado aberto pelo portal.' : 'Comentário sem texto.'));
  const attachmentLabel = input.attachmentCount
    ? `Anexos: ${input.attachmentCount}`
    : '';
  const textBody = [
    isNewTicket ? 'Um novo chamado foi aberto no CAF TI Helpdesk.' : 'Um novo comentário foi adicionado ao chamado.',
    '',
    `Protocolo: ${input.ticket.reference}`,
    `Título: ${title}`,
    `Autor: ${actor}`,
    `Mensagem: ${message}`,
    attachmentLabel,
    '',
    `Abrir chamado: ${link}`,
  ].filter(Boolean).join('\n');
  const htmlBody = `<!DOCTYPE html>
<html lang="pt-BR">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
  <body style="margin:0;background:#f4f6fb;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
      <tr><td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e7f0;">
          <tr><td style="padding:28px 32px;background:#11182d;color:#ffffff;font-size:22px;font-weight:700;">CAF TI Helpdesk</td></tr>
          <tr><td style="padding:28px 32px;">
            <p style="margin:0 0 18px;font-size:18px;line-height:1.4;color:#172033;font-weight:700;">${escapeHtml(isNewTicket ? 'Novo chamado aberto' : 'Novo comentário no chamado')}</p>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#5d6a80;"><strong>Protocolo:</strong> ${escapeHtml(input.ticket.reference)}</p>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#5d6a80;"><strong>Título:</strong> ${escapeHtml(title)}</p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#5d6a80;"><strong>Autor:</strong> ${escapeHtml(actor)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f4f6fb;">
              <tr><td style="padding:16px;font-size:15px;line-height:1.5;color:#172033;">${escapeHtml(message)}</td></tr>
            </table>
            ${attachmentLabel ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.5;color:#5d6a80;">${escapeHtml(attachmentLabel)}</p>` : ''}
            <p style="margin:24px 0 0;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#3145a5;color:#ffffff;text-decoration:none;padding:12px 18px;font-size:15px;line-height:1.2;font-weight:700;">Abrir chamado</a></p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  return { subject, textBody, htmlBody };
}

async function listSupportRecipients(actorEmail: string): Promise<NotificationRecipient[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('email,full_name')
    .in('role', ['ti_agent', 'admin'])
    .eq('active', true)
    .order('email');
  if (error) throw new Error(`Falha ao carregar destinatários de notificação: ${error.message}`);
  return (data || [])
    .map((profile) => ({ email: clean(profile.email).toLowerCase(), name: profile.full_name || null }))
    .filter((profile) => profile.email && profile.email !== actorEmail.toLowerCase());
}

async function enqueueAndDeliver(drafts: NotificationDraft[]): Promise<void> {
  if (drafts.length === 0) return;
  readNotificationEnv();
  const supabase = createAdminClient();
  const { error } = await supabase.from('notification_outbox').upsert(
    drafts.map((draft) => ({
      dedupe_key: draft.dedupeKey,
      event_type: draft.eventType,
      ticket_id: draft.ticketId,
      comment_id: draft.commentId || null,
      recipient_email: draft.recipient.email,
      recipient_name: draft.recipient.name,
      subject: draft.subject,
      text_body: draft.textBody,
      html_body: draft.htmlBody,
      status: 'pending',
      last_error: null,
    })),
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  );
  if (error) throw new Error(`Falha ao enfileirar notificação: ${error.message}`);
  await retryPendingNotifications(Math.max(25, drafts.length));
}

async function deliver(row: OutboxRow): Promise<'sent' | 'failed'> {
  const supabase = createAdminClient();
  const attempts = Number(row.attempts || 0) + 1;
  await supabase
    .from('notification_outbox')
    .update({ status: 'sending', attempts, last_error: null })
    .eq('id', row.id);

  try {
    const { apiKey, fromEmail } = readNotificationEnv();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [row.recipient_email],
        subject: row.subject,
        text: row.text_body,
        html: row.html_body,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.text();
    let payload: { id?: string; message?: string } = {};
    try {
      payload = JSON.parse(raw) as { id?: string; message?: string };
    } catch {
      payload = {};
    }
    if (!response.ok || !payload.id) {
      throw new Error(payload.message || `Resend retornou HTTP ${response.status}.`);
    }
    await supabase
      .from('notification_outbox')
      .update({
        status: 'sent',
        provider_message_id: payload.id,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', row.id);
    return 'sent';
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await supabase
      .from('notification_outbox')
      .update({ status: 'failed', last_error: message.slice(0, 1500) })
      .eq('id', row.id);
    return 'failed';
  }
}

export async function retryPendingNotifications(limit = 25): Promise<{
  sent: number;
  failed: number;
  skipped: boolean;
}> {
  try {
    readNotificationEnv();
  } catch {
    return { sent: 0, failed: 0, skipped: true };
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('notification_outbox')
    .select('id,recipient_email,subject,text_body,html_body,attempts')
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(`Falha ao carregar notificações pendentes: ${error.message}`);

  let sent = 0;
  let failed = 0;
  for (const row of data || []) {
    if (await deliver(row as OutboxRow) === 'sent') sent += 1;
    else failed += 1;
  }
  return { sent, failed, skipped: false };
}

export async function notifyTicketCreated(input: {
  actor: ApiActor;
  ticket: PortalTicketNotification;
  attachmentCount: number;
}): Promise<void> {
  const recipients = await listSupportRecipients(input.actor.email);
  const content = renderEmail({
    eventType: 'ticket_created',
    ticket: input.ticket,
    actorEmail: input.actor.email,
    actorName: input.actor.fullName,
    message: input.ticket.description,
    attachmentCount: input.attachmentCount,
  });
  await enqueueAndDeliver(recipients.map((recipient) => ({
    dedupeKey: `ticket-created:${input.ticket.id}:${recipient.email}`,
    eventType: 'ticket_created',
    ticketId: input.ticket.id,
    recipient,
    ...content,
  })));
}

export async function notifyExternalTicketCreated(input: {
  ticket: PortalTicketNotification;
  attachmentCount: number;
}): Promise<void> {
  const recipients = await listSupportRecipients('');
  const content = renderEmail({
    eventType: 'ticket_created',
    ticket: input.ticket,
    actorEmail: input.ticket.requesterEmail || 'monday',
    actorName: input.ticket.requesterName || 'Monday',
    message: input.ticket.description,
    attachmentCount: input.attachmentCount,
  });
  await enqueueAndDeliver(recipients.map((recipient) => ({
    dedupeKey: `ticket-created:${input.ticket.id}:${recipient.email}`,
    eventType: 'ticket_created',
    ticketId: input.ticket.id,
    recipient,
    ...content,
  })));
}

export async function notifyCommentCreated(input: {
  actor: ApiActor;
  ticket: PortalTicketNotification;
  commentId: string;
  message: string;
  attachmentCount: number;
}): Promise<void> {
  const recipients = input.actor.role === 'ti_agent' || input.actor.role === 'admin'
    ? [{ email: input.ticket.requesterEmail.toLowerCase(), name: input.ticket.requesterName }]
    : await listSupportRecipients(input.actor.email);
  const filtered = recipients.filter((recipient) => recipient.email && recipient.email !== input.actor.email.toLowerCase());
  const content = renderEmail({
    eventType: 'ticket_commented',
    ticket: input.ticket,
    actorEmail: input.actor.email,
    actorName: input.actor.fullName,
    message: input.message,
    attachmentCount: input.attachmentCount,
  });
  await enqueueAndDeliver(filtered.map((recipient) => ({
    dedupeKey: `ticket-commented:${input.commentId}:${recipient.email}`,
    eventType: 'ticket_commented',
    ticketId: input.ticket.id,
    commentId: input.commentId,
    recipient,
    ...content,
  })));
}

export async function notifyExternalCommentCreated(input: {
  ticket: PortalTicketNotification;
  commentId: string;
  authorName: string;
  message: string;
  attachmentCount: number;
}): Promise<void> {
  const email = clean(input.ticket.requesterEmail).toLowerCase();
  if (!email) return;

  const recipient = { email, name: input.ticket.requesterName };
  const content = renderEmail({
    eventType: 'ticket_commented',
    ticket: input.ticket,
    actorEmail: 'monday',
    actorName: input.authorName || 'Equipe de TI',
    message: input.message,
    attachmentCount: input.attachmentCount,
  });
  await enqueueAndDeliver([{
    dedupeKey: `ticket-commented:${input.commentId}:${recipient.email}`,
    eventType: 'ticket_commented',
    ticketId: input.ticket.id,
    commentId: input.commentId,
    recipient,
    ...content,
  }]);
}
