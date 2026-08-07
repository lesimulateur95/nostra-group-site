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

drop function if exists public.money_drop_select_random_question(uuid);
drop function if exists public.money_drop_select_random_question(uuid, text);

create function public.money_drop_select_random_question(
  p_game_id uuid,
  p_category text default null
)
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
    and (
      nullif(trim(p_category), '') is null
      or lower(trim(q.category)) = lower(trim(p_category))
    )
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
revoke all on function public.money_drop_select_random_question(uuid, text) from public, anon;
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
grant execute on function public.money_drop_select_random_question(uuid, text) to authenticated, service_role;
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
-- 8. BANQUE DE 200 QUESTIONS — 20 THÈMES DE 10 QUESTIONS
-- ---------------------------------------------------------------------------
-- Les questions sont regroupées directement par thème dans la régie.
-- Une réexécution met à jour les questions livrées sans créer de doublons.
insert into public.money_drop_questions (
  category, question, option_a, option_b, option_c, option_d, correct_option
)
values
  ('Automobile', 'Quel élément transmet la puissance du moteur aux roues motrices ?', 'La transmission', 'Le radiateur', 'Le catalyseur', 'Le démarreur', 'A'),
  ('Automobile', 'Quel drapeau indique la fin officielle d’une course ?', 'Le drapeau bleu', 'Le drapeau à damier', 'Le drapeau jaune', 'Le drapeau blanc', 'B'),
  ('Automobile', 'Quel document permet d’identifier officiellement un véhicule ?', 'Le carnet d’entretien', 'La carte grise', 'Le devis commercial', 'Le bon de commande', 'B'),
  ('Automobile', 'Sur route mouillée, quelle action réduit le plus le risque ?', 'Réduire la distance de sécurité', 'Accélérer dans les virages', 'Augmenter la distance de sécurité', 'Freiner plus tard', 'C'),
  ('Automobile', 'Quelle pièce recharge principalement la batterie lorsque le moteur tourne ?', 'L’alternateur', 'Le turbo', 'L’embrayage', 'Le filtre à huile', 'A'),
  ('Automobile', 'Quel matériau est souvent utilisé pour alléger une monocoque de supercar ?', 'Le plomb', 'La fibre de carbone', 'Le cuivre', 'Le béton', 'B'),
  ('Automobile', 'À quoi sert principalement le système ABS ?', 'Empêcher le blocage des roues au freinage', 'Augmenter la puissance moteur', 'Réduire la consommation à l’arrêt', 'Gonfler automatiquement les pneus', 'A'),
  ('Automobile', 'Quel contrôle est prioritaire avant une longue sortie sur circuit ?', 'La couleur des sièges', 'La pression et l’état des pneus', 'Le volume de l’autoradio', 'La taille du coffre', 'B'),
  ('Automobile', 'Quel liquide transmet la pression dans un système de freinage hydraulique ?', 'Le liquide de refroidissement', 'Le liquide de frein', 'L’huile moteur', 'Le carburant', 'B'),
  ('Automobile', 'Quel élément utilise les gaz d’échappement pour comprimer l’air admis ?', 'Le turbocompresseur', 'Le démarreur', 'Le différentiel', 'Le thermostat', 'A'),
  ('Culture générale', 'Quelle est la capitale du Portugal ?', 'Madrid', 'Lisbonne', 'Porto', 'Rome', 'B'),
  ('Culture générale', 'Quelle langue est principalement parlée au Brésil ?', 'L’espagnol', 'Le portugais', 'Le français', 'L’italien', 'B'),
  ('Culture générale', 'Quel océan est le plus vaste de la planète ?', 'L’océan Atlantique', 'L’océan Indien', 'L’océan Pacifique', 'L’océan Arctique', 'C'),
  ('Culture générale', 'Dans quelle ville se trouve la tour Eiffel ?', 'Lyon', 'Bruxelles', 'Paris', 'Genève', 'C'),
  ('Culture générale', 'Quel est le plus grand continent par sa superficie ?', 'L’Afrique', 'L’Asie', 'L’Europe', 'L’Amérique du Sud', 'B'),
  ('Culture générale', 'Combien de jours compte une année bissextile ?', '364', '365', '366', '367', 'C'),
  ('Culture générale', 'Quelle couleur obtient-on en mélangeant du bleu et du jaune ?', 'Orange', 'Vert', 'Violet', 'Rouge', 'B'),
  ('Culture générale', 'Quelle valeur représente le chiffre romain X ?', '5', '10', '50', '100', 'B'),
  ('Culture générale', 'Combien de jours compte une semaine ?', '5', '6', '7', '8', 'C'),
  ('Culture générale', 'Quel instrument sert à mesurer la température ?', 'Un baromètre', 'Un thermomètre', 'Un altimètre', 'Un chronomètre', 'B'),
  ('Géographie', 'Quelle est la capitale du Japon ?', 'Kyoto', 'Tokyo', 'Osaka', 'Séoul', 'B'),
  ('Géographie', 'Sur quel continent se trouve le désert du Sahara ?', 'L’Asie', 'L’Amérique du Sud', 'L’Afrique', 'L’Europe', 'C'),
  ('Géographie', 'Quel est le plus long fleuve entièrement situé en France ?', 'La Seine', 'La Garonne', 'Le Rhône', 'La Loire', 'D'),
  ('Géographie', 'Dans quelle chaîne de montagnes se trouve le mont Blanc ?', 'Les Pyrénées', 'Les Alpes', 'Les Andes', 'L’Himalaya', 'B'),
  ('Géographie', 'Quelle est la capitale de l’Australie ?', 'Canberra', 'Sydney', 'Melbourne', 'Perth', 'A'),
  ('Géographie', 'Quel est le plus vaste pays du monde par sa superficie ?', 'Le Canada', 'La Chine', 'La Russie', 'Les États-Unis', 'C'),
  ('Géographie', 'Quelle est la capitale du Canada ?', 'Toronto', 'Vancouver', 'Ottawa', 'Montréal', 'C'),
  ('Géographie', 'Sur quel continent se trouve la cordillère des Andes ?', 'L’Amérique du Sud', 'L’Asie', 'L’Afrique', 'L’Europe', 'A'),
  ('Géographie', 'Quelle mer se situe au sud de l’Europe ?', 'La mer Baltique', 'La mer Méditerranée', 'La mer du Nord', 'La mer de Béring', 'B'),
  ('Géographie', 'Dans quelle mer le Nil se jette-t-il ?', 'La mer Rouge', 'La mer Noire', 'La mer Méditerranée', 'La mer Caspienne', 'C'),
  ('Histoire', 'En quelle année débute la Révolution française ?', '1492', '1789', '1815', '1914', 'B'),
  ('Histoire', 'Quel peuple de l’Antiquité a construit les pyramides de Gizeh ?', 'Les Romains', 'Les Vikings', 'Les Égyptiens', 'Les Gaulois', 'C'),
  ('Histoire', 'Qui fut le premier humain à marcher sur la Lune ?', 'Youri Gagarine', 'Buzz Aldrin', 'Neil Armstrong', 'Thomas Pesquet', 'C'),
  ('Histoire', 'Quelle ville était au cœur de l’Empire romain ?', 'Athènes', 'Rome', 'Alexandrie', 'Londres', 'B'),
  ('Histoire', 'En quelle année le mur de Berlin est-il tombé ?', '1961', '1975', '1989', '1999', 'C'),
  ('Histoire', 'À quel conflit Jeanne d’Arc est-elle principalement associée ?', 'La guerre de Cent Ans', 'Les guerres napoléoniennes', 'La guerre de Trente Ans', 'La guerre de Crimée', 'A'),
  ('Histoire', 'En quelle année Christophe Colomb atteint-il les Amériques ?', '1066', '1492', '1515', '1789', 'B'),
  ('Histoire', 'En quelle année commence la Première Guerre mondiale ?', '1870', '1914', '1939', '1945', 'B'),
  ('Histoire', 'Qui est généralement associé à l’invention de l’imprimerie à caractères mobiles en Europe ?', 'Galilée', 'Gutenberg', 'Newton', 'Pasteur', 'B'),
  ('Histoire', 'Quel roi de France était surnommé le Roi-Soleil ?', 'Louis IX', 'Louis XIII', 'Louis XIV', 'Louis XVI', 'C'),
  ('Sciences', 'Que représente la formule chimique H₂O ?', 'Le dioxyde de carbone', 'L’eau', 'L’oxygène', 'Le sel', 'B'),
  ('Sciences', 'Combien de cavités possède normalement le cœur humain ?', 'Deux', 'Trois', 'Quatre', 'Six', 'C'),
  ('Sciences', 'Quel est le symbole chimique de l’or ?', 'Au', 'Ag', 'Or', 'Fe', 'A'),
  ('Sciences', 'À quelle température l’eau pure gèle-t-elle normalement ?', '0 °C', '10 °C', '-10 °C', '100 °C', 'A'),
  ('Sciences', 'Quel gaz est le plus abondant dans l’atmosphère terrestre ?', 'L’oxygène', 'L’azote', 'Le dioxyde de carbone', 'L’hydrogène', 'B'),
  ('Sciences', 'Quelle force attire les objets vers le sol ?', 'Le magnétisme', 'La gravité', 'La poussée', 'La friction', 'B'),
  ('Sciences', 'Quelle est l’unité de l’intensité électrique ?', 'Le volt', 'Le watt', 'L’ampère', 'L’ohm', 'C'),
  ('Sciences', 'Quel pH correspond à une solution neutre ?', '0', '5', '7', '14', 'C'),
  ('Sciences', 'Combien d’os compte généralement le squelette humain adulte ?', '106', '206', '306', '406', 'B'),
  ('Sciences', 'Quel organe filtre principalement le sang pour produire l’urine ?', 'Le poumon', 'Le rein', 'L’estomac', 'Le pancréas', 'B'),
  ('Espace', 'Quelle planète est surnommée la planète rouge ?', 'Vénus', 'Mars', 'Saturne', 'Neptune', 'B'),
  ('Espace', 'Quelle est la plus grande planète du Système solaire ?', 'La Terre', 'Mars', 'Jupiter', 'Uranus', 'C'),
  ('Espace', 'Quelle planète est la plus proche du Soleil ?', 'Mercure', 'Vénus', 'La Terre', 'Mars', 'A'),
  ('Espace', 'Quel est le satellite naturel de la Terre ?', 'Phobos', 'La Lune', 'Europe', 'Titan', 'B'),
  ('Espace', 'Dans quelle galaxie se trouve le Système solaire ?', 'Andromède', 'La Voie lactée', 'Le Grand Nuage de Magellan', 'La galaxie du Sombrero', 'B'),
  ('Espace', 'Qui fut le premier humain envoyé dans l’espace ?', 'Neil Armstrong', 'Youri Gagarine', 'John Glenn', 'Buzz Aldrin', 'B'),
  ('Espace', 'Quelle planète est célèbre pour ses anneaux très visibles ?', 'Mercure', 'Mars', 'Saturne', 'Vénus', 'C'),
  ('Espace', 'Quelle étoile est la plus proche de la Terre ?', 'Sirius', 'Le Soleil', 'Véga', 'Bételgeuse', 'B'),
  ('Espace', 'Quel instrument permet d’observer les astres lointains ?', 'Un microscope', 'Un télescope', 'Un sismographe', 'Un hygromètre', 'B'),
  ('Espace', 'Qu’est-ce que le Soleil ?', 'Une planète', 'Une étoile', 'Un satellite', 'Une comète', 'B'),
  ('Technologie', 'Dans un ordinateur, que désigne généralement le sigle CPU ?', 'La carte graphique', 'Le processeur', 'Le disque dur', 'L’écran', 'B'),
  ('Technologie', 'Quels chiffres sont utilisés dans le système binaire ?', '0 et 1', '1 et 2', '0 à 9', '2 et 3', 'A'),
  ('Technologie', 'Qui est associé à l’invention du World Wide Web ?', 'Steve Jobs', 'Bill Gates', 'Tim Berners-Lee', 'Alan Turing', 'C'),
  ('Technologie', 'À quoi sert principalement le langage HTML ?', 'Structurer le contenu d’une page web', 'Retoucher des photos', 'Réparer un ordinateur', 'Chiffrer une carte bancaire', 'A'),
  ('Technologie', 'À quoi sert principalement la mémoire RAM ?', 'Stocker temporairement les données utilisées', 'Imprimer des documents', 'Refroidir le processeur', 'Alimenter l’écran', 'A'),
  ('Technologie', 'Que signifie le S dans HTTPS ?', 'Simple', 'Secure', 'System', 'Static', 'B'),
  ('Technologie', 'Que représente une URL ?', 'L’adresse d’une ressource sur Internet', 'Un type de batterie', 'Un format audio', 'Une carte graphique', 'A'),
  ('Technologie', 'Quel type de code est un QR code ?', 'Un code sonore', 'Un code-barres en deux dimensions', 'Un mot de passe vocal', 'Un fichier vidéo', 'B'),
  ('Technologie', 'Lequel de ces noms désigne un système d’exploitation ?', 'Linux', 'Bluetooth', 'HDMI', 'JPEG', 'A'),
  ('Technologie', 'Quel raccourci clavier sert généralement à copier sur Windows ?', 'Ctrl + V', 'Ctrl + C', 'Ctrl + Z', 'Ctrl + P', 'B'),
  ('Sport', 'Combien de joueurs une équipe de football aligne-t-elle normalement sur le terrain ?', '9', '10', '11', '12', 'C'),
  ('Sport', 'Combien de points vaut un essai au rugby à XV ?', '3 points', '5 points', '6 points', '7 points', 'B'),
  ('Sport', 'À quelle hauteur se trouve approximativement un panier de basket officiel ?', '2,05 m', '2,55 m', '3,05 m', '3,55 m', 'C'),
  ('Sport', 'À quelle fréquence ont lieu normalement les Jeux olympiques d’été ?', 'Tous les 2 ans', 'Tous les 3 ans', 'Tous les 4 ans', 'Tous les 5 ans', 'C'),
  ('Sport', 'Quelle suite de points est utilisée au tennis avant l’avantage ?', '10, 20, 30', '15, 30, 40', '20, 40, 60', '25, 50, 75', 'B'),
  ('Sport', 'Quelle est la distance officielle d’un marathon ?', '21,097 km', '40 km', '42,195 km', '50 km', 'C'),
  ('Sport', 'Combien de joueurs une équipe de volley-ball aligne-t-elle sur le terrain ?', '5', '6', '7', '8', 'B'),
  ('Sport', 'Dans quel espace se déroule un combat de boxe ?', 'Un court', 'Un ring', 'Une piste', 'Un tatami uniquement', 'B'),
  ('Sport', 'Combien de nages différentes composent le quatre nages ?', '2', '3', '4', '5', 'C'),
  ('Sport', 'Le Tour de France est une compétition de quel sport ?', 'Cyclisme', 'Athlétisme', 'Natation', 'Ski', 'A'),
  ('Football', 'À quelle distance du but se trouve le point de penalty ?', '9 mètres', '10 mètres', '11 mètres', '12 mètres', 'C'),
  ('Football', 'Que provoque normalement un carton rouge ?', 'Un simple avertissement', 'L’exclusion du joueur', 'Un remplacement obligatoire', 'La fin du match', 'B'),
  ('Football', 'Dans quelle zone le gardien peut-il normalement toucher le ballon avec les mains ?', 'Dans tout le terrain', 'Dans sa surface de réparation', 'Seulement dans le rond central', 'Uniquement sur corner', 'B'),
  ('Football', 'Quelle est la durée réglementaire d’un match sans prolongation ?', '60 minutes', '80 minutes', '90 minutes', '100 minutes', 'C'),
  ('Football', 'Comment appelle-t-on trois buts marqués par le même joueur dans un match ?', 'Un doublé', 'Un triplé', 'Un hat-trick', 'Un clean sheet', 'C'),
  ('Football', 'Quel coup de pied est accordé lorsque le ballon sort derrière le but après avoir été touché en dernier par un défenseur ?', 'Un coup franc', 'Un corner', 'Une touche', 'Un penalty automatique', 'B'),
  ('Football', 'Que représente généralement un carton jaune ?', 'Un avertissement', 'Une expulsion définitive', 'Un but annulé', 'Une prolongation', 'A'),
  ('Football', 'À quelle fréquence se déroule normalement la Coupe du monde masculine ?', 'Tous les 2 ans', 'Tous les 3 ans', 'Tous les 4 ans', 'Tous les 6 ans', 'C'),
  ('Football', 'Comment s’appelle la barre horizontale située au-dessus du but ?', 'Le poteau', 'La transversale', 'La ligne de touche', 'Le filet', 'B'),
  ('Football', 'Quelle partie du corps un joueur de champ ne peut-il pas utiliser volontairement ?', 'La tête', 'Le torse', 'Le pied', 'La main', 'D'),
  ('Cinéma & séries', 'Comment s’appelle le cow-boy dans Toy Story ?', 'Buzz', 'Woody', 'Rex', 'Sully', 'B'),
  ('Cinéma & séries', 'Qui a réalisé le film Titanic sorti en 1997 ?', 'Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott', 'C'),
  ('Cinéma & séries', 'Comment s’appelle l’école de magie de Harry Potter ?', 'Poudlard', 'Narnia', 'Camelot', 'Nevermore', 'A'),
  ('Cinéma & séries', 'Quel est le nom du jeune lion héros du Roi Lion ?', 'Scar', 'Mufasa', 'Simba', 'Timon', 'C'),
  ('Cinéma & séries', 'Dans quelle saga apparaît Dark Vador ?', 'Star Trek', 'Star Wars', 'Le Seigneur des anneaux', 'Indiana Jones', 'B'),
  ('Cinéma & séries', 'Comment s’appellent les deux sœurs principales de La Reine des neiges ?', 'Anna et Elsa', 'Ariel et Jasmine', 'Belle et Aurore', 'Mulan et Mérida', 'A'),
  ('Cinéma & séries', 'Quels animaux sont au centre de Jurassic Park ?', 'Des dragons', 'Des dinosaures', 'Des requins', 'Des robots', 'B'),
  ('Cinéma & séries', 'Comment s’appelle le héros principal de Matrix ?', 'Neo', 'Morpheus', 'Trinity', 'Smith', 'A'),
  ('Cinéma & séries', 'Comment s’appelle le café fréquenté dans la série Friends ?', 'Central Perk', 'Monk’s Café', 'Luke’s Diner', 'The Max', 'A'),
  ('Cinéma & séries', 'Dans quelle ville fictive se déroule principalement Stranger Things ?', 'Sunnydale', 'Hawkins', 'Springfield', 'Gotham', 'B'),
  ('Musique', 'Combien de touches possède généralement un piano standard ?', '64', '72', '88', '96', 'C'),
  ('Musique', 'Combien de cordes possède un violon classique ?', '4', '5', '6', '8', 'A'),
  ('Musique', 'De quel pays est originaire le groupe The Beatles ?', 'Les États-Unis', 'Le Royaume-Uni', 'L’Australie', 'Le Canada', 'B'),
  ('Musique', 'Quel appareil aide un musicien à garder un tempo régulier ?', 'Un diapason', 'Un métronome', 'Un amplificateur', 'Un égaliseur', 'B'),
  ('Musique', 'Quelle clé est couramment utilisée pour les notes aiguës ?', 'La clé de sol', 'La clé de fa', 'La clé d’ut quatrième', 'La clé de percussion', 'A'),
  ('Musique', 'Quel instrument possède généralement six cordes ?', 'La guitare', 'Le violon', 'La trompette', 'La flûte', 'A'),
  ('Musique', 'De quel pays Mozart était-il originaire ?', 'Autriche', 'Italie', 'France', 'Espagne', 'A'),
  ('Musique', 'Que désigne le tempo en musique ?', 'La vitesse d’exécution', 'Le volume sonore', 'La hauteur d’une note', 'Le nombre d’instruments', 'A'),
  ('Musique', 'Qui dirige habituellement un orchestre ?', 'Le soliste', 'Le chef d’orchestre', 'Le luthier', 'Le choriste', 'B'),
  ('Musique', 'À quelle famille appartient le saxophone ?', 'Les cordes', 'Les bois', 'Les percussions', 'Les claviers', 'B'),
  ('Cuisine', 'Quel ingrédient est la base du guacamole ?', 'La courgette', 'L’avocat', 'Le concombre', 'Le poivron', 'B'),
  ('Cuisine', 'De quel pays les sushis sont-ils originaires ?', 'La Chine', 'La Thaïlande', 'Le Japon', 'La Corée du Sud', 'C'),
  ('Cuisine', 'Quel aliment constitue la base d’un risotto traditionnel ?', 'Le riz', 'Les pâtes', 'La semoule', 'La pomme de terre', 'A'),
  ('Cuisine', 'Quel plat provençal est composé principalement de légumes mijotés ?', 'La choucroute', 'La ratatouille', 'Le cassoulet', 'La tartiflette', 'B'),
  ('Cuisine', 'Quel ingrédient est à la base du houmous ?', 'Les pois chiches', 'Les lentilles', 'Les haricots rouges', 'Le maïs', 'A'),
  ('Cuisine', 'Quels ingrédients forment principalement une mayonnaise classique ?', 'Huile et jaune d’œuf', 'Lait et farine', 'Eau et sucre', 'Tomate et vinaigre', 'A'),
  ('Cuisine', 'À quelle famille appartient le croissant ?', 'Les viennoiseries', 'Les charcuteries', 'Les confiseries', 'Les potages', 'A'),
  ('Cuisine', 'De quel pays la paella est-elle originaire ?', 'Italie', 'Espagne', 'Grèce', 'Portugal', 'B'),
  ('Cuisine', 'À partir de quelle plante fabrique-t-on principalement le tofu ?', 'Le soja', 'Le blé', 'Le riz', 'Le pois', 'A'),
  ('Cuisine', 'Quel ingrédient chauffe-t-on pour obtenir du caramel ?', 'Le sel', 'Le sucre', 'La farine', 'Le beurre seul', 'B'),
  ('Nature', 'Quel fruit pousse sur un chêne ?', 'Une noix', 'Un gland', 'Une châtaigne', 'Une noisette', 'B'),
  ('Nature', 'Quel phénomène permet aux plantes de produire de la matière grâce à la lumière ?', 'La fermentation', 'La photosynthèse', 'L’évaporation', 'La combustion', 'B'),
  ('Nature', 'Quel phénomène transforme l’eau liquide en vapeur ?', 'La condensation', 'L’évaporation', 'La solidification', 'La fusion', 'B'),
  ('Nature', 'Comment appelle-t-on une roche formée par le refroidissement du magma ?', 'Une roche magmatique', 'Une roche sédimentaire uniquement', 'Une roche organique', 'Une roche artificielle', 'A'),
  ('Nature', 'Que permettent souvent d’estimer les cernes d’un tronc d’arbre ?', 'Son âge', 'Sa hauteur exacte', 'Le nombre de feuilles', 'La profondeur de ses racines', 'A'),
  ('Nature', 'Quels organismes construisent principalement les récifs coralliens ?', 'Des poissons', 'Des coraux', 'Des algues uniquement', 'Des coquillages uniquement', 'B'),
  ('Nature', 'Laquelle de ces sources d’énergie est renouvelable ?', 'Le charbon', 'Le pétrole', 'Le solaire', 'Le gaz naturel', 'C'),
  ('Nature', 'Quelle saison vient juste après le printemps ?', 'L’automne', 'L’été', 'L’hiver', 'La mousson', 'B'),
  ('Nature', 'Quel déchet convient généralement au compostage ?', 'Une peau de banane', 'Une pile électrique', 'Une bouteille en verre', 'Une canette en aluminium', 'A'),
  ('Nature', 'Comment appelle-t-on l’eau qui tombe des nuages sous forme liquide ?', 'La rosée', 'La pluie', 'Le brouillard', 'La vapeur', 'B'),
  ('Animaux', 'Quel est le plus grand animal vivant connu ?', 'L’éléphant d’Afrique', 'La baleine bleue', 'Le requin-baleine', 'La girafe', 'B'),
  ('Animaux', 'Combien de pattes possède une araignée ?', '6', '8', '10', '12', 'B'),
  ('Animaux', 'Quelle substance est produite par les abeilles à partir du nectar ?', 'Le lait', 'Le miel', 'La farine', 'Le cacao', 'B'),
  ('Animaux', 'Quel mammifère pond des œufs ?', 'Le dauphin', 'L’ornithorynque', 'Le cheval', 'Le lion', 'B'),
  ('Animaux', 'Quel est l’animal terrestre le plus rapide ?', 'Le guépard', 'Le lion', 'L’antilope', 'Le cheval', 'A'),
  ('Animaux', 'Quel est le plus grand animal terrestre actuel ?', 'Le rhinocéros blanc', 'L’éléphant d’Afrique', 'La girafe', 'L’hippopotame', 'B'),
  ('Animaux', 'À quelle classe appartient la grenouille ?', 'Les reptiles', 'Les amphibiens', 'Les mammifères', 'Les oiseaux', 'B'),
  ('Animaux', 'Combien de bras possède une pieuvre ?', '6', '8', '10', '12', 'B'),
  ('Animaux', 'Le manchot appartient à quelle classe animale ?', 'Les poissons', 'Les oiseaux', 'Les mammifères', 'Les reptiles', 'B'),
  ('Animaux', 'Quel mammifère est capable de vol actif ?', 'L’écureuil', 'La chauve-souris', 'Le lémurien', 'Le koala', 'B'),
  ('Logique & maths', 'Quel est le résultat de 12 multiplié par 12 ?', '124', '132', '144', '154', 'C'),
  ('Logique & maths', 'Quelle est la moitié de 250 ?', '100', '115', '125', '150', 'C'),
  ('Logique & maths', 'Combien font 15 % de 200 ?', '15', '20', '30', '40', 'C'),
  ('Logique & maths', 'Combien font 3 + 4 × 2 en respectant les priorités ?', '11', '14', '10', '16', 'A'),
  ('Logique & maths', 'Quel est le périmètre d’un carré de 5 cm de côté ?', '10 cm', '20 cm', '25 cm', '30 cm', 'B'),
  ('Logique & maths', 'Quelle est la somme des angles d’un triangle ?', '90°', '180°', '270°', '360°', 'B'),
  ('Logique & maths', 'Combien font 1 000 divisé par 8 ?', '100', '120', '125', '150', 'C'),
  ('Logique & maths', 'Quel nombre complète la suite 2, 4, 8, 16, ... ?', '18', '24', '30', '32', 'D'),
  ('Logique & maths', 'À quel pourcentage correspondent trois quarts ?', '25 %', '50 %', '75 %', '80 %', 'C'),
  ('Logique & maths', 'Lequel de ces nombres est premier ?', '21', '29', '35', '39', 'B'),
  ('Jeux de société', 'Combien de faces possède un dé classique ?', '4', '6', '8', '10', 'B'),
  ('Jeux de société', 'Combien de cartes contient un jeu standard sans joker ?', '32', '40', '52', '64', 'C'),
  ('Jeux de société', 'Combien de pièces chaque joueur possède-t-il au début d’une partie d’échecs ?', '8', '12', '16', '20', 'C'),
  ('Jeux de société', 'Comment se termine une partie d’échecs lorsque le roi ne peut plus échapper à une attaque ?', 'Par un roque', 'Par un échec et mat', 'Par une promotion', 'Par une prise en passant', 'B'),
  ('Jeux de société', 'Dans quel jeu peut-on acheter des rues et construire des hôtels ?', 'Monopoly', 'Cluedo', 'Scrabble', 'Risk', 'A'),
  ('Jeux de société', 'Dans quel jeu forme-t-on des mots avec des lettres sur un plateau ?', 'Uno', 'Scrabble', 'Puissance 4', 'Bataille navale', 'B'),
  ('Jeux de société', 'Combien de dominos contient un jeu traditionnel double-six ?', '21', '24', '28', '36', 'C'),
  ('Jeux de société', 'Quelle carte d’Uno change le sens du jeu ?', 'La carte Inversion', 'La carte +2 uniquement', 'La carte 0', 'La carte 7', 'A'),
  ('Jeux de société', 'Comment se déplacent généralement les pions aux dames ?', 'En diagonale', 'En ligne droite seulement', 'Comme un cavalier', 'Sans règle', 'A'),
  ('Jeux de société', 'Au poker, qu’est-ce qu’une couleur ?', 'Cinq cartes de la même enseigne', 'Cinq cartes consécutives seulement', 'Quatre cartes identiques', 'Deux paires', 'A'),
  ('Jeux vidéo', 'Comment s’appelle le frère de Mario ?', 'Wario', 'Luigi', 'Toad', 'Yoshi', 'B'),
  ('Jeux vidéo', 'Quel jeu est célèbre pour son monde construit avec des blocs ?', 'Minecraft', 'Rocket League', 'FIFA', 'Gran Turismo', 'A'),
  ('Jeux vidéo', 'Comment s’appelle la ville principale de GTA V ?', 'Liberty City', 'Vice City', 'Los Santos', 'San Fierro', 'C'),
  ('Jeux vidéo', 'À quel genre appartient principalement Fortnite Battle Royale ?', 'Jeu de course', 'Battle royale', 'Jeu de gestion', 'Jeu de rythme', 'B'),
  ('Jeux vidéo', 'Quelle entreprise fabrique les consoles PlayStation ?', 'Nintendo', 'Sony', 'Microsoft', 'Sega', 'B'),
  ('Jeux vidéo', 'Quelle entreprise fabrique les consoles Xbox ?', 'Microsoft', 'Sony', 'Nintendo', 'Atari', 'A'),
  ('Jeux vidéo', 'Comment s’appelle le héros principal de The Legend of Zelda ?', 'Zelda', 'Link', 'Ganondorf', 'Epona', 'B'),
  ('Jeux vidéo', 'Quel type de Pokémon est Pikachu ?', 'Feu', 'Eau', 'Électrik', 'Plante', 'C'),
  ('Jeux vidéo', 'Comment appelle-t-on les formes composées de quatre blocs dans Tetris ?', 'Des pentominos', 'Des tétriminos', 'Des dominos', 'Des hexagones', 'B'),
  ('Jeux vidéo', 'Quel personnage jaune mange des gommes dans un labyrinthe ?', 'Sonic', 'Pac-Man', 'Kirby', 'Mega Man', 'B'),
  ('Littérature & français', 'Qui a écrit Le Petit Prince ?', 'Victor Hugo', 'Antoine de Saint-Exupéry', 'Jules Verne', 'Albert Camus', 'B'),
  ('Littérature & français', 'Quel est le pluriel du mot cheval ?', 'Chevals', 'Chevaux', 'Chevales', 'Chevaus', 'B'),
  ('Littérature & français', 'Qui a écrit Les Misérables ?', 'Émile Zola', 'Victor Hugo', 'Molière', 'Marcel Proust', 'B'),
  ('Littérature & français', 'Qui a écrit Les Trois Mousquetaires ?', 'Alexandre Dumas', 'Jules Verne', 'Gustave Flaubert', 'Honoré de Balzac', 'A'),
  ('Littérature & français', 'Quel mot est un synonyme de rapide ?', 'Lent', 'Vif', 'Lourd', 'Calme', 'B'),
  ('Littérature & français', 'Quel est le rôle principal d’un adjectif qualificatif ?', 'Qualifier un nom', 'Remplacer un verbe', 'Indiquer une ponctuation', 'Former un nombre', 'A'),
  ('Littérature & français', 'Quel est l’infinitif de « nous faisons » ?', 'Faire', 'Faisir', 'Faisonner', 'Fait', 'A'),
  ('Littérature & français', 'Quel est le féminin du mot acteur ?', 'Acteuse', 'Actrice', 'Acteure', 'Acteuresse', 'B'),
  ('Littérature & français', 'Quel est l’antonyme du mot chaud ?', 'Tiède', 'Froid', 'Brûlant', 'Sec', 'B'),
  ('Littérature & français', 'Combien de lettres compte l’alphabet français moderne ?', '24', '25', '26', '27', 'C'),
  ('Mythologie', 'Qui est le roi des dieux dans la mythologie grecque ?', 'Apollon', 'Zeus', 'Hermès', 'Arès', 'B'),
  ('Mythologie', 'Quel dieu grec règne sur la mer ?', 'Hadès', 'Poséidon', 'Héphaïstos', 'Dionysos', 'B'),
  ('Mythologie', 'Quel dieu grec règne sur le monde souterrain ?', 'Hadès', 'Zeus', 'Pan', 'Éros', 'A'),
  ('Mythologie', 'Comment s’appelle le marteau de Thor ?', 'Excalibur', 'Mjöllnir', 'Gungnir', 'Gram', 'B'),
  ('Mythologie', 'Qui est le dieu principal de la mythologie nordique ?', 'Loki', 'Odin', 'Baldr', 'Týr', 'B'),
  ('Mythologie', 'Quelle créature mi-homme mi-taureau vivait dans un labyrinthe ?', 'Le Cyclope', 'Le Minotaure', 'Le Centaure', 'Le Sphinx', 'B'),
  ('Mythologie', 'Quel héros grec possède un célèbre point faible au talon ?', 'Héraclès', 'Achille', 'Persée', 'Ulysse', 'B'),
  ('Mythologie', 'Quel dieu égyptien est représenté avec une tête de chacal ?', 'Râ', 'Anubis', 'Horus', 'Thot', 'B'),
  ('Mythologie', 'Quel animal est Pégase ?', 'Un cheval ailé', 'Un lion ailé', 'Un serpent géant', 'Un taureau de feu', 'A'),
  ('Mythologie', 'Quelle déesse grecque est associée à la sagesse ?', 'Aphrodite', 'Athéna', 'Héra', 'Artémis', 'B'),
  ('France & patrimoine', 'Quelle est la capitale de la France ?', 'Lyon', 'Paris', 'Marseille', 'Bordeaux', 'B'),
  ('France & patrimoine', 'Quelle est la devise de la République française ?', 'Honneur et Patrie', 'Liberté, Égalité, Fraternité', 'Unité et Travail', 'Ordre et Progrès', 'B'),
  ('France & patrimoine', 'À quelle date est célébrée la fête nationale française ?', 'Le 1er mai', 'Le 8 mai', 'Le 14 juillet', 'Le 11 novembre', 'C'),
  ('France & patrimoine', 'Quel fleuve traverse Paris ?', 'La Loire', 'La Seine', 'Le Rhône', 'La Garonne', 'B'),
  ('France & patrimoine', 'Dans quelle région se trouve le Mont-Saint-Michel ?', 'Normandie', 'Bretagne administrative', 'Provence-Alpes-Côte d’Azur', 'Grand Est', 'A'),
  ('France & patrimoine', 'Pour quelle exposition la tour Eiffel a-t-elle été construite ?', 'L’Exposition universelle de 1889', 'L’Exposition coloniale de 1931', 'Les Jeux olympiques de 1900', 'L’Exposition universelle de 1900', 'A'),
  ('France & patrimoine', 'Quel célèbre musée parisien abrite la Joconde ?', 'Le musée d’Orsay', 'Le Louvre', 'Le Centre Pompidou', 'Le musée Rodin', 'B'),
  ('France & patrimoine', 'De quelle région le camembert est-il originaire ?', 'Normandie', 'Alsace', 'Bourgogne', 'Corse', 'A'),
  ('France & patrimoine', 'Quelle grande ville française est située sur la Méditerranée ?', 'Lille', 'Marseille', 'Rennes', 'Orléans', 'B'),
  ('France & patrimoine', 'Quel numéro porte le département de la Vendée ?', '75', '85', '95', '44', 'B')
on conflict (lower(trim(question))) do update set
  category = excluded.category,
  option_a = excluded.option_a,
  option_b = excluded.option_b,
  option_c = excluded.option_c,
  option_d = excluded.option_d,
  correct_option = excluded.correct_option,
  active = true;

-- Recharge du cache API Supabase.
notify pgrst, 'reload schema';

-- NOSTRA GROUP V138.4 — 50 QUESTIONS FINALES MONEY DROP
-- Migration additive et réexécutable.
-- Ajoute un vrai type « finale », 50 questions difficiles à deux trappes
-- et réserve automatiquement ces questions à la dernière manche.

alter table public.money_drop_questions
  add column if not exists is_final boolean not null default false;

update public.money_drop_questions
set is_final = false
where is_final is null;

create index if not exists money_drop_questions_final_active_idx
  on public.money_drop_questions (is_final, active, category, created_at desc);

-- Permet au gérant de créer une question classique ou finale.
drop function if exists public.money_drop_add_question(text, text, text, text, text, text, text);
drop function if exists public.money_drop_add_question(text, text, text, text, text, text, text, boolean);

create function public.money_drop_add_question(
  p_category text,
  p_question text,
  p_option_a text,
  p_option_b text,
  p_option_c text,
  p_option_d text,
  p_correct_option text,
  p_is_final boolean default false
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
    correct_option, is_final, created_by
  ) values (
    trim(p_category), trim(p_question), trim(p_option_a), trim(p_option_b),
    nullif(trim(p_option_c), ''), nullif(trim(p_option_d), ''),
    v_correct, coalesce(p_is_final, false), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Une question finale ne peut être utilisée que lors de la dernière manche.
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
  v_is_final boolean;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.archived_at is not null then raise exception 'game_not_found'; end if;
  if v_game.status <> 'setup' then raise exception 'game_not_in_setup'; end if;

  select is_final into v_is_final
  from public.money_drop_questions
  where id = p_question_id and active;

  if v_is_final is null then raise exception 'question_not_found'; end if;
  if v_is_final <> (v_game.current_round >= v_game.total_rounds) then
    raise exception 'question_wrong_round';
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

drop function if exists public.money_drop_select_random_question(uuid);
drop function if exists public.money_drop_select_random_question(uuid, text);

create function public.money_drop_select_random_question(
  p_game_id uuid,
  p_category text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question_id bigint;
begin
  perform public.money_drop_require_manager();

  select * into v_game
  from public.money_drop_games
  where id = p_game_id
  for update;

  if v_game.id is null or v_game.archived_at is not null then raise exception 'game_not_found'; end if;
  if v_game.status <> 'setup' then raise exception 'game_not_in_setup'; end if;

  select q.id into v_question_id
  from public.money_drop_questions q
  where q.active
    and q.is_final = (v_game.current_round >= v_game.total_rounds)
    and (
      nullif(trim(p_category), '') is null
      or lower(trim(q.category)) = lower(trim(p_category))
    )
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

revoke all on function public.money_drop_add_question(text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.money_drop_select_question(uuid, bigint) from public, anon;
revoke all on function public.money_drop_select_random_question(uuid, text) from public, anon;

grant execute on function public.money_drop_add_question(text, text, text, text, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.money_drop_select_question(uuid, bigint) to authenticated, service_role;
grant execute on function public.money_drop_select_random_question(uuid, text) to authenticated, service_role;

-- 50 finales : 10 thèmes, 5 questions par thème, 2 trappes chacune.
insert into public.money_drop_questions (
  category, question, option_a, option_b, option_c, option_d,
  correct_option, is_final, active
) values
  ('Histoire', 'Quel traité de 843 partage l’Empire carolingien entre les petits-fils de Charlemagne ?', 'Le traité de Verdun', 'Le traité de Tordesillas', null, null, 'A', true, true),
  ('Histoire', 'Qui est traditionnellement considéré comme le dernier empereur romain d’Occident ?', 'Justinien Ier', 'Romulus Augustule', null, null, 'B', true, true),
  ('Histoire', 'En quelle année s’est déroulée la bataille de Hastings ?', '1066', '1215', null, null, 'A', true, true),
  ('Histoire', 'Quel pharaon fit construire les grands temples d’Abou Simbel ?', 'Toutânkhamon', 'Ramsès II', null, null, 'B', true, true),
  ('Histoire', 'La paix de Westphalie de 1648 met principalement fin à quelle guerre ?', 'La guerre de Trente Ans', 'La guerre de Cent Ans', null, null, 'A', true, true),
  ('Géographie', 'Quel détroit sépare l’Asie de l’Amérique du Nord ?', 'Le détroit de Gibraltar', 'Le détroit de Béring', null, null, 'B', true, true),
  ('Géographie', 'Le lac Titicaca est partagé entre quels deux pays ?', 'Le Pérou et la Bolivie', 'Le Chili et l’Argentine', null, null, 'A', true, true),
  ('Géographie', 'Quel pays est entièrement enclavé dans le territoire de l’Afrique du Sud ?', 'L’Eswatini', 'Le Lesotho', null, null, 'B', true, true),
  ('Géographie', 'Quelle chaîne de montagnes marque conventionnellement une partie de la limite entre l’Europe et l’Asie ?', 'L’Oural', 'Les Alpes', null, null, 'A', true, true),
  ('Géographie', 'Quel fleuve traverse la ville de Budapest ?', 'Le Dniepr', 'Le Danube', null, null, 'B', true, true),
  ('Sciences', 'Quelle valeur est la plus proche du nombre d’Avogadro ?', '6,02 × 10²³', '9,81 × 10²³', null, null, 'A', true, true),
  ('Sciences', 'Quel élément chimique porte le numéro atomique 74 ?', 'L’or', 'Le tungstène', null, null, 'B', true, true),
  ('Sciences', 'Quelle est l’unité SI de la conductance électrique ?', 'Le siemens', 'Le tesla', null, null, 'A', true, true),
  ('Sciences', 'Quelle particule est le quantum du champ électromagnétique ?', 'Le gluon', 'Le photon', null, null, 'B', true, true),
  ('Sciences', 'À 25 °C, quel est approximativement le pH d’une solution aqueuse neutre ?', '7', '0', null, null, 'A', true, true),
  ('Espace', 'Quelle planète possède une rotation rétrograde et un jour sidéral plus long que son année ?', 'Mercure', 'Vénus', null, null, 'B', true, true),
  ('Espace', 'Quelle est la plus grande lune de Saturne ?', 'Titan', 'Europe', null, null, 'A', true, true),
  ('Espace', 'Comment appelle-t-on le point d’une orbite où un objet est le plus proche du Soleil ?', 'L’aphélie', 'Le périhélie', null, null, 'B', true, true),
  ('Espace', 'Quelle grande galaxie est la plus proche de la Voie lactée ?', 'La galaxie d’Andromède', 'La galaxie du Triangle', null, null, 'A', true, true),
  ('Espace', 'Quelle sonde a été la première à entrer dans l’espace interstellaire ?', 'Pioneer 10', 'Voyager 1', null, null, 'B', true, true),
  ('Technologie', 'Qui a créé le langage de programmation Python ?', 'Guido van Rossum', 'Dennis Ritchie', null, null, 'A', true, true),
  ('Technologie', 'Lequel de ces algorithmes repose sur la cryptographie asymétrique ?', 'AES', 'RSA', null, null, 'B', true, true),
  ('Technologie', 'Quel est le rôle principal du DNS sur Internet ?', 'Associer des noms de domaine à des adresses IP', 'Chiffrer automatiquement tous les messages', null, null, 'A', true, true),
  ('Technologie', 'Combien de bits contient un octet ?', '16 bits', '8 bits', null, null, 'B', true, true),
  ('Technologie', 'Qui a créé le système de gestion de versions Git ?', 'Linus Torvalds', 'Tim Berners-Lee', null, null, 'A', true, true),
  ('Sport', 'Combien d’épreuves composent un décathlon ?', '12', '10', null, null, 'B', true, true),
  ('Sport', 'Quelle est la distance officielle d’un marathon ?', '42,195 km', '40 km', null, null, 'A', true, true),
  ('Sport', 'Quelles disciplines sont combinées dans le biathlon ?', 'Le saut à ski et le tir', 'Le ski de fond et le tir', null, null, 'B', true, true),
  ('Sport', 'Dans un tie-break classique au tennis, quel score minimal faut-il atteindre avec deux points d’écart ?', '7 points', '5 points', null, null, 'A', true, true),
  ('Sport', 'À quelle discipline est associé le style appelé Fosbury flop ?', 'Le saut à la perche', 'Le saut en hauteur', null, null, 'B', true, true),
  ('Cinéma & séries', 'Qui a réalisé Les Sept Samouraïs ?', 'Akira Kurosawa', 'Yasujirō Ozu', null, null, 'A', true, true),
  ('Cinéma & séries', 'Quel film a reçu la Palme d’or au Festival de Cannes en 1994 ?', 'Forrest Gump', 'Pulp Fiction', null, null, 'B', true, true),
  ('Cinéma & séries', 'Qui a réalisé 2001 : L’Odyssée de l’espace ?', 'Stanley Kubrick', 'Andreï Tarkovski', null, null, 'A', true, true),
  ('Cinéma & séries', 'Qui a réalisé le film muet Nosferatu sorti en 1922 ?', 'Fritz Lang', 'F. W. Murnau', null, null, 'B', true, true),
  ('Cinéma & séries', 'Lequel de ces artistes est cofondateur du Studio Ghibli ?', 'Hayao Miyazaki', 'Akira Toriyama', null, null, 'A', true, true),
  ('Musique', 'Qui a composé le Boléro ?', 'Claude Debussy', 'Maurice Ravel', null, null, 'B', true, true),
  ('Musique', 'Qui a composé Les Quatre Saisons ?', 'Antonio Vivaldi', 'Arcangelo Corelli', null, null, 'A', true, true),
  ('Musique', 'Qui a composé la Symphonie du Nouveau Monde ?', 'Bedřich Smetana', 'Antonín Dvořák', null, null, 'B', true, true),
  ('Musique', 'Sur quelle île Freddie Mercury est-il né ?', 'Zanzibar', 'Madagascar', null, null, 'A', true, true),
  ('Musique', 'Quel musicien est l’artiste principal de l’album Kind of Blue ?', 'John Coltrane', 'Miles Davis', null, null, 'B', true, true),
  ('Littérature & français', 'Quel nom donne le narrateur au début de Moby-Dick ?', 'Ishmaël', 'Achab', null, null, 'A', true, true),
  ('Littérature & français', 'Qui a écrit Le Nom de la rose ?', 'Italo Calvino', 'Umberto Eco', null, null, 'B', true, true),
  ('Littérature & français', 'Qui a écrit En attendant Godot ?', 'Samuel Beckett', 'Eugène Ionesco', null, null, 'A', true, true),
  ('Littérature & français', 'Dans quel roman apparaît la ville fictive de Macondo ?', 'La Maison aux esprits', 'Cent ans de solitude', null, null, 'B', true, true),
  ('Littérature & français', 'Qui a écrit le recueil Les Fleurs du mal ?', 'Charles Baudelaire', 'Arthur Rimbaud', null, null, 'A', true, true),
  ('Automobile', 'Quel modèle a popularisé la production automobile à la chaîne au début du XXe siècle ?', 'La Citroën Traction Avant', 'La Ford Model T', null, null, 'B', true, true),
  ('Automobile', 'Quel type de mouvement caractérise le moteur Wankel ?', 'Un piston rotatif', 'Des pistons opposés à plat', null, null, 'A', true, true),
  ('Automobile', 'Que signifie le sigle ABS dans le domaine du freinage automobile ?', 'Système automatique de suralimentation', 'Système antiblocage des roues', null, null, 'B', true, true),
  ('Automobile', 'Sur quel circuit se disputent les 24 Heures du Mans ?', 'Le circuit de la Sarthe', 'Le circuit de Magny-Cours', null, null, 'A', true, true),
  ('Automobile', 'Quelle monoplace est généralement reconnue comme la première Formule 1 à monocoque entièrement en fibre de carbone ?', 'La Lotus 79', 'La McLaren MP4/1', null, null, 'B', true, true)
on conflict (lower(trim(question))) do update set
  category = excluded.category,
  option_a = excluded.option_a,
  option_b = excluded.option_b,
  option_c = excluded.option_c,
  option_d = excluded.option_d,
  correct_option = excluded.correct_option,
  is_final = true,
  active = true,
  updated_at = now();

notify pgrst, 'reload schema';
-- NOSTRA GROUP V138.5 — MONEY DROP SHOW COMPLET
-- Migration additive à exécuter après V138.4.
-- Ajoute : modes Classique/Express/Événement, inscriptions publiques, code de partie,
-- écran spectateur, sons, jokers, difficulté progressive, classement et archives.

alter table public.money_drop_settings
  add column if not exists public_registration_enabled boolean not null default false,
  add column if not exists spectator_enabled boolean not null default true,
  add column if not exists sounds_enabled boolean not null default true,
  add column if not exists jokers_enabled boolean not null default true;

alter table public.money_drop_questions
  add column if not exists difficulty text not null default 'Moyenne';

update public.money_drop_questions
set difficulty = 'Finale'
where is_final = true;

with ranked as (
  select id, row_number() over (partition by category order by id) as rn
  from public.money_drop_questions
  where coalesce(is_final, false) = false
)
update public.money_drop_questions q
set difficulty = case
  when ((r.rn - 1) % 10) between 0 and 2 then 'Facile'
  when ((r.rn - 1) % 10) between 3 and 5 then 'Moyenne'
  when ((r.rn - 1) % 10) between 6 and 7 then 'Difficile'
  else 'Expert'
end
from ranked r
where q.id = r.id
  and (q.difficulty is null or q.difficulty = 'Moyenne');

alter table public.money_drop_games
  add column if not exists game_mode text not null default 'classic',
  add column if not exists answer_seconds integer not null default 60,
  add column if not exists join_code text,
  add column if not exists joker_time_used boolean not null default false,
  add column if not exists joker_hint_used boolean not null default false,
  add column if not exists joker_change_used boolean not null default false,
  add column if not exists hint_removed_option text;

update public.money_drop_games
set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where join_code is null;

create unique index if not exists money_drop_live_join_code_idx
  on public.money_drop_games (join_code)
  where archived_at is null and join_code is not null;

-- Une partie terminée ne doit pas bloquer la création de la suivante.
drop index if exists public.money_drop_one_live_game_idx;
create unique index money_drop_one_live_game_idx
  on public.money_drop_games ((1))
  where archived_at is null and status in ('setup','question_open','allocations_locked','revealed');

create table if not exists public.money_drop_registrations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.money_drop_registrations enable row level security;
revoke all on table public.money_drop_registrations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- ÉTAT COMPLET
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
  v_registrations jsonb := '[]'::jsonb;
  v_leaderboard jsonb := '[]'::jsonb;
  v_recent_games jsonb := '[]'::jsonb;
  v_is_player boolean := false;
  v_is_captain boolean := false;
  v_is_registered boolean := false;
begin
  select * into v_settings from public.money_drop_settings where id = 1;

  select * into v_game
  from public.money_drop_games
  where archived_at is null and status <> 'cancelled'
  order by created_at desc
  limit 1;

  select exists(
    select 1 from public.money_drop_registrations r where r.user_id = auth.uid()
  ) into v_is_registered;

  if p_manager then
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', r.user_id,
      'player_name', r.player_name,
      'created_at', r.created_at
    ) order by r.created_at), '[]'::jsonb)
    into v_registrations
    from public.money_drop_registrations r;
  end if;

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
    ) into v_allocations
    from public.money_drop_allocations
    where game_id = v_game.id and round_number = v_game.current_round;

    if v_game.current_question_id is not null then
      select * into v_question from public.money_drop_questions where id = v_game.current_question_id;

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
        'difficulty', v_question.difficulty,
        'question', v_question.question,
        'options', v_options,
        'correct_option', case when p_manager or v_game.status in ('revealed', 'finished') then v_question.correct_option else null end,
        'active', v_question.active,
        'is_final', v_question.is_final,
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

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_leaderboard
  from (
    select g.id, g.team_name, g.current_amount as final_amount, g.starting_amount,
           g.game_mode, g.finished_at,
           coalesce((select string_agg(p.player_name, ', ' order by p.position)
                     from public.money_drop_players p where p.game_id = g.id), '') as players
    from public.money_drop_games g
    where g.status = 'finished'
    order by g.current_amount desc, g.finished_at desc nulls last
    limit 10
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  into v_recent_games
  from (
    select g.id, g.team_name, g.current_amount as final_amount, g.starting_amount,
           g.game_mode, g.finished_at,
           coalesce((select string_agg(p.player_name, ', ' order by p.position)
                     from public.money_drop_players p where p.game_id = g.id), '') as players
    from public.money_drop_games g
    where g.status = 'finished'
    order by g.finished_at desc nulls last
    limit 8
  ) x;

  return jsonb_build_object(
    'configured', true,
    'settings', jsonb_build_object(
      'enabled', v_settings.enabled,
      'starting_amount', v_settings.starting_amount,
      'total_rounds', v_settings.total_rounds,
      'answer_seconds', v_settings.answer_seconds,
      'public_registration_enabled', v_settings.public_registration_enabled,
      'spectator_enabled', v_settings.spectator_enabled,
      'sounds_enabled', v_settings.sounds_enabled,
      'jokers_enabled', v_settings.jokers_enabled
    ),
    'game', case when v_game.id is null then null else jsonb_build_object(
      'id', v_game.id,
      'status', v_game.status,
      'team_name', v_game.team_name,
      'starting_amount', v_game.starting_amount,
      'current_amount', v_game.current_amount,
      'current_round', v_game.current_round,
      'total_rounds', v_game.total_rounds,
      'current_question_id', v_game.current_question_id,
      'round_deadline', v_game.round_deadline,
      'created_at', v_game.created_at,
      'finished_at', v_game.finished_at,
      'game_mode', v_game.game_mode,
      'answer_seconds', v_game.answer_seconds,
      'join_code', case when p_manager or v_is_player then v_game.join_code else null end,
      'joker_time_used', v_game.joker_time_used,
      'joker_hint_used', v_game.joker_hint_used,
      'joker_change_used', v_game.joker_change_used,
      'hint_removed_option', v_game.hint_removed_option
    ) end,
    'players', v_players,
    'question', v_question_json,
    'allocations', v_allocations,
    'history', v_history,
    'registrations', v_registrations,
    'leaderboard', v_leaderboard,
    'recent_games', v_recent_games,
    'current_user_is_registered', v_is_registered,
    'current_user_is_player', v_is_player,
    'current_user_is_captain', v_is_captain
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- PARAMÈTRES SHOW
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_update_show_settings(
  p_starting_amount bigint,
  p_total_rounds integer,
  p_answer_seconds integer,
  p_public_registration_enabled boolean,
  p_spectator_enabled boolean,
  p_sounds_enabled boolean,
  p_jokers_enabled boolean
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
      public_registration_enabled = coalesce(p_public_registration_enabled, false),
      spectator_enabled = coalesce(p_spectator_enabled, true),
      sounds_enabled = coalesce(p_sounds_enabled, true),
      jokers_enabled = coalesce(p_jokers_enabled, true),
      updated_by = auth.uid(), updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.money_drop_set_registration_open(p_enabled boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.money_drop_require_manager();
  update public.money_drop_settings
  set public_registration_enabled = coalesce(p_enabled, false), updated_by = auth.uid(), updated_at = now()
  where id = 1;
end; $$;

-- ---------------------------------------------------------------------------
-- INSCRIPTIONS ET CODE DE PARTIE
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_register()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_enabled boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select enabled and public_registration_enabled into v_enabled from public.money_drop_settings where id = 1;
  if not coalesce(v_enabled, false) then raise exception 'registration_closed'; end if;
  insert into public.money_drop_registrations(user_id, player_name)
  values(auth.uid(), public.money_drop_player_name(auth.uid()))
  on conflict(user_id) do update set player_name = excluded.player_name, updated_at = now();
end; $$;

create or replace function public.money_drop_withdraw_registration()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  delete from public.money_drop_registrations where user_id = auth.uid();
end; $$;

-- Remplace la création V138.4 pour ajouter le mode et le code.
drop function if exists public.money_drop_create_game(text, uuid[]);
drop function if exists public.money_drop_create_game(text, uuid[], text);
create function public.money_drop_create_game(
  p_team_name text,
  p_players uuid[],
  p_game_mode text default 'classic'
)
returns uuid
language plpgsql security definer set search_path = public, auth as $$
declare
  v_settings public.money_drop_settings%rowtype;
  v_game_id uuid;
  v_player uuid;
  v_position integer := 0;
  v_mode text := lower(trim(coalesce(p_game_mode, 'classic')));
  v_rounds integer;
  v_seconds integer;
  v_code text;
begin
  perform public.money_drop_require_manager();
  update public.money_drop_games set archived_at=coalesce(archived_at,now())
  where archived_at is null and status='finished';
  if exists(select 1 from public.money_drop_games where archived_at is null and status in ('setup','question_open','allocations_locked','revealed')) then
    raise exception 'active_game_exists';
  end if;
  if v_mode not in ('classic','express','event') then raise exception 'invalid_game_mode'; end if;
  if coalesce(array_length(p_players,1),0) not between 1 and 4
     or (select count(distinct value) from unnest(p_players) value) <> array_length(p_players,1) then
    raise exception 'invalid_players';
  end if;

  select * into v_settings from public.money_drop_settings where id = 1;
  v_rounds := case when v_mode='express' then least(5, v_settings.total_rounds) else v_settings.total_rounds end;
  v_seconds := case when v_mode='express' then least(30, v_settings.answer_seconds) else v_settings.answer_seconds end;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    exit when not exists(select 1 from public.money_drop_games where archived_at is null and join_code = v_code);
  end loop;

  insert into public.money_drop_games(
    status, team_name, starting_amount, current_amount, current_round, total_rounds,
    answer_seconds, game_mode, join_code, created_by
  ) values(
    'setup', coalesce(nullif(trim(p_team_name),''),'Équipe Nostra'),
    v_settings.starting_amount, v_settings.starting_amount, 1, v_rounds,
    v_seconds, v_mode, v_code, auth.uid()
  ) returning id into v_game_id;

  foreach v_player in array p_players loop
    v_position := v_position + 1;
    insert into public.money_drop_players(game_id,user_id,position,player_name,is_captain)
    values(v_game_id,v_player,v_position,public.money_drop_player_name(v_player),v_position=1);
  end loop;

  delete from public.money_drop_registrations where user_id = any(p_players);
  return v_game_id;
end; $$;

create or replace function public.money_drop_join_game(p_code text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_game public.money_drop_games%rowtype; v_position integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_game from public.money_drop_games
  where archived_at is null and status='setup' and upper(join_code)=upper(trim(p_code))
  order by created_at desc limit 1 for update;
  if v_game.id is null then raise exception 'invalid_join_code'; end if;
  if exists(select 1 from public.money_drop_players where game_id=v_game.id and user_id=auth.uid()) then return v_game.id; end if;
  select coalesce(max(position),0)+1 into v_position from public.money_drop_players where game_id=v_game.id;
  if v_position > 4 then raise exception 'team_full'; end if;
  insert into public.money_drop_players(game_id,user_id,position,player_name,is_captain)
  values(v_game.id,auth.uid(),v_position,public.money_drop_player_name(auth.uid()),false);
  delete from public.money_drop_registrations where user_id=auth.uid();
  return v_game.id;
end; $$;

-- ---------------------------------------------------------------------------
-- DIFFICULTÉ ET QUESTIONS
-- ---------------------------------------------------------------------------
drop function if exists public.money_drop_add_question(text,text,text,text,text,text,text,boolean);
drop function if exists public.money_drop_add_question(text,text,text,text,text,text,text,boolean,text);
create function public.money_drop_add_question(
  p_category text,
  p_question text,
  p_option_a text,
  p_option_b text,
  p_option_c text,
  p_option_d text,
  p_correct_option text,
  p_is_final boolean default false,
  p_difficulty text default 'Moyenne'
)
returns bigint language plpgsql security definer set search_path = public, auth as $$
declare v_id bigint; v_correct text := upper(trim(coalesce(p_correct_option,''))); v_diff text := initcap(lower(trim(coalesce(p_difficulty,'Moyenne'))));
begin
  perform public.money_drop_require_manager();
  if coalesce(p_is_final,false) then v_diff := 'Finale'; end if;
  if v_diff not in ('Facile','Moyenne','Difficile','Expert','Finale') then raise exception 'invalid_difficulty'; end if;
  if char_length(trim(coalesce(p_category,''))) < 2 or char_length(trim(coalesce(p_question,''))) < 5
     or nullif(trim(p_option_a),'') is null or nullif(trim(p_option_b),'') is null
     or v_correct not in ('A','B','C','D')
     or (v_correct='C' and nullif(trim(p_option_c),'') is null)
     or (v_correct='D' and nullif(trim(p_option_d),'') is null) then raise exception 'invalid_question'; end if;
  insert into public.money_drop_questions(category,question,option_a,option_b,option_c,option_d,correct_option,is_final,difficulty,created_by)
  values(trim(p_category),trim(p_question),trim(p_option_a),trim(p_option_b),nullif(trim(p_option_c),''),nullif(trim(p_option_d),''),v_correct,coalesce(p_is_final,false),v_diff,auth.uid())
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.money_drop_select_random_question(p_game_id uuid, p_category text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_game public.money_drop_games%rowtype; v_question_id bigint; v_target text;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id=p_game_id for update;
  if v_game.id is null or v_game.archived_at is not null then raise exception 'game_not_found'; end if;
  if v_game.status <> 'setup' then raise exception 'game_not_in_setup'; end if;
  if v_game.current_round >= v_game.total_rounds then v_target := 'Finale';
  elsif v_game.current_round::numeric / v_game.total_rounds <= .25 then v_target := 'Facile';
  elsif v_game.current_round::numeric / v_game.total_rounds <= .55 then v_target := 'Moyenne';
  elsif v_game.current_round::numeric / v_game.total_rounds <= .80 then v_target := 'Difficile';
  else v_target := 'Expert'; end if;

  select q.id into v_question_id from public.money_drop_questions q
  where q.active and q.is_final=(v_game.current_round>=v_game.total_rounds)
    and (nullif(trim(p_category),'') is null or lower(trim(q.category))=lower(trim(p_category)))
    and q.difficulty=v_target
    and not exists(select 1 from public.money_drop_round_history h where h.game_id=p_game_id and h.question_id=q.id)
  order by random() limit 1;

  if v_question_id is null then
    select q.id into v_question_id from public.money_drop_questions q
    where q.active and q.is_final=(v_game.current_round>=v_game.total_rounds)
      and (nullif(trim(p_category),'') is null or lower(trim(q.category))=lower(trim(p_category)))
      and not exists(select 1 from public.money_drop_round_history h where h.game_id=p_game_id and h.question_id=q.id)
    order by random() limit 1;
  end if;
  if v_question_id is null then raise exception 'no_question_available'; end if;
  perform public.money_drop_select_question(p_game_id,v_question_id);
  return v_question_id;
end; $$;

-- Le chrono appartient maintenant à la partie, pour permettre le mode Express.
create or replace function public.money_drop_open_question(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_game public.money_drop_games%rowtype;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id=p_game_id for update;
  if v_game.id is null or v_game.status <> 'setup' or v_game.current_question_id is null then raise exception 'question_missing'; end if;
  update public.money_drop_games
  set status='question_open', round_deadline=now()+make_interval(secs=>v_game.answer_seconds), hint_removed_option=null
  where id=p_game_id;
end; $$;

-- ---------------------------------------------------------------------------
-- JOKERS : +30 s, indice (retire une mauvaise trappe), changement de question.
-- ---------------------------------------------------------------------------
create or replace function public.money_drop_use_joker(p_game_id uuid, p_joker text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question public.money_drop_questions%rowtype;
  v_joker text := lower(trim(coalesce(p_joker,'')));
  v_removed text;
  v_new_question bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not (select jokers_enabled from public.money_drop_settings where id=1) then raise exception 'jokers_disabled'; end if;
  select * into v_game from public.money_drop_games where id=p_game_id for update;
  if v_game.id is null or v_game.status <> 'question_open' then raise exception 'joker_unavailable'; end if;
  if not public.money_drop_is_manager() and not exists(select 1 from public.money_drop_players where game_id=p_game_id and user_id=auth.uid()) then raise exception 'not_player'; end if;
  select * into v_question from public.money_drop_questions where id=v_game.current_question_id;

  if v_joker='time' then
    if v_game.joker_time_used then raise exception 'joker_already_used'; end if;
    update public.money_drop_games set joker_time_used=true, round_deadline=greatest(coalesce(round_deadline,now()),now())+interval '30 seconds' where id=p_game_id;
  elsif v_joker='hint' then
    if v_game.joker_hint_used then raise exception 'joker_already_used'; end if;
    if v_game.current_round >= v_game.total_rounds then raise exception 'joker_unavailable_final'; end if;
    select key into v_removed from (values
      ('A',v_question.option_a),('B',v_question.option_b),('C',v_question.option_c),('D',v_question.option_d)
    ) as x(key,label)
    where nullif(trim(label),'') is not null and key <> v_question.correct_option
    order by random() limit 1;
    update public.money_drop_games set joker_hint_used=true, hint_removed_option=v_removed where id=p_game_id;
  elsif v_joker='change' then
    if v_game.joker_change_used then raise exception 'joker_already_used'; end if;
    select q.id into v_new_question from public.money_drop_questions q
    where q.active and q.id<>v_game.current_question_id
      and q.is_final=(v_game.current_round>=v_game.total_rounds)
      and not exists(select 1 from public.money_drop_round_history h where h.game_id=p_game_id and h.question_id=q.id)
    order by random() limit 1;
    if v_new_question is null then raise exception 'no_question_available'; end if;
    delete from public.money_drop_allocations where game_id=p_game_id and round_number=v_game.current_round;
    update public.money_drop_games set joker_change_used=true,current_question_id=v_new_question,
      hint_removed_option=null,round_deadline=now()+make_interval(secs=>v_game.answer_seconds)
    where id=p_game_id;
  else
    raise exception 'invalid_joker';
  end if;
end; $$;

-- Nettoie l'indice entre deux manches.
create or replace function public.money_drop_advance_round(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_game public.money_drop_games%rowtype;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id=p_game_id for update;
  if v_game.id is null or v_game.status <> 'revealed' then raise exception 'round_not_revealed'; end if;
  if v_game.current_amount=0 or v_game.current_round>=v_game.total_rounds then
    update public.money_drop_games set status='finished',finished_at=now(),round_deadline=null,hint_removed_option=null where id=p_game_id;
  else
    delete from public.money_drop_allocations where game_id=p_game_id and round_number=v_game.current_round+1;
    update public.money_drop_games set status='setup',current_round=current_round+1,current_question_id=null,round_deadline=null,hint_removed_option=null where id=p_game_id;
  end if;
end; $$;

-- Archiver une partie terminée sans perdre son classement ; annuler sinon.
create or replace function public.money_drop_cancel_game(p_game_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  perform public.money_drop_require_manager();
  select status into v_status from public.money_drop_games where id=p_game_id for update;
  if v_status is null then raise exception 'game_not_found'; end if;
  if v_status='finished' then
    update public.money_drop_games set archived_at=coalesce(archived_at,now()), round_deadline=null where id=p_game_id;
  else
    update public.money_drop_games set status='cancelled', archived_at=coalesce(archived_at,now()), finished_at=coalesce(finished_at,now()), round_deadline=null where id=p_game_id;
  end if;
end; $$;

-- ---------------------------------------------------------------------------
-- DROITS RPC
-- ---------------------------------------------------------------------------
revoke all on function public.money_drop_update_show_settings(bigint,integer,integer,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.money_drop_set_registration_open(boolean) from public, anon;
revoke all on function public.money_drop_register() from public, anon;
revoke all on function public.money_drop_withdraw_registration() from public, anon;
revoke all on function public.money_drop_create_game(text,uuid[],text) from public, anon;
revoke all on function public.money_drop_join_game(text) from public, anon;
revoke all on function public.money_drop_add_question(text,text,text,text,text,text,text,boolean,text) from public, anon;
revoke all on function public.money_drop_use_joker(uuid,text) from public, anon;

grant execute on function public.money_drop_update_show_settings(bigint,integer,integer,boolean,boolean,boolean,boolean) to authenticated, service_role;
grant execute on function public.money_drop_set_registration_open(boolean) to authenticated, service_role;
grant execute on function public.money_drop_register() to authenticated, service_role;
grant execute on function public.money_drop_withdraw_registration() to authenticated, service_role;
grant execute on function public.money_drop_create_game(text,uuid[],text) to authenticated, service_role;
grant execute on function public.money_drop_join_game(text) to authenticated, service_role;
grant execute on function public.money_drop_add_question(text,text,text,text,text,text,text,boolean,text) to authenticated, service_role;
grant execute on function public.money_drop_use_joker(uuid,text) to authenticated, service_role;

notify pgrst, 'reload schema';
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
