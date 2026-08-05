import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

import { createMondayUpdateForPortalComment } from './update-sync';

export async function retryPortalCommentUpdates(limit = 25): Promise<{
  synchronized: number;
  failures: number;
}> {
  const supabase = createAdminClient();
  const safeLimit = Math.min(100, Math.max(1, limit));
  const comments = await supabase
    .from('ticket_comments')
    .select('id,ticket_id,body,author_email_snapshot')
    .eq('source', 'portal')
    .is('monday_update_id', null)
    .in('monday_sync_status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (comments.error) throw new Error(comments.error.message);

  const result = { synchronized: 0, failures: 0 };
  for (const comment of comments.data || []) {
    const attempt = await createMondayUpdateForPortalComment({
      ticketId: String(comment.ticket_id),
      commentId: String(comment.id),
      authorEmail: String(comment.author_email_snapshot || 'portal@caf.local'),
      message: String(comment.body || ''),
    });
    if (attempt.error) result.failures += 1;
    else result.synchronized += 1;
  }
  return result;
}
