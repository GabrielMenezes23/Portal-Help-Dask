begin;

create table if not exists public.monday_managed_webhooks (
  event_type text primary key,
  monday_webhook_id text not null unique,
  board_id text not null,
  callback_url text not null,
  active boolean not null default true,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.monday_managed_webhooks enable row level security;
alter table public.monday_managed_webhooks force row level security;

create policy monday_managed_webhooks_select_admin
  on public.monday_managed_webhooks
  for select
  to authenticated
  using (app_private.is_admin());

revoke all on table public.monday_managed_webhooks from anon, authenticated;
grant select on table public.monday_managed_webhooks to authenticated;
grant select, insert, update, delete on table public.monday_managed_webhooks to service_role;

drop trigger if exists monday_managed_webhooks_set_updated_at on public.monday_managed_webhooks;
create trigger monday_managed_webhooks_set_updated_at
  before update on public.monday_managed_webhooks
  for each row execute function app_private.set_updated_at();

commit;
