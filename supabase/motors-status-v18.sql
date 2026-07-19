-- NOSTRA GROUP V18 — État de Nostra Motors
-- À exécuter une seule fois dans Supabase > SQL Editor.

create table if not exists public.motors_settings (
  id integer primary key default 1 check (id = 1),
  status text not null default 'open',
  label text not null default 'Concession ouverte',
  message text not null default 'Nostra Motors accueille actuellement ses clients.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.motors_settings (id) values (1) on conflict (id) do nothing;

alter table public.motors_settings enable row level security;

drop policy if exists "motors settings readable" on public.motors_settings;
create policy "motors settings readable" on public.motors_settings
for select to authenticated using (true);

drop policy if exists "manager manages motors settings" on public.motors_settings;
create policy "manager manages motors settings" on public.motors_settings
for all to authenticated
using (public.has_nostra_dashboard_access())
with check (public.has_nostra_dashboard_access());
