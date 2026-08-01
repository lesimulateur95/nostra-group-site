-- Nostra Group · Le Cercle Nostra · V115
-- À exécuter une seule fois après les SQL Casino V108 à V114.
-- Ajoute Double ou quitte sans effacer les joueurs, les statistiques ni les réglages existants.

do $$
declare
  v_constraint record;
begin
  -- Les trois tables historiques possèdent un CHECK qui énumère les jeux.
  -- On retire uniquement le CHECK attaché à leur colonne "game".
  for v_constraint in
    select c.conrelid::regclass as table_name, c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname in ('casino_game_settings', 'casino_game_rounds', 'casino_active_games')
      and c.contype = 'c'
      and exists (
        select 1
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attname = 'game'
          and a.attnum = any(c.conkey)
      )
  loop
    execute format('alter table %s drop constraint %I', v_constraint.table_name, v_constraint.conname);
  end loop;
end;
$$;

-- Toute une étape (lecture du gain, tirage, règlement et suppression de l'état)
-- est traitée dans une seule transaction verrouillée. Un double clic ne peut
-- donc ni doubler deux fois la même étape, ni payer deux fois une partie.
create or replace function public.casino_double_or_quit_v115(
  p_action text,
  p_wager bigint,
  p_expected_doubles integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_config public.casino_game_settings%rowtype;
  v_active public.casino_active_games%rowtype;
  v_round_id uuid;
  v_current bigint;
  v_doubles integer;
  v_balance bigint := 0;
  v_win boolean;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if p_action not in ('status','start','double','cashout') then raise exception 'invalid_action'; end if;

  select * into v_config
  from public.casino_game_settings
  where game = 'double_or_quit';
  if not found then raise exception 'game_not_configured'; end if;
  if not v_config.enabled then raise exception 'game_closed'; end if;

  select coalesce(balance, 0) into v_balance
  from public.casino_wallets
  where user_id = v_user_id;
  v_balance := coalesce(v_balance, 0);

  if p_action = 'status' then
    select * into v_active
    from public.casino_active_games
    where user_id = v_user_id and game = 'double_or_quit';

    if not found then
      return jsonb_build_object(
        'active', false,
        'finished', true,
        'currentAmount', 0,
        'doubles', 0,
        'balance', v_balance
      );
    end if;

    return jsonb_build_object(
      'active', true,
      'finished', false,
      'currentAmount', coalesce((v_active.state->>'currentAmount')::bigint, 0),
      'doubles', coalesce((v_active.state->>'doubles')::integer, 0),
      'balance', v_balance
    );
  end if;

  if p_action = 'start' then
    if p_wager < v_config.min_bet or p_wager > v_config.max_bet then
      raise exception 'wager_out_of_bounds';
    end if;

    v_round_id := public.casino_begin_game_v108('double_or_quit', p_wager);
    insert into public.casino_active_games (user_id, game, round_id, state, updated_at)
    values (
      v_user_id,
      'double_or_quit',
      v_round_id,
      jsonb_build_object('roundId', v_round_id, 'wager', p_wager, 'currentAmount', p_wager, 'doubles', 0),
      now()
    );

    select balance into v_balance from public.casino_wallets where user_id = v_user_id;
    return jsonb_build_object(
      'active', true,
      'finished', false,
      'result', 'Ta mise est prête. Double-la ou encaisse-la.',
      'currentAmount', p_wager,
      'doubles', 0,
      'balance', v_balance
    );
  end if;

  select * into v_active
  from public.casino_active_games
  where user_id = v_user_id and game = 'double_or_quit'
  for update;
  if not found then raise exception 'no_active_double_game'; end if;

  v_round_id := v_active.round_id;
  v_current := greatest(0, coalesce((v_active.state->>'currentAmount')::bigint, 0));
  v_doubles := greatest(0, coalesce((v_active.state->>'doubles')::integer, 0));

  if coalesce(p_expected_doubles, -1) <> v_doubles then
    raise exception 'stale_double_action';
  end if;

  if p_action = 'cashout' then
    v_current := least(v_config.max_payout, v_current);
    perform public.casino_server_settle_v108(
      v_user_id,
      v_round_id,
      v_current,
      jsonb_build_object('result','cashout','doubles',v_doubles,'final_amount',v_current)
    );
    delete from public.casino_active_games
    where user_id = v_user_id and game = 'double_or_quit';
    select balance into v_balance from public.casino_wallets where user_id = v_user_id;
    return jsonb_build_object(
      'active', false,
      'finished', true,
      'result', 'Tu quittes la table avec ' || v_current || ' jetons',
      'payout', v_current,
      'currentAmount', v_current,
      'doubles', v_doubles,
      'balance', v_balance
    );
  end if;

  v_win := random() * 100 < v_config.win_rate_percent;
  if not v_win then
    perform public.casino_server_settle_v108(
      v_user_id,
      v_round_id,
      0,
      jsonb_build_object('result','lost','doubles',v_doubles,'amount_lost',v_current)
    );
    delete from public.casino_active_games
    where user_id = v_user_id and game = 'double_or_quit';
    select balance into v_balance from public.casino_wallets where user_id = v_user_id;
    return jsonb_build_object(
      'active', false,
      'finished', true,
      'result', 'Tout est perdu. La Maison remporte la partie.',
      'payout', 0,
      'currentAmount', 0,
      'doubles', v_doubles,
      'balance', v_balance
    );
  end if;

  v_current := least(v_config.max_payout, v_current * 2);
  v_doubles := v_doubles + 1;

  if v_current >= v_config.max_payout then
    perform public.casino_server_settle_v108(
      v_user_id,
      v_round_id,
      v_current,
      jsonb_build_object('result','max_payout','doubles',v_doubles,'final_amount',v_current)
    );
    delete from public.casino_active_games
    where user_id = v_user_id and game = 'double_or_quit';
    select balance into v_balance from public.casino_wallets where user_id = v_user_id;
    return jsonb_build_object(
      'active', false,
      'finished', true,
      'result', 'Plafond de la table atteint : gain encaissé automatiquement !',
      'payout', v_current,
      'currentAmount', v_current,
      'doubles', v_doubles,
      'balance', v_balance
    );
  end if;

  update public.casino_active_games
  set state = jsonb_build_object(
        'roundId', v_round_id,
        'wager', p_wager,
        'currentAmount', v_current,
        'doubles', v_doubles
      ),
      updated_at = now()
  where user_id = v_user_id and game = 'double_or_quit';

  return jsonb_build_object(
    'active', true,
    'finished', false,
    'result', 'Double réussi : ' || v_current || ' jetons en jeu',
    'currentAmount', v_current,
    'doubles', v_doubles,
    'balance', v_balance
  );
end;
$$;

alter table public.casino_game_settings
  add constraint casino_game_settings_game_check_v115
  check (game in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit'));

alter table public.casino_game_rounds
  add constraint casino_game_rounds_game_check_v115
  check (game in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit'));

alter table public.casino_active_games
  add constraint casino_active_games_game_check_v115
  check (game in ('poker','blackjack','double_or_quit'));

insert into public.casino_game_settings
  (game, enabled, difficulty, win_rate_percent, min_bet, max_bet, base_multiplier, jackpot_multiplier, max_payout, sort_order)
values
  ('double_or_quit', true, 'hard', 42, 100, 25000, 2, 2, 500000, 8)
on conflict (game) do nothing;

-- Étend la mise sécurisée des jeux à étapes au nouveau jeu.
create or replace function public.casino_begin_game_v108(p_game text, p_wager bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_balance bigint;
  v_config public.casino_game_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_game not in ('poker','blackjack','double_or_quit') or p_wager < 1 then raise exception 'invalid_game'; end if;

  select * into v_config from public.casino_game_settings where game = p_game;
  if not found then raise exception 'game_not_configured'; end if;
  if not v_config.enabled then raise exception 'game_closed'; end if;
  if p_wager < v_config.min_bet or p_wager > v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;

  if exists (
    select 1 from public.casino_game_rounds
    where user_id = auth.uid() and game = p_game and status = 'pending'
  ) then
    raise exception 'active_game_exists';
  end if;

  insert into public.casino_wallets (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.casino_wallets
  set balance = balance - p_wager,
      lifetime_wagered = lifetime_wagered + p_wager,
      updated_at = now()
  where user_id = auth.uid() and balance >= p_wager
  returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;

  insert into public.casino_game_rounds (user_id, game, wager)
  values (auth.uid(), p_game, p_wager)
  returning id into v_id;

  insert into public.casino_transactions
    (user_id, kind, amount, balance_after, label, reference_id)
  values
    (auth.uid(), 'wager', -p_wager, v_balance, 'Mise ' || p_game, v_id);

  return v_id;
end;
$$;

-- Le Dashboard V110 continue d'utiliser la même action, avec le nouveau jeu autorisé.
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
  if p_game not in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit')
    or p_difficulty not in ('balanced','hard','expert','custom')
    or p_win_rate_percent not between 1 and 95
    or p_min_bet < 1 or p_max_bet < p_min_bet
    or p_base_multiplier not between 0.1 and 100
    or p_jackpot_multiplier < p_base_multiplier or p_jackpot_multiplier > 1000
    or p_max_payout < 1
  then raise exception 'invalid_game_settings'; end if;

  -- Double ou quitte reste toujours un vrai x2. La Direction règle le taux,
  -- les mises, l'ouverture et le plafond, mais pas la définition du jeu.
  if p_game = 'double_or_quit' then
    p_base_multiplier := 2;
    p_jackpot_multiplier := 2;
  end if;

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

revoke all on function public.casino_begin_game_v108(text,bigint) from public, anon;
grant execute on function public.casino_begin_game_v108(text,bigint) to authenticated;
revoke all on function public.casino_double_or_quit_v115(text,bigint,integer) from public, anon;
grant execute on function public.casino_double_or_quit_v115(text,bigint,integer) to authenticated;
grant execute on function public.casino_update_game_settings_v110(text,boolean,text,numeric,bigint,bigint,numeric,numeric,bigint) to authenticated;

-- Vérification indicative après exécution : doit retourner exactement une ligne.
select game, enabled, difficulty, win_rate_percent, min_bet, max_bet, max_payout
from public.casino_game_settings
where game = 'double_or_quit';
