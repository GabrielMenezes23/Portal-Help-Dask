begin;

alter table public.ticket_comments
  add column if not exists author_name_snapshot text not null default '';

create index if not exists ticket_comments_monday_source_idx
  on public.ticket_comments (ticket_id, source, source_active, source_created_at)
  where source = 'monday';

commit;
