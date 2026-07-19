-- NOSTRA GROUP V30.3
-- CORRECTION DE L'HISTORIQUE DES GAINS
--
-- Le tirage était bien créé, mais les lectures directes pouvaient être bloquées
-- silencieusement par RLS. Ce script crée deux fonctions de lecture sécurisées :
-- - historique personnel du citoyen ;
-- - historique complet réservé au Gérant.

alter table public.game_wheel_spins
  add column if not exists deleted_at timestamptz;

-- Retire l'ancien déclencheur V30.2 qui empêchait de restaurer deleted_at.
drop trigger if exists nostra_wheel_block_soft_delete_trigger
on public.game_wheel_spins;

-- Réaffiche les gains éventuellement masqués par les anciens correctifs.
update public.game_wheel_spins
set deleted_at = null
where deleted_at is not null;

alter table public.game_wheel_spins enable row level security;

-- Politiques normales conservées pour les lectures directes.
drop policy if exists "wheel citizens read own"
on public.game_wheel_spins;

create policy "wheel citizens read own"
on public.game_wheel_spins
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "wheel managers read all"
on public.game_wheel_spins;

create policy "wheel managers read all"
on public.game_wheel_spins
for select
to authenticated
using (public.nostra_games_is_manager());

grant select on public.game_wheel_spins to authenticated;

-- Historique du citoyen connecté.
create or replace function public.get_my_nostra_wheel_spins()
returns setof public.game_wheel_spins
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'not_authenticated';
  end if;

  return query
  select spins.*
  from public.game_wheel_spins spins
  where spins.user_id = v_user_id
    and spins.deleted_at is null
  order by spins.awarded_at desc
  limit 200;
end;
$$;

revoke all on function public.get_my_nostra_wheel_spins() from public;
grant execute on function public.get_my_nostra_wheel_spins() to authenticated;

-- Historique complet réservé au Gérant.
create or replace function public.get_nostra_wheel_spins_for_dashboard()
returns setof public.game_wheel_spins
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.nostra_games_is_manager() then
    raise exception using
      errcode = '42501',
      message = 'manager_required';
  end if;

  return query
  select spins.*
  from public.game_wheel_spins spins
  where spins.deleted_at is null
  order by spins.awarded_at desc
  limit 500;
end;
$$;

revoke all on function public.get_nostra_wheel_spins_for_dashboard() from public;
grant execute on function public.get_nostra_wheel_spins_for_dashboard() to authenticated;

notify pgrst, 'reload schema';
