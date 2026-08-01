-- Nostra Group · Le Cercle Nostra · V110
-- Exécuter après les SQL V108 et V109 dans Supabase → SQL Editor.
-- Ajoute le contrôle complet de chaque jeu sans effacer les joueurs ni leur solde.

create table if not exists public.casino_game_settings (
  game text primary key check (game in ('poker','blackjack','roulette','slots','dice','plinko','coinflip')),
  enabled boolean not null default true,
  difficulty text not null default 'hard' check (difficulty in ('balanced','hard','expert','custom')),
  win_rate_percent numeric(5,2) not null default 35 check (win_rate_percent between 1 and 95),
  min_bet bigint not null default 25 check (min_bet > 0),
  max_bet bigint not null default 25000 check (max_bet >= min_bet),
  base_multiplier numeric(8,2) not null default 2 check (base_multiplier between 0.1 and 100),
  jackpot_multiplier numeric(8,2) not null default 10 check (jackpot_multiplier between 0.1 and 1000),
  max_payout bigint not null default 100000 check (max_payout > 0),
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.casino_game_settings
  (game, enabled, difficulty, win_rate_percent, min_bet, max_bet, base_multiplier, jackpot_multiplier, max_payout, sort_order)
values
  ('poker', true, 'hard', 30, 100, 50000, 4, 6, 250000, 1),
  ('blackjack', true, 'hard', 34, 50, 25000, 2, 2.5, 100000, 2),
  ('roulette', true, 'hard', 38, 50, 25000, 2, 36, 250000, 3),
  ('slots', true, 'expert', 20, 25, 10000, 2, 25, 250000, 4),
  ('dice', true, 'hard', 40, 25, 20000, 1.9, 4, 100000, 5),
  ('plinko', true, 'expert', 28, 25, 20000, 1.6, 12, 150000, 6),
  ('coinflip', true, 'hard', 40, 25, 20000, 1.9, 3, 100000, 7)
on conflict (game) do nothing;

alter table public.casino_game_settings enable row level security;
drop policy if exists "casino game settings readable" on public.casino_game_settings;
create policy "casino game settings readable"
on public.casino_game_settings for select to authenticated using (public.is_nostra_manager());

create or replace function public.casino_public_game_settings_v110()
returns table (
  game text,
  enabled boolean,
  difficulty text,
  min_bet bigint,
  max_bet bigint,
  base_multiplier numeric,
  jackpot_multiplier numeric,
  max_payout bigint,
  sort_order smallint
)
language sql
stable
security definer
set search_path = public
as $$
  select g.game, g.enabled, g.difficulty, g.min_bet, g.max_bet,
    g.base_multiplier, g.jackpot_multiplier, g.max_payout, g.sort_order
  from public.casino_game_settings g
  order by g.sort_order;
$$;

create or replace function public.casino_update_game_settings_v110(
  p_game text,
  p_enabled boolean,
  p_difficulty text,
  p_win_rate_percent numeric,
  p_min_bet bigint,
  p_max_bet bigint,
  p_base_multiplier numeric,
  p_jackpot_multiplier numeric,
  p_max_payout bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  if p_game not in ('poker','blackjack','roulette','slots','dice','plinko','coinflip')
    or p_difficulty not in ('balanced','hard','expert','custom')
    or p_win_rate_percent not between 1 and 95
    or p_min_bet < 1 or p_max_bet < p_min_bet
    or p_base_multiplier not between 0.1 and 100
    or p_jackpot_multiplier < p_base_multiplier or p_jackpot_multiplier > 1000
    or p_max_payout < 1
  then raise exception 'invalid_game_settings'; end if;

  update public.casino_game_settings set
    enabled = p_enabled,
    difficulty = p_difficulty,
    win_rate_percent = p_win_rate_percent,
    min_bet = p_min_bet,
    max_bet = p_max_bet,
    base_multiplier = p_base_multiplier,
    jackpot_multiplier = p_jackpot_multiplier,
    max_payout = p_max_payout,
    updated_at = now(),
    updated_by = auth.uid()
  where game = p_game;
  if not found then raise exception 'unknown_game'; end if;
  return true;
end;
$$;

create or replace function public.casino_admin_control_v110()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'games', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.sort_order)
      from public.casino_game_settings g
    ), '[]'::jsonb),
    'stats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'game', s.game,
        'rounds', s.rounds,
        'wagered', s.wagered,
        'paid', s.paid
      ) order by s.game)
      from (
        select game, count(*)::bigint rounds, coalesce(sum(wager),0)::bigint wagered, coalesce(sum(payout),0)::bigint paid
        from public.casino_game_rounds
        where status = 'settled'
        group by game
      ) s
    ), '[]'::jsonb),
    'rounds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'display_name', coalesce(public.casino_display_name_v108(r.user_id), 'Citoyen Nostra'),
        'game', r.game,
        'wager', r.wager,
        'payout', r.payout,
        'status', r.status,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from (
        select * from public.casino_game_rounds order by created_at desc limit 40
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.casino_roulette_match_v110(p_choice text, p_number integer)
returns boolean
language plpgsql
immutable
as $$
declare v_red integer[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  return (p_choice = 'green' and p_number = 0)
    or (p_choice = 'red' and p_number = any(v_red))
    or (p_choice = 'black' and p_number > 0 and not (p_number = any(v_red)))
    or (p_choice = 'even' and p_number > 0 and mod(p_number,2) = 0)
    or (p_choice = 'odd' and mod(p_number,2) = 1)
    or (p_choice = 'low' and p_number between 1 and 18)
    or (p_choice = 'high' and p_number between 19 and 36)
    or case when p_choice ~ '^number:([0-9]|[12][0-9]|3[0-6])$'
      then split_part(p_choice,':',2)::integer = p_number
      else false end;
end;
$$;

-- Remplace le moteur des cinq jeux instantanés : activation, limites, pourcentage,
-- multiplicateurs et plafond sont désormais ceux du Dashboard.
create or replace function public.casino_play_simple_v108(p_game text, p_wager bigint, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_config public.casino_game_settings%rowtype;
  v_balance bigint;
  v_payout bigint := 0;
  v_result jsonb := '{}'::jsonb;
  v_number integer;
  v_symbols text[] := array['◆','♠','✦','7','♛','●'];
  v_a text; v_b text; v_c text;
  v_multiplier numeric := 0;
  v_win boolean;
  v_jackpot boolean;
  v_index integer;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_game not in ('roulette','slots','dice','plinko','coinflip') or p_wager < 1 then raise exception 'invalid_game'; end if;
  select * into v_config from public.casino_game_settings where game = p_game;
  if not found then raise exception 'game_not_configured'; end if;
  if not v_config.enabled then raise exception 'game_closed'; end if;
  if p_wager < v_config.min_bet or p_wager > v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;

  insert into public.casino_wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.casino_wallets set balance = balance - p_wager, lifetime_wagered = lifetime_wagered + p_wager, updated_at = now()
  where user_id = auth.uid() and balance >= p_wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;

  v_win := random() * 100 < v_config.win_rate_percent;
  v_jackpot := v_win and random() < 0.05;

  if p_game = 'roulette' then
    if p_choice not in ('red','black','even','odd','low','high','green') and p_choice !~ '^number:([0-9]|[12][0-9]|3[0-6])$' then raise exception 'invalid_choice'; end if;
    loop
      v_number := floor(random() * 37)::integer;
      exit when public.casino_roulette_match_v110(p_choice, v_number) = v_win;
    end loop;
    v_multiplier := case when v_win and (p_choice = 'green' or p_choice like 'number:%') then v_config.jackpot_multiplier when v_win then v_config.base_multiplier else 0 end;
    v_result := jsonb_build_object('number',v_number,'result',case when v_win then 'Mise gagnante' else 'La bille tombe sur '||v_number end,'multiplier',v_multiplier);

  elsif p_game = 'slots' then
    if v_win and v_jackpot then
      v_index := 1 + floor(random() * array_length(v_symbols,1))::integer;
      v_a := v_symbols[v_index]; v_b := v_a; v_c := v_a;
      v_multiplier := v_config.jackpot_multiplier;
    elsif v_win then
      v_index := 1 + floor(random() * array_length(v_symbols,1))::integer;
      v_a := v_symbols[v_index]; v_b := v_a;
      loop v_c := v_symbols[1 + floor(random() * array_length(v_symbols,1))::integer]; exit when v_c <> v_a; end loop;
      if random() < 0.5 then v_b := v_c; v_c := v_a; end if;
      v_multiplier := v_config.base_multiplier;
    else
      v_a := v_symbols[1 + floor(random() * array_length(v_symbols,1))::integer];
      loop v_b := v_symbols[1 + floor(random() * array_length(v_symbols,1))::integer]; exit when v_b <> v_a; end loop;
      loop v_c := v_symbols[1 + floor(random() * array_length(v_symbols,1))::integer]; exit when v_c <> v_a and v_c <> v_b; end loop;
    end if;
    v_result := jsonb_build_object('symbols',jsonb_build_array(v_a,v_b,v_c),'result',case when v_jackpot then 'Jackpot !' when v_win then 'Combinaison gagnante' else 'Aucune combinaison' end,'multiplier',v_multiplier);

  elsif p_game = 'dice' then
    if p_choice not in ('under','over') then raise exception 'invalid_choice'; end if;
    if v_win then
      v_number := case when p_choice = 'under' then floor(random()*50)::integer else 50 + floor(random()*50)::integer end;
      v_multiplier := v_config.base_multiplier;
    else
      v_number := case when p_choice = 'under' then 50 + floor(random()*50)::integer else floor(random()*50)::integer end;
    end if;
    v_result := jsonb_build_object('number',v_number,'result',case when v_win then 'Prédiction correcte' else 'Prédiction manquée' end,'multiplier',v_multiplier);

  elsif p_game = 'coinflip' then
    if p_choice not in ('heads','tails') then raise exception 'invalid_choice'; end if;
    v_a := case when v_win then p_choice when p_choice = 'heads' then 'tails' else 'heads' end;
    if v_win then v_multiplier := v_config.base_multiplier; end if;
    v_result := jsonb_build_object('outcome',v_a,'result',case when v_win then 'Bon côté !' else 'Mauvais côté' end,'multiplier',v_multiplier);

  else
    if p_choice not in ('low','medium','high') then raise exception 'invalid_choice'; end if;
    v_number := floor(random()*9)::integer;
    if v_jackpot then v_multiplier := v_config.jackpot_multiplier;
    elsif v_win then v_multiplier := v_config.base_multiplier;
    elsif random() < 0.28 then v_multiplier := 0.5;
    else v_multiplier := 0;
    end if;
    v_result := jsonb_build_object('number',v_number,'result','Multiplicateur ×'||v_multiplier,'multiplier',v_multiplier);
  end if;

  v_payout := least(v_config.max_payout, floor(p_wager * v_multiplier)::bigint);
  update public.casino_wallets set balance=balance+v_payout, lifetime_won=lifetime_won+v_payout, games_played=games_played+1, biggest_win=greatest(biggest_win,v_payout), xp=xp+greatest(10,least(250,floor(p_wager::numeric/10)::bigint)), updated_at=now()
  where user_id=auth.uid() returning balance into v_balance;
  insert into public.casino_game_rounds (id,user_id,game,wager,payout,status,result,settled_at) values (v_id,auth.uid(),p_game,p_wager,v_payout,'settled',v_result,now());
  insert into public.casino_transactions (user_id,kind,amount,balance_after,label,reference_id) values (auth.uid(),'wager',-p_wager,v_balance-v_payout,'Mise '||p_game,v_id);
  if v_payout>0 then insert into public.casino_transactions (user_id,kind,amount,balance_after,label,reference_id) values (auth.uid(),'payout',v_payout,v_balance,'Gain '||p_game,v_id); end if;
  return v_result || jsonb_build_object('payout',v_payout,'balance',v_balance,'finished',true);
end;
$$;

revoke all on public.casino_game_settings from anon;
grant select on public.casino_game_settings to authenticated;
revoke all on function public.casino_public_game_settings_v110() from public, anon;
grant execute on function public.casino_public_game_settings_v110() to authenticated;
grant execute on function public.casino_update_game_settings_v110(text,boolean,text,numeric,bigint,bigint,numeric,numeric,bigint) to authenticated;
grant execute on function public.casino_admin_control_v110() to authenticated;
grant execute on function public.casino_play_simple_v108(text,bigint,text) to authenticated;
