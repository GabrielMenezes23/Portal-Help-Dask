begin;

create schema if not exists app_private;
revoke all on schema app_private from public;
revoke all on schema app_private from anon;
revoke all on schema app_private from authenticated;
grant usage on schema app_private to authenticated;

do $$
begin
  create type public.app_role as enum ('requester', 'ti_agent', 'admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.app_role not null default 'requester',
  department text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_lowercase check (email = lower(email))
);

comment on table public.profiles is
  'Perfis e papéis internos ligados ao Supabase Auth.';
comment on column public.profiles.role is
  'Autorização controlada pelo banco; não usar user_metadata para decisões de acesso.';

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email));

create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.active = true
        and profile.role = 'admin'::public.app_role
    );
$$;

revoke all on function app_private.is_admin() from public;
revoke all on function app_private.is_admin() from anon;
grant execute on function app_private.is_admin() to authenticated;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    active
  )
  values (
    new.id,
    lower(coalesce(new.email, '')),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'requester'::public.app_role,
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

revoke all on function app_private.handle_new_user() from public;
revoke all on function app_private.handle_new_user() from anon;
revoke all on function app_private.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created_or_email_changed on auth.users;
create trigger on_auth_user_created_or_email_changed
  after insert or update of email on auth.users
  for each row execute function app_private.handle_new_user();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or app_private.is_admin()
  );

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

commit;
