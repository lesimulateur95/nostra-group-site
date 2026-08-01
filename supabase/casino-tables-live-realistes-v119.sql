-- Nostra Group · Le Cercle Nostra · V119
-- À exécuter une seule fois après la V118.
-- Roulette européenne live, blackjack 2–6 joueurs et baccarat live.

alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check;
alter table public.casino_game_settings add constraint casino_game_settings_game_check
  check (game in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat'));

alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check;
alter table public.casino_game_rounds add constraint casino_game_rounds_game_check
  check (game in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat'));

insert into public.casino_game_settings(game,enabled,difficulty,win_rate_percent,min_bet,max_bet,base_multiplier,jackpot_multiplier,max_payout)
values('baccarat',true,'balanced',45,50,50000,2,9,250000)
on conflict(game) do nothing;

create table if not exists public.casino_live_tables (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('roulette','blackjack','baccarat')),
  name text not null,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null,
  max_players integer not null check (max_players between 2 and 6),
  visibility text not null check (visibility in ('public','private')),
  join_code text not null unique,
  status text not null default 'open' check (status in ('open','betting','playing','finished','cancelled')),
  phase text not null default 'bets_open',
  round_no integer not null default 1 check (round_no > 0),
  dealer_hand integer[] not null default array[]::integer[],
  state jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.casino_live_players (
  table_id uuid not null references public.casino_live_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  seat_no integer not null check (seat_no between 1 and 6),
  bet_amount bigint not null default 0 check (bet_amount >= 0),
  bet_choice text,
  bets jsonb not null default '[]'::jsonb,
  hand integer[] not null default array[]::integer[],
  status text not null default 'seated',
  payout bigint not null default 0 check (payout >= 0),
  joined_at timestamptz not null default now(),
  primary key(table_id,user_id),
  unique(table_id,seat_no)
);

create index if not exists casino_live_tables_lobby_idx on public.casino_live_tables(status,visibility,created_at desc);
create index if not exists casino_live_players_user_idx on public.casino_live_players(user_id,joined_at desc);
alter table public.casino_live_tables enable row level security;
alter table public.casino_live_players enable row level security;
revoke all on table public.casino_live_tables,public.casino_live_players from public,anon,authenticated;

create or replace function public.casino_live_blackjack_value_v119(p_cards integer[])
returns integer language plpgsql immutable strict set search_path=public as $$
declare v_card integer; v_total integer:=0; v_aces integer:=0; v_rank integer;
begin
  foreach v_card in array p_cards loop
    v_rank:=v_card%13+2;
    if v_rank=14 then v_total:=v_total+11;v_aces:=v_aces+1;
    else v_total:=v_total+least(v_rank,10); end if;
  end loop;
  while v_total>21 and v_aces>0 loop v_total:=v_total-10;v_aces:=v_aces-1;end loop;
  return v_total;
end;$$;

create or replace function public.casino_live_baccarat_value_v119(p_cards integer[])
returns integer language plpgsql immutable strict set search_path=public as $$
declare v_card integer;v_total integer:=0;v_rank integer;
begin
  foreach v_card in array p_cards loop v_rank:=v_card%13+2;v_total:=v_total+case when v_rank=14 then 1 when v_rank>=10 then 0 else v_rank end;end loop;
  return mod(v_total,10);
end;$$;

create or replace function public.casino_live_create_v119(p_game text,p_name text,p_max_players integer,p_visibility text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_code text;v_name text;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if p_game not in ('roulette','blackjack','baccarat') or p_visibility not in ('public','private') or p_max_players not between 2 and 6 then raise exception 'invalid_table';end if;
  if exists(select 1 from public.casino_live_tables t join public.casino_live_players p on p.table_id=t.id where p.user_id=auth.uid() and t.status in ('open','betting','playing')) then raise exception 'active_live_table';end if;
  if not exists(select 1 from public.casino_game_settings where game=p_game and enabled) then raise exception 'game_closed';end if;
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));v_name:=left(coalesce(nullif(trim(p_name),''),'Table prestige'),42);
  insert into public.casino_live_tables(game,name,host_user_id,host_name,max_players,visibility,join_code)
  values(p_game,v_name,auth.uid(),coalesce(public.casino_display_name_v108(auth.uid()),'Citoyen Nostra'),p_max_players,p_visibility,v_code) returning id into v_id;
  insert into public.casino_live_players(table_id,user_id,display_name,seat_no) values(v_id,auth.uid(),coalesce(public.casino_display_name_v108(auth.uid()),'Citoyen Nostra'),1);
  return v_id;
end;$$;

create or replace function public.casino_live_join_v119(p_table_id uuid default null,p_code text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_table public.casino_live_tables%rowtype;v_seat integer;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if exists(select 1 from public.casino_live_tables t join public.casino_live_players p on p.table_id=t.id where p.user_id=auth.uid() and t.status in ('open','betting','playing')) then raise exception 'active_live_table';end if;
  if p_table_id is not null then select * into v_table from public.casino_live_tables where id=p_table_id for update;
  else select * into v_table from public.casino_live_tables where join_code=upper(trim(coalesce(p_code,''))) and visibility='private' and status='open' for update;end if;
  if not found then
    if p_table_id is null then raise exception 'invalid_code';
    else raise exception 'table_unavailable';end if;
  end if;
  if v_table.status<>'open' then raise exception 'table_unavailable';end if;
  if v_table.visibility='private' and p_table_id is not null and upper(trim(coalesce(p_code,'')))<>v_table.join_code then raise exception 'invalid_code';end if;
  select n into v_seat from generate_series(1,v_table.max_players) n where not exists(select 1 from public.casino_live_players where table_id=v_table.id and seat_no=n) order by n limit 1;
  if v_seat is null then raise exception 'table_full';end if;
  insert into public.casino_live_players(table_id,user_id,display_name,seat_no) values(v_table.id,auth.uid(),coalesce(public.casino_display_name_v108(auth.uid()),'Citoyen Nostra'),v_seat);
  update public.casino_live_tables set updated_at=now() where id=v_table.id;return v_table.id;
end;$$;

create or replace function public.casino_live_bet_v119(p_table_id uuid,p_amount bigint,p_choice text default null,p_bets jsonb default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_table public.casino_live_tables%rowtype;v_player public.casino_live_players%rowtype;v_config public.casino_game_settings%rowtype;v_balance bigint;v_bet jsonb;v_total bigint:=0;v_target text;v_value bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select * into v_table from public.casino_live_tables where id=p_table_id for update;if not found or v_table.status<>'open' then raise exception 'table_unavailable';end if;
  select * into v_player from public.casino_live_players where table_id=p_table_id and user_id=auth.uid() for update;if not found then raise exception 'forbidden';end if;
  if v_player.bet_amount>0 then raise exception 'bet_already_locked';end if;
  select * into v_config from public.casino_game_settings where game=v_table.game;if not found or not v_config.enabled then raise exception 'game_closed';end if;
  if v_table.game='roulette' then
    if p_bets is null or jsonb_typeof(p_bets)<>'array' or jsonb_array_length(p_bets)<1 or jsonb_array_length(p_bets)>64 then raise exception 'invalid_bets';end if;
    for v_bet in select value from jsonb_array_elements(p_bets) loop
      v_target:=coalesce(v_bet->>'target','');v_value:=coalesce((v_bet->>'value')::bigint,0);
      if v_value<1 or (v_target not in ('red','black','even','odd','low','high') and v_target!~'^number:([0-9]|[12][0-9]|3[0-6])$') then raise exception 'invalid_bets';end if;
      v_total:=v_total+v_value;
    end loop;p_amount:=v_total;p_choice:=null;
  elsif v_table.game='baccarat' and p_choice not in ('player','banker','tie') then raise exception 'invalid_choice';
  else p_choice:=null;p_bets:='[]'::jsonb;end if;
  if p_amount<v_config.min_bet or p_amount>v_config.max_bet then raise exception 'wager_out_of_bounds';end if;
  insert into public.casino_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-p_amount,updated_at=now() where user_id=auth.uid() and balance>=p_amount returning balance into v_balance;if not found then raise exception 'insufficient_balance';end if;
  update public.casino_live_players set bet_amount=p_amount,bet_choice=p_choice,bets=coalesce(p_bets,'[]'::jsonb),status='ready' where table_id=p_table_id and user_id=auth.uid();
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(auth.uid(),'wager',-p_amount,v_balance,'Mise table live · '||v_table.game,p_table_id);
  update public.casino_live_tables set updated_at=now() where id=p_table_id;return true;
end;$$;

create or replace function public.casino_live_credit_result_v119(p_table_id uuid,p_user_id uuid,p_game text,p_wager bigint,p_payout bigint,p_result jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_balance bigint;v_round uuid:=gen_random_uuid();
begin
  update public.casino_wallets set balance=balance+p_payout,lifetime_wagered=lifetime_wagered+p_wager,lifetime_won=lifetime_won+p_payout,games_played=games_played+1,biggest_win=greatest(biggest_win,p_payout),xp=xp+greatest(10,least(250,floor(p_wager::numeric/10)::bigint)),updated_at=now() where user_id=p_user_id returning balance into v_balance;
  insert into public.casino_game_rounds(id,user_id,game,wager,payout,status,result,settled_at) values(v_round,p_user_id,p_game,p_wager,p_payout,'settled',p_result||jsonb_build_object('mode','live','table_id',p_table_id),now());
  if p_payout>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(p_user_id,'payout',p_payout,v_balance,'Paiement table live · '||p_game,v_round);end if;
end;$$;

create or replace function public.casino_live_start_v119(p_table_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.casino_live_tables%rowtype;p record;v_count integer;v_deck integer[];v_pos integer:=1;v_number integer;v_payout bigint;v_bet jsonb;v_target text;v_value bigint;v_player_cards integer[];v_banker_cards integer[];v_player_value integer;v_banker_value integer;v_player_third integer:=-1;v_winner text;v_result jsonb;v_first_seat integer;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select * into t from public.casino_live_tables where id=p_table_id for update;if not found or t.status<>'open' then raise exception 'table_unavailable';end if;
  if t.host_user_id<>auth.uid() then raise exception 'not_host';end if;
  select count(*) into v_count from public.casino_live_players where table_id=t.id;if v_count<2 or exists(select 1 from public.casino_live_players where table_id=t.id and bet_amount<1) then raise exception 'players_not_ready';end if;
  select array_agg(card order by rnd) into v_deck from(select card,random() rnd from generate_series(0,51) as gs(card) order by rnd)q;
  if t.game='roulette' then
    v_number:=floor(random()*37)::integer;v_result:=jsonb_build_object('number',v_number,'summary','La bille tombe sur '||v_number);
    for p in select * from public.casino_live_players where table_id=t.id for update loop
      v_payout:=0;for v_bet in select value from jsonb_array_elements(p.bets) loop v_target:=v_bet->>'target';v_value:=(v_bet->>'value')::bigint;if public.casino_roulette_match_v117(v_target,v_number) then v_payout:=v_payout+v_value*public.casino_roulette_multiplier_v117(v_target);end if;end loop;
      v_payout:=least(v_payout,(select max_payout from public.casino_game_settings where game='roulette'));update public.casino_live_players set payout=v_payout,status='finished' where table_id=t.id and user_id=p.user_id;perform public.casino_live_credit_result_v119(t.id,p.user_id,'roulette',p.bet_amount,v_payout,v_result);
    end loop;
    update public.casino_live_tables set status='finished',phase='result',result=v_result,finished_at=now(),updated_at=now() where id=t.id;return v_result;
  elsif t.game='baccarat' then
    v_player_cards:=array[v_deck[1],v_deck[3]];v_banker_cards:=array[v_deck[2],v_deck[4]];v_pos:=5;v_player_value:=public.casino_live_baccarat_value_v119(v_player_cards);v_banker_value:=public.casino_live_baccarat_value_v119(v_banker_cards);
    if v_player_value<8 and v_banker_value<8 then
      if v_player_value<=5 then v_player_third:=v_deck[v_pos];v_player_cards:=array_append(v_player_cards,v_player_third);v_pos:=v_pos+1;end if;
      if (v_player_third=-1 and v_banker_value<=5) or (v_player_third>=0 and (v_banker_value<=2 or (v_banker_value=3 and public.casino_live_baccarat_value_v119(array[v_player_third])<>8) or (v_banker_value=4 and public.casino_live_baccarat_value_v119(array[v_player_third]) between 2 and 7) or (v_banker_value=5 and public.casino_live_baccarat_value_v119(array[v_player_third]) between 4 and 7) or (v_banker_value=6 and public.casino_live_baccarat_value_v119(array[v_player_third]) between 6 and 7))) then v_banker_cards:=array_append(v_banker_cards,v_deck[v_pos]);end if;
    end if;
    v_player_value:=public.casino_live_baccarat_value_v119(v_player_cards);v_banker_value:=public.casino_live_baccarat_value_v119(v_banker_cards);v_winner:=case when v_player_value>v_banker_value then 'player' when v_banker_value>v_player_value then 'banker' else 'tie' end;
    v_result:=jsonb_build_object('winner',v_winner,'player_cards',v_player_cards,'banker_cards',v_banker_cards,'player_value',v_player_value,'banker_value',v_banker_value,'summary',case v_winner when 'player' then 'Joueur gagne' when 'banker' then 'Banque gagne' else 'Égalité' end);
    for p in select * from public.casino_live_players where table_id=t.id for update loop v_payout:=case when p.bet_choice<>v_winner then 0 when v_winner='tie' then p.bet_amount*9 when v_winner='banker' then floor(p.bet_amount*1.95)::bigint else p.bet_amount*2 end;v_payout:=least(v_payout,(select max_payout from public.casino_game_settings where game='baccarat'));update public.casino_live_players set payout=v_payout,status='finished' where table_id=t.id and user_id=p.user_id;perform public.casino_live_credit_result_v119(t.id,p.user_id,'baccarat',p.bet_amount,v_payout,v_result);end loop;
    update public.casino_live_tables set status='finished',phase='result',result=v_result,finished_at=now(),updated_at=now() where id=t.id;return v_result;
  end if;
  update public.casino_live_tables set dealer_hand=array[v_deck[1],v_deck[2]],state=jsonb_build_object('deck',v_deck,'nextCard',3),status='playing',phase='players',result='{}'::jsonb,updated_at=now() where id=t.id;
  v_pos:=3;for p in select * from public.casino_live_players where table_id=t.id order by seat_no for update loop v_player_cards:=array[v_deck[v_pos],v_deck[v_pos+1]];v_pos:=v_pos+2;update public.casino_live_players set hand=v_player_cards,status=case when public.casino_live_blackjack_value_v119(v_player_cards)=21 then 'stand' else 'waiting' end where table_id=t.id and user_id=p.user_id;end loop;
  update public.casino_live_tables set state=jsonb_set(state,'{nextCard}',to_jsonb(v_pos),true) where id=t.id;
  select min(seat_no) into v_first_seat from public.casino_live_players where table_id=t.id and status='waiting';
  if v_first_seat is null then perform public.casino_live_blackjack_settle_v119(t.id);else update public.casino_live_players set status='playing' where table_id=t.id and seat_no=v_first_seat;update public.casino_live_tables set state=jsonb_set(state,'{turnSeat}',to_jsonb(v_first_seat),true) where id=t.id;end if;
  return jsonb_build_object('playing',true);
end;$$;

create or replace function public.casino_live_blackjack_settle_v119(p_table_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare t public.casino_live_tables%rowtype;p record;v_deck integer[];v_next integer;v_dealer integer[];v_dealer_value integer;v_player_value integer;v_payout bigint;v_result jsonb;
begin
  select * into t from public.casino_live_tables where id=p_table_id for update;if not found or t.game<>'blackjack' or t.status<>'playing' then raise exception 'table_unavailable';end if;
  v_deck:=array(select jsonb_array_elements_text(t.state->'deck')::integer);v_next:=(t.state->>'nextCard')::integer;v_dealer:=t.dealer_hand;v_dealer_value:=public.casino_live_blackjack_value_v119(v_dealer);
  while v_dealer_value<17 loop v_dealer:=array_append(v_dealer,v_deck[v_next]);v_next:=v_next+1;v_dealer_value:=public.casino_live_blackjack_value_v119(v_dealer);end loop;
  v_result:=jsonb_build_object('dealer_value',v_dealer_value,'summary',case when v_dealer_value>21 then 'Le croupier dépasse 21' else 'Le croupier reste à '||v_dealer_value end);
  for p in select * from public.casino_live_players where table_id=t.id for update loop v_player_value:=public.casino_live_blackjack_value_v119(p.hand);v_payout:=case when v_player_value>21 then 0 when cardinality(p.hand)=2 and v_player_value=21 and not(cardinality(v_dealer)=2 and v_dealer_value=21) then floor(p.bet_amount*2.5)::bigint when v_dealer_value>21 or v_player_value>v_dealer_value then p.bet_amount*2 when v_player_value=v_dealer_value then p.bet_amount else 0 end;v_payout:=least(v_payout,(select max_payout from public.casino_game_settings where game='blackjack'));update public.casino_live_players set payout=v_payout,status='finished' where table_id=t.id and user_id=p.user_id;perform public.casino_live_credit_result_v119(t.id,p.user_id,'blackjack',p.bet_amount,v_payout,v_result||jsonb_build_object('player_value',v_player_value));end loop;
  update public.casino_live_tables set dealer_hand=v_dealer,state=jsonb_set(t.state,'{nextCard}',to_jsonb(v_next),true),status='finished',phase='result',result=v_result,finished_at=now(),updated_at=now() where id=t.id;return true;
end;$$;

create or replace function public.casino_live_blackjack_action_v119(p_table_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path=public as $$
declare t public.casino_live_tables%rowtype;p public.casino_live_players%rowtype;v_deck integer[];v_next integer;v_card integer;v_value integer;v_next_seat integer;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;if p_action not in ('hit','stand') then raise exception 'invalid_action';end if;
  select * into t from public.casino_live_tables where id=p_table_id for update;if not found or t.game<>'blackjack' or t.status<>'playing' then raise exception 'table_unavailable';end if;
  select * into p from public.casino_live_players where table_id=t.id and user_id=auth.uid() for update;if not found or p.status<>'playing' then raise exception 'not_your_turn';end if;
  if p_action='hit' then v_deck:=array(select jsonb_array_elements_text(t.state->'deck')::integer);v_next:=(t.state->>'nextCard')::integer;v_card:=v_deck[v_next];p.hand:=array_append(p.hand,v_card);v_value:=public.casino_live_blackjack_value_v119(p.hand);update public.casino_live_players set hand=p.hand,status=case when v_value>21 then 'bust' when v_value=21 then 'stand' else 'playing' end where table_id=t.id and user_id=p.user_id;update public.casino_live_tables set state=jsonb_set(state,'{nextCard}',to_jsonb(v_next+1),true),updated_at=now() where id=t.id;if v_value<21 then return true;end if;else update public.casino_live_players set status='stand' where table_id=t.id and user_id=p.user_id;end if;
  select min(seat_no) into v_next_seat from public.casino_live_players where table_id=t.id and status='waiting';if v_next_seat is null then perform public.casino_live_blackjack_settle_v119(t.id);else update public.casino_live_players set status='playing' where table_id=t.id and seat_no=v_next_seat;update public.casino_live_tables set state=jsonb_set(state,'{turnSeat}',to_jsonb(v_next_seat),true),updated_at=now() where id=t.id;end if;return true;
end;$$;

create or replace function public.casino_live_new_round_v119(p_table_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare t public.casino_live_tables%rowtype;
begin if auth.uid() is null then raise exception 'authentication_required';end if;select * into t from public.casino_live_tables where id=p_table_id for update;if not found or t.host_user_id<>auth.uid() then raise exception 'not_host';end if;if t.status<>'finished' then raise exception 'table_unavailable';end if;update public.casino_live_players set bet_amount=0,bet_choice=null,bets='[]'::jsonb,hand=array[]::integer[],status='seated',payout=0 where table_id=t.id;update public.casino_live_tables set status='open',phase='bets_open',round_no=round_no+1,dealer_hand=array[]::integer[],state='{}'::jsonb,result='{}'::jsonb,finished_at=null,updated_at=now() where id=t.id;return true;end;$$;

create or replace function public.casino_live_cancel_v119(p_table_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare t public.casino_live_tables%rowtype;p record;v_balance bigint;
begin if auth.uid() is null then raise exception 'authentication_required';end if;select * into t from public.casino_live_tables where id=p_table_id for update;if not found or t.host_user_id<>auth.uid() then raise exception 'not_host';end if;if t.status<>'open' then raise exception 'table_unavailable';end if;for p in select * from public.casino_live_players where table_id=t.id and bet_amount>0 for update loop update public.casino_wallets set balance=balance+p.bet_amount,updated_at=now() where user_id=p.user_id returning balance into v_balance;insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(p.user_id,'refund',p.bet_amount,v_balance,'Remboursement table live annulée',t.id);end loop;update public.casino_live_tables set status='cancelled',phase='closed',result=jsonb_build_object('summary','Table annulée et remboursée'),finished_at=now(),updated_at=now() where id=t.id;return true;end;$$;

create or replace function public.casino_live_leave_v119(p_table_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare t public.casino_live_tables%rowtype;p public.casino_live_players%rowtype;v_balance bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select * into t from public.casino_live_tables where id=p_table_id for update;if not found or t.status<>'open' then raise exception 'table_unavailable';end if;
  if t.host_user_id=auth.uid() then raise exception 'not_host';end if;
  select * into p from public.casino_live_players where table_id=t.id and user_id=auth.uid() for update;if not found then raise exception 'forbidden';end if;
  if p.bet_amount>0 then update public.casino_wallets set balance=balance+p.bet_amount,updated_at=now() where user_id=p.user_id returning balance into v_balance;insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(p.user_id,'refund',p.bet_amount,v_balance,'Départ avant lancement · table live',t.id);end if;
  delete from public.casino_live_players where table_id=t.id and user_id=p.user_id;update public.casino_live_tables set updated_at=now() where id=t.id;return true;
end;$$;

create or replace function public.casino_live_lobby_v119()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_tables jsonb;v_balance bigint;
begin if auth.uid() is null then raise exception 'authentication_required';end if;select balance into v_balance from public.casino_wallets where user_id=auth.uid();select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'game',t.game,'name',t.name,'host_name',t.host_name,'max_players',t.max_players,'visibility',t.visibility,'join_code',case when t.host_user_id=auth.uid() then t.join_code else null end,'status',t.status,'phase',t.phase,'round_no',t.round_no,'dealer_hand',case when t.game='blackjack' and t.status='playing' then array[t.dealer_hand[1]] else t.dealer_hand end,'dealer_value',case when t.status='finished' then public.casino_live_blackjack_value_v119(t.dealer_hand) else 0 end,'result',t.result,'is_host',t.host_user_id=auth.uid(),'is_seated',exists(select 1 from public.casino_live_players m where m.table_id=t.id and m.user_id=auth.uid()),'created_at',t.created_at,'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'seat_no',p.seat_no,'bet_amount',p.bet_amount,'bet_choice',case when p.user_id=auth.uid() or t.status='finished' then p.bet_choice else null end,'hand',case when t.game<>'blackjack' or t.status in ('playing','finished') then p.hand else array[]::integer[] end,'hand_value',case when cardinality(p.hand)>0 then public.casino_live_blackjack_value_v119(p.hand) else 0 end,'status',p.status,'payout',p.payout,'is_me',p.user_id=auth.uid()) order by p.seat_no),'[]'::jsonb) from public.casino_live_players p where p.table_id=t.id)) order by t.created_at desc),'[]'::jsonb) into v_tables from public.casino_live_tables t where (t.visibility='public' and t.status='open') or exists(select 1 from public.casino_live_players p where p.table_id=t.id and p.user_id=auth.uid());return jsonb_build_object('tables',v_tables,'balance',coalesce(v_balance,0));end;$$;

create or replace function public.casino_live_recover_v119()
returns integer language plpgsql security definer set search_path=public as $$
declare t record;p record;v_balance bigint;v_count integer:=0;
begin if auth.uid() is null then raise exception 'authentication_required';end if;for t in select * from public.casino_live_tables where status in ('open','betting','playing') and updated_at<now()-interval '2 hours' for update skip locked loop for p in select * from public.casino_live_players where table_id=t.id and bet_amount>0 for update loop update public.casino_wallets set balance=balance+p.bet_amount,updated_at=now() where user_id=p.user_id returning balance into v_balance;insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(p.user_id,'refund',p.bet_amount,v_balance,'Remboursement table live interrompue',t.id);end loop;update public.casino_live_tables set status='cancelled',phase='expired',result=jsonb_build_object('summary','Table interrompue : toutes les mises sont remboursées'),finished_at=now(),updated_at=now() where id=t.id;v_count:=v_count+1;end loop;return v_count;end;$$;

-- La remise à zéro totale inclut aussi toutes les nouvelles tables live.
create or replace function public.casino_admin_opening_reset_v114(p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if not public.is_nostra_manager() and coalesce(public.nostra_jwt_discord_id(),'')<>'331843410962939908' then raise exception 'forbidden';end if;
  if coalesce(p_confirmation,'')<>'OUVRIR LE CASINO A ZERO' then raise exception 'invalid_confirmation';end if;
  truncate table public.casino_live_players,public.casino_live_tables,public.casino_pvp_rooms,public.casino_poker_seats,public.casino_active_games,public.casino_transactions,public.casino_game_rounds,public.casino_conversion_requests,public.casino_poker_tables,public.casino_wallets restart identity;
  return jsonb_build_object('complete',true,'purchases',0,'transactions',0,'rounds',0,'wallets',0,'players',0,'multiplayer_rooms',0,'live_tables',0,'total_wagered',0,'total_paid',0,'house_result',0,'real_rtp_percent',0,'settings_preserved',true,'rp_database_modified',false);
end;$$;

revoke all on function public.casino_live_blackjack_value_v119(integer[]) from public,anon,authenticated;
revoke all on function public.casino_live_baccarat_value_v119(integer[]) from public,anon,authenticated;
revoke all on function public.casino_live_credit_result_v119(uuid,uuid,text,bigint,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.casino_live_blackjack_settle_v119(uuid) from public,anon,authenticated;
revoke all on function public.casino_live_create_v119(text,text,integer,text) from public,anon;
revoke all on function public.casino_live_join_v119(uuid,text) from public,anon;
revoke all on function public.casino_live_bet_v119(uuid,bigint,text,jsonb) from public,anon;
revoke all on function public.casino_live_start_v119(uuid) from public,anon;
revoke all on function public.casino_live_blackjack_action_v119(uuid,text) from public,anon;
revoke all on function public.casino_live_new_round_v119(uuid) from public,anon;
revoke all on function public.casino_live_cancel_v119(uuid) from public,anon;
revoke all on function public.casino_live_leave_v119(uuid) from public,anon;
revoke all on function public.casino_live_lobby_v119() from public,anon;
revoke all on function public.casino_live_recover_v119() from public,anon;
grant execute on function public.casino_live_create_v119(text,text,integer,text) to authenticated;
grant execute on function public.casino_live_join_v119(uuid,text) to authenticated;
grant execute on function public.casino_live_bet_v119(uuid,bigint,text,jsonb) to authenticated;
grant execute on function public.casino_live_start_v119(uuid) to authenticated;
grant execute on function public.casino_live_blackjack_action_v119(uuid,text) to authenticated;
grant execute on function public.casino_live_new_round_v119(uuid) to authenticated;
grant execute on function public.casino_live_cancel_v119(uuid) to authenticated;
grant execute on function public.casino_live_leave_v119(uuid) to authenticated;
grant execute on function public.casino_live_lobby_v119() to authenticated;
grant execute on function public.casino_live_recover_v119() to authenticated;
grant execute on function public.casino_admin_opening_reset_v114(text) to authenticated;
notify pgrst,'reload schema';
select 'V119 prête · tables live réalistes' as status;
