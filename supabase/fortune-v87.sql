-- NOSTRA GROUP V87 — ROUE DE LA FORTUNE COMPLÈTE
-- Migration additive et réexécutable.
-- Ajoute : chronomètre, buzzer, banque d'énigmes, écran TV, historique,
-- sélection aléatoire et cases « Diviser » / « Échange ».
-- AUCUNE PARTIE, AUCUN JOUEUR ET AUCUNE ÉNIGME EXISTANTE NE SONT SUPPRIMÉS.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 0. PRÉREQUIS
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.fortune_settings') is null
     or to_regclass('public.fortune_games') is null
     or (
       to_regclass('public.fortune_players') is null
       and to_regclass('public.fortune_game_players') is null
     )
     or to_regclass('public.fortune_rounds') is null
     or to_regclass('public.fortune_wheel_segments') is null then
    raise exception using
      message = 'fortune_module_missing',
      detail = 'Installe d’abord le module actuel de la Roue de la Fortune avant la V87.';
  end if;
end
$$;

-- Certaines installations historiques nomment la table des joueurs
-- « fortune_game_players ». Une vue simple et automatiquement modifiable
-- fournit le nom « fortune_players » attendu par la V87, sans copier ni
-- supprimer aucune donnée.
do $$
begin
  if to_regclass('public.fortune_players') is null
     and to_regclass('public.fortune_game_players') is not null then
    execute 'create view public.fortune_players as select * from public.fortune_game_players';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. COLONNES ADDITIVES
-- ---------------------------------------------------------------------------
alter table public.fortune_settings
  add column if not exists sound_enabled boolean not null default true,
  add column if not exists music_enabled boolean not null default true,
  add column if not exists default_answer_seconds integer not null default 30;

alter table public.fortune_games
  add column if not exists turn_deadline timestamptz,
  add column if not exists turn_duration_seconds integer not null default 30,
  add column if not exists buzzer_active boolean not null default false,
  add column if not exists buzzer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists buzzer_player_position integer,
  add column if not exists buzzer_at timestamptz,
  add column if not exists pending_special_action text,
  add column if not exists pending_actor_position integer,
  add column if not exists pending_target_position integer,
  add column if not exists pending_special_label text;

do $$
begin
  alter table public.fortune_settings
    drop constraint if exists fortune_settings_default_answer_seconds_v87_check;
  alter table public.fortune_settings
    add constraint fortune_settings_default_answer_seconds_v87_check
    check (default_answer_seconds between 5 and 300);

  alter table public.fortune_games
    drop constraint if exists fortune_games_turn_duration_v87_check;
  alter table public.fortune_games
    add constraint fortune_games_turn_duration_v87_check
    check (turn_duration_seconds between 5 and 300);

  alter table public.fortune_games
    drop constraint if exists fortune_games_pending_special_v87_check;
  alter table public.fortune_games
    add constraint fortune_games_pending_special_v87_check
    check (
      pending_special_action is null
      or pending_special_action in ('divide_bank', 'swap_bank')
    );
end
$$;

-- Les deux nouveaux types sont ajoutés proprement, que les colonnes utilisent
-- un ENUM PostgreSQL ou un simple texte protégé par une contrainte CHECK.
do $$
declare
  v_schema text;
  v_type text;
  v_kind text;
  v_constraint record;
begin
  select n.nspname, t.typname, t.typtype
    into v_schema, v_type, v_kind
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'public'
    and c.relname = 'fortune_wheel_segments'
    and a.attname = 'segment_type'
    and not a.attisdropped;

  if v_kind = 'e' then
    execute format('alter type %I.%I add value if not exists %L', v_schema, v_type, 'divide_bank');
    execute format('alter type %I.%I add value if not exists %L', v_schema, v_type, 'swap_bank');
  else
    for v_constraint in
      select conname
      from pg_constraint
      where conrelid = 'public.fortune_wheel_segments'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%segment_type%'
    loop
      execute format(
        'alter table public.fortune_wheel_segments drop constraint %I',
        v_constraint.conname
      );
    end loop;

    alter table public.fortune_wheel_segments
      drop constraint if exists fortune_wheel_segments_segment_type_v87_check;
    alter table public.fortune_wheel_segments
      add constraint fortune_wheel_segments_segment_type_v87_check
      check (segment_type in (
        'cash', 'bankrupt', 'lose_turn', 'jackpot', 'free_turn', 'prize',
        'divide_bank', 'swap_bank'
      ));
  end if;

  select n.nspname, t.typname, t.typtype
    into v_schema, v_type, v_kind
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'public'
    and c.relname = 'fortune_games'
    and a.attname = 'last_spin_type'
    and not a.attisdropped;

  if v_kind = 'e' then
    execute format('alter type %I.%I add value if not exists %L', v_schema, v_type, 'divide_bank');
    execute format('alter type %I.%I add value if not exists %L', v_schema, v_type, 'swap_bank');
  else
    for v_constraint in
      select conname
      from pg_constraint
      where conrelid = 'public.fortune_games'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%last_spin_type%'
    loop
      execute format(
        'alter table public.fortune_games drop constraint %I',
        v_constraint.conname
      );
    end loop;

    alter table public.fortune_games
      drop constraint if exists fortune_games_last_spin_type_v87_check;
    alter table public.fortune_games
      add constraint fortune_games_last_spin_type_v87_check
      check (
        last_spin_type is null
        or last_spin_type in (
          'cash', 'bankrupt', 'lose_turn', 'jackpot', 'free_turn', 'prize',
          'divide_bank', 'swap_bank'
        )
      );
  end if;
end
$$;

create index if not exists fortune_games_v87_live_state_idx
  on public.fortune_games (status, turn_deadline, buzzer_active);

-- Les index sont posés sur la vraie table, jamais sur la vue de compatibilité.
do $$
declare
  v_player_table regclass;
  v_relkind "char";
begin
  v_player_table := coalesce(
    to_regclass('public.fortune_game_players'),
    to_regclass('public.fortune_players')
  );

  select relkind into v_relkind
  from pg_class
  where oid = v_player_table;

  if v_relkind in ('r', 'p') then
    execute format(
      'create index if not exists fortune_players_v87_user_game_idx on %s (user_id, game_id, position)',
      v_player_table
    );
    execute format(
      'create index if not exists fortune_players_v87_game_position_idx on %s (game_id, position)',
      v_player_table
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. BANQUE D'ÉNIGMES ET HISTORIQUE
-- ---------------------------------------------------------------------------
create table if not exists public.fortune_puzzle_bank_v87 (
  id bigserial primary key,
  category text not null,
  solution text not null,
  difficulty text not null default 'normal',
  active boolean not null default true,
  used_count integer not null default 0,
  last_used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fortune_puzzle_bank_v87_category_check
    check (char_length(trim(category)) between 2 and 160),
  constraint fortune_puzzle_bank_v87_solution_check
    check (char_length(trim(solution)) between 2 and 300),
  constraint fortune_puzzle_bank_v87_difficulty_check
    check (difficulty in ('facile', 'normal', 'difficile', 'finale')),
  constraint fortune_puzzle_bank_v87_used_count_check
    check (used_count >= 0)
);

create unique index if not exists fortune_puzzle_bank_v87_unique_puzzle_idx
  on public.fortune_puzzle_bank_v87 (
    lower(trim(category)),
    lower(trim(solution))
  );
create index if not exists fortune_puzzle_bank_v87_random_idx
  on public.fortune_puzzle_bank_v87 (active, difficulty, used_count, last_used_at);

create table if not exists public.fortune_game_history_v87 (
  id bigserial primary key,
  game_id text not null unique,
  winner_user_id uuid references auth.users(id) on delete set null,
  winner_name text,
  winner_position integer,
  player_count integer not null default 0,
  total_prize integer not null default 0,
  final_result text,
  status text not null,
  finished_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists fortune_game_history_v87_finished_idx
  on public.fortune_game_history_v87 (finished_at desc);

-- Quelques énigmes originales pour que le tirage soit utilisable immédiatement.
insert into public.fortune_puzzle_bank_v87 (category, solution, difficulty)
values
  ('Cinéma', 'LE DERNIER TOUR DE PISTE', 'normal'),
  ('Automobile', 'UNE VOITURE DE COLLECTION', 'facile'),
  ('Circuit', 'LE DRAPEAU À DAMIER', 'facile'),
  ('Expression', 'PRENDRE UN VIRAGE DÉCISIF', 'normal'),
  ('Voyage', 'UNE ESCALE SOUS LES ÉTOILES', 'normal'),
  ('Musique', 'LE RYTHME FAIT MONTER LA PRESSION', 'difficile'),
  ('Sport', 'DÉPASSER SES PROPRES LIMITES', 'normal'),
  ('Mystère', 'LA RÉPONSE ÉTAIT SOUS NOS YEUX', 'difficile'),
  ('Finale', 'LA CHANCE SOURIT AUX PLUS AUDACIEUX', 'finale'),
  ('Finale', 'UN SOUVENIR QUI RESTERA GRAVÉ', 'finale'),
  ('Nostra Group', 'L EXCLUSIVITÉ PREND LA ROUTE', 'normal'),
  ('Nostra Circuit', 'LA PASSION AU BOUT DE LA LIGNE DROITE', 'difficile')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. CONTRÔLES D'ACCÈS ROBUSTES
-- ---------------------------------------------------------------------------
create or replace function public.fortune_is_manager_v87()
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
      execute 'select public.has_nostra_dashboard_access()'
        into v_allowed;
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

revoke all on function public.fortune_is_manager_v87() from public;
grant execute on function public.fortune_is_manager_v87() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. OUTILS DE TEXTE ET DE TOUR
-- ---------------------------------------------------------------------------
create or replace function public.fortune_mask_puzzle_v87(
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
  if p_solution is null then
    return '';
  end if;

  if char_length(p_solution) = 0 then
    return '';
  end if;

  for v_index in 1..char_length(p_solution)
  loop
    v_character := substr(p_solution, v_index, 1);

    if v_character ~ '[A-Za-zÀ-ÖØ-öø-ÿ]' then
      if upper(v_character) = any(v_revealed) then
        v_result := v_result || v_character;
      else
        v_result := v_result || '□';
      end if;
    else
      v_result := v_result || v_character;
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.fortune_next_player_position_v87(
  p_game_id uuid,
  p_current_position integer
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  select min(position)
    into v_next
  from public.fortune_players
  where game_id = p_game_id
    and position > coalesce(p_current_position, 0);

  if v_next is null then
    select min(position)
      into v_next
    from public.fortune_players
    where game_id = p_game_id;
  end if;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. ÉTAT LÉGER POUR LE CHRONO, LE BUZZER ET LES CASES SPÉCIALES
-- ---------------------------------------------------------------------------
create or replace function public.fortune_get_extra_state_v87(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'configured', true,
        'game_id', g.id,
        'turn_deadline', g.turn_deadline,
        'turn_duration_seconds', g.turn_duration_seconds,
        'buzzer_active', g.buzzer_active,
        'buzzer_user_id', g.buzzer_user_id,
        'buzzer_player_position', g.buzzer_player_position,
        'buzzer_player_name', (
          select p.player_name
          from public.fortune_players p
          where p.game_id = g.id
            and p.position = g.buzzer_player_position
          limit 1
        ),
        'buzzer_at', g.buzzer_at,
        'pending_special_action', g.pending_special_action,
        'pending_actor_position', g.pending_actor_position,
        'pending_actor_name', (
          select p.player_name
          from public.fortune_players p
          where p.game_id = g.id
            and p.position = g.pending_actor_position
          limit 1
        ),
        'pending_special_label', g.pending_special_label
      )
      from public.fortune_games g
      where g.id = p_game_id
      limit 1
    ),
    jsonb_build_object(
      'configured', false,
      'game_id', p_game_id,
      'turn_deadline', null,
      'turn_duration_seconds', 30,
      'buzzer_active', false,
      'buzzer_user_id', null,
      'buzzer_player_position', null,
      'buzzer_player_name', null,
      'buzzer_at', null,
      'pending_special_action', null,
      'pending_actor_position', null,
      'pending_actor_name', null,
      'pending_special_label', null
    )
  );
$$;

grant execute on function public.fortune_get_extra_state_v87(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. CHRONOMÈTRE ET BUZZER
-- ---------------------------------------------------------------------------
create or replace function public.fortune_start_timer_v87(
  p_game_id uuid,
  p_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seconds integer := greatest(5, least(coalesce(p_seconds, 30), 300));
begin
  if not public.fortune_is_manager_v87() then
    raise exception 'manager_required';
  end if;

  update public.fortune_games
     set turn_duration_seconds = v_seconds,
         turn_deadline = clock_timestamp() + make_interval(secs => v_seconds)
   where id = p_game_id
     and status not in ('finished', 'cancelled');

  if not found then
    raise exception 'game_not_found';
  end if;

  return public.fortune_get_extra_state_v87(p_game_id);
end;
$$;

create or replace function public.fortune_stop_timer_v87(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fortune_is_manager_v87() then
    raise exception 'manager_required';
  end if;

  update public.fortune_games
     set turn_deadline = null
   where id = p_game_id;

  if not found then
    raise exception 'game_not_found';
  end if;

  return public.fortune_get_extra_state_v87(p_game_id);
end;
$$;

create or replace function public.fortune_reset_buzzer_v87(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fortune_is_manager_v87() then
    raise exception 'manager_required';
  end if;

  update public.fortune_games
     set buzzer_active = true,
         buzzer_user_id = null,
         buzzer_player_position = null,
         buzzer_at = null
   where id = p_game_id
     and status not in ('finished', 'cancelled');

  if not found then
    raise exception 'game_not_found';
  end if;

  return public.fortune_get_extra_state_v87(p_game_id);
end;
$$;

create or replace function public.fortune_press_buzzer_v87(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.fortune_games%rowtype;
  v_player public.fortune_players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
    into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  if not v_game.buzzer_active
     or v_game.buzzer_user_id is not null
     or (v_game.turn_deadline is not null and v_game.turn_deadline <= clock_timestamp()) then
    raise exception 'buzzer_closed';
  end if;

  select *
    into v_player
  from public.fortune_players
  where game_id = p_game_id
    and user_id::text = auth.uid()::text
  limit 1;

  if not found then
    raise exception 'player_required';
  end if;

  update public.fortune_players
     set is_active = (position = v_player.position)
   where game_id = p_game_id;

  update public.fortune_games
     set buzzer_active = false,
         buzzer_user_id = auth.uid(),
         buzzer_player_position = v_player.position,
         buzzer_at = clock_timestamp(),
         turn_deadline = null,
         active_player_position = v_player.position,
         turn_phase = case
           when status = 'finale' then 'final_answer'
           else 'can_act'
         end
   where id = p_game_id;

  return public.fortune_get_extra_state_v87(p_game_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. BANQUE D'ÉNIGMES ET RÉVÉLATION MANUELLE
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
begin
  if not public.fortune_is_manager_v87() then
    raise exception 'manager_required';
  end if;

  if not exists (select 1 from public.fortune_games where id = p_game_id) then
    raise exception 'game_not_found';
  end if;

  select *
    into v_puzzle
  from public.fortune_puzzle_bank_v87
  where active = true
    and (
      nullif(trim(coalesce(p_difficulty, '')), '') is null
      or difficulty = trim(p_difficulty)
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
           final_masked_puzzle = public.fortune_mask_puzzle_v87(
             v_puzzle.solution,
             '{}'::text[]
           )
     where id = p_game_id;
  else
    v_round := greatest(1, least(coalesce(p_round_number, 1), 4));

    update public.fortune_rounds
       set category = v_puzzle.category,
           solution = v_puzzle.solution,
           revealed_letters = '{}'::text[],
           masked_puzzle = public.fortune_mask_puzzle_v87(
             v_puzzle.solution,
             '{}'::text[]
           ),
           status = case when status = 'won' then 'waiting' else status end,
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
        public.fortune_mask_puzzle_v87(v_puzzle.solution, '{}'::text[]),
        '{}'::text[],
        'waiting',
        null,
        null
      );
    end if;
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
    'round_number', case when p_for_final then null else v_round end
  );
end;
$$;

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
begin
  if not public.fortune_is_manager_v87() then
    raise exception 'manager_required';
  end if;

  v_letter := upper(substr(trim(coalesce(p_letter, '')), 1, 1));
  if v_letter = '' or v_letter !~ '[A-ZÀ-ÖØ-Þ]' then
    raise exception 'invalid_letter';
  end if;

  select *
    into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  if v_game.status = 'finale' then
    v_letters := coalesce(v_game.final_revealed_letters, '{}'::text[]);
    if not (v_letter = any(v_letters)) then
      v_letters := array_append(v_letters, v_letter);
    end if;

    update public.fortune_games
       set final_revealed_letters = v_letters,
           final_masked_puzzle = public.fortune_mask_puzzle_v87(
             coalesce(final_solution, ''),
             v_letters
           )
     where id = p_game_id;

    v_solution := coalesce(v_game.final_solution, '');
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

    if not (v_letter = any(v_letters)) then
      v_letters := array_append(v_letters, v_letter);
    end if;

    update public.fortune_rounds
       set revealed_letters = v_letters,
           masked_puzzle = public.fortune_mask_puzzle_v87(v_solution, v_letters)
     where game_id = p_game_id
       and round_number = v_game.current_round;
  end if;

  return jsonb_build_object(
    'letter', v_letter,
    'masked_puzzle', public.fortune_mask_puzzle_v87(v_solution, v_letters)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. MODIFICATION DES CASES, Y COMPRIS DIVISER ET ÉCHANGE
-- ---------------------------------------------------------------------------
create or replace function public.fortune_update_wheel_segment_v87(
  p_segment_id bigint,
  p_label text,
  p_segment_type text,
  p_value integer,
  p_color text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.fortune_wheel_segments%rowtype;
begin
  if not public.fortune_is_manager_v87() then
    raise exception 'manager_required';
  end if;

  if p_segment_type not in (
    'cash', 'bankrupt', 'lose_turn', 'jackpot', 'free_turn', 'prize',
    'divide_bank', 'swap_bank'
  ) then
    raise exception 'invalid_segment_type';
  end if;

  if trim(coalesce(p_label, '')) = ''
     or p_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid_segment';
  end if;

  -- Le littéral est injecté avec %L pour rester compatible avec une colonne
  -- texte comme avec un éventuel ENUM PostgreSQL.
  execute format(
    'update public.fortune_wheel_segments
        set label = $1,
            segment_type = %L,
            value = $2,
            color = $3,
            active = $4
      where id = $5
      returning *',
    p_segment_type
  )
  into v_row
  using
    left(trim(p_label), 40),
    greatest(0, coalesce(p_value, 0)),
    p_color,
    coalesce(p_active, true),
    p_segment_id;

  if v_row.id is null then
    raise exception 'segment_not_found';
  end if;

  return to_jsonb(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. NOUVELLE LOGIQUE DE LANCER DE ROUE
-- ---------------------------------------------------------------------------
create or replace function public.fortune_spin_wheel_v87(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.fortune_games%rowtype;
  v_settings public.fortune_settings%rowtype;
  v_player public.fortune_players%rowtype;
  v_segment public.fortune_wheel_segments%rowtype;
  v_wheel_type text;
  v_next_position integer;
  v_sequence integer;
  v_duration integer;
  v_started_at timestamptz;
  v_is_manager boolean;
  v_final_value integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
    into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found';
  end if;

  select *
    into v_settings
  from public.fortune_settings
  limit 1;

  if not found or not coalesce(v_settings.enabled, false) then
    raise exception 'game_disabled';
  end if;

  if v_game.pending_special_action is not null then
    raise exception 'special_target_required';
  end if;

  select *
    into v_player
  from public.fortune_players
  where game_id = p_game_id
    and position = v_game.active_player_position
  for update;

  if not found then
    raise exception 'active_player_missing';
  end if;

  v_is_manager := public.fortune_is_manager_v87();
  if v_player.user_id::text <> auth.uid()::text and not v_is_manager then
    raise exception 'not_active_player';
  end if;

  if v_game.status = 'active' then
    if v_game.turn_phase not in ('must_spin', 'can_act') then
      raise exception 'spin_not_allowed';
    end if;
    v_wheel_type := 'normal';
  elsif v_game.status = 'finale' then
    if v_game.turn_phase <> 'final_spin' then
      raise exception 'spin_not_allowed';
    end if;
    v_wheel_type := 'final';
  else
    raise exception 'game_not_active';
  end if;

  if coalesce(v_settings.visible_wheel, 'none') <> v_wheel_type then
    raise exception 'wheel_hidden';
  end if;

  select *
    into v_segment
  from public.fortune_wheel_segments
  where wheel_type = v_wheel_type
    and active = true
    and (
      v_wheel_type = 'final'
      or v_game.player_count > 1
      or segment_type not in ('divide_bank', 'swap_bank')
    )
  order by random()
  limit 1;

  if not found then
    raise exception 'wheel_empty';
  end if;

  v_sequence := coalesce(v_game.spin_sequence, 0) + 1;
  v_duration := 3200 + floor(random() * 1601)::integer;
  v_started_at := clock_timestamp();

  -- Même compatibilité texte/ENUM pour le type du dernier lancer.
  execute format(
    'update public.fortune_games
        set last_spin_label = $1,
            last_spin_type = %L,
            last_spin_value = $2,
            last_spin_position = $3,
            spin_sequence = $4,
            spin_started_at = $5,
            spin_duration_ms = $6,
            pending_special_action = null,
            pending_actor_position = null,
            pending_target_position = null,
            pending_special_label = null
      where id = $7',
    v_segment.segment_type::text
  )
  using
    v_segment.label,
    greatest(0, coalesce(v_segment.value, 0)),
    v_segment.position,
    v_sequence,
    v_started_at,
    v_duration,
    p_game_id;

  if v_wheel_type = 'final' then
    v_final_value := case
      when v_segment.segment_type = 'jackpot'
        then greatest(0, coalesce(v_settings.jackpot_amount, 0))
      else greatest(0, coalesce(v_segment.value, 0))
    end;

    -- En finale, aucune case ne remet à zéro les cagnottes.
    update public.fortune_games
       set final_prize_label = v_segment.label,
           final_prize_value = v_final_value,
           turn_phase = 'final_answer',
           jackpot_armed = false
     where id = p_game_id;
  else
    case v_segment.segment_type
      when 'cash' then
        update public.fortune_games
           set turn_phase = 'choose_consonant',
               jackpot_armed = false
         where id = p_game_id;

      when 'jackpot' then
        update public.fortune_games
           set turn_phase = 'choose_consonant',
               jackpot_armed = true
         where id = p_game_id;

      when 'free_turn' then
        update public.fortune_players
           set free_turns = coalesce(free_turns, 0) + 1
         where game_id = p_game_id
           and position = v_player.position;

        update public.fortune_games
           set turn_phase = 'can_act',
               jackpot_armed = false
         where id = p_game_id;

      when 'bankrupt' then
        -- Banqueroute : uniquement la cagnotte de manche, jamais la sécurisée.
        update public.fortune_players
           set round_bank = 0
         where game_id = p_game_id
           and position = v_player.position;

        v_next_position := public.fortune_next_player_position_v87(
          p_game_id,
          v_player.position
        );

        update public.fortune_players
           set is_active = (position = v_next_position)
         where game_id = p_game_id;

        update public.fortune_games
           set active_player_position = v_next_position,
               turn_phase = 'must_spin',
               jackpot_armed = false
         where id = p_game_id;

      when 'lose_turn' then
        v_next_position := public.fortune_next_player_position_v87(
          p_game_id,
          v_player.position
        );

        update public.fortune_players
           set is_active = (position = v_next_position)
         where game_id = p_game_id;

        update public.fortune_games
           set active_player_position = v_next_position,
               turn_phase = 'must_spin',
               jackpot_armed = false
         where id = p_game_id;

      when 'divide_bank' then
        update public.fortune_games
           set pending_special_action = 'divide_bank',
               pending_actor_position = v_player.position,
               pending_special_label = v_segment.label,
               turn_phase = 'waiting',
               jackpot_armed = false
         where id = p_game_id;

      when 'swap_bank' then
        update public.fortune_games
           set pending_special_action = 'swap_bank',
               pending_actor_position = v_player.position,
               pending_special_label = v_segment.label,
               turn_phase = 'waiting',
               jackpot_armed = false
         where id = p_game_id;

      else
        update public.fortune_games
           set turn_phase = 'can_act',
               jackpot_armed = false
         where id = p_game_id;
    end case;
  end if;

  return jsonb_build_object(
    'segment_position', v_segment.position,
    'label', v_segment.label,
    'segment_type', v_segment.segment_type,
    'value', greatest(0, coalesce(v_segment.value, 0)),
    'spin_sequence', v_sequence,
    'spin_started_at', v_started_at,
    'spin_duration_ms', v_duration
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. RÉSOLUTION DES CASES DIVISER ET ÉCHANGE
-- ---------------------------------------------------------------------------
create or replace function public.fortune_resolve_special_v87(
  p_game_id uuid,
  p_target_position integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.fortune_games%rowtype;
  v_actor public.fortune_players%rowtype;
  v_target public.fortune_players%rowtype;
  v_actor_bank integer;
  v_target_bank integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
    into v_game
  from public.fortune_games
  where id = p_game_id
  for update;

  if not found or v_game.pending_special_action is null then
    raise exception 'special_not_pending';
  end if;

  select *
    into v_actor
  from public.fortune_players
  where game_id = p_game_id
    and position = v_game.pending_actor_position
  for update;

  if not found then
    raise exception 'actor_not_found';
  end if;

  if v_actor.user_id::text <> auth.uid()::text and not public.fortune_is_manager_v87() then
    raise exception 'not_special_actor';
  end if;

  select *
    into v_target
  from public.fortune_players
  where game_id = p_game_id
    and position = p_target_position
  for update;

  if not found then
    raise exception 'special_target';
  end if;

  if v_game.pending_special_action = 'swap_bank'
     and v_actor.position = v_target.position then
    raise exception 'special_target';
  end if;

  if v_game.pending_special_action = 'divide_bank' then
    update public.fortune_players
       set round_bank = floor(greatest(0, coalesce(round_bank, 0)) / 2.0)::integer
     where game_id = p_game_id
       and position = v_target.position;
  elsif v_game.pending_special_action = 'swap_bank' then
    v_actor_bank := greatest(0, coalesce(v_actor.round_bank, 0));
    v_target_bank := greatest(0, coalesce(v_target.round_bank, 0));

    update public.fortune_players
       set round_bank = case
         when position = v_actor.position then v_target_bank
         when position = v_target.position then v_actor_bank
         else round_bank
       end
     where game_id = p_game_id
       and position in (v_actor.position, v_target.position);
  else
    raise exception 'special_not_supported';
  end if;

  update public.fortune_games
     set pending_target_position = v_target.position,
         pending_special_action = null,
         pending_actor_position = null,
         pending_special_label = null,
         turn_phase = 'can_act'
   where id = p_game_id;

  return jsonb_build_object(
    'resolved', true,
    'target_position', v_target.position,
    'actor_position', v_actor.position
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. ARCHIVAGE AUTOMATIQUE DES PARTIES ET GAGNANTS
-- ---------------------------------------------------------------------------
create or replace function public.fortune_archive_game_v87(
  p_game_id uuid,
  p_status text,
  p_final_result text,
  p_final_prize_value integer,
  p_active_player_position integer,
  p_player_count integer,
  p_finished_at timestamptz default clock_timestamp()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner public.fortune_players%rowtype;
  v_snapshot jsonb;
  v_total integer := 0;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'position', p.position,
        'user_id', p.user_id,
        'player_name', p.player_name,
        'round_bank', p.round_bank,
        'secured_bank', p.secured_bank,
        'free_turns', p.free_turns,
        'is_active', p.is_active
      ) order by p.position
    ),
    '[]'::jsonb
  )
    into v_snapshot
  from public.fortune_players p
  where p.game_id = p_game_id;

  if p_final_result = 'won' and p_active_player_position is not null then
    select *
      into v_winner
    from public.fortune_players
    where game_id = p_game_id
      and position = p_active_player_position
    limit 1;
  end if;

  if v_winner.position is null then
    select *
      into v_winner
    from public.fortune_players
    where game_id = p_game_id
    order by (coalesce(secured_bank, 0) + coalesce(round_bank, 0)) desc,
             position asc
    limit 1;
  end if;

  if v_winner.position is not null then
    v_total := greatest(
      0,
      coalesce(v_winner.secured_bank, 0) +
      coalesce(v_winner.round_bank, 0) +
      case when p_final_result = 'won'
        then greatest(0, coalesce(p_final_prize_value, 0))
        else 0
      end
    );
  end if;

  insert into public.fortune_game_history_v87 (
    game_id,
    winner_user_id,
    winner_name,
    winner_position,
    player_count,
    total_prize,
    final_result,
    status,
    finished_at,
    snapshot
  ) values (
    p_game_id::text,
    v_winner.user_id,
    v_winner.player_name,
    v_winner.position,
    greatest(0, coalesce(p_player_count, 0)),
    v_total,
    p_final_result,
    coalesce(p_status, 'finished'),
    coalesce(p_finished_at, clock_timestamp()),
    jsonb_build_object('players', v_snapshot)
  )
  on conflict (game_id) do update
    set winner_user_id = excluded.winner_user_id,
        winner_name = excluded.winner_name,
        winner_position = excluded.winner_position,
        player_count = excluded.player_count,
        total_prize = excluded.total_prize,
        final_result = excluded.final_result,
        status = excluded.status,
        finished_at = excluded.finished_at,
        snapshot = excluded.snapshot;
end;
$$;

create or replace function public.fortune_archive_finished_game_trigger_v87()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('finished', 'cancelled')
     and old.status is distinct from new.status then
    perform public.fortune_archive_game_v87(
      new.id,
      new.status::text,
      new.final_result::text,
      new.final_prize_value,
      new.active_player_position,
      new.player_count,
      clock_timestamp()
    );
  end if;
  return new;
end;
$$;

create or replace function public.fortune_archive_deleted_game_trigger_v87()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fortune_archive_game_v87(
    old.id,
    coalesce(old.status::text, 'cancelled'),
    old.final_result::text,
    old.final_prize_value,
    old.active_player_position,
    old.player_count,
    clock_timestamp()
  );
  return old;
end;
$$;

drop trigger if exists fortune_archive_finished_game_v87
  on public.fortune_games;
create trigger fortune_archive_finished_game_v87
after update of status on public.fortune_games
for each row
execute function public.fortune_archive_finished_game_trigger_v87();

drop trigger if exists fortune_archive_deleted_game_v87
  on public.fortune_games;
create trigger fortune_archive_deleted_game_v87
before delete on public.fortune_games
for each row
execute function public.fortune_archive_deleted_game_trigger_v87();

-- Récupère également les parties terminales encore présentes au moment de
-- l'installation, sans modifier leur contenu.
do $$
declare
  v_game record;
begin
  for v_game in
    select id, status, final_result, final_prize_value,
           active_player_position, player_count
    from public.fortune_games
    where status in ('finished', 'cancelled')
  loop
    perform public.fortune_archive_game_v87(
      v_game.id,
      v_game.status::text,
      v_game.final_result::text,
      v_game.final_prize_value,
      v_game.active_player_position,
      v_game.player_count,
      clock_timestamp()
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 12. SÉCURITÉ RLS
-- ---------------------------------------------------------------------------
alter table public.fortune_puzzle_bank_v87 enable row level security;
alter table public.fortune_game_history_v87 enable row level security;

drop policy if exists "fortune puzzles read authenticated v87"
  on public.fortune_puzzle_bank_v87;
create policy "fortune puzzles read authenticated v87"
on public.fortune_puzzle_bank_v87
for select
to authenticated
using (true);

drop policy if exists "fortune puzzles manager insert v87"
  on public.fortune_puzzle_bank_v87;
create policy "fortune puzzles manager insert v87"
on public.fortune_puzzle_bank_v87
for insert
to authenticated
with check (public.fortune_is_manager_v87());

drop policy if exists "fortune puzzles manager update v87"
  on public.fortune_puzzle_bank_v87;
create policy "fortune puzzles manager update v87"
on public.fortune_puzzle_bank_v87
for update
to authenticated
using (public.fortune_is_manager_v87())
with check (public.fortune_is_manager_v87());

drop policy if exists "fortune history read authenticated v87"
  on public.fortune_game_history_v87;
create policy "fortune history read authenticated v87"
on public.fortune_game_history_v87
for select
to authenticated
using (true);

grant select on public.fortune_puzzle_bank_v87 to authenticated;
grant insert, update on public.fortune_puzzle_bank_v87 to authenticated;
grant usage, select on sequence public.fortune_puzzle_bank_v87_id_seq to authenticated;
grant select on public.fortune_game_history_v87 to authenticated;

grant execute on function public.fortune_start_timer_v87(uuid, integer)
  to authenticated, service_role;
grant execute on function public.fortune_stop_timer_v87(uuid)
  to authenticated, service_role;
grant execute on function public.fortune_reset_buzzer_v87(uuid)
  to authenticated, service_role;
grant execute on function public.fortune_press_buzzer_v87(uuid)
  to authenticated, service_role;
grant execute on function public.fortune_pick_random_puzzle_v87(uuid, integer, boolean, text)
  to authenticated, service_role;
grant execute on function public.fortune_reveal_letter_v87(uuid, text)
  to authenticated, service_role;
grant execute on function public.fortune_update_wheel_segment_v87(bigint, text, text, integer, text, boolean)
  to authenticated, service_role;
grant execute on function public.fortune_spin_wheel_v87(uuid)
  to authenticated, service_role;
grant execute on function public.fortune_resolve_special_v87(uuid, integer)
  to authenticated, service_role;

-- Ajout à Realtime seulement si ce n'est pas déjà le cas.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fortune_puzzle_bank_v87'
    ) then
      alter publication supabase_realtime
        add table public.fortune_puzzle_bank_v87;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'fortune_game_history_v87'
    ) then
      alter publication supabase_realtime
        add table public.fortune_game_history_v87;
    end if;
  end if;
exception when insufficient_privilege then
  raise notice 'Realtime non modifié : droits insuffisants, sans impact sur la V87.';
end
$$;

analyze public.fortune_games;
do $$
begin
  if to_regclass('public.fortune_game_players') is not null then
    analyze public.fortune_game_players;
  elsif exists (
    select 1 from pg_class
    where oid = to_regclass('public.fortune_players')
      and relkind in ('r', 'p')
  ) then
    analyze public.fortune_players;
  end if;
end
$$;
analyze public.fortune_rounds;
analyze public.fortune_wheel_segments;
analyze public.fortune_puzzle_bank_v87;
analyze public.fortune_game_history_v87;

select
  'V87_OK'::text as resultat,
  (select count(*) from public.fortune_puzzle_bank_v87) as enigmes_disponibles,
  (select count(*) from public.fortune_game_history_v87) as parties_archivees;
