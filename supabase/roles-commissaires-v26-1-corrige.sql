-- NOSTRA GROUP V26.1 — Correctif rôles multiples + planning commissaires + rapports d'incident
-- Script réexécutable : il conserve les comptes et les données existantes.
-- Correctif important : l'ancien déclencheur de rôle est supprimé AVANT la migration.

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text,
  discord_name text,
  email text,
  avatar_url text,
  rp_first_name text,
  rp_last_name text,
  role text not null default 'citizen',
  roles text[] not null default array['citizen']::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles add column if not exists roles text[];
alter table public.member_profiles alter column role set default 'citizen';

alter table public.member_profiles drop constraint if exists member_profiles_role_check;
alter table public.member_profiles drop constraint if exists member_profiles_roles_check;

-- L'ancien déclencheur V25 empêchait la conversion des anciens rôles dans le SQL Editor.
drop trigger if exists protect_nostra_member_role_trigger on public.member_profiles;
drop trigger if exists protect_nostra_member_roles_trigger on public.member_profiles;

-- Normalise à la fois l'ancien rôle principal et le tableau des rôles.
update public.member_profiles
set roles = (
  select coalesce(array_agg(distinct normalized_role), array['citizen']::text[])
  from (
    select case lower(trim(coalesce(value, '')))
      when 'manager' then 'manager'
      when 'gérant' then 'manager'
      when 'gerant' then 'manager'
      when 'admin' then 'manager'
      when 'administrator' then 'employee'
      when 'administrateur' then 'employee'
      when 'commissioner' then 'commissioner'
      when 'commissaire' then 'commissioner'
      when 'commercial' then 'commercial'
      when 'sales' then 'commercial'
      when 'employee' then 'employee'
      when 'employé' then 'employee'
      when 'employe' then 'employee'
      when 'staff' then 'employee'
      when 'citizen' then 'citizen'
      when 'member' then 'citizen'
      when 'membre' then 'citizen'
      when 'citoyen' then 'citizen'
      else 'citizen'
    end as normalized_role
    from unnest(
      array_append(
        coalesce(roles, array[]::text[]),
        coalesce(role, 'citizen')
      )
    ) as value
  ) normalized
), updated_at = now();

-- Le compte principal reste toujours Gérant.
update public.member_profiles
set roles = case
  when 'manager' = any(coalesce(roles, array[]::text[])) then roles
  else array_append(coalesce(roles, array[]::text[]), 'manager')
end,
updated_at = now()
where discord_id = '331843410962939908';

-- Le champ role reste compatible avec les anciennes pages et suit le rôle le plus élevé.
update public.member_profiles
set role = case
  when 'manager' = any(roles) then 'manager'
  when 'commissioner' = any(roles) then 'commissioner'
  when 'commercial' = any(roles) then 'commercial'
  when 'employee' = any(roles) then 'employee'
  else 'citizen'
end,
updated_at = now();

alter table public.member_profiles alter column roles set default array['citizen']::text[];
alter table public.member_profiles alter column roles set not null;

alter table public.member_profiles
  add constraint member_profiles_role_check
  check (role in ('citizen', 'employee', 'commercial', 'commissioner', 'manager')) not valid;
alter table public.member_profiles validate constraint member_profiles_role_check;

alter table public.member_profiles
  add constraint member_profiles_roles_check
  check (
    cardinality(roles) > 0
    and roles <@ array['citizen', 'employee', 'commercial', 'commissioner', 'manager']::text[]
  ) not valid;
alter table public.member_profiles validate constraint member_profiles_roles_check;

create or replace function public.nostra_roles()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  stored_roles text[];
  stored_role text;
begin
  if public.nostra_jwt_discord_id() = '331843410962939908' then
    return array['manager']::text[];
  end if;

  select roles, role into stored_roles, stored_role
  from public.member_profiles
  where user_id = auth.uid();

  if stored_roles is not null and cardinality(stored_roles) > 0 then
    return stored_roles;
  end if;

  if stored_role is not null then
    return array[stored_role]::text[];
  end if;

  return array['citizen']::text[];
end;
$$;

create or replace function public.nostra_has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select requested_role = any(public.nostra_roles());
$$;

create or replace function public.nostra_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_roles text[];
begin
  current_roles := public.nostra_roles();
  if 'manager' = any(current_roles) then return 'manager'; end if;
  if 'commissioner' = any(current_roles) then return 'commissioner'; end if;
  if 'commercial' = any(current_roles) then return 'commercial'; end if;
  if 'employee' = any(current_roles) then return 'employee'; end if;
  return 'citizen';
end;
$$;

create or replace function public.has_nostra_dashboard_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nostra_has_role('manager');
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

grant execute on function public.nostra_roles() to authenticated;
grant execute on function public.nostra_has_role(text) to authenticated;
grant execute on function public.nostra_role() to authenticated;
grant execute on function public.has_nostra_dashboard_access() to authenticated;
grant execute on function public.is_nostra_manager() to authenticated;

create or replace function public.protect_nostra_member_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_nostra_dashboard_access() then
    new.role := old.role;
    new.roles := old.roles;
  end if;

  if new.discord_id = '331843410962939908' then
    if not ('manager' = any(coalesce(new.roles, array[]::text[]))) then
      new.roles := array_append(coalesce(new.roles, array[]::text[]), 'manager');
    end if;
  end if;

  if 'manager' = any(new.roles) then new.role := 'manager';
  elsif 'commissioner' = any(new.roles) then new.role := 'commissioner';
  elsif 'commercial' = any(new.roles) then new.role := 'commercial';
  elsif 'employee' = any(new.roles) then new.role := 'employee';
  else new.role := 'citizen';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_nostra_member_role_trigger on public.member_profiles;
drop trigger if exists protect_nostra_member_roles_trigger on public.member_profiles;
create trigger protect_nostra_member_roles_trigger
before update on public.member_profiles
for each row execute function public.protect_nostra_member_roles();

create table if not exists public.commissioner_race_briefing (
  id integer primary key default 1 check (id = 1),
  event_title text not null default '',
  event_date date,
  stands_opening text not null default '',
  qualifications_time text not null default '',
  race_start text not null default '',
  vehicle text not null default '',
  lap_count text not null default '',
  weather text not null default '',
  commissioners text not null default '',
  race_direction text not null default '',
  live_announcement text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.commissioner_incident_reports (
  id bigint generated by default as identity primary key,
  created_by uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  incident_date date not null,
  incident_time time not null,
  session_name text not null,
  circuit_zone text not null,
  people_involved text not null,
  factual_description text not null,
  intervention text not null,
  witnesses text,
  race_direction_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.commissioner_race_briefing enable row level security;
alter table public.commissioner_incident_reports enable row level security;

drop policy if exists "commissioners read race briefing" on public.commissioner_race_briefing;
create policy "commissioners read race briefing" on public.commissioner_race_briefing
for select to authenticated using (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'));

drop policy if exists "commissioners insert race briefing" on public.commissioner_race_briefing;
create policy "commissioners insert race briefing" on public.commissioner_race_briefing
for insert to authenticated with check (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'));

drop policy if exists "commissioners update race briefing" on public.commissioner_race_briefing;
create policy "commissioners update race briefing" on public.commissioner_race_briefing
for update to authenticated using (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'))
with check (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'));

drop policy if exists "commissioners read incident reports" on public.commissioner_incident_reports;
create policy "commissioners read incident reports" on public.commissioner_incident_reports
for select to authenticated using (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'));

drop policy if exists "commissioners create incident reports" on public.commissioner_incident_reports;
create policy "commissioners create incident reports" on public.commissioner_incident_reports
for insert to authenticated with check (
  (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'))
  and created_by = auth.uid()
);

drop policy if exists "commissioners update own incident reports" on public.commissioner_incident_reports;
create policy "commissioners update own incident reports" on public.commissioner_incident_reports
for update to authenticated using (
  created_by = auth.uid() or public.nostra_has_role('manager')
) with check (
  created_by = auth.uid() or public.nostra_has_role('manager')
);

drop policy if exists "commissioners delete incident reports" on public.commissioner_incident_reports;
create policy "commissioners delete incident reports" on public.commissioner_incident_reports
for delete to authenticated using (
  created_by = auth.uid() or public.nostra_has_role('manager')
);
