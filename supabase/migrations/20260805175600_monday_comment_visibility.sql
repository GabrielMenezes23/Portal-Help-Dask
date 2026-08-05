begin;

create or replace function app_private.normalize_monday_comment_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.source = 'monday' and trim(coalesce(new.author_email_snapshot, '')) = '' then
    new.author_email_snapshot := 'monday@integration.local';
  end if;
  return new;
end;
$$;

revoke all on function app_private.normalize_monday_comment_author() from public, anon, authenticated;

drop trigger if exists ticket_comments_normalize_monday_author on public.ticket_comments;
create trigger ticket_comments_normalize_monday_author
  before insert or update of source, author_email_snapshot on public.ticket_comments
  for each row execute function app_private.normalize_monday_comment_author();

drop policy if exists ticket_comments_select_visible_ticket on public.ticket_comments;
create policy ticket_comments_select_visible_ticket
  on public.ticket_comments
  for select
  to authenticated
  using (
    app_private.ticket_is_visible(ticket_id)
    and (source <> 'monday' or source_active = true)
  );

commit;
