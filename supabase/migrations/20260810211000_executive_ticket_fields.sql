begin;

alter table public.tickets
  add column if not exists category text not null default '',
  add column if not exists tags_raw text not null default '',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists supplier_ticket text not null default '',
  add column if not exists supplier_link text not null default '',
  add column if not exists secondary_update text not null default '',
  add column if not exists work_time_seconds integer not null default 0 check (work_time_seconds >= 0),
  add column if not exists open_time_seconds integer not null default 0 check (open_time_seconds >= 0),
  add column if not exists hardware_issue text not null default '',
  add column if not exists software_issue text not null default '',
  add column if not exists incident_relation text not null default '',
  add column if not exists service_subtype text not null default '',
  add column if not exists responsible_text text not null default '',
  add column if not exists requester_name_text text not null default '';

create index if not exists tickets_category_active_idx
  on public.tickets (category)
  where source_active = true and category <> '';

create index if not exists tickets_tags_active_gin_idx
  on public.tickets using gin (tags)
  where source_active = true and cardinality(tags) > 0;

create index if not exists tickets_supplier_ticket_active_idx
  on public.tickets (supplier_ticket)
  where source_active = true and supplier_ticket <> '';

commit;
