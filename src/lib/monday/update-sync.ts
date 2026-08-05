import 'server-only';

import { readMondayEnv } from '@/lib/env/server-env';
import { createAdminClient } from '@/lib/supabase/admin';

import { mondayRequest } from './client';
import {
  flattenMondayUpdates,
  portalCommentMarkerId,
  type MondayUpdateNode,
  type NormalizedMondayComment,
} from './update-domain';
import { commentDedupeMarker } from './write-model';

const UPDATE_PAGE_SIZE = 100;

const ITEM_UPDATES_QUERY = `
  query ItemUpdates($itemIds: [ID!]!, $limit: Int!, $page: Int!) {
    items(ids: $itemIds) {
      id
      updates(limit: $limit, page: $page) {
        id
        body
        text_body
        created_at
        updated_at
        creator { id name }
        assets { id name url public_url file_extension file_size created_at }
        replies {
          id
          body
          text_body
          created_at
          updated_at
          creator { id name }
          assets { id name url public_url file_extension file_size created_at }
        }
      }
    }
  }
`;

const CREATE_UPDATE_MUTATION = `
  mutation CreatePortalUpdate($itemId: ID!, $body: String!) {
    create_update(item_id: $itemId, body: $body) { id }
  }
`;

function safeDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extensionFromName(name: string): string | null {
  return name.trim().match(/\.([a-zA-Z0-9]{1,12})$/)?.[1]?.toLowerCase() || null;
}

export async function fetchMondayItemUpdates(itemId: string): Promise<MondayUpdateNode[]> {
  const updates: MondayUpdateNode[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const data = await mondayRequest<{
      items: Array<{ id: string; updates: MondayUpdateNode[] }>;
    }>(ITEM_UPDATES_QUERY, {
      itemIds: [itemId],
      limit: UPDATE_PAGE_SIZE,
      page,
    });
    const batch = data.items?.[0]?.updates || [];
    updates.push(...batch);
    if (batch.length < UPDATE_PAGE_SIZE) break;
  }
  return updates;
}

async function findMarkerUpdate(itemId: string, marker: string): Promise<string | null> {
  const updates = flattenMondayUpdates(await fetchMondayItemUpdates(itemId));
  return updates.find((update) => update.body.includes(marker))?.updateId || null;
}

export async function createMondayUpdateForPortalComment(input: {
  ticketId: string;
  commentId: string;
  authorEmail: string;
  message: string;
}): Promise<{ updateId: string | null; error: string | null }> {
  const supabase = createAdminClient();
  const [ticketResult, commentResult] = await Promise.all([
    supabase
      .from('tickets')
      .select('monday_item_id')
      .eq('id', input.ticketId)
      .maybeSingle(),
    supabase
      .from('ticket_comments')
      .select('monday_update_id')
      .eq('id', input.commentId)
      .eq('ticket_id', input.ticketId)
      .maybeSingle(),
  ]);
  if (ticketResult.error || !ticketResult.data?.monday_item_id) {
    return { updateId: null, error: ticketResult.error?.message || 'Chamado ainda não existe no Monday.' };
  }
  if (commentResult.error || !commentResult.data) {
    return { updateId: null, error: commentResult.error?.message || 'Comentário não encontrado.' };
  }
  if (commentResult.data.monday_update_id) {
    return { updateId: String(commentResult.data.monday_update_id), error: null };
  }

  const marker = commentDedupeMarker(input.commentId);
  try {
    const itemId = String(ticketResult.data.monday_item_id);
    const existing = await findMarkerUpdate(itemId, marker);
    const updateId = existing || String(
      (
        await mondayRequest<{ create_update: { id: string } }>(CREATE_UPDATE_MUTATION, {
          itemId,
          body: `${input.authorEmail}\n${input.message || '(anexo enviado pelo portal)'}\n${marker}`,
        })
      ).create_update.id,
    );
    const update = await supabase
      .from('ticket_comments')
      .update({
        monday_update_id: updateId,
        monday_sync_status: 'synced',
        monday_sync_error: null,
        monday_synced_at: new Date().toISOString(),
      })
      .eq('id', input.commentId)
      .eq('ticket_id', input.ticketId);
    if (update.error) throw new Error(update.error.message);
    return { updateId, error: null };
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    await supabase
      .from('ticket_comments')
      .update({ monday_sync_status: 'failed', monday_sync_error: error.slice(0, 1500) })
      .eq('id', input.commentId)
      .eq('ticket_id', input.ticketId);
    return { updateId: null, error };
  }
}

async function persistMondayComment(
  ticketId: string,
  comment: NormalizedMondayComment,
): Promise<string> {
  const supabase = createAdminClient();
  const portalCommentId = portalCommentMarkerId(comment.body);
  if (portalCommentId) {
    const existingPortal = await supabase
      .from('ticket_comments')
      .select('id')
      .eq('id', portalCommentId)
      .eq('ticket_id', ticketId)
      .maybeSingle();
    if (!existingPortal.error && existingPortal.data) {
      await supabase
        .from('ticket_comments')
        .update({
          monday_update_id: comment.updateId,
          monday_parent_update_id: comment.parentUpdateId,
          monday_sync_status: 'synced',
          monday_sync_error: null,
          monday_synced_at: new Date().toISOString(),
          source_updated_at: safeDate(comment.updatedAt),
        })
        .eq('id', portalCommentId);
      return portalCommentId;
    }
  }

  const existing = await supabase
    .from('ticket_comments')
    .select('id')
    .eq('ticket_id', ticketId)
    .eq('monday_update_id', comment.updateId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);

  const payload = {
    author_email_snapshot: '',
    author_name_snapshot: comment.authorName,
    body: comment.body,
    source: 'monday' as const,
    monday_sync_status: 'not_required' as const,
    monday_sync_error: null,
    monday_synced_at: new Date().toISOString(),
    monday_update_id: comment.updateId,
    monday_parent_update_id: comment.parentUpdateId,
    source_active: true,
    source_created_at: safeDate(comment.createdAt),
    source_updated_at: safeDate(comment.updatedAt),
    raw_payload: comment.rawPayload,
    updated_at: new Date().toISOString(),
  };

  if (existing.data) {
    const updated = await supabase
      .from('ticket_comments')
      .update(payload)
      .eq('id', existing.data.id)
      .select('id')
      .single();
    if (updated.error) throw new Error(updated.error.message);
    return String(updated.data.id);
  }

  const inserted = await supabase
    .from('ticket_comments')
    .insert({ ticket_id: ticketId, ...payload })
    .select('id')
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return String(inserted.data.id);
}

async function persistMondayAssets(
  ticketId: string,
  commentId: string,
  comment: NormalizedMondayComment,
): Promise<number> {
  if (comment.assets.length === 0) return 0;
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const rows = comment.assets.map((asset) => {
    const name = String(asset.name || `asset_${asset.id}`).trim();
    return {
      ticket_id: ticketId,
      comment_id: commentId,
      monday_asset_id: String(asset.id),
      file_name: name,
      file_extension: String(asset.file_extension || extensionFromName(name) || '') || null,
      mime_type: null,
      size_bytes: asset.file_size == null ? null : Number(asset.file_size),
      source_url: asset.public_url || asset.url || null,
      source_created_at: safeDate(asset.created_at || null),
      source_active: true,
      last_seen_at: now,
      last_synced_at: now,
      raw_payload: asset,
      upload_source: 'monday' as const,
      monday_sync_status: 'not_required' as const,
      monday_sync_error: null,
      monday_synced_at: now,
    };
  });
  const result = await supabase
    .from('ticket_attachments')
    .upsert(rows, { onConflict: 'ticket_id,monday_asset_id' });
  if (result.error) throw new Error(result.error.message);
  return rows.length;
}

export async function syncMondayItemUpdates(itemId: string): Promise<{
  comments: number;
  attachments: number;
}> {
  const { boardId } = readMondayEnv();
  const supabase = createAdminClient();
  const ticket = await supabase
    .from('tickets')
    .select('id')
    .eq('board_id', boardId)
    .eq('monday_item_id', itemId)
    .maybeSingle();
  if (ticket.error) throw new Error(ticket.error.message);
  if (!ticket.data) throw new Error(`Chamado do item ${itemId} ainda não existe no portal.`);
  const ticketId = String(ticket.data.id);

  const comments = flattenMondayUpdates(await fetchMondayItemUpdates(itemId));
  let attachmentCount = 0;
  for (const comment of comments) {
    const commentId = await persistMondayComment(ticketId, comment);
    attachmentCount += await persistMondayAssets(ticketId, commentId, comment);
  }

  const currentUpdateIds = new Set(comments.map((comment) => comment.updateId));
  const existing = await supabase
    .from('ticket_comments')
    .select('id,monday_update_id')
    .eq('ticket_id', ticketId)
    .eq('source', 'monday')
    .eq('source_active', true);
  if (existing.error) throw new Error(existing.error.message);
  const missingIds = (existing.data || [])
    .filter((row) => row.monday_update_id && !currentUpdateIds.has(String(row.monday_update_id)))
    .map((row) => String(row.id));
  if (missingIds.length > 0) {
    const deactivate = await supabase
      .from('ticket_comments')
      .update({ source_active: false, updated_at: new Date().toISOString() })
      .in('id', missingIds);
    if (deactivate.error) throw new Error(deactivate.error.message);
  }

  await supabase
    .from('tickets')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', ticketId);

  return { comments: comments.length, attachments: attachmentCount };
}
