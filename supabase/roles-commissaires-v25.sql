-- NOSTRA GROUP V25 — Nouveaux rôles et accès Commissaires
-- Script réexécutable : il conserve les comptes déjà présents.

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text,
  discord_name text,
  email text,
  avatar_url text,
  rp_first_name text,
  rp_last_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles
  drop constraint if exists member_profiles_role_check;

-- Les anciens rôles sont convertis sans donner d'accès Gérant supplémentaire.
update public.member_profiles
set role = 'employee', updated_at = now()
where role in ('staff', 'administrator');

update public.member_profiles
set role = 'member', updated_at = now()
where role not in ('member', 'employee', 'commercial', 'commissioner', 'manager');

alter table public.member_profiles
  add constraint member_profiles_role_check
  check (role in ('member', 'employee', 'commercial', 'commissioner', 'manager'));

create or replace function public.nostra_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored_role text;
begin
  if public.nostra_jwt_discord_id() = '331843410962939908' then
    return 'manager';
  end if;

  select role into stored_role
  from public.member_profiles
  where user_id = auth.uid();

  if stored_role in ('member', 'employee', 'commercial', 'commissioner', 'manager') then
    return stored_role;
  end if;

  return 'member';
end;
$$;

create or replace function public.has_nostra_dashboard_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nostra_role() = 'manager';
$$;

create or replace function public.is_nostra_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_nostra_dashboard_access();
$$;

grant execute on function public.nostra_role() to authenticated;
grant execute on function public.has_nostra_dashboard_access() to authenticated;
grant execute on function public.is_nostra_manager() to authenticated;

create or replace function public.protect_nostra_member_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_nostra_dashboard_access() then
    new.role := old.role;
  end if;

  if new.discord_id = '331843410962939908' then
    new.role := 'manager';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_nostra_member_role_trigger on public.member_profiles;
create trigger protect_nostra_member_role_trigger
before update on public.member_profiles
for each row execute function public.protect_nostra_member_role();
