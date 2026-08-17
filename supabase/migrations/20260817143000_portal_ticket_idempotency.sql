begin;

alter table public.tickets
  add column if not exists portal_request_id uuid;

create unique index if not exists tickets_portal_request_id_unique_idx
  on public.tickets (portal_request_id)
  where portal_request_id is not null;

commit;
