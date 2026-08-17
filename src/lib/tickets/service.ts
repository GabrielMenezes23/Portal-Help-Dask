import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import type { ApiActor } from '@/lib/auth/api-authorization';
import { writeAuditEvent } from '@/lib/audit';
import { readPortalTicketDefaults } from '@/lib/env/server-env';
import {
  appendMondayUserReply,
  createMondayItem,
  renameMondayItem,
  updateMondayTicketFields,
  uploadMondayFile,
} from '@/lib/monday/client';
import { stripPortalReferenceFromTitle } from '@/lib/monday/domain';
import {
  buildCreateItemColumnValues,
  formatPortalCommentBlock,
  pendingTicketSyncMode,
  shouldUpdateMondayTicketFields,
} from '@/lib/monday/write-model';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  notifyCommentCreated,
  notifyTicketCreated,
  retryPendingNotifications,
} from '@/lib/notifications/service';

import { addBusinessMinutes } from './sla';
import { getSlaPolicy, loadSlaConfiguration } from './sla-config';
import { normalizeManagementText, type ValidNewTicket } from './validation';

const STORAGE_BUCKET = 'ticket-attachments';
const PRIORITY_RAW = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
} as const;

type TicketAccessRow = {
  id: string;
  monday_item_id: string | null;
  requester_user_id: string | null;
  requester_email: string;
  requester_name: string;
  title: string;
  description: string;
  priority_key: ValidNewTicket['priority'];
  priority_justification: string;
  request_type: string;
  opened_at: string;
  portal_reference: string | null;
};

function safeFileName(value: string): string {
  const clean = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 140);
  return clean || 'arquivo';
}

function safeError(cause: unknown): string {
  return (cause instanceof Error ? cause.message : String(cause)).slice(0, 1500);
}

function portalReference(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `CAF-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function canAccessTicket(
  actor: ApiActor,
  ticketId: string,
): Promise<TicketAccessRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tickets')
    .select(
      'id,monday_item_id,requester_user_id,requester_email,requester_name,title,description,priority_key,priority_justification,request_type,opened_at,portal_reference',
    )
    .eq('id', ticketId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao validar o chamado: ${error.message}`);
  if (!data) return null;

  const support = actor.role === 'ti_agent' || actor.role === 'admin';
  const owner =
    data.requester_user_id === actor.userId ||
    String(data.requester_email).toLowerCase() === actor.email.toLowerCase();

  return support || owner ? (data as TicketAccessRow) : null;
}

async function markTicketSync(
  ticketId: string,
  status: 'synced' | 'failed' | 'pending',
  errorMessage: string | null,
  mondayItemId?: string,
): Promise<void> {
  const supabase = createAdminClient();
  const payload: Record<string, unknown> = {
    external_sync_status: status,
    external_sync_error: errorMessage?.slice(0, 1500) ?? null,
  };
  if (mondayItemId) payload.monday_item_id = mondayItemId;

  const { error } = await supabase
    .from('tickets')
    .update(payload)
    .eq('id', ticketId);
  if (error) {
    throw new Error(
      `Falha ao atualizar sincronização do chamado: ${error.message}`,
    );
  }
}

async function createMondayForTicket(ticket: {
  id: string;
  title: string;
  description: string;
  priority_key: ValidNewTicket['priority'];
  priority_justification: string;
  request_type: string;
  requester_email: string;
  opened_at: string;
  portal_reference?: string | null;
  status_bucket?: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  root_cause?: string;
  current_update?: string;
}): Promise<string> {
  const openedDate = new Date(ticket.opened_at).toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  const created = await createMondayItem({
    title: ticket.title,
    columnValues: buildCreateItemColumnValues({
      email: ticket.requester_email,
      openedDate,
      description: ticket.description,
      priority: ticket.priority_key,
      requestType: ticket.request_type,
      justification: ticket.priority_justification,
    }),
  });

  await markTicketSync(ticket.id, 'pending', null, created.id);
  const status = ticket.status_bucket || 'open';
  const rootCause = ticket.root_cause || '';
  const currentUpdate = ticket.current_update || '';
  if (shouldUpdateMondayTicketFields({ status, rootCause, currentUpdate })) {
    await updateMondayTicketFields({
      itemId: created.id,
      status,
      rootCause,
      currentUpdate,
    });
  }
  await markTicketSync(ticket.id, 'synced', null, created.id);
  return created.id;
}

export async function createPortalTicket(input: {
  actor: ApiActor;
  ticket: ValidNewTicket;
  files?: File[];
  requestId?: string;
}) {
  const supabase = createAdminClient();
  const now = new Date();
  const routing = readPortalTicketDefaults();
  const slaConfiguration = await loadSlaConfiguration(supabase);
  const slaPolicy = getSlaPolicy(slaConfiguration, input.ticket.priority);
  const deadline = slaPolicy
    ? addBusinessMinutes(
        now,
        slaPolicy.targetBusinessMinutes,
        slaConfiguration.calendar,
      ).toISOString()
    : null;
  const reference = portalReference(now);

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      board_id: routing.boardId,
      monday_item_id: null,
      title: input.ticket.title,
      group_external_id: routing.defaultGroupId,
      group_name: 'Portal CAF TI',
      status_raw: 'Aberto',
      status_bucket: 'open',
      priority_raw: PRIORITY_RAW[input.ticket.priority],
      priority_key: input.ticket.priority,
      requester_name:
        input.actor.fullName || input.actor.email.split('@')[0],
      requester_email: input.actor.email.toLowerCase(),
      requester_user_id: input.actor.userId,
      responsible_name: '',
      request_type: input.ticket.requestType,
      priority_justification: input.ticket.justification,
      root_cause: '',
      current_update: '',
      description: input.ticket.description,
      user_reply_raw: '',
      opened_at: now.toISOString(),
      source_created_at: now.toISOString(),
      source_updated_at: now.toISOString(),
      source_active: true,
      source_system: 'portal',
      portal_reference: reference,
      created_by_user_id: input.actor.userId,
      external_sync_status: 'pending',
      portal_request_id: input.requestId || null,
      last_activity_at: now.toISOString(),
      sla_deadline: deadline,
      sla_warning_minutes: slaPolicy?.warningMinutes ?? 120,
      raw_payload: { created_from: 'portal' },
    })
    .select(
      'id,monday_item_id,title,description,priority_key,priority_justification,request_type,requester_email,opened_at,portal_reference,status_bucket,root_cause,current_update',
    )
    .single();

  if (error) {
    if (error.code === '23505' && input.requestId) {
      const existing = await supabase
        .from('tickets')
        .select('id,portal_reference,external_sync_status,external_sync_error')
        .eq('portal_request_id', input.requestId)
        .eq('created_by_user_id', input.actor.userId)
        .maybeSingle();
      if (!existing.error && existing.data) {
        return {
          id: String(existing.data.id),
          reference: String(existing.data.portal_reference || ''),
          syncStatus: existing.data.external_sync_status === 'failed' ? 'failed' as const : 'synced' as const,
          syncError: existing.data.external_sync_error,
          attachmentError: null,
        };
      }
    }
    throw new Error(`Não foi possível criar o chamado: ${error.message}`);
  }

  let syncStatus: 'synced' | 'failed' = 'synced';
  let syncError: string | null = null;
  try {
    await createMondayForTicket(
      data as Parameters<typeof createMondayForTicket>[0],
    );
  } catch (cause) {
    syncStatus = 'failed';
    syncError = safeError(cause);
    await markTicketSync(String(data.id), 'failed', syncError);
  }

  let attachmentError: string | null = null;
  if (input.files?.length) {
    try {
      const commentResult = await addPortalComment({
        actor: input.actor,
        ticketId: String(data.id),
        message: 'Anexo enviado na abertura do chamado.',
        files: input.files,
        notify: false,
      });
      attachmentError = commentResult.attachmentError;
    } catch (cause) {
      attachmentError = safeError(cause);
    }
  }

  await writeAuditEvent({
    actor: { userId: input.actor.userId, email: input.actor.email },
    action: 'ticket.create',
    entityType: 'ticket',
    entityId: String(data.id),
    success: true,
    metadata: {
      reference,
      monday_sync_status: syncStatus,
      monday_error: syncError,
      attachment_error: attachmentError,
    },
  });

  try {
    await notifyTicketCreated({
      actor: input.actor,
      ticket: {
        id: String(data.id),
        reference,
        title: String(data.title),
        description: String(data.description),
        requesterEmail: String(data.requester_email),
        requesterName: String(input.actor.fullName || ''),
      },
      attachmentCount: input.files?.length || 0,
    });
  } catch (cause) {
    console.error('Falha ao notificar abertura do chamado.', safeError(cause));
  }

  return {
    id: String(data.id),
    reference,
    syncStatus,
    syncError,
    attachmentError,
  };
}

async function storeAttachment(input: {
  actor: ApiActor;
  ticketId: string;
  commentId: string;
  file: File;
}) {
  const supabase = createAdminClient();
  const bytes = await input.file.arrayBuffer();
  const checksum = createHash('sha256')
    .update(Buffer.from(bytes))
    .digest('hex');
  const fileName = safeFileName(input.file.name);
  const path = `${input.ticketId}/${input.commentId}/${randomUUID()}-${fileName}`;

  const upload = await supabase.storage.from(STORAGE_BUCKET).upload(path, bytes, {
    contentType: input.file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upload.error) {
    throw new Error(
      `Não foi possível armazenar o arquivo: ${upload.error.message}`,
    );
  }

  const { data, error } = await supabase
    .from('ticket_attachments')
    .insert({
      ticket_id: input.ticketId,
      comment_id: input.commentId,
      monday_asset_id: null,
      file_name: input.file.name,
      file_extension: input.file.name.includes('.')
        ? input.file.name.split('.').pop()?.toLowerCase()
        : null,
      mime_type: input.file.type || 'application/octet-stream',
      size_bytes: input.file.size,
      source_url: null,
      source_active: true,
      storage_bucket: STORAGE_BUCKET,
      storage_path: path,
      uploaded_by: input.actor.userId,
      checksum_sha256: checksum,
      upload_source: 'portal',
      monday_sync_status: 'pending',
      raw_payload: { original_name: input.file.name },
    })
    .select('id')
    .single();

  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw new Error(`Não foi possível registrar o arquivo: ${error.message}`);
  }

  return {
    id: String(data.id),
    bytes,
    path,
    fileName: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
  };
}

export async function addPortalComment(input: {
  actor: ApiActor;
  ticketId: string;
  message: string;
  files?: File[];
  notify?: boolean;
}) {
  const ticket = await canAccessTicket(input.actor, input.ticketId);
  if (!ticket) throw new Error('Chamado não encontrado ou sem permissão.');

  const supabase = createAdminClient();
  const files = (input.files || []).filter((file) => file.size > 0);
  const hasFile = files.length > 0;
  const { data: comment, error: commentError } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: input.ticketId,
      author_user_id: input.actor.userId,
      author_email_snapshot: input.actor.email.toLowerCase(),
      body: input.message,
      source: 'portal',
      monday_sync_status: 'pending',
      raw_payload: hasFile && !input.message ? { attachment_only: true } : {},
    })
    .select('id,created_at')
    .single();

  if (commentError) {
    throw new Error(
      `Não foi possível salvar o comentário: ${commentError.message}`,
    );
  }

  const attachments: Array<Awaited<ReturnType<typeof storeAttachment>>> = [];
  const attachmentErrors: string[] = [];
  for (const file of files) {
    try {
      attachments.push(
        await storeAttachment({
          actor: input.actor,
          ticketId: input.ticketId,
          commentId: String(comment.id),
          file,
        }),
      );
    } catch (cause) {
      attachmentErrors.push(`${file.name}: ${safeError(cause)}`);
    }
  }
  const attachmentError = attachmentErrors.length
    ? attachmentErrors.join('; ').slice(0, 1500)
    : null;
  if (attachmentErrors.length && !input.message.trim()) {
    if (attachments.length > 0) {
      await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(attachments.map((attachment) => attachment.path));
      await supabase
        .from('ticket_attachments')
        .delete()
        .in('id', attachments.map((attachment) => attachment.id));
    }
    await supabase.from('ticket_comments').delete().eq('id', comment.id);
    throw new Error(attachmentError || 'Não foi possível armazenar os anexos.');
  }

  let commentSyncError: string | null = null;
  const attachmentSyncErrors: string[] = [];

  if (ticket.monday_item_id) {
    try {
      const block = formatPortalCommentBlock({
        authorEmail: input.actor.email,
        message: input.message,
        commentId: String(comment.id),
        timestamp: new Date(String(comment.created_at)),
      });
      await appendMondayUserReply(
        String(ticket.monday_item_id),
        block,
        String(comment.id),
      );
      await supabase
        .from('ticket_comments')
        .update({
          monday_sync_status: 'synced',
          monday_sync_error: null,
          monday_synced_at: new Date().toISOString(),
        })
        .eq('id', comment.id);
    } catch (cause) {
      commentSyncError = safeError(cause);
      await supabase
        .from('ticket_comments')
        .update({
          monday_sync_status: 'failed',
          monday_sync_error: commentSyncError,
        })
        .eq('id', comment.id);
    }

    for (const attachment of attachments) {
      try {
        const assetId = await uploadMondayFile({
          itemId: String(ticket.monday_item_id),
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          bytes: attachment.bytes,
          attachmentId: attachment.id,
        });
        await supabase
          .from('ticket_attachments')
          .update({
            monday_asset_id: assetId,
            monday_sync_status: 'synced',
            monday_sync_error: null,
            monday_synced_at: new Date().toISOString(),
          })
          .eq('id', attachment.id);
      } catch (cause) {
        const error = safeError(cause);
        attachmentSyncErrors.push(`${attachment.fileName}: ${error}`);
        await supabase
          .from('ticket_attachments')
          .update({
            monday_sync_status: 'failed',
            monday_sync_error: error,
          })
          .eq('id', attachment.id);
      }
    }
  }

  await supabase
    .from('tickets')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', input.ticketId);

  await writeAuditEvent({
    actor: { userId: input.actor.userId, email: input.actor.email },
    action: 'ticket.comment.create',
    entityType: 'ticket',
    entityId: input.ticketId,
    success: true,
    metadata: {
      comment_id: comment.id,
      has_file: hasFile,
      attachment_error: attachmentError,
      monday_comment_error: commentSyncError,
      monday_attachment_error: attachmentSyncErrors.length
        ? attachmentSyncErrors.join('; ').slice(0, 1500)
        : null,
    },
  });

  if (input.notify !== false) {
    try {
      await notifyCommentCreated({
        actor: input.actor,
        ticket: {
          id: input.ticketId,
          reference: String(ticket.portal_reference || ticket.monday_item_id || input.ticketId),
          title: ticket.title,
          description: ticket.description,
          requesterEmail: ticket.requester_email,
          requesterName: ticket.requester_name || null,
        },
        commentId: String(comment.id),
        message: input.message,
        attachmentCount: attachments.length,
      });
    } catch (cause) {
      console.error('Falha ao notificar novo comentário.', safeError(cause));
    }
  }

  return {
    id: String(comment.id),
    syncError: commentSyncError || attachmentSyncErrors.join('; ') || attachmentError,
    attachmentError,
  };
}

export async function retryPendingMondaySync(
  actor:
    | ApiActor
    | { userId: null; email: string; fullName: null; role: 'admin' },
  limit = 25,
) {
  const supabase = createAdminClient();
  const safeLimit = Math.min(100, Math.max(1, limit));
  const results = { tickets: 0, comments: 0, attachments: 0, failures: 0 };

  const { data: portalTickets, error: portalTicketError } = await supabase
    .from('tickets')
    .select('id,monday_item_id,title')
    .eq('source_system', 'portal')
    .eq('source_active', true)
    .not('monday_item_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (portalTicketError) throw new Error(portalTicketError.message);

  for (const ticket of portalTickets || []) {
    const title = stripPortalReferenceFromTitle(String(ticket.title || ''));
    if (!ticket.monday_item_id || !title || title === ticket.title) continue;
    try {
      await renameMondayItem({
        itemId: String(ticket.monday_item_id),
        name: title,
      });
      await supabase
        .from('tickets')
        .update({ title })
        .eq('id', ticket.id);
    } catch (cause) {
      results.failures += 1;
      await supabase
        .from('tickets')
        .update({
          external_sync_status: 'failed',
          external_sync_error: safeError(cause),
        })
        .eq('id', ticket.id);
    }
  }

  const { data: pendingTickets, error: pendingTicketError } = await supabase
    .from('tickets')
    .select(
      'id,monday_item_id,title,description,priority_key,priority_justification,request_type,requester_email,opened_at,portal_reference,status_bucket,root_cause,current_update',
    )
    .in('external_sync_status', ['pending', 'failed'])
    .eq('source_active', true)
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (pendingTicketError) throw new Error(pendingTicketError.message);

  for (const ticket of pendingTickets || []) {
    try {
      if (pendingTicketSyncMode(ticket.monday_item_id) === 'create') {
        await createMondayForTicket(
          ticket as Parameters<typeof createMondayForTicket>[0],
        );
      } else {
        await updateMondayTicketFields({
          itemId: String(ticket.monday_item_id),
          status: ticket.status_bucket as 'open' | 'in_progress' | 'resolved' | 'cancelled',
          rootCause: String(ticket.root_cause || ''),
          currentUpdate: String(ticket.current_update || ''),
        });
        await markTicketSync(String(ticket.id), 'synced', null);
      }
      results.tickets += 1;
    } catch (cause) {
      results.failures += 1;
      await markTicketSync(String(ticket.id), 'failed', safeError(cause));
    }
  }

  const { data: pendingComments, error: pendingCommentError } = await supabase
    .from('ticket_comments')
    .select('id,ticket_id,body,author_email_snapshot,created_at')
    .in('monday_sync_status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (pendingCommentError) throw new Error(pendingCommentError.message);

  for (const comment of pendingComments || []) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('monday_item_id')
      .eq('id', comment.ticket_id)
      .maybeSingle();
    if (!ticket?.monday_item_id) continue;

    try {
      await appendMondayUserReply(
        String(ticket.monday_item_id),
        formatPortalCommentBlock({
          authorEmail: String(comment.author_email_snapshot),
          message: String(comment.body || ''),
          commentId: String(comment.id),
          timestamp: new Date(String(comment.created_at)),
        }),
        String(comment.id),
      );
      await supabase
        .from('ticket_comments')
        .update({
          monday_sync_status: 'synced',
          monday_sync_error: null,
          monday_synced_at: new Date().toISOString(),
        })
        .eq('id', comment.id);
      results.comments += 1;
    } catch (cause) {
      results.failures += 1;
      await supabase
        .from('ticket_comments')
        .update({
          monday_sync_status: 'failed',
          monday_sync_error: safeError(cause),
        })
        .eq('id', comment.id);
    }
  }

  const { data: pendingAttachments, error: pendingAttachmentError } =
    await supabase
      .from('ticket_attachments')
      .select(
        'id,ticket_id,file_name,mime_type,storage_bucket,storage_path',
      )
      .in('monday_sync_status', ['pending', 'failed'])
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(safeLimit);
  if (pendingAttachmentError) throw new Error(pendingAttachmentError.message);

  for (const attachment of pendingAttachments || []) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('monday_item_id')
      .eq('id', attachment.ticket_id)
      .maybeSingle();
    if (
      !ticket?.monday_item_id ||
      !attachment.storage_bucket ||
      !attachment.storage_path
    ) {
      continue;
    }

    try {
      const download = await supabase.storage
        .from(String(attachment.storage_bucket))
        .download(String(attachment.storage_path));
      if (download.error) throw new Error(download.error.message);

      const assetId = await uploadMondayFile({
        itemId: String(ticket.monday_item_id),
        fileName: String(attachment.file_name),
        mimeType: String(
          attachment.mime_type || 'application/octet-stream',
        ),
        bytes: await download.data.arrayBuffer(),
        attachmentId: String(attachment.id),
      });
      await supabase
        .from('ticket_attachments')
        .update({
          monday_asset_id: assetId,
          monday_sync_status: 'synced',
          monday_sync_error: null,
          monday_synced_at: new Date().toISOString(),
        })
        .eq('id', attachment.id);
      results.attachments += 1;
    } catch (cause) {
      results.failures += 1;
      await supabase
        .from('ticket_attachments')
        .update({
          monday_sync_status: 'failed',
          monday_sync_error: safeError(cause),
        })
        .eq('id', attachment.id);
    }
  }

  await writeAuditEvent({
    actor: { userId: actor.userId, email: actor.email },
    action: 'monday.retry_pending',
    entityType: 'integration',
    entityId: 'monday',
    metadata: results,
  });

  const notifications = await retryPendingNotifications();

  return { ...results, notifications };
}

export async function updateTicketManagement(input: {
  actor: ApiActor;
  ticketId: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  rootCause: string;
  currentUpdate: string;
}) {
  if (input.actor.role !== 'ti_agent' && input.actor.role !== 'admin') {
    throw new Error('Acesso restrito à equipe de TI.');
  }

  const supabase = createAdminClient();
  const { data: ticket, error: loadError } = await supabase
    .from('tickets')
    .select('id,monday_item_id')
    .eq('id', input.ticketId)
    .maybeSingle();
  if (loadError || !ticket) throw new Error('Chamado não encontrado.');

  const now = new Date().toISOString();
  const rootCause = normalizeManagementText(input.rootCause);
  const currentUpdate = normalizeManagementText(input.currentUpdate);
  const statusRaw = {
    open: 'Aberto',
    in_progress: 'Em andamento',
    resolved: 'Resolvido',
    cancelled: 'Cancelado',
  }[input.status];

  const { error } = await supabase
    .from('tickets')
    .update({
      status_bucket: input.status,
      status_raw: statusRaw,
      root_cause: rootCause,
      current_update: currentUpdate,
      resolved_at: input.status === 'resolved' ? now : null,
      last_activity_at: now,
      external_sync_status: 'pending',
      external_sync_error: null,
    })
    .eq('id', input.ticketId);
  if (error) throw new Error(`Falha ao atualizar chamado: ${error.message}`);

  let syncError: string | null = null;
  if (ticket.monday_item_id) {
    try {
      await updateMondayTicketFields({
        itemId: String(ticket.monday_item_id),
        status: input.status,
        rootCause,
        currentUpdate,
      });
      await markTicketSync(input.ticketId, 'synced', null);
    } catch (cause) {
      syncError = safeError(cause);
      await markTicketSync(input.ticketId, 'failed', syncError);
    }
  }

  await writeAuditEvent({
    actor: { userId: input.actor.userId, email: input.actor.email },
    action: 'ticket.manage.update',
    entityType: 'ticket',
    entityId: input.ticketId,
    metadata: { status: input.status, monday_error: syncError },
  });

  return { syncError };
}
