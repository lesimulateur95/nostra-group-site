-- Nostra Group · Casino · V130
-- Le bouton Tapis engage le solde réel de jetons du citoyen, sans plafond de table.

begin;

-- Poker solo : le montant du tapis est calculé et débité atomiquement dans la base.
create or replace function public.casino_poker_lock_action_v130(
  p_round_id uuid,
  p_expected_version integer,
  p_amount bigint default 0,
  p_all_in boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.casino_active_games%rowtype;
  v_config public.casino_game_settings%rowtype;
  v_balance bigint;
  v_committed bigint;
  v_amount bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_amount < 0 then raise exception 'invalid_raise'; end if;

  select * into v_active
  from public.casino_active_games
  where user_id = auth.uid() and game = 'poker'
  for update;

  if not found or v_active.round_id <> p_round_id then raise exception 'no_active_poker'; end if;
  if coalesce((v_active.state->>'actionVersion')::integer, 0) <> p_expected_version then
    raise exception 'stale_poker_action';
  end if;

  select balance into v_balance
  from public.casino_wallets
  where user_id = auth.uid()
  for update;

  if not found then raise exception 'insufficient_balance'; end if;
  v_amount := case when p_all_in then v_balance else p_amount end;
  if v_amount < 0 or (p_all_in and v_amount < 1) then raise exception 'insufficient_balance'; end if;

  v_committed := coalesce((v_active.state->>'committed')::bigint, (v_active.state->>'wager')::bigint, 0);
  select * into v_config from public.casino_game_settings where game = 'poker';
  if not p_all_in and v_committed + v_amount > v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;

  update public.casino_wallets
  set balance = balance - v_amount,
      lifetime_wagered = lifetime_wagered + v_amount,
      updated_at = now()
  where user_id = auth.uid() and balance >= v_amount
  returning balance into v_balance;

  if not found then raise exception 'insufficient_balance'; end if;

  update public.casino_game_rounds
  set wager = wager + v_amount
  where id = p_round_id and user_id = auth.uid();

  update public.casino_active_games
  set state = jsonb_set(
        jsonb_set(state, '{actionVersion}', to_jsonb(p_expected_version + 1), true),
        '{committed}', to_jsonb(v_committed + v_amount), true
      ),
      updated_at = now()
  where user_id = auth.uid() and game = 'poker';

  return jsonb_build_object('balance', v_balance, 'amount', v_amount);
end;
$$;

-- Poker citoyen : ajoute d'abord tout le portefeuille restant à la cave,
-- puis laisse le moteur heads-up engager ce montant et gérer les mises non couvertes.
create or replace function public.casino_pvp_poker_action_v130(
  p_room_id uuid,
  p_action text,
  p_amount bigint default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.casino_pvp_rooms%rowtype;
  v_side text;
  v_stack_key text;
  v_stack bigint;
  v_wallet bigint := 0;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;

  if p_action = 'allin' then
    select * into v_room
    from public.casino_pvp_rooms
    where id = p_room_id
    for update;

    if not found or v_room.game <> 'poker' or v_room.status <> 'playing' then
      raise exception 'poker_not_playing';
    end if;

    if v_user_id = v_room.host_user_id then v_side := 'host';
    elsif v_user_id = v_room.guest_user_id then v_side := 'guest';
    else raise exception 'forbidden';
    end if;

    if v_room.state->>'turnSide' <> v_side then raise exception 'not_your_turn'; end if;

    select balance into v_wallet
    from public.casino_wallets
    where user_id = v_user_id
    for update;

    v_wallet := coalesce(v_wallet, 0);
    if v_wallet > 0 then
      v_stack_key := v_side || 'Stack';
      v_stack := coalesce((v_room.state->>v_stack_key)::bigint, 0);

      update public.casino_wallets
      set balance = 0,
          lifetime_wagered = lifetime_wagered + v_wallet,
          updated_at = now()
      where user_id = v_user_id;

      update public.casino_pvp_rooms
      set state = jsonb_set(state, array[v_stack_key], to_jsonb(v_stack + v_wallet), true),
          updated_at = now()
      where id = p_room_id;

      insert into public.casino_transactions(user_id, kind, amount, balance_after, label, reference_id)
      values(v_user_id, 'table_buyin', -v_wallet, 0, 'Complément tapis poker citoyen', p_room_id);
    end if;
  end if;

  return public.casino_pvp_poker_action_v117(p_room_id, p_action, p_amount);
end;
$$;

revoke all on function public.casino_poker_lock_action_v130(uuid, integer, bigint, boolean) from public, anon;
revoke all on function public.casino_pvp_poker_action_v130(uuid, text, bigint) from public, anon;
grant execute on function public.casino_poker_lock_action_v130(uuid, integer, bigint, boolean) to authenticated;
grant execute on function public.casino_pvp_poker_action_v130(uuid, text, bigint) to authenticated;

commit;

select 'V130 prête · Tapis utilise le solde réel de jetons' as resultat;
