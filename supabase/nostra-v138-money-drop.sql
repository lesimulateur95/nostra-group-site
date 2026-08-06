-- NOSTRA GROUP V138 — MONEY DROP NOSTRA MOTORS
-- Migration additive, réexécutable et sans suppression des autres modules.
-- Fonctionnalités : activation civile, banque de questions, équipes de 1 à 4,
-- cagnotte configurable, répartition sécurisée, trappes, historique et régie.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------
create table if not exists public.money_drop_settings (
  id smallint primary key default 1,
  enabled boolean not null default false,
  starting_amount bigint not null default 250000,
  total_rounds integer not null default 8,
  answer_seconds integer not null default 60,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint money_drop_settings_singleton_check check (id = 1),
  constraint money_drop_settings_amount_check check (starting_amount between 1000 and 1000000000),
  constraint money_drop_settings_rounds_check check (total_rounds between 1 and 12),
  constraint money_drop_settings_timer_check check (answer_seconds between 10 and 600)
);

insert into public.money_drop_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.money_drop_questions (
  id bigserial primary key,
  category text not null,
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text,
  option_d text,
  correct_option text not null,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint money_drop_question_category_check check (char_length(trim(category)) between 2 and 100),
  constraint money_drop_question_text_check check (char_length(trim(question)) between 5 and 500),
  constraint money_drop_question_a_check check (char_length(trim(option_a)) between 1 and 180),
  constraint money_drop_question_b_check check (char_length(trim(option_b)) between 1 and 180),
  constraint money_drop_question_c_check check (option_c is null or char_length(trim(option_c)) between 1 and 180),
  constraint money_drop_question_d_check check (option_d is null or char_length(trim(option_d)) between 1 and 180),
  constraint money_drop_question_correct_check check (
    correct_option in ('A', 'B', 'C', 'D')
    and case correct_option
      when 'A' then nullif(trim(option_a), '') is not null
      when 'B' then nullif(trim(option_b), '') is not null
      when 'C' then nullif(trim(option_c), '') is not null
      when 'D' then nullif(trim(option_d), '') is not null
      else false
    end
  )
);

create unique index if not exists money_drop_questions_unique_idx
  on public.money_drop_questions (lower(trim(question)));
create index if not exists money_drop_questions_active_idx
  on public.money_drop_questions (active, created_at desc);

create table if not exists public.money_drop_games (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'setup',
  team_name text not null default 'Équipe Nostra',
  starting_amount bigint not null,
  current_amount bigint not null,
  current_round integer not null default 1,
  total_rounds integer not null,
  current_question_id bigint references public.money_drop_questions(id) on delete set null,
  round_deadline timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  archived_at timestamptz,
  constraint money_drop_games_status_check check (
    status in ('setup', 'question_open', 'allocations_locked', 'revealed', 'finished', 'cancelled')
  ),
  constraint money_drop_games_team_check check (char_length(trim(team_name)) between 2 and 100),
  constraint money_drop_games_amounts_check check (
    starting_amount >= 0 and current_amount >= 0 and current_amount <= starting_amount
  ),
  constraint money_drop_games_round_check check (
    total_rounds between 1 and 12 and current_round between 1 and total_rounds
  )
);

create unique index if not exists money_drop_one_live_game_idx
  on public.money_drop_games ((1))
  where archived_at is null and status <> 'cancelled';
create index if not exists money_drop_games_status_idx
  on public.money_drop_games (status, created_at desc);

create table if not exists public.money_drop_players (
  game_id uuid not null references public.money_drop_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null,
  player_name text not null,
  is_captain boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, position),
  constraint money_drop_players_position_check check (position between 1 and 4),
  constraint money_drop_players_name_check check (char_length(trim(player_name)) between 1 and 120)
);

create index if not exists money_drop_players_user_idx
  on public.money_drop_players (user_id, game_id);

create table if not exists public.money_drop_allocations (
  game_id uuid not null references public.money_drop_games(id) on delete cascade,
  round_number integer not null,
  option_key text not null,
  amount bigint not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (game_id, round_number, option_key),
  constraint money_drop_allocations_option_check check (option_key in ('A', 'B', 'C', 'D')),
  constraint money_drop_allocations_amount_check check (amount >= 0)
);

create table if not exists public.money_drop_round_history (
  id bigserial primary key,
  game_id uuid not null references public.money_drop_games(id) on delete cascade,
  round_number integer not null,
  question_id bigint references public.money_drop_questions(id) on delete set null,
  category text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option text not null,
  allocations jsonb not null default '{}'::jsonb,
  lost_amount bigint not null default 0,
  remaining_amount bigint not null default 0,
  revealed_at timestamptz not null default now(),
  unique (game_id, round_number),
  constraint money_drop_history_correct_check check (correct_option in ('A', 'B', 'C', 'D')),
  constraint money_drop_history_amount_check check (lost_amount >= 0 and remaining_amount >= 0)
);

create index if not exists money_drop_history_game_idx
  on public.money_drop_round_history (game_id, round_number);

-- ---------------------------------------------------------------------------
-- 2. ACCÈS ET OUTILS
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_is_manager()
returns boolean
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_allowed boolean := false;
  v_profile jsonb;
  v_text text;
begin
  if auth.uid() is null then
    return current_user in ('postgres', 'service_role', 'supabase_admin');
  end if;

  if to_regprocedure('public.has_nostra_dashboard_access()') is not null then
    begin
      execute 'select public.has_nostra_dashboard_access()' into v_allowed;
      if coalesce(v_allowed, false) then return true; end if;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.member_profiles') is not null then
    begin
      execute 'select to_jsonb(p) from public.member_profiles p where p.user_id = $1 limit 1'
        into v_profile using auth.uid();
      v_text := lower(coalesce(v_profile::text, ''));
      if v_text ~ '(manager|gérant|gerant|direction|administrator|administrateur|admin)' then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  return false;
end;
$$;

create or replace function public.money_drop_player_name(p_user_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_name text;
begin
  if to_regclass('public.member_profiles') is not null then
    begin
      execute $sql$
        select coalesce(
          nullif(trim(concat_ws(' ', rp_first_name, rp_last_name)), ''),
          nullif(trim(discord_name), '')
        )
        from public.member_profiles
        where user_id = $1
        limit 1
      $sql$ into v_name using p_user_id;
    exception when others then
      v_name := null;
    end;
  end if;

  if v_name is null then
    select coalesce(
      nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(email, 'Citoyen Nostra'), '@', 1)
    )
    into v_name
    from auth.users
    where id = p_user_id;
  end if;

  return coalesce(v_name, 'Citoyen Nostra');
end;
$$;

create or replace function public.money_drop_require_manager()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.money_drop_is_manager() then
    raise exception 'manager_required';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. ÉTAT PUBLIC ET ÉTAT RÉGIE
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_build_state(p_manager boolean default false)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
declare
  v_settings public.money_drop_settings%rowtype;
  v_game public.money_drop_games%rowtype;
  v_question public.money_drop_questions%rowtype;
  v_players jsonb := '[]'::jsonb;
  v_options jsonb := '[]'::jsonb;
  v_allocations jsonb := jsonb_build_object('A', 0, 'B', 0, 'C', 0, 'D', 0);
  v_history jsonb := '[]'::jsonb;
  v_question_json jsonb := null;
  v_is_player boolean := false;
  v_is_captain boolean := false;
begin
  select * into v_settings from public.money_drop_settings where id = 1;

  select * into v_game
  from public.money_drop_games
  where archived_at is null and status <> 'cancelled'
  order by created_at desc
  limit 1;

  if v_game.id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'position', p.position,
      'user_id', p.user_id,
      'player_name', p.player_name,
      'is_captain', p.is_captain
    ) order by p.position), '[]'::jsonb)
    into v_players
    from public.money_drop_players p
    where p.game_id = v_game.id;

    select exists(
      select 1 from public.money_drop_players p
      where p.game_id = v_game.id and p.user_id = auth.uid()
    ), exists(
      select 1 from public.money_drop_players p
      where p.game_id = v_game.id and p.user_id = auth.uid() and p.is_captain
    ) into v_is_player, v_is_captain;

    select jsonb_build_object(
      'A', coalesce(sum(amount) filter (where option_key = 'A'), 0),
      'B', coalesce(sum(amount) filter (where option_key = 'B'), 0),
      'C', coalesce(sum(amount) filter (where option_key = 'C'), 0),
      'D', coalesce(sum(amount) filter (where option_key = 'D'), 0)
    )
    into v_allocations
    from public.money_drop_allocations
    where game_id = v_game.id and round_number = v_game.current_round;

    if v_game.current_question_id is not null then
      select * into v_question
      from public.money_drop_questions
      where id = v_game.current_question_id;

      v_options := jsonb_build_array(
        jsonb_build_object('key', 'A', 'label', v_question.option_a),
        jsonb_build_object('key', 'B', 'label', v_question.option_b)
      );
      if nullif(trim(v_question.option_c), '') is not null then
        v_options := v_options || jsonb_build_array(jsonb_build_object('key', 'C', 'label', v_question.option_c));
      end if;
      if nullif(trim(v_question.option_d), '') is not null then
        v_options := v_options || jsonb_build_array(jsonb_build_object('key', 'D', 'label', v_question.option_d));
      end if;

      v_question_json := jsonb_build_object(
        'id', v_question.id,
        'category', v_question.category,
        'question', v_question.question,
        'options', v_options,
        'correct_option', case
          when p_manager or v_game.status in ('revealed', 'finished') then v_question.correct_option
          else null
        end,
        'active', v_question.active,
        'created_at', v_question.created_at
      );
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'round_number', h.round_number,
      'category', h.category,
      'question', h.question,
      'correct_option', h.correct_option,
      'allocations', h.allocations,
      'lost_amount', h.lost_amount,
      'remaining_amount', h.remaining_amount
    ) order by h.round_number desc), '[]'::jsonb)
    into v_history
    from public.money_drop_round_history h
    where h.game_id = v_game.id;
  end if;

  return jsonb_build_object(
    'configured', true,
    'settings', jsonb_build_object(
      'enabled', v_settings.enabled,
      'starting_amount', v_settings.starting_amount,
      'total_rounds', v_settings.total_rounds,
      'answer_seconds', v_settings.answer_seconds
    ),
    'game', case when v_game.id is null then null else to_jsonb(v_game) end,
    'players', v_players,
    'question', v_question_json,
    'allocations', v_allocations,
    'history', v_history,
    'current_user_is_player', v_is_player,
    'current_user_is_captain', v_is_captain
  );
end;
$$;

create or replace function public.money_drop_get_public_state()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  return public.money_drop_build_state(false);
end;
$$;

create or replace function public.money_drop_get_manager_state()
returns jsonb
language plpgsql
security definer
stable
set search_path = public, auth
as $$
begin
  perform public.money_drop_require_manager();
  return public.money_drop_build_state(true);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. PARAMÈTRES ET QUESTIONS
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_set_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.money_drop_require_manager();
  update public.money_drop_settings
  set enabled = coalesce(p_enabled, false), updated_by = auth.uid(), updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.money_drop_update_settings(
  p_starting_amount bigint,
  p_total_rounds integer,
  p_answer_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.money_drop_require_manager();
  if p_starting_amount not between 1000 and 1000000000
     or p_total_rounds not between 1 and 12
     or p_answer_seconds not between 10 and 600 then
    raise exception 'invalid_settings';
  end if;

  update public.money_drop_settings
  set starting_amount = p_starting_amount,
      total_rounds = p_total_rounds,
      answer_seconds = p_answer_seconds,
      updated_by = auth.uid(),
      updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.money_drop_add_question(
  p_category text,
  p_question text,
  p_option_a text,
  p_option_b text,
  p_option_c text,
  p_option_d text,
  p_correct_option text
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id bigint;
  v_correct text := upper(trim(coalesce(p_correct_option, '')));
begin
  perform public.money_drop_require_manager();

  if char_length(trim(coalesce(p_category, ''))) < 2
     or char_length(trim(coalesce(p_question, ''))) < 5
     or nullif(trim(p_option_a), '') is null
     or nullif(trim(p_option_b), '') is null
     or v_correct not in ('A', 'B', 'C', 'D')
     or (v_correct = 'C' and nullif(trim(p_option_c), '') is null)
     or (v_correct = 'D' and nullif(trim(p_option_d), '') is null) then
    raise exception 'invalid_question';
  end if;

  insert into public.money_drop_questions (
    category, question, option_a, option_b, option_c, option_d,
    correct_option, created_by
  ) values (
    trim(p_category), trim(p_question), trim(p_option_a), trim(p_option_b),
    nullif(trim(p_option_c), ''), nullif(trim(p_option_d), ''),
    v_correct, auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.money_drop_toggle_question(
  p_question_id bigint,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.money_drop_require_manager();

  if exists (
    select 1 from public.money_drop_games
    where archived_at is null
      and current_question_id = p_question_id
      and status in ('question_open', 'allocations_locked')
  ) then
    raise exception 'question_in_use';
  end if;

  update public.money_drop_questions
  set active = coalesce(p_active, false), updated_at = now()
  where id = p_question_id;

  if not found then raise exception 'question_not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. PARTIE ET ÉQUIPE
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_create_game(
  p_team_name text,
  p_players uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_settings public.money_drop_settings%rowtype;
  v_game_id uuid;
  v_player uuid;
  v_position integer := 0;
begin
  perform public.money_drop_require_manager();

  if exists (
    select 1 from public.money_drop_games
    where archived_at is null and status <> 'cancelled'
  ) then
    raise exception 'active_game_exists';
  end if;

  if coalesce(array_length(p_players, 1), 0) not between 1 and 4
     or (select count(distinct value) from unnest(p_players) value) <> array_length(p_players, 1) then
    raise exception 'invalid_players';
  end if;

  select * into v_settings from public.money_drop_settings where id = 1;

  insert into public.money_drop_games (
    status, team_name, starting_amount, current_amount,
    current_round, total_rounds, created_by
  ) values (
    'setup', coalesce(nullif(trim(p_team_name), ''), 'Équipe Nostra'),
    v_settings.starting_amount, v_settings.starting_amount,
    1, v_settings.total_rounds, auth.uid()
  ) returning id into v_game_id;

  foreach v_player in array p_players loop
    v_position := v_position + 1;
    insert into public.money_drop_players (
      game_id, user_id, position, player_name, is_captain
    ) values (
      v_game_id, v_player, v_position,
      public.money_drop_player_name(v_player), v_position = 1
    );
  end loop;

  return v_game_id;
end;
$$;

create or replace function public.money_drop_select_question(
  p_game_id uuid,
  p_question_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.archived_at is not null then raise exception 'game_not_found'; end if;
  if v_game.status <> 'setup' then raise exception 'game_not_in_setup'; end if;

  if not exists (select 1 from public.money_drop_questions where id = p_question_id and active) then
    raise exception 'question_not_found';
  end if;

  if exists (
    select 1 from public.money_drop_round_history
    where game_id = p_game_id and question_id = p_question_id
  ) then
    raise exception 'question_already_used';
  end if;

  update public.money_drop_games
  set current_question_id = p_question_id, round_deadline = null
  where id = p_game_id;

  delete from public.money_drop_allocations
  where game_id = p_game_id and round_number = v_game.current_round;
end;
$$;

create or replace function public.money_drop_select_random_question(p_game_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id bigint;
begin
  perform public.money_drop_require_manager();

  select q.id into v_question_id
  from public.money_drop_questions q
  where q.active
    and not exists (
      select 1 from public.money_drop_round_history h
      where h.game_id = p_game_id and h.question_id = q.id
    )
  order by random()
  limit 1;

  if v_question_id is null then raise exception 'no_question_available'; end if;
  perform public.money_drop_select_question(p_game_id, v_question_id);
  return v_question_id;
end;
$$;

create or replace function public.money_drop_open_question(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seconds integer;
begin
  perform public.money_drop_require_manager();

  if not exists (
    select 1 from public.money_drop_games
    where id = p_game_id and status = 'setup' and current_question_id is not null
  ) then
    raise exception 'question_missing';
  end if;

  select answer_seconds into v_seconds from public.money_drop_settings where id = 1;
  update public.money_drop_games
  set status = 'question_open', round_deadline = now() + make_interval(secs => v_seconds)
  where id = p_game_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RÉPARTITION ET TRAPPES
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_save_allocations(
  p_game_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question public.money_drop_questions%rowtype;
  v_a bigint := greatest(0, coalesce((p_allocations ->> 'A')::bigint, 0));
  v_b bigint := greatest(0, coalesce((p_allocations ->> 'B')::bigint, 0));
  v_c bigint := greatest(0, coalesce((p_allocations ->> 'C')::bigint, 0));
  v_d bigint := greatest(0, coalesce((p_allocations ->> 'D')::bigint, 0));
  v_total bigint;
  v_empty_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.status <> 'question_open' then raise exception 'question_closed'; end if;
  if v_game.round_deadline is not null and now() > v_game.round_deadline then raise exception 'timer_expired'; end if;

  if not public.money_drop_is_manager() and not exists (
    select 1 from public.money_drop_players
    where game_id = p_game_id and user_id = auth.uid()
  ) then
    raise exception 'not_player';
  end if;

  select * into v_question from public.money_drop_questions where id = v_game.current_question_id;
  if v_question.id is null then raise exception 'question_missing'; end if;

  if nullif(trim(v_question.option_c), '') is null and v_c <> 0 then raise exception 'invalid_option'; end if;
  if nullif(trim(v_question.option_d), '') is null and v_d <> 0 then raise exception 'invalid_option'; end if;

  v_total := v_a + v_b + v_c + v_d;
  if v_total <> v_game.current_amount then raise exception 'allocations_total'; end if;

  if v_a = 0 then v_empty_count := v_empty_count + 1; end if;
  if v_b = 0 then v_empty_count := v_empty_count + 1; end if;
  if nullif(trim(v_question.option_c), '') is not null and v_c = 0 then v_empty_count := v_empty_count + 1; end if;
  if nullif(trim(v_question.option_d), '') is not null and v_d = 0 then v_empty_count := v_empty_count + 1; end if;
  if v_empty_count < 1 then raise exception 'empty_door_required'; end if;

  delete from public.money_drop_allocations
  where game_id = p_game_id and round_number = v_game.current_round;

  insert into public.money_drop_allocations (game_id, round_number, option_key, amount, updated_by)
  values
    (p_game_id, v_game.current_round, 'A', v_a, auth.uid()),
    (p_game_id, v_game.current_round, 'B', v_b, auth.uid());

  if nullif(trim(v_question.option_c), '') is not null then
    insert into public.money_drop_allocations (game_id, round_number, option_key, amount, updated_by)
    values (p_game_id, v_game.current_round, 'C', v_c, auth.uid());
  end if;

  if nullif(trim(v_question.option_d), '') is not null then
    insert into public.money_drop_allocations (game_id, round_number, option_key, amount, updated_by)
    values (p_game_id, v_game.current_round, 'D', v_d, auth.uid());
  end if;
end;
$$;

create or replace function public.money_drop_lock_allocations(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_total bigint;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.status <> 'question_open' then raise exception 'question_not_open'; end if;

  select coalesce(sum(amount), 0) into v_total
  from public.money_drop_allocations
  where game_id = p_game_id and round_number = v_game.current_round;

  if v_total <> v_game.current_amount then raise exception 'allocations_missing'; end if;

  update public.money_drop_games
  set status = 'allocations_locked', round_deadline = null
  where id = p_game_id;
end;
$$;

create or replace function public.money_drop_reveal_answer(p_game_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question public.money_drop_questions%rowtype;
  v_surviving bigint := 0;
  v_lost bigint := 0;
  v_allocations jsonb;
  v_options jsonb;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.status <> 'allocations_locked' then raise exception 'allocations_not_locked'; end if;

  select * into v_question from public.money_drop_questions where id = v_game.current_question_id;
  if v_question.id is null then raise exception 'question_missing'; end if;

  select coalesce(sum(amount), 0) into v_surviving
  from public.money_drop_allocations
  where game_id = p_game_id
    and round_number = v_game.current_round
    and option_key = v_question.correct_option;

  v_lost := v_game.current_amount - v_surviving;

  select jsonb_build_object(
    'A', coalesce(sum(amount) filter (where option_key = 'A'), 0),
    'B', coalesce(sum(amount) filter (where option_key = 'B'), 0),
    'C', coalesce(sum(amount) filter (where option_key = 'C'), 0),
    'D', coalesce(sum(amount) filter (where option_key = 'D'), 0)
  ) into v_allocations
  from public.money_drop_allocations
  where game_id = p_game_id and round_number = v_game.current_round;

  v_options := jsonb_build_array(
    jsonb_build_object('key', 'A', 'label', v_question.option_a),
    jsonb_build_object('key', 'B', 'label', v_question.option_b)
  );
  if nullif(trim(v_question.option_c), '') is not null then
    v_options := v_options || jsonb_build_array(jsonb_build_object('key', 'C', 'label', v_question.option_c));
  end if;
  if nullif(trim(v_question.option_d), '') is not null then
    v_options := v_options || jsonb_build_array(jsonb_build_object('key', 'D', 'label', v_question.option_d));
  end if;

  insert into public.money_drop_round_history (
    game_id, round_number, question_id, category, question, options,
    correct_option, allocations, lost_amount, remaining_amount
  ) values (
    p_game_id, v_game.current_round, v_question.id, v_question.category,
    v_question.question, v_options, v_question.correct_option,
    v_allocations, v_lost, v_surviving
  )
  on conflict (game_id, round_number) do update set
    question_id = excluded.question_id,
    category = excluded.category,
    question = excluded.question,
    options = excluded.options,
    correct_option = excluded.correct_option,
    allocations = excluded.allocations,
    lost_amount = excluded.lost_amount,
    remaining_amount = excluded.remaining_amount,
    revealed_at = now();

  update public.money_drop_games
  set current_amount = v_surviving, status = 'revealed', round_deadline = null
  where id = p_game_id;

  return v_surviving;
end;
$$;

create or replace function public.money_drop_advance_round(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.status <> 'revealed' then raise exception 'round_not_revealed'; end if;

  if v_game.current_amount = 0 or v_game.current_round >= v_game.total_rounds then
    update public.money_drop_games
    set status = 'finished', finished_at = now(), round_deadline = null
    where id = p_game_id;
  else
    delete from public.money_drop_allocations
    where game_id = p_game_id and round_number = v_game.current_round + 1;

    update public.money_drop_games
    set status = 'setup',
        current_round = current_round + 1,
        current_question_id = null,
        round_deadline = null
    where id = p_game_id;
  end if;
end;
$$;

create or replace function public.money_drop_cancel_game(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.money_drop_require_manager();
  update public.money_drop_games
  set status = 'cancelled', archived_at = now(), finished_at = coalesce(finished_at, now()), round_deadline = null
  where id = p_game_id and archived_at is null;
  if not found then raise exception 'game_not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. RLS ET DROITS
-- ---------------------------------------------------------------------------
alter table public.money_drop_settings enable row level security;
alter table public.money_drop_questions enable row level security;
alter table public.money_drop_games enable row level security;
alter table public.money_drop_players enable row level security;
alter table public.money_drop_allocations enable row level security;
alter table public.money_drop_round_history enable row level security;

-- La lecture directe des questions est uniquement nécessaire au Dashboard.
drop policy if exists money_drop_questions_manager_select on public.money_drop_questions;
create policy money_drop_questions_manager_select
on public.money_drop_questions for select
to authenticated
using (public.money_drop_is_manager());

revoke all on table public.money_drop_settings from anon, authenticated;
revoke all on table public.money_drop_questions from anon, authenticated;
revoke all on table public.money_drop_games from anon, authenticated;
revoke all on table public.money_drop_players from anon, authenticated;
revoke all on table public.money_drop_allocations from anon, authenticated;
revoke all on table public.money_drop_round_history from anon, authenticated;

grant select on table public.money_drop_questions to authenticated;

revoke all on function public.money_drop_get_public_state() from public, anon;
revoke all on function public.money_drop_get_manager_state() from public, anon;
revoke all on function public.money_drop_set_enabled(boolean) from public, anon;
revoke all on function public.money_drop_update_settings(bigint, integer, integer) from public, anon;
revoke all on function public.money_drop_add_question(text, text, text, text, text, text, text) from public, anon;
revoke all on function public.money_drop_toggle_question(bigint, boolean) from public, anon;
revoke all on function public.money_drop_create_game(text, uuid[]) from public, anon;
revoke all on function public.money_drop_select_question(uuid, bigint) from public, anon;
revoke all on function public.money_drop_select_random_question(uuid) from public, anon;
revoke all on function public.money_drop_open_question(uuid) from public, anon;
revoke all on function public.money_drop_save_allocations(uuid, jsonb) from public, anon;
revoke all on function public.money_drop_lock_allocations(uuid) from public, anon;
revoke all on function public.money_drop_reveal_answer(uuid) from public, anon;
revoke all on function public.money_drop_advance_round(uuid) from public, anon;
revoke all on function public.money_drop_cancel_game(uuid) from public, anon;

grant execute on function public.money_drop_get_public_state() to authenticated, service_role;
grant execute on function public.money_drop_get_manager_state() to authenticated, service_role;
grant execute on function public.money_drop_set_enabled(boolean) to authenticated, service_role;
grant execute on function public.money_drop_update_settings(bigint, integer, integer) to authenticated, service_role;
grant execute on function public.money_drop_add_question(text, text, text, text, text, text, text) to authenticated, service_role;
grant execute on function public.money_drop_toggle_question(bigint, boolean) to authenticated, service_role;
grant execute on function public.money_drop_create_game(text, uuid[]) to authenticated, service_role;
grant execute on function public.money_drop_select_question(uuid, bigint) to authenticated, service_role;
grant execute on function public.money_drop_select_random_question(uuid) to authenticated, service_role;
grant execute on function public.money_drop_open_question(uuid) to authenticated, service_role;
grant execute on function public.money_drop_save_allocations(uuid, jsonb) to authenticated, service_role;
grant execute on function public.money_drop_lock_allocations(uuid) to authenticated, service_role;
grant execute on function public.money_drop_reveal_answer(uuid) to authenticated, service_role;
grant execute on function public.money_drop_advance_round(uuid) to authenticated, service_role;
grant execute on function public.money_drop_cancel_game(uuid) to authenticated, service_role;

revoke all on function public.money_drop_build_state(boolean) from public, anon, authenticated;
revoke all on function public.money_drop_require_manager() from public, anon, authenticated;
revoke all on function public.money_drop_is_manager() from public, anon;
revoke all on function public.money_drop_player_name(uuid) from public, anon, authenticated;
grant execute on function public.money_drop_is_manager() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. QUESTIONS DE DÉPART ORIGINALES NOSTRA MOTORS
-- ---------------------------------------------------------------------------
insert into public.money_drop_questions (
  category, question, option_a, option_b, option_c, option_d, correct_option
)
values
  ('Automobile', 'Quel élément transmet la puissance du moteur aux roues motrices ?', 'La transmission', 'Le radiateur', 'Le catalyseur', 'Le démarreur', 'A'),
  ('Circuit', 'Quel drapeau indique la fin officielle d’une course ?', 'Le drapeau bleu', 'Le drapeau à damier', 'Le drapeau jaune', 'Le drapeau blanc', 'B'),
  ('Nostra Motors', 'Quel document permet d’identifier officiellement un véhicule ?', 'Le carnet d’entretien', 'La carte grise', 'Le devis commercial', 'Le bon de commande', 'B'),
  ('Sécurité', 'Sur route mouillée, quelle action réduit le plus le risque ?', 'Réduire la distance de sécurité', 'Accélérer dans les virages', 'Augmenter la distance de sécurité', 'Freiner plus tard', 'C'),
  ('Mécanique', 'Quelle pièce recharge principalement la batterie lorsque le moteur tourne ?', 'L’alternateur', 'Le turbo', 'L’embrayage', 'Le filtre à huile', 'A'),
  ('Hypercars', 'Quel matériau est souvent utilisé pour alléger une monocoque de supercar ?', 'Le plomb', 'La fibre de carbone', 'Le cuivre', 'Le béton', 'B'),
  ('Code de la route', 'À quoi sert principalement le système ABS ?', 'Empêcher le blocage des roues au freinage', 'Augmenter la puissance moteur', 'Réduire la consommation à l’arrêt', 'Gonfler automatiquement les pneus', 'A'),
  ('Entretien', 'Quel contrôle est prioritaire avant une longue sortie sur circuit ?', 'La couleur des sièges', 'La pression et l’état des pneus', 'Le volume de l’autoradio', 'La taille du coffre', 'B'),
  ('Finale', 'Quel principe protège le mieux une voiture de collection sur la durée ?', 'Un stockage sec et un entretien régulier', 'La laisser dehors toute l’année', null, null, 'A'),
  ('Finale', 'Pour conserver la cagnotte finale, faut-il placer l’argent sur une ou deux réponses ?', 'Une seule réponse', 'Les deux réponses', null, null, 'A')
on conflict do nothing;

-- Recharge du cache API Supabase.
notify pgrst, 'reload schema';
