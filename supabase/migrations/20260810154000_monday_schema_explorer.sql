begin;

do $$
begin
  create type public.monday_schema_run_status as enum ('running', 'succeeded', 'failed');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.monday_schema_trigger_source as enum ('manual', 'cron');
exception when duplicate_object then null;
end $$;

create table if not exists public.monday_schema_runs (
  id uuid primary key default gen_random_uuid(),
  status public.monday_schema_run_status not null default 'running',
  trigger_source public.monday_schema_trigger_source not null,
  triggered_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  workspace_count integer not null default 0 check (workspace_count >= 0),
  board_count integer not null default 0 check (board_count >= 0),
  group_count integer not null default 0 check (group_count >= 0),
  column_count integer not null default 0 check (column_count >= 0),
  relation_count integer not null default 0 check (relation_count >= 0),
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint monday_schema_runs_finished_state check (
    (status = 'running' and finished_at is null)
    or (status in ('succeeded', 'failed') and finished_at is not null)
  )
);

create table if not exists public.monday_workspaces (
  workspace_id text primary key,
  name text not null,
  kind text not null default '',
  state text not null default '',
  description text not null default '',
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  raw_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monday_boards (
  board_id text primary key,
  workspace_id text,
  name text not null,
  board_kind text not null default '',
  state text not null default '',
  url text not null default '',
  source_updated_at timestamptz,
  is_priority boolean not null default false,
  priority_reason text not null default '',
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  raw_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monday_groups (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  group_id text not null,
  title text not null,
  position text not null default '',
  archived boolean not null default false,
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(board_id, group_id)
);

create table if not exists public.monday_columns (
  id uuid primary key default gen_random_uuid(),
  board_id text not null,
  column_id text not null,
  title text not null,
  type text not null,
  description text not null default '',
  settings jsonb not null default '{}'::jsonb,
  revision text not null default '',
  archived boolean not null default false,
  semantic_hint text not null default '',
  internal_field text,
  mapping_status text not null default 'unmapped' check (mapping_status in ('confirmed','probable','ambiguous','unmapped')),
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(board_id, column_id)
);

create table if not exists public.monday_board_relations (
  id uuid primary key default gen_random_uuid(),
  source_board_id text not null,
  source_column_id text not null,
  target_board_id text not null,
  relation_type text not null,
  target_unresolved boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_run_id uuid references public.monday_schema_runs(id) on delete set null,
  source_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_board_id, source_column_id, target_board_id)
);

create index if not exists monday_schema_runs_started_idx on public.monday_schema_runs(started_at desc);
create index if not exists monday_boards_priority_name_idx on public.monday_boards(is_priority desc, name);
create index if not exists monday_columns_board_type_idx on public.monday_columns(board_id, type);
create index if not exists monday_columns_board_hint_idx on public.monday_columns(board_id, semantic_hint);
create index if not exists monday_board_relations_source_idx on public.monday_board_relations(source_board_id, source_column_id);

create or replace trigger monday_workspaces_set_updated_at
  before update on public.monday_workspaces
  for each row execute function app_private.set_updated_at();
create or replace trigger monday_boards_set_updated_at
  before update on public.monday_boards
  for each row execute function app_private.set_updated_at();
create or replace trigger monday_groups_set_updated_at
  before update on public.monday_groups
  for each row execute function app_private.set_updated_at();
create or replace trigger monday_columns_set_updated_at
  before update on public.monday_columns
  for each row execute function app_private.set_updated_at();
create or replace trigger monday_board_relations_set_updated_at
  before update on public.monday_board_relations
  for each row execute function app_private.set_updated_at();

alter table public.monday_schema_runs enable row level security;
alter table public.monday_schema_runs force row level security;
alter table public.monday_workspaces enable row level security;
alter table public.monday_workspaces force row level security;
alter table public.monday_boards enable row level security;
alter table public.monday_boards force row level security;
alter table public.monday_groups enable row level security;
alter table public.monday_groups force row level security;
alter table public.monday_columns enable row level security;
alter table public.monday_columns force row level security;
alter table public.monday_board_relations enable row level security;
alter table public.monday_board_relations force row level security;

drop policy if exists monday_schema_runs_select_support on public.monday_schema_runs;
create policy monday_schema_runs_select_support
  on public.monday_schema_runs for select to authenticated
  using (app_private.has_support_access());
drop policy if exists monday_workspaces_select_support on public.monday_workspaces;
create policy monday_workspaces_select_support
  on public.monday_workspaces for select to authenticated
  using (app_private.has_support_access());
drop policy if exists monday_boards_select_support on public.monday_boards;
create policy monday_boards_select_support
  on public.monday_boards for select to authenticated
  using (app_private.has_support_access());
drop policy if exists monday_groups_select_support on public.monday_groups;
create policy monday_groups_select_support
  on public.monday_groups for select to authenticated
  using (app_private.has_support_access());
drop policy if exists monday_columns_select_support on public.monday_columns;
create policy monday_columns_select_support
  on public.monday_columns for select to authenticated
  using (app_private.has_support_access());
drop policy if exists monday_board_relations_select_support on public.monday_board_relations;
create policy monday_board_relations_select_support
  on public.monday_board_relations for select to authenticated
  using (app_private.has_support_access());

revoke all on table public.monday_schema_runs from anon, authenticated;
revoke all on table public.monday_workspaces from anon, authenticated;
revoke all on table public.monday_boards from anon, authenticated;
revoke all on table public.monday_groups from anon, authenticated;
revoke all on table public.monday_columns from anon, authenticated;
revoke all on table public.monday_board_relations from anon, authenticated;

grant select on table public.monday_schema_runs to authenticated;
grant select on table public.monday_workspaces to authenticated;
grant select on table public.monday_boards to authenticated;
grant select on table public.monday_groups to authenticated;
grant select on table public.monday_columns to authenticated;
grant select on table public.monday_board_relations to authenticated;

grant select, insert, update, delete on table public.monday_schema_runs to service_role;
grant select, insert, update, delete on table public.monday_workspaces to service_role;
grant select, insert, update, delete on table public.monday_boards to service_role;
grant select, insert, update, delete on table public.monday_groups to service_role;
grant select, insert, update, delete on table public.monday_columns to service_role;
grant select, insert, update, delete on table public.monday_board_relations to service_role;

commit;
