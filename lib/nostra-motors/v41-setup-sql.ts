export const MOTORS_V41_SETUP_SQL = `
-- NOSTRA GROUP V41 — RENDEZ-VOUS ET LIVRAISONS
-- À exécuter une seule fois dans Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.motors_appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  customer_name text not null,
  phone text not null,
  email text null,
  appointment_type text not null check (appointment_type in ('showroom', 'test_drive')),
  appointment_date date not null,
  appointment_time time not null,
  vehicle_id text null,
  vehicle_label text null,
  message text null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined', 'completed', 'cancelled')),
  direction_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists motors_appointments_status_idx
  on public.motors_appointments(status, appointment_date, appointment_time);

alter table if exists public.orders
  add column if not exists delivery_status text not null default 'not_planned',
  add column if not exists delivery_date timestamptz null,
  add column if not exists delivery_driver text null,
  add column if not exists delivery_notes text null;

-- La sécurité d’accès au Dashboard est contrôlée côté serveur par les rôles du site.
alter table public.motors_appointments enable row level security;

grant insert on public.motors_appointments to anon, authenticated;
grant select, update, delete on public.motors_appointments to authenticated;

drop policy if exists motors_appointments_public_insert on public.motors_appointments;
create policy motors_appointments_public_insert
on public.motors_appointments
for insert
to anon, authenticated
with check (true);

drop policy if exists motors_appointments_authenticated_read on public.motors_appointments;
create policy motors_appointments_authenticated_read
on public.motors_appointments
for select
to authenticated
using (true);

drop policy if exists motors_appointments_authenticated_update on public.motors_appointments;
create policy motors_appointments_authenticated_update
on public.motors_appointments
for update
to authenticated
using (true)
with check (true);

drop policy if exists motors_appointments_authenticated_delete on public.motors_appointments;
create policy motors_appointments_authenticated_delete
on public.motors_appointments
for delete
to authenticated
using (true);
`;
