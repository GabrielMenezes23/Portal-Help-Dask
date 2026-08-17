begin;

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  event_type text not null check (event_type in ('ticket_created', 'ticket_commented')),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  comment_id uuid references public.ticket_comments(id) on delete cascade,
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  text_body text not null,
  html_body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (status, created_at)
  where status in ('pending', 'failed');

create index if not exists notification_outbox_ticket_idx
  on public.notification_outbox (ticket_id, created_at desc);

alter table public.notification_outbox enable row level security;
alter table public.notification_outbox force row level security;
revoke all on table public.notification_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_outbox to service_role;

drop trigger if exists notification_outbox_set_updated_at on public.notification_outbox;
create trigger notification_outbox_set_updated_at
  before update on public.notification_outbox
  for each row execute function app_private.set_updated_at();

commit;
