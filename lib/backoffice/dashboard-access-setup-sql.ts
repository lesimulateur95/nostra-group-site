export const DASHBOARD_ACCESS_SETUP_SQL = String.raw`
-- NOSTRA GROUP V29.1 — Accès Dashboard par rôle
-- Script réexécutable : il conserve les données existantes.

create or replace function public.nostra_can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.nostra_has_role('manager')
    or public.nostra_has_role('employee')
    or public.nostra_has_role('commercial');
$$;

grant execute on function public.nostra_can_manage_orders() to authenticated;

alter table public.orders enable row level security;

drop policy if exists "users read own orders" on public.orders;
create policy "users read own orders"
on public.orders
for select
to authenticated
using (
  user_id = auth.uid()
  or public.nostra_can_manage_orders()
);

drop policy if exists "manager manages orders" on public.orders;
drop policy if exists "authorized staff read orders" on public.orders;
create policy "authorized staff read orders"
on public.orders
for select
to authenticated
using (public.nostra_can_manage_orders());

drop policy if exists "authorized staff update orders" on public.orders;
create policy "authorized staff update orders"
on public.orders
for update
to authenticated
using (public.nostra_can_manage_orders())
with check (public.nostra_can_manage_orders());

drop policy if exists "manager deletes orders" on public.orders;
create policy "manager deletes orders"
on public.orders
for delete
to authenticated
using (public.nostra_has_role('manager'));

grant select, update on public.orders to authenticated;

alter table public.commissioner_race_briefing
add column if not exists public_visible boolean not null default true;

alter table public.commissioner_race_briefing enable row level security;

drop policy if exists "commissioners read race briefing" on public.commissioner_race_briefing;
create policy "commissioners and citizens read public briefing"
on public.commissioner_race_briefing
for select
to authenticated
using (
  public_visible
  or public.nostra_has_role('commissioner')
  or public.nostra_has_role('manager')
);

drop policy if exists "commissioners insert race briefing" on public.commissioner_race_briefing;
create policy "commissioners insert race briefing"
on public.commissioner_race_briefing
for insert
to authenticated
with check (
  public.nostra_has_role('commissioner')
  or public.nostra_has_role('manager')
);

drop policy if exists "commissioners update race briefing" on public.commissioner_race_briefing;
create policy "commissioners update race briefing"
on public.commissioner_race_briefing
for update
to authenticated
using (
  public.nostra_has_role('commissioner')
  or public.nostra_has_role('manager')
)
with check (
  public.nostra_has_role('commissioner')
  or public.nostra_has_role('manager')
);

grant select, insert, update on public.commissioner_race_briefing to authenticated;

notify pgrst, 'reload schema';
`;
