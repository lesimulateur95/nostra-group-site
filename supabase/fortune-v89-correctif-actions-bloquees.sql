-- NOSTRA GROUP V89 — CORRECTIF ROUE / ÉNIGMES / LETTRES
-- Correctif additif et réexécutable.
-- Répare les parties restées en « waiting » alors que le joueur actif et
-- l'énigme sont déjà présents.
-- Ne supprime aucune partie, aucun joueur, aucune énigme et aucune cagnotte.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. PRÉREQUIS ET COMPATIBILITÉ TABLE DES JOUEURS
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.fortune_settings') is null
     or to_regclass('public.fortune_games') is null
     or to_regclass('public.fortune_rounds') is null
     or to_regclass('public.fortune_wheel_segments') is null
     or (
       to_regclass('public.fortune_players') is null
       and to_regclass('public.fortune_game_players') is null
     ) then
    raise exception using
      message = 'fortune_module_missing',
      detail = 'Le module de la Roue de la Fortune doit être installé avant la V89.';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.fortune_players') is null
     and to_regclass('public.fortune_game_players') is not null then
    execute 'create view public.fortune_players as select * from public.fortune_game_players';
  end if;
end
$$;

do $$
declare
  v_relation regclass;
  v_kind "char";
begin
  foreach v_relation in array array[
    to_regclass('public.fortune_game_players'),
    to_regclass('public.fortune_players')
  ]
  loop
    if v_relation is null then
      continue;
    end if;

    select relkind into v_kind from pg_class where oid = v_relation;
    if v_kind in ('r', 'p') then
      execute format(
        'alter table %s add column if not exists is_active boolean not null default false',
        v_relation
      );
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. OUTILS ROBUSTES
-- ---------------------------------------------------------------------------
create or replace function public.fortune_is_manager_v89()
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_allowed boolean := false;
  v_roles jsonb;
  v_profile jsonb;
  v_claims jsonb;
  v_text text;
begin
  if auth.uid() is null then
    return current_user in ('postgres', 'service_role', 'supabase_admin');
  end if;

  if to_regprocedure('public.has_nostra_dashboard_access()') is not null then
    begin
      execute 'select public.has_nostra_dashboard_access()' into v_allowed;
      if coalesce(v_allowed, false) then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  if to_regprocedure('public.nostra_roles()') is not null then
    begin
      execute 'select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from public.nostra_roles() r'
        into v_roles;
      v_text := lower(coalesce(v_roles::text, ''));
      if v_text ~ '(manager|gérant|gerant|direction|administrator|administrateur|admin)' then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.member_profiles') is not null then
    begin
      execute 'select to_jsonb(mp) from public.member_profiles mp where mp.user_id = $1 limit 1'
        into v_profile
        using auth.uid();
      v_text := lower(coalesce(v_profile::text, ''));
      if v_text ~ '(manager|gérant|gerant|direction|administrator|administrateur|admin)' then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    v_text := lower(coalesce(v_claims::text, ''));
    if v_text ~ '(manager|gérant|gerant|direction|administrator|administrateur|admin)' then
      return true;
    end if;
  exception when others then
    null;
  end;

  return false;
end;
$$;

create or replace function public.fortune_mask_puzzle_v89(
  p_solution text,
  p_revealed text[] default '{}'::text[]
)
returns text
language plpgsql
immutable
as $$
declare
  v_result text := '';
  v_character text;
  v_index integer;
  v_revealed text[] := coalesce(p_revealed, '{}'::text[]);
begin
  if coalesce(p_solution, '') = '' then
    return '';
  end if;

  for v_index in 1..char_length(p_solution)
  loop
    v_character := substr(p_solution, v_index, 1);

    if v_character !~ '[[:alpha:]]' then
      v_result := v_result || v_character;
    elsif upper(v_character) = any(v_revealed) then
      v_result := v_result || v_character;
    else
      v_result := v_result || '_';
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.fortune_sync_active_player_v89(
  p_game_id uuid,
  p_position integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_relation regclass;
  v_kind "char";
  v_updated boolean := false;
begin
  foreach v_relation in array array[
    to_regclass('public.fortune_game_players'),
    to_regclass('public.fortune_players')
  ]
  loop
    if v_relation is null then
      continue;
    end if;

    select relkind into v_kind from pg_class where oid = v_relation;
    if v_kind in ('r', 'p') then
      execute format(
        'update %s set is_active = (position = $2) where game_id = $1',
        v_relation
      ) using p_game_id, p_position;
      v_updated := true;
    end if;
  end loop;

  -- Cas où fortune_players est uniquement une vue simple modifiable.
  if not v_updated and to_regclass('public.fortune_players') is not null then
    update public.fortune_players
       set is_active = (position = p_position)
     where game_id = p_game_id;
  end if;
end;
$$;

create or replace function public.fortune_prepare_current_round_v89(
  p_game_id uuid,
  p_round_number integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.fortune_games%rowtype;
  v_round_number integer;
  v_solution text;
  v_active_position integer;
begin
  select * into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  v_round_number := greatest(
    1,
    least(coalesce(p_round_number, v_game.current_round, 1), 4)
  );

  select solution
    into v_solution
  from public.fortune_rounds
  where game_id = p_game_id
    and round_number = v_round_number
  for update;

  if not found or nullif(trim(coalesce(v_solution, '')), '') is null then
    raise exception 'round_solution_missing';
  end if;

  v_active_position := v_game.active_player_position;
  if v_active_position is null then
    select min(position)
      into v_active_position
    from public.fortune_players
    where game_id = p_game_id;
  end if;

  if v_active_position is null then
    raise exception 'active_player_missing';
  end if;

  update public.fortune_rounds
     set status = 'active',
         starting_position = coalesce(starting_position, v_active_position),
         winner_position = null
   where game_id = p_game_id
     and round_number = v_round_number;

  update public.fortune_games
     set current_round = v_round_number,
         status = 'active',
         active_player_position = v_active_position,
         turn_phase = 'must_spin',
         jackpot_armed = false
   where id = p_game_id;

  perform public.fortune_sync_active_player_v89(
    p_game_id,
    v_active_position
  );

  update public.fortune_settings
     set visible_wheel = 'normal'
   where coalesce(visible_wheel::text, 'none') <> 'normal';

  return jsonb_build_object(
    'game_id', p_game_id,
    'round_number', v_round_number,
    'active_player_position', v_active_position,
    'turn_phase', 'must_spin'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. TIRAGE D'ÉNIGME : AFFECTE ET DÉMARRE LA MANCHE
-- ---------------------------------------------------------------------------
create or replace function public.fortune_pick_random_puzzle_v87(
  p_game_id uuid,
  p_round_number integer default 1,
  p_for_final boolean default false,
  p_difficulty text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puzzle public.fortune_puzzle_bank_v87%rowtype;
  v_round integer;
  v_game public.fortune_games%rowtype;
begin
  if not public.fortune_is_manager_v89() then
    raise exception 'manager_required';
  end if;

  select * into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  select * into v_puzzle
  from public.fortune_puzzle_bank_v87
  where active = true
    and (
      (
        p_for_final
        and difficulty = coalesce(
          nullif(trim(coalesce(p_difficulty, '')), ''),
          'finale'
        )
      )
      or (
        not p_for_final
        and difficulty <> 'finale'
        and (
          nullif(trim(coalesce(p_difficulty, '')), '') is null
          or difficulty = trim(p_difficulty)
        )
      )
    )
  order by used_count asc, last_used_at asc nulls first, random()
  limit 1;

  if not found then
    raise exception 'puzzle_bank_empty';
  end if;

  if p_for_final then
    update public.fortune_games
       set final_category = v_puzzle.category,
           final_solution = v_puzzle.solution,
           final_revealed_letters = '{}'::text[],
           final_masked_puzzle = public.fortune_mask_puzzle_v89(
             v_puzzle.solution,
             '{}'::text[]
           ),
           turn_phase = case
             when status = 'finale' then 'final_spin'
             else turn_phase
           end
     where id = p_game_id;

    if v_game.status = 'finale' then
      update public.fortune_settings set visible_wheel = 'final';
    end if;
  else
    v_round := greatest(1, least(coalesce(p_round_number, 1), 4));

    update public.fortune_rounds
       set category = v_puzzle.category,
           solution = v_puzzle.solution,
           revealed_letters = '{}'::text[],
           masked_puzzle = public.fortune_mask_puzzle_v89(
             v_puzzle.solution,
             '{}'::text[]
           ),
           status = 'waiting',
           winner_position = null
     where game_id = p_game_id
       and round_number = v_round;

    if not found then
      insert into public.fortune_rounds (
        game_id,
        round_number,
        category,
        solution,
        masked_puzzle,
        revealed_letters,
        status,
        starting_position,
        winner_position
      ) values (
        p_game_id,
        v_round,
        v_puzzle.category,
        v_puzzle.solution,
        public.fortune_mask_puzzle_v89(v_puzzle.solution, '{}'::text[]),
        '{}'::text[],
        'waiting',
        null,
        null
      );
    end if;

    -- Le tirage rend immédiatement la manche jouable et évite l'état bloqué.
    perform public.fortune_prepare_current_round_v89(p_game_id, v_round);
  end if;

  update public.fortune_puzzle_bank_v87
     set used_count = used_count + 1,
         last_used_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where id = v_puzzle.id;

  return jsonb_build_object(
    'puzzle_id', v_puzzle.id,
    'category', v_puzzle.category,
    'difficulty', v_puzzle.difficulty,
    'for_final', p_for_final,
    'round_number', case when p_for_final then null else v_round end,
    'started', not p_for_final
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RÉVÉLATION MANUELLE D'UNE LETTRE
-- ---------------------------------------------------------------------------
create or replace function public.fortune_reveal_letter_v87(
  p_game_id uuid,
  p_letter text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.fortune_games%rowtype;
  v_letter text;
  v_letters text[];
  v_solution text;
  v_masked text;
begin
  if not public.fortune_is_manager_v89() then
    raise exception 'manager_required';
  end if;

  v_letter := upper(substr(trim(coalesce(p_letter, '')), 1, 1));
  if v_letter = '' or v_letter !~ '^[A-ZÀ-ÖØ-Þ]$' then
    raise exception 'invalid_letter';
  end if;

  select * into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  if v_game.status = 'finale' then
    v_solution := coalesce(v_game.final_solution, '');
    if nullif(trim(v_solution), '') is null then
      raise exception 'final_solution_missing';
    end if;

    v_letters := coalesce(v_game.final_revealed_letters, '{}'::text[]);
    if not (v_letter = any(v_letters)) then
      v_letters := array_append(v_letters, v_letter);
    end if;

    v_masked := public.fortune_mask_puzzle_v89(v_solution, v_letters);

    update public.fortune_games
       set final_revealed_letters = v_letters,
           final_masked_puzzle = v_masked
     where id = p_game_id;
  else
    select solution, coalesce(revealed_letters, '{}'::text[])
      into v_solution, v_letters
    from public.fortune_rounds
    where game_id = p_game_id
      and round_number = v_game.current_round
    for update;

    if not found then
      raise exception 'round_not_found';
    end if;
    if nullif(trim(coalesce(v_solution, '')), '') is null then
      raise exception 'round_solution_missing';
    end if;

    if not (v_letter = any(v_letters)) then
      v_letters := array_append(v_letters, v_letter);
    end if;

    v_masked := public.fortune_mask_puzzle_v89(v_solution, v_letters);

    update public.fortune_rounds
       set revealed_letters = v_letters,
           masked_puzzle = v_masked
     where game_id = p_game_id
       and round_number = v_game.current_round;
  end if;

  return jsonb_build_object(
    'letter', v_letter,
    'masked_puzzle', v_masked,
    'already_visible', v_letter = any(coalesce(v_letters, '{}'::text[]))
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. LANCER V89 : RÉPARE L'ÉTAT AVANT LE LANCER V87
-- ---------------------------------------------------------------------------
create or replace function public.fortune_spin_wheel_v89(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.fortune_games%rowtype;
  v_has_solution boolean := false;
  v_result jsonb;
  v_active_position integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  v_active_position := v_game.active_player_position;
  if v_active_position is null then
    select min(position)
      into v_active_position
    from public.fortune_players
    where game_id = p_game_id;

    if v_active_position is not null then
      update public.fortune_games
         set active_player_position = v_active_position
       where id = p_game_id;
      perform public.fortune_sync_active_player_v89(
        p_game_id,
        v_active_position
      );
    end if;
  else
    perform public.fortune_sync_active_player_v89(
      p_game_id,
      v_active_position
    );
  end if;

  if v_game.status in ('setup', 'between_rounds')
     or (
       v_game.status = 'active'
       and v_game.turn_phase = 'waiting'
       and v_game.pending_special_action is null
     ) then
    select exists (
      select 1
      from public.fortune_rounds
      where game_id = p_game_id
        and round_number = v_game.current_round
        and nullif(trim(coalesce(solution, '')), '') is not null
    ) into v_has_solution;

    if not v_has_solution then
      raise exception 'round_solution_missing';
    end if;

    perform public.fortune_prepare_current_round_v89(
      p_game_id,
      v_game.current_round
    );
  elsif v_game.status = 'finale'
        and v_game.turn_phase = 'waiting'
        and nullif(trim(coalesce(v_game.final_solution, '')), '') is not null then
    update public.fortune_games
       set turn_phase = 'final_spin'
     where id = p_game_id;
    update public.fortune_settings set visible_wheel = 'final';
  end if;

  if to_regprocedure('public.fortune_spin_wheel_v87(uuid)') is null then
    raise exception using
      message = 'fortune_spin_v87_missing',
      detail = 'Le SQL V87E doit être installé avant le correctif V89.';
  end if;

  execute 'select public.fortune_spin_wheel_v87($1)'
    into v_result
    using p_game_id;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. RÉPARATION IMMÉDIATE DE LA PARTIE DE TEST EN COURS
-- ---------------------------------------------------------------------------
do $$
declare
  v_game record;
begin
  for v_game in
    select g.id, g.current_round
    from public.fortune_games g
    where g.status in ('setup', 'active', 'between_rounds')
      and coalesce(g.turn_phase::text, 'waiting') = 'waiting'
      and g.pending_special_action is null
      and exists (
        select 1
        from public.fortune_rounds r
        where r.game_id = g.id
          and r.round_number = g.current_round
          and nullif(trim(coalesce(r.solution, '')), '') is not null
      )
  loop
    begin
      perform public.fortune_prepare_current_round_v89(
        v_game.id,
        v_game.current_round
      );
    exception when others then
      raise warning 'V89 : partie % non réparée automatiquement : %',
        v_game.id,
        sqlerrm;
    end;
  end loop;
end
$$;

revoke all on function public.fortune_is_manager_v89() from public;
revoke all on function public.fortune_sync_active_player_v89(uuid, integer) from public;
revoke all on function public.fortune_prepare_current_round_v89(uuid, integer) from public;
revoke all on function public.fortune_pick_random_puzzle_v87(uuid, integer, boolean, text) from public;
revoke all on function public.fortune_reveal_letter_v87(uuid, text) from public;
revoke all on function public.fortune_spin_wheel_v89(uuid) from public;

grant execute on function public.fortune_is_manager_v89() to authenticated, service_role;
grant execute on function public.fortune_mask_puzzle_v89(text, text[]) to authenticated, service_role;
grant execute on function public.fortune_sync_active_player_v89(uuid, integer) to service_role;
grant execute on function public.fortune_prepare_current_round_v89(uuid, integer) to service_role;
grant execute on function public.fortune_pick_random_puzzle_v87(uuid, integer, boolean, text) to authenticated, service_role;
grant execute on function public.fortune_reveal_letter_v87(uuid, text) to authenticated, service_role;
grant execute on function public.fortune_spin_wheel_v89(uuid) to authenticated, service_role;

analyze public.fortune_games;
analyze public.fortune_rounds;
analyze public.fortune_wheel_segments;

select
  'V89_OK'::text as resultat,
  to_regprocedure('public.fortune_spin_wheel_v89(uuid)') is not null as lancer_repare,
  to_regprocedure('public.fortune_pick_random_puzzle_v87(uuid,integer,boolean,text)') is not null as tirage_enigme_repare,
  to_regprocedure('public.fortune_reveal_letter_v87(uuid,text)') is not null as revelation_lettre_reparee;
