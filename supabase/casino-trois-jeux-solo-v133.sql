-- Nostra Group · Le Cercle Nostra · V133
-- À exécuter une seule fois après la V132.
-- Hi-Lo, Gratte-ciel et Memory Casino.

begin;

alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v115;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v119;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v131;
alter table public.casino_game_settings drop constraint if exists casino_game_settings_game_check_v133;
alter table public.casino_game_settings add constraint casino_game_settings_game_check_v133 check (game in (
  'poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat',
  'mines','mystery_boxes','horse_racing','slots_tournament','card_battle','hi_lo','skyscraper','memory'
));

alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v115;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v119;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v131;
alter table public.casino_game_rounds drop constraint if exists casino_game_rounds_game_check_v133;
alter table public.casino_game_rounds add constraint casino_game_rounds_game_check_v133 check (game in (
  'poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat',
  'mines','mystery_boxes','horse_racing','slots_tournament','card_battle','hi_lo','skyscraper','memory'
));

alter table public.casino_active_games drop constraint if exists casino_active_games_game_check;
alter table public.casino_active_games drop constraint if exists casino_active_games_game_check_v115;
alter table public.casino_active_games drop constraint if exists casino_active_games_game_check_v131;
alter table public.casino_active_games drop constraint if exists casino_active_games_game_check_v133;
alter table public.casino_active_games add constraint casino_active_games_game_check_v133
  check (game in ('poker','blackjack','double_or_quit','mines','hi_lo','skyscraper','memory'));

insert into public.casino_game_settings
  (game,enabled,difficulty,win_rate_percent,min_bet,max_bet,base_multiplier,jackpot_multiplier,max_payout,sort_order)
values
  ('hi_lo',true,'hard',46,25,25000,1.45,8,250000,15),
  ('skyscraper',true,'hard',42,25,25000,1.6,12,300000,16),
  ('memory',true,'hard',50,25,20000,2,8,200000,17)
on conflict(game) do nothing;

create or replace function public.casino_begin_game_v108(p_game text,p_wager bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_balance bigint;v_config public.casino_game_settings%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  if p_game not in ('poker','blackjack','double_or_quit','mines','hi_lo','skyscraper','memory') or p_wager<1 then raise exception 'invalid_game';end if;
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
  if p_game not in ('poker','blackjack','roulette','slots','dice','plinko','coinflip','double_or_quit','baccarat','mines','mystery_boxes','horse_racing','slots_tournament','card_battle','hi_lo','skyscraper','memory')
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

create or replace function public.casino_abandon_active_game_v132(p_game text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user_id uuid := auth.uid();
  v_active public.casino_active_games%rowtype;
  v_round public.casino_game_rounds%rowtype;
  v_balance bigint := 0;
  v_abandoned boolean := false;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if p_game not in ('poker','blackjack','double_or_quit','mines','hi_lo','skyscraper','memory') then raise exception 'invalid_game'; end if;

  select * into v_active from public.casino_active_games
  where user_id=v_user_id and game=p_game for update;

  if found then
    select * into v_round from public.casino_game_rounds
    where id=v_active.round_id and user_id=v_user_id and status='pending' for update;
  else
    select * into v_round from public.casino_game_rounds
    where user_id=v_user_id and game=p_game and status='pending'
    order by created_at desc limit 1 for update;
  end if;

  if found then
    update public.casino_game_rounds
    set status='settled',payout=0,
        result=coalesce(result,'{}'::jsonb)||jsonb_build_object('result','abandoned','summary','Partie quittée · jetons engagés perdus','abandoned',true),
        settled_at=now()
    where id=v_round.id and status='pending';
    if found then
      v_abandoned:=true;
      update public.casino_wallets set games_played=games_played+1,updated_at=now() where user_id=v_user_id;
    end if;
  end if;

  delete from public.casino_active_games where user_id=v_user_id and game=p_game;
  select coalesce(balance,0) into v_balance from public.casino_wallets where user_id=v_user_id;
  return jsonb_build_object('abandoned',v_abandoned,'game',p_game,'balance',coalesce(v_balance,0),'refunded',false);
end;$$;

create or replace function public.casino_recover_stale_rounds_v108()
returns integer language plpgsql security definer set search_path=public as $$
declare v_round record;v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication_required';end if;
  for v_round in
    select r.id,r.user_id,r.game from public.casino_game_rounds r
    left join public.casino_active_games a on a.round_id=r.id
    where r.status='pending'
      and r.game in ('poker','blackjack','double_or_quit','mines','hi_lo','skyscraper','memory')
      and coalesce(a.updated_at,r.created_at)<now()-interval '30 minutes'
    for update of r skip locked
  loop
    update public.casino_game_rounds
    set status='settled',payout=0,
        result=coalesce(result,'{}'::jsonb)||jsonb_build_object('result','abandoned','summary','Partie interrompue · jetons engagés perdus','abandoned',true,'automatic',true),
        settled_at=now()
    where id=v_round.id and status='pending';
    if found then
      delete from public.casino_active_games where round_id=v_round.id;
      update public.casino_wallets set games_played=games_played+1,updated_at=now() where user_id=v_round.user_id;
      v_count:=v_count+1;
    end if;
  end loop;
  return v_count;
end;$$;

revoke all on function public.casino_begin_game_v108(text,bigint) from public,anon;
revoke all on function public.casino_update_game_settings_v110(text,boolean,text,numeric,bigint,bigint,numeric,numeric,bigint) from public,anon;
revoke all on function public.casino_abandon_active_game_v132(text) from public,anon;
revoke all on function public.casino_recover_stale_rounds_v108() from public,anon;
grant execute on function public.casino_begin_game_v108(text,bigint) to authenticated;
grant execute on function public.casino_update_game_settings_v110(text,boolean,text,numeric,bigint,bigint,numeric,numeric,bigint) to authenticated;
grant execute on function public.casino_abandon_active_game_v132(text) to authenticated;
grant execute on function public.casino_recover_stale_rounds_v108() to authenticated;

notify pgrst,'reload schema';
commit;

select 'V133 prête · Hi-Lo, Gratte-ciel et Memory Casino' as status;
