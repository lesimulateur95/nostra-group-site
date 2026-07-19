-- NOSTRA GROUP V30 — PLANNING LIVE, ACCÈS DASHBOARD ET SUPPRESSION DES GAINS
-- Réexécutable et sans suppression des données existantes.

create or replace function public.nostra_can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.nostra_has_role('manager')
    or public.nostra_has_role('employee')
    or public.nostra_has_role('commercial');
$$;
grant execute on function public.nostra_can_manage_orders() to authenticated;

alter table public.commissioner_race_briefing
  add column if not exists public_visible boolean not null default true;

update public.commissioner_race_briefing
set public_visible = true
where id = 1;

alter table public.commissioner_race_briefing enable row level security;

drop policy if exists "commissioners read race briefing" on public.commissioner_race_briefing;
drop policy if exists "commissioners and citizens read public briefing" on public.commissioner_race_briefing;
create policy "commissioners and citizens read public briefing"
on public.commissioner_race_briefing
for select to authenticated
using (
  public_visible
  or public.nostra_has_role('commissioner')
  or public.nostra_has_role('manager')
);

drop policy if exists "commissioners insert race briefing" on public.commissioner_race_briefing;
create policy "commissioners insert race briefing"
on public.commissioner_race_briefing
for insert to authenticated
with check (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'));

drop policy if exists "commissioners update race briefing" on public.commissioner_race_briefing;
create policy "commissioners update race briefing"
on public.commissioner_race_briefing
for update to authenticated
using (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'))
with check (public.nostra_has_role('commissioner') or public.nostra_has_role('manager'));

grant select, insert, update on public.commissioner_race_briefing to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'commissioner_race_briefing'
  ) then
    alter publication supabase_realtime add table public.commissioner_race_briefing;
  end if;
end $$;

alter table public.game_wheel_spins
  add column if not exists deleted_at timestamptz;

alter table public.game_wheel_spins enable row level security;
drop policy if exists "wheel managers update all" on public.game_wheel_spins;
create policy "wheel managers update all"
on public.game_wheel_spins
for update to authenticated
using (public.nostra_games_is_manager())
with check (public.nostra_games_is_manager());
grant select, update on public.game_wheel_spins to authenticated;

notify pgrst, 'reload schema';
