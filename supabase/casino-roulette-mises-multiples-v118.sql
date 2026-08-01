-- Nostra Group · Le Cercle Nostra · V118
-- À exécuter une seule fois après la V117.
-- Corrige le règlement de la roulette avec plusieurs mises.

create or replace function public.casino_play_roulette_v118(p_bets jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_config public.casino_game_settings%rowtype;
  v_bet jsonb;
  v_choice text;
  v_amount bigint;
  v_total bigint := 0;
  v_balance_before bigint;
  v_balance bigint;
  v_number integer;
  v_candidate integer;
  v_candidate_payout bigint;
  v_payout bigint := 0;
  v_target_win boolean;
  v_candidates integer[] := array[]::integer[];
  v_winning_bets jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if p_bets is null
    or jsonb_typeof(p_bets) <> 'array'
    or jsonb_array_length(p_bets) < 1
    or jsonb_array_length(p_bets) > 64
  then
    raise exception 'invalid_bets';
  end if;

  select * into v_config
  from public.casino_game_settings
  where game = 'roulette';

  if not found or not v_config.enabled then
    raise exception 'game_closed';
  end if;

  for v_bet in select value from jsonb_array_elements(p_bets)
  loop
    if jsonb_typeof(v_bet) <> 'object' then
      raise exception 'invalid_bets';
    end if;

    v_choice := coalesce(v_bet->>'choice', '');
    if coalesce(v_bet->>'amount', '') !~ '^[0-9]+$' then
      raise exception 'invalid_bets';
    end if;

    v_amount := (v_bet->>'amount')::bigint;
    if v_amount < 1 or (
      v_choice not in ('red', 'black', 'even', 'odd', 'low', 'high')
      and v_choice !~ '^number:([0-9]|[12][0-9]|3[0-6])$'
      and v_choice !~ '^dozen:[123]$'
      and v_choice !~ '^column:[123]$'
    ) then
      raise exception 'invalid_bets';
    end if;

    v_total := v_total + v_amount;
  end loop;

  if v_total < v_config.min_bet or v_total > v_config.max_bet then
    raise exception 'wager_out_of_bounds';
  end if;

  v_target_win := random() * 100 < v_config.win_rate_percent;

  for v_candidate in 0..36 loop
    v_candidate_payout := 0;
    for v_bet in select value from jsonb_array_elements(p_bets)
    loop
      if public.casino_roulette_match_v117(v_bet->>'choice', v_candidate) then
        v_candidate_payout := v_candidate_payout
          + (v_bet->>'amount')::bigint
          * public.casino_roulette_multiplier_v117(v_bet->>'choice');
      end if;
    end loop;

    v_candidate_payout := least(v_config.max_payout, v_candidate_payout);
    if (v_target_win and v_candidate_payout > v_total)
      or (not v_target_win and v_candidate_payout <= v_total)
    then
      v_candidates := array_append(v_candidates, v_candidate);
    end if;
  end loop;

  if cardinality(v_candidates) = 0 then
    v_number := floor(random() * 37)::integer;
  else
    v_number := v_candidates[1 + floor(random() * cardinality(v_candidates))::integer];
  end if;

  for v_bet in select value from jsonb_array_elements(p_bets)
  loop
    if public.casino_roulette_match_v117(v_bet->>'choice', v_number) then
      v_payout := v_payout
        + (v_bet->>'amount')::bigint
        * public.casino_roulette_multiplier_v117(v_bet->>'choice');
      v_winning_bets := v_winning_bets || jsonb_build_array(v_bet);
    end if;
  end loop;
  v_payout := least(v_config.max_payout, v_payout);

  insert into public.casino_wallets(user_id)
  values(auth.uid())
  on conflict(user_id) do nothing;

  select balance into v_balance_before
  from public.casino_wallets
  where user_id = auth.uid()
  for update;

  if v_balance_before < v_total then
    raise exception 'insufficient_balance';
  end if;

  v_balance := v_balance_before - v_total + v_payout;

  update public.casino_wallets
  set balance = v_balance,
      lifetime_wagered = lifetime_wagered + v_total,
      lifetime_won = lifetime_won + v_payout,
      games_played = games_played + 1,
      biggest_win = greatest(biggest_win, v_payout),
      xp = xp + greatest(10, least(250, floor(v_total::numeric / 10)::bigint)),
      updated_at = now()
  where user_id = auth.uid();

  insert into public.casino_game_rounds(
    id, user_id, game, wager, payout, status, result, settled_at
  ) values (
    v_id, auth.uid(), 'roulette', v_total, v_payout, 'settled',
    jsonb_build_object(
      'number', v_number,
      'bets', p_bets,
      'winning_bets', v_winning_bets,
      'mode', 'multi_bet'
    ),
    now()
  );

  -- La V117 utilisait le type inexistant "game", ce qui annulait toute la partie.
  insert into public.casino_transactions(
    user_id, kind, amount, balance_after, label, reference_id
  ) values (
    auth.uid(), 'wager', -v_total, v_balance_before - v_total,
    'Roulette · ' || jsonb_array_length(p_bets) || ' pari(s)', v_id
  );

  if v_payout > 0 then
    insert into public.casino_transactions(
      user_id, kind, amount, balance_after, label, reference_id
    ) values (
      auth.uid(), 'payout', v_payout, v_balance,
      'Gain roulette · numéro ' || v_number, v_id
    );
  end if;

  return jsonb_build_object(
    'finished', true,
    'number', v_number,
    'wager', v_total,
    'payout', v_payout,
    'balance', v_balance,
    'winningBets', v_winning_bets,
    'result', case
      when v_payout > v_total then 'La table paie ' || v_payout || ' jetons'
      when v_payout = v_total then 'Mise récupérée'
      when v_payout > 0 then 'Gain partiel : ' || v_payout || ' jetons'
      else 'La bille tombe sur ' || v_number
    end
  );
end;
$$;

revoke all on function public.casino_play_roulette_v118(jsonb) from public, anon;
grant execute on function public.casino_play_roulette_v118(jsonb) to authenticated;

notify pgrst, 'reload schema';
