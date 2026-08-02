-- Nostra Group · Le Cercle Nostra · V131
-- À exécuter une seule fois après la V130.
-- Mines, Coffres mystères, Courses hippiques, Tournoi de machines et Bataille de cartes.

begin;

alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v115;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v119;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v131;
alter table public.casino_game_settings add constraint casino_game_settings_game_check_v131 check (game in (
  'poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat',
  'mines','mystery_boxes','horse_racing','slots_tournament','card_battle'
));

alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v115;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v119;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v131;
alter table public.casino_game_rounds add constraint casino_game_rounds_game_check_v131 check (game in (
  'poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat',
  'mines','mystery_boxes','horse_racing','slots_tournament','card_battle'
));

alter table public.casino_active_games drop constraint if exists casino_active_games_game_check;
alter table public.casino_active_games drop constraint if exists casino_active_games_game_check_v115;
alter table public.casino_active_games drop constraint if exists casino_active_games_game_check_v131;
alter table public.casino_active_games add constraint casino_active_games_game_check_v131
  check (game in ('poker','blackjack','double_or_quit','mines'));

insert into public.casino_game_settings
  (game,enabled,difficulty,win_rate_percent,min_bet,max_bet,base_multiplier,jackpot_multiplier,max_payout,sort_order)
values
  ('mines',true,'hard',38,25,25000,1.12,25,250000,10),
  ('mystery_boxes',true,'hard',36,25,25000,2,20,250000,11),
  ('horse_racing',true,'balanced',45,50,50000,2,8,500000,12),
  ('slots_tournament',true,'balanced',45,100,25000,2,10,500000,13),
  ('card_battle',true,'balanced',50,50,50000,2,2,100000,14)
on conflict(game) do nothing;

create table if not exists public.casino_special_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('horse_racing','slots_tournament','card_battle')),
  name text not null,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null,
  max_players integer not null check (max_players between 2 and 8),
  visibility text not null check (visibility in ('public','private')),
  join_code text not null unique,
  status text not null default 'open' check (status in ('open','playing','finished','cancelled')),
  entry_fee bigint not null check (entry_fee > 0),
  total_turns integer not null default 10 check (total_turns between 1 and 50),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.casino_special_players (
  room_id uuid not null references public.casino_special_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  seat_no integer not null check (seat_no between 1 and 8),
  wager bigint not null default 0 check (wager >= 0),
  choice text,
  score bigint not null default 0 check (score >= 0),
  turns_played integer not null default 0 check (turns_played >= 0),
  payout bigint not null default 0 check (payout >= 0),
  state jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key(room_id,user_id),
  unique(room_id,seat_no)
);

create index if not exists casino_special_rooms_lobby_idx on public.casino_special_rooms(status,visibility,created_at desc);
create index if not exists casino_special_players_user_idx on public.casino_special_players(user_id,joined_at desc);
alter table public.casino_special_rooms enable row level security;
alter table public.casino_special_players enable row level security;
revoke all on table public.casino_special_rooms,public.casino_special_players from public,anon,authenticated;

create or replace function public.casino_begin_game_v108(p_game text,p_wager bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_balance bigint;v_config public.casino_game_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if p_game not in ('poker','blackjack','double_or_quit','mines') or p_wager<1 then raise exception 'invalid_game';end if;
  select * into v_config from public.casino_game_settings where game=p_game;
  if not found then raise exception 'game_not_configured';end if;
  if not v_config.enabled then raise exception 'game_closed';end if;
  if p_wager<v_config.min_bet or p_wager>v_config.max_bet then raise exception 'wager_out_of_bounds';end if;
  if exists(select 1 from public.casino_game_rounds where user_id=auth.uid() and game=p_game and status='pending') then raise exception 'active_game_exists';end if;
  insert into public.casino_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-p_wager,lifetime_wagered=lifetime_wagered+p_wager,updated_at=now()
  where user_id=auth.uid() and balance>=p_wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance';end if;
  insert into public.casino_game_rounds(user_id,game,wager) values(auth.uid(),p_game,p_wager) returning id into v_id;
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(auth.uid(),'wager',-p_wager,v_balance,'Mise '||p_game,v_id);
  return v_id;
end;$$;

create or replace function public.casino_update_game_settings_v110(
  p_game text,p_enabled boolean,p_difficulty text,p_win_rate_percent numeric,p_min_bet bigint,p_max_bet bigint,
  p_base_multiplier numeric,p_jackpot_multiplier numeric,p_max_payout bigint
) returns boolean language plpgsql security definer set search_path=public as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden';end if;
  if p_game not in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat','mines','mystery_boxes','horse_racing','slots_tournament','card_battle')
    or p_difficulty not in ('balanced','hard','expert','custom') or p_win_rate_percent not between 1 and 95
    or p_min_bet<1 or p_max_bet<p_min_bet or p_base_multiplier not between 0.1 and 100
    or p_jackpot_multiplier<p_base_multiplier or p_jackpot_multiplier>1000 or p_max_payout<1
  then raise exception 'invalid_game_settings';end if;
  if p_game='double_or_quit' then p_base_multiplier:=2;p_jackpot_multiplier:=2;end if;
  update public.casino_game_settings set enabled=p_enabled,difficulty=p_difficulty,win_rate_percent=p_win_rate_percent,
    min_bet=p_min_bet,max_bet=p_max_bet,base_multiplier=p_base_multiplier,jackpot_multiplier=p_jackpot_multiplier,
    max_payout=p_max_payout,updated_at=now(),updated_by=auth.uid() where game=p_game;
  if not found then raise exception 'unknown_game';end if;return true;
end;$$;

create or replace function public.casino_play_mystery_boxes_v131(p_wager bigint,p_box integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.casino_game_settings%rowtype;v_id uuid:=gen_random_uuid();v_balance bigint;v_roll integer;
  v_payout bigint:=0;v_multiplier numeric:=0;v_type text:='loss';v_label text:='Coffre vide';v_threshold integer;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if p_box not between 0 and 5 then raise exception 'invalid_box';end if;
  select * into c from public.casino_game_settings where game='mystery_boxes';
  if not found or not c.enabled then raise exception 'game_closed';end if;
  if p_wager<c.min_bet or p_wager>c.max_bet then raise exception 'wager_out_of_bounds';end if;
  insert into public.casino_wallets(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-p_wager,lifetime_wagered=lifetime_wagered+p_wager,updated_at=now()
  where user_id=auth.uid() and balance>=p_wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance';end if;
  v_roll:=floor(random()*10000)::integer;v_threshold:=floor(c.win_rate_percent*100)::integer;
  if v_roll<greatest(1,floor(v_threshold*.08)) then v_type:='jackpot';v_multiplier:=c.jackpot_multiplier;v_label:='Jackpot du coffre';
  elsif v_roll<floor(v_threshold*.40) then v_type:='multiplier';v_multiplier:=c.base_multiplier;v_label:='Coffre multiplicateur';
  elsif v_roll<v_threshold then v_type:='refund';v_multiplier:=1;v_label:='Mise remboursée';end if;
  v_payout:=least(c.max_payout,floor(p_wager*v_multiplier)::bigint);
  update public.casino_wallets set balance=balance+v_payout,lifetime_won=lifetime_won+v_payout,games_played=games_played+1,
    biggest_win=greatest(biggest_win,v_payout),xp=xp+greatest(10,least(250,floor(p_wager::numeric/10)::bigint)),updated_at=now()
  where user_id=auth.uid() returning balance into v_balance;
  insert into public.casino_game_rounds(id,user_id,game,wager,payout,status,result,settled_at)
  values(v_id,auth.uid(),'mystery_boxes',p_wager,v_payout,'settled',jsonb_build_object('result',v_label,'box',p_box,'boxType',v_type,'multiplier',v_multiplier),now());
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(auth.uid(),'wager',-p_wager,v_balance-v_payout,'Achat coffre mystère',v_id);
  if v_payout>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
    values(auth.uid(),'payout',v_payout,v_balance,v_label,v_id);end if;
  return jsonb_build_object('finished',true,'result',v_label,'box',p_box,'boxType',v_type,'multiplier',v_multiplier,
    'wager',p_wager,'payout',v_payout,'balance',v_balance);
end;$$;

create or replace function public.casino_special_debit_v131(p_user uuid,p_amount bigint,p_reference uuid,p_label text)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_balance bigint;
begin
  insert into public.casino_wallets(user_id) values(p_user) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-p_amount,updated_at=now() where user_id=p_user and balance>=p_amount returning balance into v_balance;
  if not found then raise exception 'insufficient_balance';end if;
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(p_user,'wager',-p_amount,v_balance,p_label,p_reference);
  return v_balance;
end;$$;

create or replace function public.casino_special_credit_v131(p_room uuid,p_user uuid,p_game text,p_wager bigint,p_payout bigint,p_result jsonb)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_balance bigint;v_round uuid:=gen_random_uuid();
begin
  update public.casino_wallets set balance=balance+p_payout,lifetime_wagered=lifetime_wagered+p_wager,lifetime_won=lifetime_won+p_payout,
    games_played=games_played+1,biggest_win=greatest(biggest_win,p_payout),xp=xp+greatest(10,least(250,floor(p_wager::numeric/10)::bigint)),updated_at=now()
  where user_id=p_user returning balance into v_balance;
  insert into public.casino_game_rounds(id,user_id,game,wager,payout,status,result,settled_at)
  values(v_round,p_user,p_game,greatest(1,p_wager),p_payout,'settled',p_result||jsonb_build_object('mode','multiplayer','room_id',p_room),now());
  if p_payout>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
    values(p_user,'payout',p_payout,v_balance,'Gain '||p_game,p_room);end if;
  return v_balance;
end;$$;

create or replace function public.casino_special_create_v131(p_game text,p_name text,p_entry_fee bigint,p_max_players integer,p_visibility text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_code text;v_config public.casino_game_settings%rowtype;v_max integer;v_wager bigint:=0;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if p_game not in ('horse_racing','slots_tournament','card_battle') or p_visibility not in ('public','private') then raise exception 'invalid_table';end if;
  select * into v_config from public.casino_game_settings where game=p_game;
  if not found or not v_config.enabled then raise exception 'game_closed';end if;
  if p_entry_fee<v_config.min_bet or p_entry_fee>v_config.max_bet then raise exception 'wager_out_of_bounds';end if;
  if exists(select 1 from public.casino_special_rooms r join public.casino_special_players p on p.room_id=r.id where p.user_id=auth.uid() and r.status in ('open','playing')) then raise exception 'active_special_room';end if;
  v_max:=case when p_game='card_battle' then 2 when p_game='horse_racing' then least(6,greatest(2,p_max_players)) else least(8,greatest(2,p_max_players)) end;
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.casino_special_rooms(game,name,host_user_id,host_name,max_players,visibility,join_code,entry_fee)
  values(p_game,left(coalesce(nullif(trim(p_name),''),'Salon Prestige'),42),auth.uid(),coalesce(public.casino_display_name_v108(auth.uid()),'Citoyen Nostra'),v_max,p_visibility,v_code,p_entry_fee)
  returning id into v_id;
  if p_game<>'horse_racing' then perform public.casino_special_debit_v131(auth.uid(),p_entry_fee,v_id,'Entrée '||p_game);v_wager:=p_entry_fee;end if;
  insert into public.casino_special_players(room_id,user_id,display_name,seat_no,wager)
  values(v_id,auth.uid(),coalesce(public.casino_display_name_v108(auth.uid()),'Citoyen Nostra'),1,v_wager);
  return v_id;
end;$$;

create or replace function public.casino_special_join_v131(p_room_id uuid default null,p_code text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare r public.casino_special_rooms%rowtype;v_seat integer;v_wager bigint:=0;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if exists(select 1 from public.casino_special_rooms x join public.casino_special_players p on p.room_id=x.id where p.user_id=auth.uid() and x.status in ('open','playing')) then raise exception 'active_special_room';end if;
  if p_room_id is not null then select * into r from public.casino_special_rooms where id=p_room_id for update;
  else select * into r from public.casino_special_rooms where join_code=upper(trim(coalesce(p_code,''))) and visibility='private' and status='open' for update;end if;
  if not found then if p_room_id is null then raise exception 'invalid_code';else raise exception 'table_unavailable';end if;end if;
  if r.status<>'open' then raise exception 'table_unavailable';end if;
  if r.visibility='private' and p_room_id is not null and upper(trim(coalesce(p_code,'')))<>r.join_code then raise exception 'invalid_code';end if;
  select n into v_seat from generate_series(1,r.max_players) n where not exists(select 1 from public.casino_special_players where room_id=r.id and seat_no=n) order by n limit 1;
  if v_seat is null then raise exception 'table_full';end if;
  if r.game<>'horse_racing' then perform public.casino_special_debit_v131(auth.uid(),r.entry_fee,r.id,'Entrée '||r.game);v_wager:=r.entry_fee;end if;
  insert into public.casino_special_players(room_id,user_id,display_name,seat_no,wager)
  values(r.id,auth.uid(),coalesce(public.casino_display_name_v108(auth.uid()),'Citoyen Nostra'),v_seat,v_wager);
  update public.casino_special_rooms set updated_at=now() where id=r.id;return r.id;
end;$$;

create or replace function public.casino_special_bet_v131(p_room_id uuid,p_amount bigint,p_choice text)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.casino_special_rooms%rowtype;p public.casino_special_players%rowtype;c public.casino_game_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select * into r from public.casino_special_rooms where id=p_room_id for update;
  if not found or r.game<>'horse_racing' or r.status<>'open' then raise exception 'table_unavailable';end if;
  select * into p from public.casino_special_players where room_id=r.id and user_id=auth.uid() for update;
  if not found then raise exception 'not_seated';end if;if p.wager>0 then raise exception 'bet_already_locked';end if;
  select * into c from public.casino_game_settings where game='horse_racing';
  if p_amount<c.min_bet or p_amount>c.max_bet then raise exception 'wager_out_of_bounds';end if;
  if p_choice not in ('1','2','3','4','5','6') then raise exception 'invalid_choice';end if;
  perform public.casino_special_debit_v131(auth.uid(),p_amount,r.id,'Pari course hippique');
  update public.casino_special_players set wager=p_amount,choice=p_choice where room_id=r.id and user_id=auth.uid();
  update public.casino_special_rooms set updated_at=now() where id=r.id;return true;
end;$$;

create or replace function public.casino_special_start_v131(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.casino_special_rooms%rowtype;p record;v_count integer;v_pot bigint;v_payout bigint;v_winners integer;
  v_order integer[];v_winner integer;v_card1 integer;v_card2 integer;v_rank1 integer;v_rank2 integer;v_summary text;c public.casino_game_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select * into r from public.casino_special_rooms where id=p_room_id for update;
  if not found or r.status<>'open' then raise exception 'table_unavailable';end if;
  if r.host_user_id<>auth.uid() then raise exception 'not_host';end if;
  select count(*) into v_count from public.casino_special_players where room_id=r.id;
  if v_count<2 then raise exception 'players_not_ready';end if;
  if r.game='slots_tournament' then
    update public.casino_special_players set score=0,turns_played=0,payout=0,state='{}'::jsonb where room_id=r.id;
    update public.casino_special_rooms set status='playing',result=jsonb_build_object('summary','Tournoi en cours'),updated_at=now() where id=r.id;
    return jsonb_build_object('started',true);
  end if;
  if exists(select 1 from public.casino_special_players where room_id=r.id and wager<1) then raise exception 'players_not_ready';end if;
  select * into c from public.casino_game_settings where game=r.game;
  select sum(wager) into v_pot from public.casino_special_players where room_id=r.id;
  if r.game='horse_racing' then
    select array_agg(n order by random()) into v_order from generate_series(1,6) n;v_winner:=v_order[1];
    select count(*) into v_winners from public.casino_special_players where room_id=r.id and choice=v_winner::text;
    for p in select * from public.casino_special_players where room_id=r.id for update loop
      v_payout:=case when p.choice=v_winner::text and v_winners>0 then least(c.max_payout,floor(v_pot*(p.wager::numeric/nullif((select sum(wager) from public.casino_special_players where room_id=r.id and choice=v_winner::text),0)))::bigint) else 0 end;
      update public.casino_special_players set payout=v_payout,state=jsonb_build_object('horse',p.choice) where room_id=r.id and user_id=p.user_id;
      perform public.casino_special_credit_v131(r.id,p.user_id,r.game,p.wager,v_payout,jsonb_build_object('winner',v_winner,'choice',p.choice,'order',v_order));
    end loop;
    v_summary:=case when v_winners>0 then 'Le cheval '||v_winner||' remporte la course' else 'Aucun pari gagnant sur le cheval '||v_winner end;
    update public.casino_special_rooms set status='finished',result=jsonb_build_object('summary',v_summary,'winner',v_winner,'order',v_order),finished_at=now(),updated_at=now() where id=r.id;
    return jsonb_build_object('winner',v_winner,'order',v_order);
  end if;
  select floor(random()*52)::integer into v_card1;
  loop select floor(random()*52)::integer into v_card2;exit when v_card2<>v_card1;end loop;
  v_rank1:=v_card1%13+2;v_rank2:=v_card2%13+2;v_winners:=case when v_rank1=v_rank2 then 2 else 1 end;
  for p in select * from public.casino_special_players where room_id=r.id order by seat_no for update loop
    if p.seat_no=1 then v_payout:=case when v_rank1>=v_rank2 then floor(v_pot::numeric/v_winners)::bigint else 0 end;
    else v_payout:=case when v_rank2>=v_rank1 then floor(v_pot::numeric/v_winners)::bigint else 0 end;end if;
    v_payout:=least(c.max_payout,v_payout);
    update public.casino_special_players set payout=v_payout,state=jsonb_build_object('card',case when p.seat_no=1 then v_card1 else v_card2 end) where room_id=r.id and user_id=p.user_id;
    perform public.casino_special_credit_v131(r.id,p.user_id,r.game,p.wager,v_payout,jsonb_build_object('card',case when p.seat_no=1 then v_card1 else v_card2 end));
  end loop;
  v_summary:=case when v_rank1=v_rank2 then 'Égalité · pot partagé' when v_rank1>v_rank2 then 'Le créateur remporte la bataille' else 'Le challenger remporte la bataille' end;
  update public.casino_special_rooms set status='finished',result=jsonb_build_object('summary',v_summary),finished_at=now(),updated_at=now() where id=r.id;
  return jsonb_build_object('summary',v_summary);
end;$$;

create or replace function public.casino_special_spin_v131(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.casino_special_rooms%rowtype;p public.casino_special_players%rowtype;a integer;b integer;d integer;v_points bigint;
  v_symbols text[]:=array['●','◆','♠','✦','♛','7'];v_finished boolean;v_top bigint;v_winners integer;v_pot bigint;v_payout bigint;q record;c public.casino_game_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  select * into r from public.casino_special_rooms where id=p_room_id for update;
  if not found or r.game<>'slots_tournament' or r.status<>'playing' then raise exception 'table_unavailable';end if;
  select * into p from public.casino_special_players where room_id=r.id and user_id=auth.uid() for update;
  if not found or p.turns_played>=r.total_turns then raise exception 'turns_remaining';end if;
  a:=floor(random()*6)::integer;b:=floor(random()*6)::integer;d:=floor(random()*6)::integer;
  v_points:=case when a=5 and b=5 and d=5 then 1000 when a=b and b=d then 400 when a=b or a=d or b=d then 100 else 10+a+b+d end;
  update public.casino_special_players set score=score+v_points,turns_played=turns_played+1,
    state=jsonb_build_object('last_symbols',jsonb_build_array(v_symbols[a+1],v_symbols[b+1],v_symbols[d+1]),'last_points',v_points)
  where room_id=r.id and user_id=auth.uid();update public.casino_special_rooms set updated_at=now() where id=r.id;
  select not exists(select 1 from public.casino_special_players where room_id=r.id and turns_played<r.total_turns) into v_finished;
  if v_finished then
    select max(score),sum(wager) into v_top,v_pot from public.casino_special_players where room_id=r.id;
    select count(*) into v_winners from public.casino_special_players where room_id=r.id and score=v_top;
    select * into c from public.casino_game_settings where game='slots_tournament';
    for q in select * from public.casino_special_players where room_id=r.id for update loop
      v_payout:=case when q.score=v_top then least(c.max_payout,floor(v_pot::numeric/v_winners)::bigint) else 0 end;
      update public.casino_special_players set payout=v_payout where room_id=r.id and user_id=q.user_id;
      perform public.casino_special_credit_v131(r.id,q.user_id,r.game,q.wager,v_payout,jsonb_build_object('score',q.score,'turns',r.total_turns));
    end loop;
    update public.casino_special_rooms set status='finished',result=jsonb_build_object('summary',case when v_winners=1 then 'Le meilleur score remporte la cagnotte' else 'Égalité · cagnotte partagée' end,'winning_score',v_top),finished_at=now(),updated_at=now() where id=r.id;
  end if;
  return jsonb_build_object('symbols',jsonb_build_array(v_symbols[a+1],v_symbols[b+1],v_symbols[d+1]),'points',v_points,'finished',v_finished);
end;$$;

create or replace function public.casino_special_refund_player_v131(p_room uuid,p_user uuid,p_label text)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_wager bigint;v_balance bigint;
begin
  select wager into v_wager from public.casino_special_players where room_id=p_room and user_id=p_user for update;
  if coalesce(v_wager,0)>0 then update public.casino_wallets set balance=balance+v_wager,updated_at=now() where user_id=p_user returning balance into v_balance;
    insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(p_user,'refund',v_wager,v_balance,p_label,p_room);
  else select coalesce(balance,0) into v_balance from public.casino_wallets where user_id=p_user;end if;return coalesce(v_balance,0);
end;$$;

create or replace function public.casino_special_cancel_v131(p_room_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.casino_special_rooms%rowtype;p record;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;select * into r from public.casino_special_rooms where id=p_room_id for update;
  if not found or r.host_user_id<>auth.uid() then raise exception 'not_host';end if;if r.status not in ('open','playing') then raise exception 'table_unavailable';end if;
  for p in select user_id from public.casino_special_players where room_id=r.id loop perform public.casino_special_refund_player_v131(r.id,p.user_id,'Remboursement partie annulée');end loop;
  update public.casino_special_rooms set status='cancelled',result=jsonb_build_object('summary','Partie annulée et remboursée'),finished_at=now(),updated_at=now() where id=r.id;return true;
end;$$;

create or replace function public.casino_special_leave_v131(p_room_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare r public.casino_special_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;select * into r from public.casino_special_rooms where id=p_room_id for update;
  if not found or r.status<>'open' or r.host_user_id=auth.uid() then raise exception 'table_unavailable';end if;
  if not exists(select 1 from public.casino_special_players where room_id=r.id and user_id=auth.uid()) then raise exception 'not_seated';end if;
  perform public.casino_special_refund_player_v131(r.id,auth.uid(),'Départ avant lancement');delete from public.casino_special_players where room_id=r.id and user_id=auth.uid();
  update public.casino_special_rooms set updated_at=now() where id=r.id;return true;
end;$$;

create or replace function public.casino_special_lobby_v131()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_rooms jsonb;v_balance bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;select coalesce(balance,0) into v_balance from public.casino_wallets where user_id=auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'game',r.game,'name',r.name,'host_name',r.host_name,'max_players',r.max_players,
    'visibility',r.visibility,'join_code',case when r.host_user_id=auth.uid() then r.join_code else null end,'status',r.status,'entry_fee',r.entry_fee,
    'total_turns',r.total_turns,'result',r.result,'is_host',r.host_user_id=auth.uid(),'is_seated',exists(select 1 from public.casino_special_players me where me.room_id=r.id and me.user_id=auth.uid()),
    'players',(select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'display_name',p.display_name,'seat_no',p.seat_no,'wager',p.wager,
      'choice',case when p.user_id=auth.uid() or r.status='finished' then p.choice else null end,'score',p.score,'turns_played',p.turns_played,'payout',p.payout,
      'state',case when p.user_id=auth.uid() or r.status='finished' then p.state else '{}'::jsonb end,'is_me',p.user_id=auth.uid()) order by p.seat_no),'[]'::jsonb)
      from public.casino_special_players p where p.room_id=r.id),'created_at',r.created_at) order by r.created_at desc),'[]'::jsonb) into v_rooms
  from public.casino_special_rooms r where (r.visibility='public' and r.status='open') or exists(select 1 from public.casino_special_players p where p.room_id=r.id and p.user_id=auth.uid());
  return jsonb_build_object('rooms',v_rooms,'balance',coalesce(v_balance,0));
end;$$;

create or replace function public.casino_special_recover_v131()
returns integer language plpgsql security definer set search_path=public as $$
declare r record;p record;v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  for r in select * from public.casino_special_rooms where status in ('open','playing') and updated_at<now()-interval '2 hours' for update skip locked loop
    for p in select user_id from public.casino_special_players where room_id=r.id loop perform public.casino_special_refund_player_v131(r.id,p.user_id,'Remboursement partie interrompue');end loop;
    update public.casino_special_rooms set status='cancelled',result=jsonb_build_object('summary','Partie interrompue et remboursée'),finished_at=now(),updated_at=now() where id=r.id;v_count:=v_count+1;
  end loop;return v_count;
end;$$;

create or replace function public.casino_admin_opening_reset_v114(p_confirmation text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if not public.is_nostra_manager() and coalesce(public.nostra_jwt_discord_id(),'')<>'331843410962939908' then raise exception 'forbidden';end if;
  if coalesce(p_confirmation,'')<>'OUVRIR LE CASINO A ZERO' then raise exception 'invalid_confirmation';end if;
  truncate table public.casino_special_players,public.casino_special_rooms,public.casino_live_players,public.casino_live_tables,public.casino_pvp_rooms,
    public.casino_poker_seats,public.casino_active_games,public.casino_transactions,public.casino_game_rounds,public.casino_cashout_requests,
    public.casino_conversion_requests,public.casino_poker_tables,public.casino_wallets restart identity;
  return jsonb_build_object('complete',true,'purchases',0,'cashouts',0,'transactions',0,'rounds',0,'wallets',0,'players',0,
    'multiplayer_rooms',0,'live_tables',0,'special_rooms',0,'total_wagered',0,'total_paid',0,'house_result',0,'real_rtp_percent',0,
    'settings_preserved',true,'rp_database_modified',false);
end;$$;

revoke all on function public.casino_special_debit_v131(uuid,bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.casino_special_credit_v131(uuid,uuid,text,bigint,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.casino_special_refund_player_v131(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.casino_play_mystery_boxes_v131(bigint,integer) from public,anon;
revoke all on function public.casino_special_create_v131(text,text,bigint,integer,text) from public,anon;
revoke all on function public.casino_special_join_v131(uuid,text) from public,anon;
revoke all on function public.casino_special_bet_v131(uuid,bigint,text) from public,anon;
revoke all on function public.casino_special_start_v131(uuid) from public,anon;
revoke all on function public.casino_special_spin_v131(uuid) from public,anon;
revoke all on function public.casino_special_cancel_v131(uuid) from public,anon;
revoke all on function public.casino_special_leave_v131(uuid) from public,anon;
revoke all on function public.casino_special_lobby_v131() from public,anon;
revoke all on function public.casino_special_recover_v131() from public,anon;
grant execute on function public.casino_begin_game_v108(text,bigint) to authenticated;
grant execute on function public.casino_update_game_settings_v110(text,boolean,text,numeric,bigint,bigint,numeric,numeric,bigint) to authenticated;
grant execute on function public.casino_play_mystery_boxes_v131(bigint,integer) to authenticated;
grant execute on function public.casino_special_create_v131(text,text,bigint,integer,text) to authenticated;
grant execute on function public.casino_special_join_v131(uuid,text) to authenticated;
grant execute on function public.casino_special_bet_v131(uuid,bigint,text) to authenticated;
grant execute on function public.casino_special_start_v131(uuid) to authenticated;
grant execute on function public.casino_special_spin_v131(uuid) to authenticated;
grant execute on function public.casino_special_cancel_v131(uuid) to authenticated;
grant execute on function public.casino_special_leave_v131(uuid) to authenticated;
grant execute on function public.casino_special_lobby_v131() to authenticated;
grant execute on function public.casino_special_recover_v131() to authenticated;
grant execute on function public.casino_admin_opening_reset_v114(text) to authenticated;

commit;
notify pgrst,'reload schema';
select 'V131 prête · cinq nouveaux jeux Casino' as status;
