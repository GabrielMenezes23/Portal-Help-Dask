begin;

-- Política explícita de negação: somente service_role opera esta tabela pelo backend.
drop policy if exists request_rate_limits_deny_authenticated on public.request_rate_limits;
create policy request_rate_limits_deny_authenticated
  on public.request_rate_limits
  for all
  to authenticated
  using (false)
  with check (false);

create index if not exists audit_events_actor_user_id_idx
  on public.audit_events (actor_user_id)
  where actor_user_id is not null;
create index if not exists integration_runs_triggered_by_idx
  on public.integration_runs (triggered_by)
  where triggered_by is not null;
create index if not exists ticket_attachments_comment_id_idx
  on public.ticket_attachments (comment_id)
  where comment_id is not null;
create index if not exists ticket_attachments_uploaded_by_idx
  on public.ticket_attachments (uploaded_by)
  where uploaded_by is not null;
create index if not exists ticket_comments_author_user_id_idx
  on public.ticket_comments (author_user_id)
  where author_user_id is not null;
create index if not exists ticket_status_history_changed_by_idx
  on public.ticket_status_history (changed_by)
  where changed_by is not null;
create index if not exists tickets_created_by_user_id_idx
  on public.tickets (created_by_user_id)
  where created_by_user_id is not null;

commit;
