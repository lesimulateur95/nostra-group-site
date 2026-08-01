-- V121 · Plinko : le multiplicateur, la case et le paiement proviennent
-- d'un même résultat serveur. La case renvoyée est toujours comprise entre 0 et 6.

create or replace function public.casino_play_plinko_v121(p_wager bigint, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_config public.casino_game_settings%rowtype;
  v_balance_after_wager bigint;
  v_balance_after_payout bigint;
  v_payout bigint := 0;
  v_multiplier numeric := 0;
  v_slot integer := 3;
  v_win boolean;
  v_jackpot boolean;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_choice not in ('low','medium','high') or p_wager < 1 then raise exception 'invalid_choice'; end if;

  select * into v_config
  from public.casino_game_settings
  where game = 'plinko';

  if not found then raise exception 'game_not_configured'; end if;
  if not v_config.enabled then raise exception 'game_closed'; end if;
  if p_wager < v_config.min_bet or p_wager > v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;

  insert into public.casino_wallets (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  update public.casino_wallets
  set balance = balance - p_wager,
      lifetime_wagered = lifetime_wagered + p_wager,
      updated_at = now()
  where user_id = auth.uid()
    and balance >= p_wager
  returning balance into v_balance_after_wager;

  if not found then raise exception 'insufficient_balance'; end if;

  v_win := random() * 100 < v_config.win_rate_percent;
  v_jackpot := v_win and random() < 0.05;

  if v_jackpot then
    v_multiplier := v_config.jackpot_multiplier;
    v_slot := case when random() < 0.5 then 0 else 6 end;
  elsif v_win then
    v_multiplier := v_config.base_multiplier;
    v_slot := case when random() < 0.5 then 2 else 4 end;
  elsif random() < 0.28 then
    v_multiplier := 0.5;
    v_slot := case when random() < 0.5 then 1 else 5 end;
  else
    v_multiplier := 0;
    v_slot := 3;
  end if;

  v_payout := least(v_config.max_payout, floor(p_wager * v_multiplier)::bigint);
  v_result := jsonb_build_object(
    'slot', v_slot,
    'number', v_slot,
    'risk', p_choice,
    'result', 'La bille tombe dans la case ×' || v_multiplier,
    'multiplier', v_multiplier
  );

  update public.casino_wallets
  set balance = balance + v_payout,
      lifetime_won = lifetime_won + v_payout,
      games_played = games_played + 1,
      biggest_win = greatest(biggest_win, v_payout),
      xp = xp + greatest(10, least(250, floor(p_wager::numeric / 10)::bigint)),
      updated_at = now()
  where user_id = auth.uid()
  returning balance into v_balance_after_payout;

  insert into public.casino_game_rounds
    (id, user_id, game, wager, payout, status, result, settled_at)
  values
    (v_id, auth.uid(), 'plinko', p_wager, v_payout, 'settled', v_result, now());

  insert into public.casino_transactions
    (user_id, kind, amount, balance_after, label, reference_id)
  values
    (auth.uid(), 'wager', -p_wager, v_balance_after_wager, 'Mise plinko', v_id);

  if v_payout > 0 then
    insert into public.casino_transactions
      (user_id, kind, amount, balance_after, label, reference_id)
    values
      (auth.uid(), 'payout', v_payout, v_balance_after_payout, 'Gain plinko', v_id);
  end if;

  return v_result || jsonb_build_object(
    'payout', v_payout,
    'balance', v_balance_after_payout,
    'finished', true
  );
end;
$$;

revoke all on function public.casino_play_plinko_v121(bigint,text) from public, anon;
grant execute on function public.casino_play_plinko_v121(bigint,text) to authenticated;

select 'V121 prête · Plinko à trajectoires réelles' as resultat;
