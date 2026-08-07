-- NOSTRA GROUP V141 — MONEY DROP / REFONTE JEUX & ÉVÉNEMENTS
-- À exécuter après la V138.5 Money Drop (compatible V140 du site).
-- Corrige le lancement : un seul bouton peut charger automatiquement une question
-- puis ouvrir immédiatement la répartition et le chronomètre.

create or replace function public.money_drop_start_round(
  p_game_id uuid,
  p_category text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question_id bigint;
  v_enabled boolean;
begin
  perform public.money_drop_require_manager();

  select enabled into v_enabled
  from public.money_drop_settings
  where id = 1;

  if not coalesce(v_enabled, false) then
    raise exception 'money_drop_disabled';
  end if;

  select * into v_game
  from public.money_drop_games
  where id = p_game_id
  for update;

  if v_game.id is null or v_game.archived_at is not null then
    raise exception 'game_not_found';
  end if;

  if v_game.status <> 'setup' then
    raise exception 'game_not_in_setup';
  end if;

  v_question_id := v_game.current_question_id;

  -- Si la régie n'a pas choisi de question manuellement, le site en tire une
  -- automatiquement en respectant la manche, la difficulté et le thème éventuel.
  if v_question_id is null then
    v_question_id := public.money_drop_select_random_question(p_game_id, nullif(trim(p_category), ''));
  end if;

  -- Relecture après le tirage automatique.
  select * into v_game
  from public.money_drop_games
  where id = p_game_id
  for update;

  if v_game.current_question_id is null then
    raise exception 'question_missing';
  end if;

  -- Nettoie toute répartition fantôme de la manche avant le vrai lancement.
  delete from public.money_drop_allocations
  where game_id = p_game_id
    and round_number = v_game.current_round;

  update public.money_drop_games
  set status = 'question_open',
      round_deadline = now() + make_interval(secs => greatest(10, v_game.answer_seconds)),
      hint_removed_option = null
  where id = p_game_id;

  return v_game.current_question_id;
end;
$$;

revoke all on function public.money_drop_start_round(uuid,text) from public, anon;
grant execute on function public.money_drop_start_round(uuid,text) to authenticated, service_role;

notify pgrst, 'reload schema';
