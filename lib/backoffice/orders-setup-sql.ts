export const ORDERS_SETUP_SQL = String.raw`-- NOSTRA GROUP — Commandes Nostra Motors V21
-- Ce script conserve les commandes déjà présentes.

alter table public.orders add column if not exists customer_name text not null default '';
alter table public.orders add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists customer_note text;
alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();

alter table public.orders enable row level security;

drop policy if exists "users create own orders" on public.orders;
create policy "users create own orders" on public.orders
for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "users delete own pending orders" on public.orders;
create policy "users delete own pending orders" on public.orders
for delete to authenticated
using (user_id = auth.uid() and status = 'pending');

drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders" on public.orders
for select to authenticated
using (user_id = auth.uid() or public.has_nostra_dashboard_access());

drop policy if exists "manager manages orders" on public.orders;
create policy "manager manages orders" on public.orders
for all to authenticated
using (public.has_nostra_dashboard_access())
with check (public.has_nostra_dashboard_access());
`;
