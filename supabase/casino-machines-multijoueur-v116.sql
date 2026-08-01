-- Nostra Group · Le Cercle Nostra · V116
-- À exécuter une seule fois après la V115.
-- Six machines à sous visuelles + défis réels entre citoyens.

create table if not exists public.casino_pvp_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('poker','dice','coinflip')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null,
  guest_user_id uuid references auth.users(id) on delete set null,
  guest_name text,
  wager bigint not null check (wager > 0),
  visibility text not null default 'public' check (visibility in ('public','private')),
  join_code text not null unique,
  choice_host text,
  status text not null default 'open' check (status in ('open','finished','cancelled')),
  result jsonb not null default '{}'::jsonb,
  payout_host bigint not null default 0 check (payout_host >= 0),
  payout_guest bigint not null default 0 check (payout_guest >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists casino_pvp_rooms_lobby_idx
on public.casino_pvp_rooms (status, visibility, created_at desc);

create index if not exists casino_pvp_rooms_host_idx
on public.casino_pvp_rooms (host_user_id, created_at desc);

create index if not exists casino_pvp_rooms_guest_idx
on public.casino_pvp_rooms (guest_user_id, created_at desc);

alter table public.casino_pvp_rooms enable row level security;
revoke all on table public.casino_pvp_rooms from public, anon, authenticated;

-- Encode une main de cinq cartes. Une carte vaut 0 à 51 :
-- rang = modulo 13 + 2, couleur = division entière par 13.
create or replace function public.casino_poker_five_score_v116(p_cards integer[])
returns bigint
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_ranks integer[];
  v_quads integer[];
  v_trips integer[];
  v_pairs integer[];
  v_singles integer[];
  v_kickers integer[] := array[]::integer[];
  v_flush boolean;
  v_straight_high integer := 0;
  v_high integer;
  v_category integer := 0;
  v_score bigint;
  v_weights bigint[] := array[50625,3375,225,15,1];
  v_index integer;
begin
  if cardinality(p_cards) <> 5 then raise exception 'five_cards_required'; end if;

  select array_agg((card % 13) + 2 order by (card % 13) + 2 desc),
         count(distinct floor(card / 13.0)) = 1
  into v_ranks, v_flush
  from unnest(p_cards) as u(card);

  select
    coalesce(array_agg(rank order by rank desc) filter (where copies = 4), array[]::integer[]),
    coalesce(array_agg(rank order by rank desc) filter (where copies = 3), array[]::integer[]),
    coalesce(array_agg(rank order by rank desc) filter (where copies = 2), array[]::integer[]),
    coalesce(array_agg(rank order by rank desc) filter (where copies = 1), array[]::integer[])
  into v_quads, v_trips, v_pairs, v_singles
  from (
    select (card % 13) + 2 as rank, count(*)::integer as copies
    from unnest(p_cards) as u(card)
    group by (card % 13) + 2
  ) grouped;

  for v_high in reverse 14..5 loop
    if (v_high = 5 and array[14,5,4,3,2] <@ v_ranks)
       or (v_high > 5 and array[v_high,v_high-1,v_high-2,v_high-3,v_high-4] <@ v_ranks) then
      v_straight_high := v_high;
      exit;
    end if;
  end loop;

  if v_flush and v_straight_high > 0 then
    v_category := 8; v_kickers := array[v_straight_high];
  elsif cardinality(v_quads) > 0 then
    v_category := 7; v_kickers := array[v_quads[1],v_singles[1]];
  elsif cardinality(v_trips) > 0 and (cardinality(v_pairs) > 0 or cardinality(v_trips) > 1) then
    v_category := 6; v_kickers := array[v_trips[1],greatest(coalesce(v_pairs[1],0),coalesce(v_trips[2],0))];
  elsif v_flush then
    v_category := 5; v_kickers := v_ranks;
  elsif v_straight_high > 0 then
    v_category := 4; v_kickers := array[v_straight_high];
  elsif cardinality(v_trips) > 0 then
    v_category := 3; v_kickers := array[v_trips[1]] || v_singles;
  elsif cardinality(v_pairs) >= 2 then
    v_category := 2; v_kickers := array[v_pairs[1],v_pairs[2],v_singles[1]];
  elsif cardinality(v_pairs) = 1 then
    v_category := 1; v_kickers := array[v_pairs[1]] || v_singles;
  else
    v_category := 0; v_kickers := v_ranks;
  end if;

  v_score := v_category::bigint * 759375;
  for v_index in 1..least(5,cardinality(v_kickers)) loop
    v_score := v_score + coalesce(v_kickers[v_index],0)::bigint * v_weights[v_index];
  end loop;
  return v_score;
end;
$$;

create or replace function public.casino_poker_score_v116(p_cards integer[])
returns bigint
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  a integer; b integer; c integer; d integer; e integer;
  v_score bigint;
  v_best bigint := -1;
begin
  if cardinality(p_cards) <> 7 then raise exception 'seven_cards_required'; end if;
  for a in 1..3 loop
    for b in (a+1)..4 loop
      for c in (b+1)..5 loop
        for d in (c+1)..6 loop
          for e in (d+1)..7 loop
            v_score := public.casino_poker_five_score_v116(array[p_cards[a],p_cards[b],p_cards[c],p_cards[d],p_cards[e]]);
            v_best := greatest(v_best,v_score);
          end loop;
        end loop;
      end loop;
    end loop;
  end loop;
  return v_best;
end;
$$;

create or replace function public.casino_pvp_recover_v116()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
  v_balance bigint;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  for v_room in
    select id,host_user_id,wager from public.casino_pvp_rooms
    where status = 'open' and created_at < now() - interval '2 hours'
    for update skip locked
  loop
    update public.casino_wallets set balance = balance + v_room.wager, updated_at = now()
    where user_id = v_room.host_user_id returning balance into v_balance;
    insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
    values(v_room.host_user_id,'refund',v_room.wager,v_balance,'Remboursement défi citoyen expiré',v_room.id);
    update public.casino_pvp_rooms set status='cancelled',finished_at=now(),result=jsonb_build_object('summary','Défi expiré et remboursé') where id=v_room.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.casino_pvp_create_v116(
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
declare
  v_user_id uuid := auth.uid();
  v_config public.casino_game_settings%rowtype;
  v_room_id uuid;
  v_balance bigint;
  v_code text;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if p_game not in ('poker','dice','coinflip') or p_visibility not in ('public','private') then raise exception 'invalid_room'; end if;
  if p_game = 'coinflip' and p_choice not in ('heads','tails') then raise exception 'invalid_choice'; end if;
  if p_game = 'dice' and p_choice not in ('under','over') then raise exception 'invalid_choice'; end if;
  if p_game = 'poker' then p_choice := null; end if;

  select * into v_config from public.casino_game_settings where game = p_game;
  if not found or not v_config.enabled then raise exception 'game_closed'; end if;
  if p_wager < v_config.min_bet or p_wager > v_config.max_bet then raise exception 'wager_out_of_bounds'; end if;
  if exists(select 1 from public.casino_pvp_rooms where host_user_id=v_user_id and status='open') then raise exception 'open_room_exists'; end if;

  insert into public.casino_wallets(user_id) values(v_user_id) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-p_wager,updated_at=now()
  where user_id=v_user_id and balance>=p_wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;

  v_code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.casino_pvp_rooms(game,host_user_id,host_name,wager,visibility,join_code,choice_host)
  values(p_game,v_user_id,coalesce(public.casino_display_name_v108(v_user_id),'Citoyen Nostra'),p_wager,p_visibility,v_code,p_choice)
  returning id into v_room_id;

  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(v_user_id,'table_buyin',-p_wager,v_balance,'Mise bloquée · défi citoyen '||p_game,v_room_id);
  return v_room_id;
end;
$$;

create or replace function public.casino_pvp_cancel_v116(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.casino_pvp_rooms%rowtype;
  v_balance bigint;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.casino_pvp_rooms where id=p_room_id for update;
  if not found or v_room.host_user_id<>v_user_id or v_room.status<>'open' then raise exception 'room_not_cancellable'; end if;
  update public.casino_wallets set balance=balance+v_room.wager,updated_at=now() where user_id=v_user_id returning balance into v_balance;
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(v_user_id,'refund',v_room.wager,v_balance,'Annulation défi citoyen',v_room.id);
  update public.casino_pvp_rooms set status='cancelled',finished_at=now(),result=jsonb_build_object('summary','Défi annulé et remboursé') where id=v_room.id;
  return true;
end;
$$;

create or replace function public.casino_pvp_join_v116(p_room_id uuid,p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.casino_pvp_rooms%rowtype;
  v_balance_guest bigint;
  v_balance_host bigint;
  v_deck integer[];
  v_host_cards integer[];
  v_guest_cards integer[];
  v_board integer[];
  v_host_score bigint;
  v_guest_score bigint;
  v_roll integer;
  v_outcome text;
  v_payout_host bigint := 0;
  v_payout_guest bigint := 0;
  v_summary text;
  v_result jsonb;
  v_guest_name text;
  v_host_round uuid := gen_random_uuid();
  v_guest_round uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select * into v_room from public.casino_pvp_rooms where id=p_room_id for update;
  if not found or v_room.status<>'open' then raise exception 'room_unavailable'; end if;
  if v_room.host_user_id=v_user_id then raise exception 'cannot_join_own_room'; end if;
  if v_room.visibility='private' and upper(trim(coalesce(p_code,'')))<>v_room.join_code then raise exception 'invalid_code'; end if;

  insert into public.casino_wallets(user_id) values(v_user_id) on conflict(user_id) do nothing;
  update public.casino_wallets set balance=balance-v_room.wager,updated_at=now()
  where user_id=v_user_id and balance>=v_room.wager returning balance into v_balance_guest;
  if not found then raise exception 'insufficient_balance'; end if;
  v_guest_name := coalesce(public.casino_display_name_v108(v_user_id),'Citoyen Nostra');

  if v_room.game='poker' then
    select array_agg(card order by rnd) into v_deck
    from (select card,random() rnd from generate_series(0,51) as gs(card) order by rnd limit 9) shuffled;
    v_host_cards:=array[v_deck[1],v_deck[2]];
    v_guest_cards:=array[v_deck[3],v_deck[4]];
    v_board:=array[v_deck[5],v_deck[6],v_deck[7],v_deck[8],v_deck[9]];
    v_host_score:=public.casino_poker_score_v116(v_host_cards||v_board);
    v_guest_score:=public.casino_poker_score_v116(v_guest_cards||v_board);
    if v_host_score>v_guest_score then v_payout_host:=v_room.wager*2; v_summary:=v_room.host_name||' remporte le duel de poker';
    elsif v_guest_score>v_host_score then v_payout_guest:=v_room.wager*2; v_summary:=v_guest_name||' remporte le duel de poker';
    else v_payout_host:=v_room.wager;v_payout_guest:=v_room.wager;v_summary:='Égalité : le pot est partagé'; end if;
    v_result:=jsonb_build_object('summary',v_summary,'host_cards',v_host_cards,'guest_cards',v_guest_cards,'board',v_board);
  elsif v_room.game='coinflip' then
    v_outcome:=case when random()<0.5 then 'heads' else 'tails' end;
    if v_outcome=v_room.choice_host then v_payout_host:=v_room.wager*2;v_summary:=v_room.host_name||' gagne sur '||case when v_outcome='heads' then 'Pile' else 'Face' end;
    else v_payout_guest:=v_room.wager*2;v_summary:=v_guest_name||' gagne sur '||case when v_outcome='heads' then 'Pile' else 'Face' end; end if;
    v_result:=jsonb_build_object('summary',v_summary,'outcome',v_outcome,'host_choice',v_room.choice_host);
  else
    v_roll:=2+floor(random()*11)::integer;
    if v_roll=7 then v_payout_host:=v_room.wager;v_payout_guest:=v_room.wager;v_summary:='Le 7 partage la mise';
    elsif (v_room.choice_host='under' and v_roll<7) or (v_room.choice_host='over' and v_roll>7) then v_payout_host:=v_room.wager*2;v_summary:=v_room.host_name||' gagne avec '||v_roll;
    else v_payout_guest:=v_room.wager*2;v_summary:=v_guest_name||' gagne avec '||v_roll; end if;
    v_result:=jsonb_build_object('summary',v_summary,'number',v_roll,'host_choice',v_room.choice_host);
  end if;

  update public.casino_wallets set balance=balance+v_payout_host,lifetime_wagered=lifetime_wagered+v_room.wager,lifetime_won=lifetime_won+v_payout_host,games_played=games_played+1,biggest_win=greatest(biggest_win,v_payout_host),xp=xp+greatest(10,least(250,floor(v_room.wager::numeric/10)::bigint)),updated_at=now()
  where user_id=v_room.host_user_id returning balance into v_balance_host;
  update public.casino_wallets set balance=balance+v_payout_guest,lifetime_wagered=lifetime_wagered+v_room.wager,lifetime_won=lifetime_won+v_payout_guest,games_played=games_played+1,biggest_win=greatest(biggest_win,v_payout_guest),xp=xp+greatest(10,least(250,floor(v_room.wager::numeric/10)::bigint)),updated_at=now()
  where user_id=v_user_id returning balance into v_balance_guest;

  insert into public.casino_game_rounds(id,user_id,game,wager,payout,status,result,settled_at) values
    (v_host_round,v_room.host_user_id,v_room.game,v_room.wager,v_payout_host,'settled',v_result||jsonb_build_object('mode','citizens','side','host','room_id',v_room.id),now()),
    (v_guest_round,v_user_id,v_room.game,v_room.wager,v_payout_guest,'settled',v_result||jsonb_build_object('mode','citizens','side','guest','room_id',v_room.id),now());
  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(v_user_id,'table_buyin',-v_room.wager,v_balance_guest-v_payout_guest,'Mise défi citoyen '||v_room.game,v_room.id);
  if v_payout_host>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(v_room.host_user_id,'table_cashout',v_payout_host,v_balance_host,'Gain défi citoyen '||v_room.game,v_room.id); end if;
  if v_payout_guest>0 then insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id) values(v_user_id,'table_cashout',v_payout_guest,v_balance_guest,'Gain défi citoyen '||v_room.game,v_room.id); end if;

  update public.casino_pvp_rooms set guest_user_id=v_user_id,guest_name=v_guest_name,status='finished',result=v_result,payout_host=v_payout_host,payout_guest=v_payout_guest,finished_at=now() where id=v_room.id;
  return v_result||jsonb_build_object('payout_host',v_payout_host,'payout_guest',v_payout_guest,'balance',v_balance_guest,'finished',true);
end;
$$;

create or replace function public.casino_pvp_lobby_v116()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance bigint;
  v_rooms jsonb;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  select balance into v_balance from public.casino_wallets where user_id=v_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',room.id,'game',room.game,'host_name',room.host_name,'guest_name',room.guest_name,
    'wager',room.wager,'visibility',room.visibility,
    'join_code',case when room.host_user_id=v_user_id then room.join_code else null end,
    'choice_host',room.choice_host,'status',room.status,'result',room.result,
    'payout_host',room.payout_host,'payout_guest',room.payout_guest,
    'is_host',room.host_user_id=v_user_id,'is_guest',room.guest_user_id=v_user_id,
    'created_at',room.created_at,'finished_at',room.finished_at
  ) order by room.created_at desc),'[]'::jsonb)
  into v_rooms
  from (
    select * from public.casino_pvp_rooms
    where (status='open' and visibility='public') or host_user_id=v_user_id or guest_user_id=v_user_id
    order by created_at desc limit 40
  ) room;
  return jsonb_build_object('rooms',v_rooms,'balance',coalesce(v_balance,0));
end;
$$;

create or replace function public.casino_pvp_join_code_v116(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select id into v_room_id from public.casino_pvp_rooms
  where join_code=upper(trim(coalesce(p_code,''))) and visibility='private' and status='open';
  if not found then raise exception 'invalid_code'; end if;
  return public.casino_pvp_join_v116(v_room_id,p_code);
end;
$$;

revoke all on function public.casino_poker_five_score_v116(integer[]) from public,anon,authenticated;
revoke all on function public.casino_poker_score_v116(integer[]) from public,anon,authenticated;
revoke all on function public.casino_pvp_recover_v116() from public,anon;
revoke all on function public.casino_pvp_create_v116(text,bigint,text,text) from public,anon;
revoke all on function public.casino_pvp_cancel_v116(uuid) from public,anon;
revoke all on function public.casino_pvp_join_v116(uuid,text) from public,anon;
revoke all on function public.casino_pvp_lobby_v116() from public,anon;
revoke all on function public.casino_pvp_join_code_v116(text) from public,anon;
grant execute on function public.casino_pvp_recover_v116() to authenticated;
grant execute on function public.casino_pvp_create_v116(text,bigint,text,text) to authenticated;
grant execute on function public.casino_pvp_cancel_v116(uuid) to authenticated;
grant execute on function public.casino_pvp_join_v116(uuid,text) to authenticated;
grant execute on function public.casino_pvp_lobby_v116() to authenticated;
grant execute on function public.casino_pvp_join_code_v116(text) to authenticated;

-- Le reset total V114 inclut désormais aussi tous les salons citoyens.
create or replace function public.casino_admin_opening_reset_v114(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.is_nostra_manager() and coalesce(public.nostra_jwt_discord_id(),'')<>'331843410962939908' then raise exception 'forbidden'; end if;
  if coalesce(p_confirmation,'')<>'OUVRIR LE CASINO A ZERO' then raise exception 'invalid_confirmation'; end if;
  truncate table public.casino_pvp_rooms,public.casino_poker_seats,public.casino_active_games,public.casino_transactions,public.casino_game_rounds,public.casino_conversion_requests,public.casino_poker_tables,public.casino_wallets restart identity;
  if exists(select 1 from public.casino_pvp_rooms) or exists(select 1 from public.casino_transactions) or exists(select 1 from public.casino_game_rounds) or exists(select 1 from public.casino_conversion_requests) or exists(select 1 from public.casino_wallets) then raise exception 'casino_reset_incomplete'; end if;
  return jsonb_build_object('complete',true,'purchases',0,'transactions',0,'rounds',0,'wallets',0,'players',0,'multiplayer_rooms',0,'total_wagered',0,'total_paid',0,'house_result',0,'real_rtp_percent',0,'settings_preserved',true,'rp_database_modified',false);
end;
$$;

revoke all on function public.casino_admin_opening_reset_v114(text) from public,anon;
grant execute on function public.casino_admin_opening_reset_v114(text) to authenticated;

select 'V116 prête' as status, count(*) as salons_citoyens from public.casino_pvp_rooms;
