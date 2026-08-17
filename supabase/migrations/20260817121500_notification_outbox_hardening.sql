begin;

create index if not exists notification_outbox_comment_idx
  on public.notification_outbox (comment_id)
  where comment_id is not null;

drop policy if exists notification_outbox_service_role on public.notification_outbox;
create policy notification_outbox_service_role
  on public.notification_outbox
  for all to service_role
  using (true)
  with check (true);

commit;
