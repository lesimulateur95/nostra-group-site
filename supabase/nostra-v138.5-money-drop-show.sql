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
