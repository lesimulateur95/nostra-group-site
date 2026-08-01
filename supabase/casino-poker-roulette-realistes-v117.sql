-- Nostra Group · Le Cercle Nostra · V117
-- À exécuter une seule fois après la V116.
-- Roulette multi-paris + poker avec enchères réelles et choix de montrer les cartes.

alter table public.casino_pvp_rooms
  add column if not exists state jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.casino_pvp_rooms drop constraint if exists casino_pvp_rooms_status_check;
alter table public.casino_pvp_rooms
  add constraint casino_pvp_rooms_status_check check (status in ('open','playing','finished','cancelled'));

create or replace function public.casino_roulette_multiplier_v117(p_choice text)
returns integer
language sql
immutable
strict
as $$
  select case
    when p_choice ~ '^number:([0-9]|[12][0-9]|3[0-6])$' then 36
    when p_choice ~ '^dozen:[123]$' or p_choice ~ '^column:[123]$' then 3
    else 2
  end;
$$;

create or replace function public.casino_roulette_match_v117(p_choice text, p_number integer)
returns boolean
language plpgsql
immutable
strict
as $$
declare v_red integer[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  return (p_choice = 'red' and p_number = any(v_red))
    or (p_choice = 'black' and p_number > 0 and not (p_number = any(v_red)))
    or (p_choice = 'even' and p_number > 0 and mod(p_number,2) = 0)
    or (p_choice = 'odd' and p_number > 0 and mod(p_number,2) = 1)
    or (p_choice = 'low' and p_number between 1 and 18)
    or (p_choice = 'high' and p_number between 19 and 36)
    or (p_choice = 'dozen:1' and p_number between 1 and 12)
    or (p_choice = 'dozen:2' and p_number between 13 and 24)
    or (p_choice = 'dozen:3' and p_number between 25 and 36)
    or (p_choice = 'column:1' and p_number > 0 and mod(p_number - 1,3) = 0)
    or (p_choice = 'column:2' and p_number > 0 and mod(p_number - 2,3) = 0)
    or (p_choice = 'column:3' and p_number > 0 and mod(p_number,3) = 0)
    or case when p_choice ~ '^number:([0-9]|[12][0-9]|3[0-6])$'
      then split_part(p_choice,':',2)::integer = p_number
      else false end;
end;
$$;

create or replace function public.casino_play_roulette_v117(p_bets jsonb)
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
  v_balance bigint;
  v_number integer;
  v_candidate integer;
  v_candidate_payout bigint;
  v_payout bigint := 0;
  v_target_win boolean;
  v_candidates integer[] := array[]::integer[];
  v_winning_bets jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if jsonb_typeof(p_bets) <> 'array' or jsonb_array_length(p_bets) < 1 or jsonb_array_length(p_bets) > 24 then
    raise exception 'invalid_bets';
  end if;
  select * into v_config from public.casino_game_settings where game='roulette';
  if not found or not v_config.enabled then raise exception 'game_closed'; end if;

  for v_bet in select value from jsonb_array_elements(p_bets)
  loop
    v_choice := coalesce(v_bet->>'choice','');
    if coalesce(v_bet->>'amount','') !~ '^[0-9]+$' then raise exception 'invalid_bets'; end if;
    v_amount := (v_bet->>'amount')::bigint;
    if v_amount < 1 or (
      v_choice not in ('red','black','even','odd','low','high')
      and v_choice !~ '^number:([0-9]|[12][0-9]|3[0-6])$'
      and v_choice !~ '^dozen:[123]$'
      and v_choice !~ '^column:[123]$'
    ) then raise exception 'invalid_bets'; end if;
    v_total := v_total + v_amount;
  end loop;

  if v_total < v_config.min_bet or v_total > v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;
  v_target_win := random() * 100 < v_config.win_rate_percent;

  for v_candidate in 0..36 loop
    v_candidate_payout := 0;
    for v_bet in select value from jsonb_array_elements(p_bets)
    loop
      if public.casino_roulette_match_v117(v_bet->>'choice',v_candidate) then
        v_candidate_payout := v_candidate_payout
          + (v_bet->>'amount')::bigint * public.casino_roulette_multiplier_v117(v_bet->>'choice');
      end if;
    end loop;
    v_candidate_payout := least(v_config.max_payout,v_candidate_payout);
    if (v_target_win and v_candidate_payout > v_total) or (not v_target_win and v_candidate_payout <= v_total) then
      v_candidates := array_append(v_candidates,v_candidate);
    end if;
  end loop;
  if cardinality(v_candidates) = 0 then
    v_number := floor(random()*37)::integer;
  else
    v_number := v_candidates[1 + floor(random()*cardinality(v_candidates))::integer];
  end if;

  for v_bet in select value from jsonb_array_elements(p_bets)
  loop
    if public.casino_roulette_match_v117(v_bet->>'choice',v_number) then
      v_payout := v_payout + (v_bet->>'amount')::bigint * public.casino_roulette_multiplier_v117(v_bet->>'choice');
      v_winning_bets := v_winning_bets || jsonb_build_array(v_bet);
    end if;
  end loop;
  v_payout := least(v_config.max_payout,v_payout);

  insert into public.casino_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.casino_wallets set
    balance=balance-v_total+v_payout,
    lifetime_wagered=lifetime_wagered+v_total,
    lifetime_won=lifetime_won+v_payout,
    games_played=games_played+1,
    biggest_win=greatest(biggest_win,v_payout),
    xp=xp+greatest(10,least(250,floor(v_total::numeric/10)::bigint)),
    updated_at=now()
  where user_id=auth.uid() and balance>=v_total
  returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;

  insert into public.casino_game_rounds(id,user_id,game,wager,payout,status,result,settled_at)
  values(v_id,auth.uid(),'roulette',v_total,v_payout,'settled',jsonb_build_object(
    'number',v_number,'bets',p_bets,'winning_bets',v_winning_bets,'mode','multi_bet'
  ),now());
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(auth.uid(),'game',v_payout-v_total,v_balance,'Roulette · '||jsonb_array_length(p_bets)||' pari(s)',v_id);

  return jsonb_build_object(
    'finished',true,'number',v_number,'wager',v_total,'payout',v_payout,'balance',v_balance,
    'winningBets',v_winning_bets,
    'result',case when v_payout>v_total then 'La table paie '||v_payout||' jetons'
                  when v_payout=v_total then 'Mise récupérée'
                  when v_payout>0 then 'Gain partiel : '||v_payout||' jetons'
                  else 'La bille tombe sur '||v_number end
  );
end;
$$;

-- Verrou atomique des actions et débit des relances du poker solo.
create or replace function public.casino_poker_lock_action_v117(
  p_round_id uuid,
  p_expected_version integer,
  p_amount bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active public.casino_active_games%rowtype;
  v_config public.casino_game_settings%rowtype;
  v_balance bigint;
  v_committed bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_amount < 0 then raise exception 'invalid_raise'; end if;
  select * into v_active from public.casino_active_games
  where user_id=auth.uid() and game='poker' for update;
  if not found or v_active.round_id<>p_round_id then raise exception 'no_active_poker'; end if;
  if coalesce((v_active.state->>'actionVersion')::integer,0)<>p_expected_version then raise exception 'stale_poker_action'; end if;
  v_committed := coalesce((v_active.state->>'committed')::bigint,(v_active.state->>'wager')::bigint,0);
  select * into v_config from public.casino_game_settings where game='poker';
  if v_committed+p_amount>v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;
  update public.casino_wallets set
    balance=balance-p_amount,
    lifetime_wagered=lifetime_wagered+p_amount,
    updated_at=now()
  where user_id=auth.uid() and balance>=p_amount returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;
  update public.casino_game_rounds set wager=wager+p_amount where id=p_round_id and user_id=auth.uid();
  update public.casino_active_games set state=jsonb_set(
    jsonb_set(state,'{actionVersion}',to_jsonb(p_expected_version+1),true),
    '{committed}',to_jsonb(v_committed+p_amount),true
  ),updated_at=now() where user_id=auth.uid() and game='poker';
  return v_balance;
end;
$$;

-- Le poker citoyen devient une vraie table heads-up avec cave, blindes et quatre tours d'enchères.
create or replace function public.casino_pvp_create_v117(
  p_game text,
  p_wager bigint,
  p_visibility text,
  p_choice text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if exists(select 1 from public.casino_pvp_rooms where status in ('open','playing') and (host_user_id=auth.uid() or guest_user_id=auth.uid())) then
    raise exception 'active_room_exists';
  end if;
  return public.casino_pvp_create_v116(p_game,p_wager,p_visibility,p_choice);
end;
$$;

create or replace function public.casino_pvp_join_v117(p_room_id uuid,p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.casino_pvp_rooms%rowtype;
  v_balance bigint;
  v_deck integer[];
  v_guest_name text;
  v_small bigint;
  v_big bigint;
  v_state jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.casino_pvp_rooms where id=p_room_id for update;
  if not found or v_room.status<>'open' then raise exception 'room_unavailable'; end if;
  if v_room.game<>'poker' then return public.casino_pvp_join_v116(p_room_id,p_code); end if;
  if v_room.host_user_id=v_user_id then raise exception 'cannot_join_own_room'; end if;
  if exists(select 1 from public.casino_pvp_rooms where id<>p_room_id and status in ('open','playing') and (host_user_id=v_user_id or guest_user_id=v_user_id)) then raise exception 'active_room_exists'; end if;
  if v_room.visibility='private' and upper(trim(coalesce(p_code,'')))<>v_room.join_code then raise exception 'invalid_code'; end if;

  insert into public.casino_wallets(user_id) values(v_user_id) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-v_room.wager,updated_at=now()
  where user_id=v_user_id and balance>=v_room.wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;
  v_guest_name:=coalesce(public.casino_display_name_v108(v_user_id),'Citoyen Nostra');
  select array_agg(card order by rnd) into v_deck
  from (select card,random() rnd from generate_series(0,51) gs(card) order by rnd limit 9) shuffled;
  v_small:=least(v_room.wager,greatest(1,floor(v_room.wager::numeric/100)::bigint));
  v_big:=least(v_room.wager,greatest(v_small,floor(v_room.wager::numeric/50)::bigint));
  v_state:=jsonb_build_object(
    'street','preflop','boardVisible',0,'turnSide','host','dealerSide','host',
    'hostCards',jsonb_build_array(v_deck[1],v_deck[2]),'guestCards',jsonb_build_array(v_deck[3],v_deck[4]),
    'board',jsonb_build_array(v_deck[5],v_deck[6],v_deck[7],v_deck[8],v_deck[9]),
    'pot',v_small+v_big,'currentBet',v_big,'minRaise',v_big,
    'hostStack',v_room.wager-v_small,'guestStack',v_room.wager-v_big,
    'hostStreetBet',v_small,'guestStreetBet',v_big,
    'hostCommitted',v_small,'guestCommitted',v_big,
    'hostActed',false,'guestActed',true,'hostShow',false,'guestShow',false,
    'lastAction',v_guest_name||' pose la grosse blinde'
  );
  update public.casino_pvp_rooms set guest_user_id=v_user_id,guest_name=v_guest_name,status='playing',state=v_state,
    result=jsonb_build_object('summary','Main en cours'),updated_at=now() where id=v_room.id;
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(v_user_id,'table_buyin',-v_room.wager,v_balance,'Cave poker citoyen',v_room.id);
  return jsonb_build_object('roomId',v_room.id,'playing',true,'balance',v_balance);
end;
$$;

create or replace function public.casino_pvp_poker_action_v117(p_room_id uuid,p_action text,p_amount bigint default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_room public.casino_pvp_rooms%rowtype;
  s jsonb;
  v_side text;
  v_other text;
  v_stack bigint;
  v_other_stack bigint;
  v_street_bet bigint;
  v_other_street_bet bigint;
  v_committed bigint;
  v_other_committed bigint;
  v_current bigint;
  v_min_raise bigint;
  v_to_call bigint;
  v_pay bigint:=0;
  v_new_current bigint;
  v_pot bigint;
  v_host_acted boolean;
  v_guest_acted boolean;
  v_street text;
  v_board_visible integer;
  v_finish boolean:=false;
  v_winner text;
  v_summary text;
  v_host_score bigint;
  v_guest_score bigint;
  v_payout_host bigint:=0;
  v_payout_guest bigint:=0;
  v_balance_host bigint;
  v_balance_guest bigint;
  v_host_round uuid:=gen_random_uuid();
  v_guest_round uuid:=gen_random_uuid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if p_action not in ('fold','check','call','raise','allin') or p_amount<0 then raise exception 'invalid_poker_action'; end if;
  select * into v_room from public.casino_pvp_rooms where id=p_room_id for update;
  if not found or v_room.game<>'poker' or v_room.status<>'playing' then raise exception 'poker_not_playing'; end if;
  if v_user_id=v_room.host_user_id then v_side:='host'; v_other:='guest';
  elsif v_user_id=v_room.guest_user_id then v_side:='guest'; v_other:='host';
  else raise exception 'forbidden'; end if;
  s:=v_room.state;
  if s->>'turnSide'<>v_side then raise exception 'not_your_turn'; end if;

  v_stack:=(s->>(v_side||'Stack'))::bigint;
  v_other_stack:=(s->>(v_other||'Stack'))::bigint;
  v_street_bet:=(s->>(v_side||'StreetBet'))::bigint;
  v_other_street_bet:=(s->>(v_other||'StreetBet'))::bigint;
  v_committed:=(s->>(v_side||'Committed'))::bigint;
  v_other_committed:=(s->>(v_other||'Committed'))::bigint;
  v_current:=(s->>'currentBet')::bigint;
  v_min_raise:=(s->>'minRaise')::bigint;
  v_pot:=(s->>'pot')::bigint;
  v_to_call:=greatest(0,v_current-v_street_bet);

  if p_action='fold' then
    v_finish:=true; v_winner:=v_other;
    v_summary:=case when v_other='host' then v_room.host_name else v_room.guest_name end||' gagne après abandon';
  else
    if p_action='check' and v_to_call<>0 then raise exception 'cannot_check'; end if;
    if p_action='call' then v_pay:=least(v_stack,v_to_call); end if;
    if p_action='raise' then
      if p_amount<v_min_raise and v_stack>v_to_call+p_amount then raise exception 'raise_too_small'; end if;
      v_pay:=least(v_stack,v_to_call+p_amount);
      if v_pay<=v_to_call and v_stack>v_to_call then raise exception 'raise_too_small'; end if;
    end if;
    if p_action='allin' then v_pay:=v_stack; end if;
    v_stack:=v_stack-v_pay; v_street_bet:=v_street_bet+v_pay; v_committed:=v_committed+v_pay; v_pot:=v_pot+v_pay;
    v_new_current:=greatest(v_current,v_street_bet);
    if v_new_current>v_current then
      if v_new_current-v_current>=v_min_raise then v_min_raise:=v_new_current-v_current; end if;
      if v_other='host' then v_host_acted:=false; else v_guest_acted:=false; end if;
    end if;
    v_current:=v_new_current;
    if v_side='host' then v_host_acted:=true; v_guest_acted:=coalesce(v_guest_acted,(s->>'guestActed')::boolean);
    else v_guest_acted:=true; v_host_acted:=coalesce(v_host_acted,(s->>'hostActed')::boolean); end if;

    -- Une mise non couverte est immédiatement rendue : le pot principal reste exact.
    if v_stack=0 and v_street_bet<v_other_street_bet then
      v_other_stack:=v_other_stack+(v_other_street_bet-v_street_bet);
      v_other_committed:=v_other_committed-(v_other_street_bet-v_street_bet);
      v_pot:=v_pot-(v_other_street_bet-v_street_bet);
      v_other_street_bet:=v_street_bet; v_current:=v_street_bet;
    end if;

    s:=jsonb_set(s,array[v_side||'Stack'],to_jsonb(v_stack),true);
    s:=jsonb_set(s,array[v_other||'Stack'],to_jsonb(v_other_stack),true);
    s:=jsonb_set(s,array[v_side||'StreetBet'],to_jsonb(v_street_bet),true);
    s:=jsonb_set(s,array[v_other||'StreetBet'],to_jsonb(v_other_street_bet),true);
    s:=jsonb_set(s,array[v_side||'Committed'],to_jsonb(v_committed),true);
    s:=jsonb_set(s,array[v_other||'Committed'],to_jsonb(v_other_committed),true);
    s:=jsonb_set(s,'{pot}',to_jsonb(v_pot),true);
    s:=jsonb_set(s,'{currentBet}',to_jsonb(v_current),true);
    s:=jsonb_set(s,'{minRaise}',to_jsonb(v_min_raise),true);
    s:=jsonb_set(s,'{hostActed}',to_jsonb(v_host_acted),true);
    s:=jsonb_set(s,'{guestActed}',to_jsonb(v_guest_acted),true);
    s:=jsonb_set(s,'{lastAction}',to_jsonb(case p_action when 'check' then 'Parole' when 'call' then 'Suit '||v_pay when 'raise' then 'Relance de '||p_amount when 'allin' then 'Tapis · '||v_pay else p_action end),true);

    if v_host_acted and v_guest_acted and v_street_bet=v_other_street_bet then
      v_street:=s->>'street';
      if v_street='river' or v_stack=0 or v_other_stack=0 then
        v_finish:=true;
      else
        if v_street='preflop' then v_street:='flop';v_board_visible:=3;
        elsif v_street='flop' then v_street:='turn';v_board_visible:=4;
        else v_street:='river';v_board_visible:=5; end if;
        s:=jsonb_set(s,'{street}',to_jsonb(v_street),true);
        s:=jsonb_set(s,'{boardVisible}',to_jsonb(v_board_visible),true);
        s:=jsonb_set(s,'{currentBet}','0'::jsonb,true);
        s:=jsonb_set(s,'{hostStreetBet}','0'::jsonb,true);
        s:=jsonb_set(s,'{guestStreetBet}','0'::jsonb,true);
        s:=jsonb_set(s,'{hostActed}','false'::jsonb,true);
        s:=jsonb_set(s,'{guestActed}','false'::jsonb,true);
        s:=jsonb_set(s,'{turnSide}',to_jsonb('guest'::text),true);
      end if;
    else
      s:=jsonb_set(s,'{turnSide}',to_jsonb(v_other),true);
    end if;
  end if;

  if v_finish then
    if v_winner is null then
      s:=jsonb_set(s,'{boardVisible}','5'::jsonb,true);
      select public.casino_poker_score_v116(array(select jsonb_array_elements_text(s->'hostCards')::integer)||array(select jsonb_array_elements_text(s->'board')::integer)) into v_host_score;
      select public.casino_poker_score_v116(array(select jsonb_array_elements_text(s->'guestCards')::integer)||array(select jsonb_array_elements_text(s->'board')::integer)) into v_guest_score;
      if v_host_score>v_guest_score then v_winner:='host';v_summary:=v_room.host_name||' remporte le pot';
      elsif v_guest_score>v_host_score then v_winner:='guest';v_summary:=v_room.guest_name||' remporte le pot';
      else v_winner:='tie';v_summary:='Égalité : le pot est partagé'; end if;
    end if;
    v_pot:=coalesce((s->>'pot')::bigint,v_pot);
    v_stack:=coalesce((s->>'hostStack')::bigint,case when v_side='host' then v_stack else v_other_stack end);
    v_other_stack:=coalesce((s->>'guestStack')::bigint,case when v_side='guest' then v_stack else v_other_stack end);
    if v_winner='host' then v_payout_host:=v_stack+v_pot;v_payout_guest:=v_other_stack;
    elsif v_winner='guest' then v_payout_host:=v_stack;v_payout_guest:=v_other_stack+v_pot;
    else v_payout_host:=v_stack+floor(v_pot::numeric/2)::bigint;v_payout_guest:=v_other_stack+(v_pot-floor(v_pot::numeric/2)::bigint); end if;
    update public.casino_wallets set balance=balance+v_payout_host,lifetime_wagered=lifetime_wagered+v_room.wager,lifetime_won=lifetime_won+v_payout_host,games_played=games_played+1,biggest_win=greatest(biggest_win,v_payout_host),xp=xp+greatest(10,least(250,floor(v_room.wager::numeric/10)::bigint)),updated_at=now() where user_id=v_room.host_user_id returning balance into v_balance_host;
    update public.casino_wallets set balance=balance+v_payout_guest,lifetime_wagered=lifetime_wagered+v_room.wager,lifetime_won=lifetime_won+v_payout_guest,games_played=games_played+1,biggest_win=greatest(biggest_win,v_payout_guest),xp=xp+greatest(10,least(250,floor(v_room.wager::numeric/10)::bigint)),updated_at=now() where user_id=v_room.guest_user_id returning balance into v_balance_guest;
    insert into public.casino_game_rounds(id,user_id,game,wager,payout,status,result,settled_at) values
      (v_host_round,v_room.host_user_id,'poker',v_room.wager,v_payout_host,'settled',jsonb_build_object('mode','citizens','room_id',v_room.id,'summary',v_summary),now()),
      (v_guest_round,v_room.guest_user_id,'poker',v_room.wager,v_payout_guest,'settled',jsonb_build_object('mode','citizens','room_id',v_room.id,'summary',v_summary),now());
    if v_payout_host>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(v_room.host_user_id,'table_cashout',v_payout_host,v_balance_host,'Sortie table poker citoyen',v_room.id); end if;
    if v_payout_guest>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(v_room.guest_user_id,'table_cashout',v_payout_guest,v_balance_guest,'Sortie table poker citoyen',v_room.id); end if;
    update public.casino_pvp_rooms set status='finished',payout_host=v_payout_host,payout_guest=v_payout_guest,finished_at=now(),updated_at=now(),state=s,
      result=jsonb_build_object(
        'summary',v_summary,
        'board',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(s->'board') with ordinality b(value,n) where n<=coalesce((s->>'boardVisible')::integer,0)),'[]'::jsonb),
        'hostCards',s->'hostCards','guestCards',s->'guestCards','hostShow',false,'guestShow',false,'winner',v_winner
      )
    where id=v_room.id;
  else
    update public.casino_pvp_rooms set state=s,updated_at=now() where id=v_room.id;
  end if;
  return jsonb_build_object('finished',v_finish,'summary',coalesce(v_summary,s->>'lastAction'));
end;
$$;

create or replace function public.casino_pvp_show_cards_v117(p_room_id uuid,p_show boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_room public.casino_pvp_rooms%rowtype; v_key text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.casino_pvp_rooms where id=p_room_id for update;
  if not found or v_room.game<>'poker' or v_room.status<>'finished' then raise exception 'showdown_unavailable'; end if;
  if auth.uid()=v_room.host_user_id then v_key:='hostShow';
  elsif auth.uid()=v_room.guest_user_id then v_key:='guestShow';
  else raise exception 'forbidden'; end if;
  update public.casino_pvp_rooms set result=jsonb_set(result,array[v_key],to_jsonb(p_show),true),updated_at=now() where id=p_room_id;
  return true;
end;
$$;

create or replace function public.casino_pvp_public_state_v117(p_room public.casino_pvp_rooms,p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare s jsonb:=p_room.state; v_side text; v_board_count integer; v_public_result jsonb;
begin
  if p_user_id=p_room.host_user_id then v_side:='host'; elsif p_user_id=p_room.guest_user_id then v_side:='guest'; end if;
  if p_room.game<>'poker' then return jsonb_build_object('result',p_room.result,'poker_state',null); end if;
  v_board_count:=coalesce((s->>'boardVisible')::integer,0);
  v_public_result:=p_room.result - 'hostCards' - 'guestCards';
  v_public_result:=v_public_result||jsonb_build_object(
    'host_cards',case when v_side='host' or coalesce((p_room.result->>'hostShow')::boolean,false) then s->'hostCards' else '[]'::jsonb end,
    'guest_cards',case when v_side='guest' or coalesce((p_room.result->>'guestShow')::boolean,false) then s->'guestCards' else '[]'::jsonb end,
    'host_show',coalesce((p_room.result->>'hostShow')::boolean,false),
    'guest_show',coalesce((p_room.result->>'guestShow')::boolean,false)
  );
  return jsonb_build_object('result',v_public_result,'poker_state',jsonb_build_object(
    'street',s->>'street','board',coalesce((select jsonb_agg(value) from (select value from jsonb_array_elements(s->'board') with ordinality b(value,n) where n<=v_board_count order by n) q),'[]'::jsonb),
    'pot',coalesce((s->>'pot')::bigint,0),'current_bet',coalesce((s->>'currentBet')::bigint,0),'min_raise',coalesce((s->>'minRaise')::bigint,0),
    'host_stack',coalesce((s->>'hostStack')::bigint,0),'guest_stack',coalesce((s->>'guestStack')::bigint,0),
    'host_bet',coalesce((s->>'hostStreetBet')::bigint,0),'guest_bet',coalesce((s->>'guestStreetBet')::bigint,0),
    'turn_side',s->>'turnSide','my_side',v_side,'is_turn',p_room.status='playing' and s->>'turnSide'=v_side,
    'to_call',case when v_side is null then 0 else greatest(0,coalesce((s->>'currentBet')::bigint,0)-coalesce((s->>(v_side||'StreetBet'))::bigint,0)) end,
    'my_stack',case when v_side is null then 0 else coalesce((s->>(v_side||'Stack'))::bigint,0) end,
    'my_cards',case when v_side is null then '[]'::jsonb else s->(v_side||'Cards') end,
    'last_action',s->>'lastAction'
  ));
end;
$$;

create or replace function public.casino_pvp_lobby_v117()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_user_id uuid:=auth.uid(); v_balance bigint; v_rooms jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select balance into v_balance from public.casino_wallets where user_id=v_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',room.id,'game',room.game,'host_name',room.host_name,'guest_name',room.guest_name,'wager',room.wager,'visibility',room.visibility,
    'join_code',case when room.host_user_id=v_user_id then room.join_code else null end,'choice_host',room.choice_host,'status',room.status,
    'result',(public.casino_pvp_public_state_v117(room,v_user_id))->'result','poker_state',(public.casino_pvp_public_state_v117(room,v_user_id))->'poker_state',
    'payout_host',room.payout_host,'payout_guest',room.payout_guest,'is_host',room.host_user_id=v_user_id,'is_guest',room.guest_user_id=v_user_id,
    'created_at',room.created_at,'finished_at',room.finished_at
  ) order by room.created_at desc),'[]'::jsonb) into v_rooms
  from (select * from public.casino_pvp_rooms where (status='open' and visibility='public') or host_user_id=v_user_id or guest_user_id=v_user_id order by created_at desc limit 40) room;
  return jsonb_build_object('rooms',v_rooms,'balance',coalesce(v_balance,0));
end;
$$;

create or replace function public.casino_pvp_join_code_v117(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_room_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select id into v_room_id from public.casino_pvp_rooms where join_code=upper(trim(coalesce(p_code,''))) and visibility='private' and status='open';
  if not found then raise exception 'invalid_code'; end if;
  return public.casino_pvp_join_v117(v_room_id,p_code);
end;
$$;

create or replace function public.casino_pvp_recover_v117()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_room record; v_balance bigint; v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  for v_room in select * from public.casino_pvp_rooms where status in ('open','playing') and updated_at<now()-interval '2 hours' for update skip locked loop
    update public.casino_wallets set balance=balance+v_room.wager,updated_at=now() where user_id=v_room.host_user_id returning balance into v_balance;
    insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(v_room.host_user_id,'refund',v_room.wager,v_balance,'Remboursement table citoyenne expirée',v_room.id);
    if v_room.status='playing' and v_room.guest_user_id is not null then
      update public.casino_wallets set balance=balance+v_room.wager,updated_at=now() where user_id=v_room.guest_user_id returning balance into v_balance;
      insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(v_room.guest_user_id,'refund',v_room.wager,v_balance,'Remboursement table citoyenne expirée',v_room.id);
    end if;
    update public.casino_pvp_rooms set status='cancelled',finished_at=now(),updated_at=now(),result=jsonb_build_object('summary','Table expirée et intégralement remboursée') where id=v_room.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.casino_roulette_multiplier_v117(text) from public,anon,authenticated;
revoke all on function public.casino_roulette_match_v117(text,integer) from public,anon,authenticated;
revoke all on function public.casino_play_roulette_v117(jsonb) from public,anon;
revoke all on function public.casino_poker_lock_action_v117(uuid,integer,bigint) from public,anon;
revoke all on function public.casino_pvp_create_v117(text,bigint,text,text) from public,anon;
revoke all on function public.casino_pvp_join_v117(uuid,text) from public,anon;
revoke all on function public.casino_pvp_poker_action_v117(uuid,text,bigint) from public,anon;
revoke all on function public.casino_pvp_show_cards_v117(uuid,boolean) from public,anon;
revoke all on function public.casino_pvp_public_state_v117(public.casino_pvp_rooms,uuid) from public,anon,authenticated;
revoke all on function public.casino_pvp_lobby_v117() from public,anon;
revoke all on function public.casino_pvp_join_code_v117(text) from public,anon;
revoke all on function public.casino_pvp_recover_v117() from public,anon;
grant execute on function public.casino_play_roulette_v117(jsonb) to authenticated;
grant execute on function public.casino_poker_lock_action_v117(uuid,integer,bigint) to authenticated;
grant execute on function public.casino_pvp_create_v117(text,bigint,text,text) to authenticated;
grant execute on function public.casino_pvp_join_v117(uuid,text) to authenticated;
grant execute on function public.casino_pvp_poker_action_v117(uuid,text,bigint) to authenticated;
grant execute on function public.casino_pvp_show_cards_v117(uuid,boolean) to authenticated;
grant execute on function public.casino_pvp_lobby_v117() to authenticated;
grant execute on function public.casino_pvp_join_code_v117(text) to authenticated;
grant execute on function public.casino_pvp_recover_v117() to authenticated;

select 'V117 prête' as status;
