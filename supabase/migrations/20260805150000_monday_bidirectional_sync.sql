begin;

create table if not exists public.monday_dropdown_options (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  column_id text not null,
  option_id text not null,
  option_label text not null,
  normalized_label text not null,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monday_dropdown_options_unique unique (board_id, column_id, option_id),
  constraint monday_dropdown_options_label_not_blank check (length(trim(option_label)) > 0),
  constraint monday_dropdown_options_normalized_not_blank check (length(trim(normalized_label)) > 0)
);

create index if not exists monday_dropdown_options_active_label_idx
  on public.monday_dropdown_options (board_id, column_id, normalized_label)
  where is_active = true;

create index if not exists monday_dropdown_options_sync_idx
  on public.monday_dropdown_options (board_id, column_id, synced_at desc);

alter table public.monday_dropdown_options enable row level security;
alter table public.monday_dropdown_options force row level security;

create policy monday_dropdown_options_select_active
  on public.monday_dropdown_options
  for select
  to authenticated
  using (is_active = true);

revoke all on table public.monday_dropdown_options from anon, authenticated;
grant select on table public.monday_dropdown_options to authenticated;
grant select, insert, update, delete on table public.monday_dropdown_options to service_role;

drop trigger if exists monday_dropdown_options_set_updated_at on public.monday_dropdown_options;
create trigger monday_dropdown_options_set_updated_at
  before update on public.monday_dropdown_options
  for each row execute function app_private.set_updated_at();

alter table public.tickets
  add column if not exists opening_responsible_option_id text,
  add column if not exists opening_responsible_name text not null default '';

create index if not exists tickets_opening_responsible_idx
  on public.tickets (opening_responsible_name)
  where opening_responsible_name <> '';

alter table public.ticket_comments
  add column if not exists monday_update_id text,
  add column if not exists monday_parent_update_id text,
  add column if not exists source_active boolean not null default true,
  add column if not exists source_created_at timestamptz,
  add column if not exists source_updated_at timestamptz;

create unique index if not exists ticket_comments_monday_update_unique_idx
  on public.ticket_comments (ticket_id, monday_update_id)
  where monday_update_id is not null;

create index if not exists ticket_comments_source_active_idx
  on public.ticket_comments (ticket_id, source_active, created_at);

commit;
