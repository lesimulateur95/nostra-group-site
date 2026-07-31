-- Nostra Group · Le Cercle Nostra · V108
-- Exécuter une seule fois dans Supabase → SQL Editor.
-- Le casino est MASQUÉ par défaut après l'installation.

create extension if not exists pgcrypto;

create table if not exists public.casino_settings (
  id smallint primary key default 1 check (id = 1),
  public_enabled boolean not null default false,
  name text not null default 'Le Cercle Nostra',
  subtitle text not null default 'Maison de jeux privée',
  rp_per_chip bigint not null default 1000 check (rp_per_chip > 0),
  min_conversion bigint not null default 100 check (min_conversion > 0),
  max_conversion bigint not null default 100000 check (max_conversion >= min_conversion),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.casino_settings (id, public_enabled)
values (1, false)
on conflict (id) do nothing;

create table if not exists public.casino_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  lifetime_wagered bigint not null default 0 check (lifetime_wagered >= 0),
  lifetime_won bigint not null default 0 check (lifetime_won >= 0),
  games_played bigint not null default 0 check (games_played >= 0),
  biggest_win bigint not null default 0 check (biggest_win >= 0),
  xp bigint not null default 0 check (xp >= 0),
  level integer generated always as (greatest(1, floor(xp::numeric / 1000)::integer + 1)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.casino_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('conversion','wager','payout','adjustment','refund','table_buyin','table_cashout')),
  amount bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  label text not null,
  reference_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists casino_transactions_user_created_idx
on public.casino_transactions (user_id, created_at desc);

create table if not exists public.casino_conversion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rp_amount bigint not null check (rp_amount > 0),
  chip_amount bigint not null check (chip_amount > 0),
  rate bigint not null check (rate > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists casino_one_pending_conversion_per_user
on public.casino_conversion_requests (user_id)
where status = 'pending';

create table if not exists public.casino_game_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('poker','blackjack','roulette','slots','dice','plinko','coinflip')),
  wager bigint not null check (wager > 0),
  payout bigint not null default 0 check (payout >= 0),
  status text not null default 'pending' check (status in ('pending','settled','refunded')),
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create unique index if not exists casino_one_pending_round_per_game
on public.casino_game_rounds (user_id, game)
where status = 'pending';

create index if not exists casino_rounds_user_created_idx
on public.casino_game_rounds (user_id, created_at desc);

-- Les états complets (cartes cachées et paquet) ne sont jamais lisibles par le navigateur.
create table if not exists public.casino_active_games (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null check (game in ('poker','blackjack')),
  round_id uuid not null references public.casino_game_rounds(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);

-- Structure prête pour les futures tables publiques/privées multijoueur.
create table if not exists public.casino_poker_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  visibility text not null default 'public' check (visibility in ('public','private')),
  access_code_hash text,
  small_blind bigint not null default 25 check (small_blind > 0),
  big_blind bigint not null default 50 check (big_blind >= small_blind),
  min_buy_in bigint not null default 1000 check (min_buy_in > 0),
  max_players integer not null default 8 check (max_players between 2 and 8),
  status text not null default 'waiting' check (status in ('waiting','playing','paused','closed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.casino_poker_seats (
  table_id uuid not null references public.casino_poker_tables(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seat_no integer not null check (seat_no between 1 and 8),
  stack bigint not null check (stack >= 0),
  joined_at timestamptz not null default now(),
  primary key (table_id, user_id),
  unique (table_id, seat_no)
);

alter table public.casino_settings enable row level security;
alter table public.casino_wallets enable row level security;
alter table public.casino_transactions enable row level security;
alter table public.casino_conversion_requests enable row level security;
alter table public.casino_game_rounds enable row level security;
alter table public.casino_active_games enable row level security;
alter table public.casino_poker_tables enable row level security;
alter table public.casino_poker_seats enable row level security;

drop policy if exists "casino settings readable" on public.casino_settings;
create policy "casino settings readable" on public.casino_settings for select to authenticated using (true);

drop policy if exists "casino own transactions readable" on public.casino_transactions;
create policy "casino own transactions readable" on public.casino_transactions for select to authenticated using (user_id = auth.uid());

drop policy if exists "casino own conversions readable" on public.casino_conversion_requests;
create policy "casino own conversions readable" on public.casino_conversion_requests for select to authenticated using (user_id = auth.uid() or public.is_nostra_manager());

drop policy if exists "casino own rounds readable" on public.casino_game_rounds;
create policy "casino own rounds readable" on public.casino_game_rounds for select to authenticated using (user_id = auth.uid());

drop policy if exists "casino poker lobby readable" on public.casino_poker_tables;
create policy "casino poker lobby readable" on public.casino_poker_tables for select to authenticated using (visibility = 'public' or created_by = auth.uid() or public.is_nostra_manager());

drop policy if exists "casino poker seats readable" on public.casino_poker_seats;
create policy "casino poker seats readable" on public.casino_poker_seats for select to authenticated using (
  exists (select 1 from public.casino_poker_tables t where t.id = table_id and (t.visibility = 'public' or t.created_by = auth.uid() or public.is_nostra_manager()))
);

create or replace function public.casino_display_name_v108(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(btrim(concat_ws(' ', mp.rp_first_name, mp.rp_last_name)), ''),
    nullif(mp.steam_name, ''),
    'Joueur privé'
  )
  from public.member_profiles mp
  where mp.user_id = p_user_id
  limit 1;
$$;

create or replace function public.casino_my_wallet_v108()
returns table (
  balance bigint,
  lifetime_wagered bigint,
  lifetime_won bigint,
  games_played bigint,
  biggest_win bigint,
  xp bigint,
  level integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  insert into public.casino_wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  return query
  select w.balance, w.lifetime_wagered, w.lifetime_won, w.games_played, w.biggest_win, w.xp, w.level
  from public.casino_wallets w where w.user_id = auth.uid();
end;
$$;

create or replace function public.casino_request_conversion_v108(p_chip_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.casino_settings%rowtype;
  v_id uuid;
  v_rp_amount bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select * into v_settings from public.casino_settings where id = 1;
  if not found then raise exception 'casino_not_configured'; end if;
  if p_chip_amount < v_settings.min_conversion or p_chip_amount > v_settings.max_conversion then raise exception 'invalid_amount'; end if;
  if exists (select 1 from public.casino_conversion_requests where user_id = auth.uid() and status = 'pending') then raise exception 'pending_exists'; end if;
  v_rp_amount := p_chip_amount * v_settings.rp_per_chip;
  insert into public.casino_conversion_requests (user_id, rp_amount, chip_amount, rate)
  values (auth.uid(), v_rp_amount, p_chip_amount, v_settings.rp_per_chip)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'rp_amount', v_rp_amount, 'chip_amount', p_chip_amount, 'status', 'pending');
end;
$$;

create or replace function public.casino_update_settings_v108(
  p_public_enabled boolean,
  p_name text,
  p_subtitle text,
  p_rp_per_chip bigint,
  p_min_conversion bigint,
  p_max_conversion bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(p_name,''))) < 3 or p_rp_per_chip < 1 or p_min_conversion < 1 or p_max_conversion < p_min_conversion then raise exception 'invalid_settings'; end if;
  update public.casino_settings set
    public_enabled = p_public_enabled,
    name = left(btrim(p_name), 80),
    subtitle = left(btrim(coalesce(p_subtitle,'')), 120),
    rp_per_chip = p_rp_per_chip,
    min_conversion = p_min_conversion,
    max_conversion = p_max_conversion,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;
  return true;
end;
$$;

create or replace function public.casino_review_conversion_v108(p_request_id uuid, p_decision text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.casino_conversion_requests%rowtype;
  v_balance bigint;
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'invalid_decision'; end if;
  select * into v_request from public.casino_conversion_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then raise exception 'request_not_pending'; end if;
  update public.casino_conversion_requests set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now() where id = p_request_id;
  if p_decision = 'approved' then
    insert into public.casino_wallets (user_id, balance) values (v_request.user_id, v_request.chip_amount)
    on conflict (user_id) do update set balance = casino_wallets.balance + excluded.balance, updated_at = now()
    returning balance into v_balance;
    insert into public.casino_transactions (user_id, kind, amount, balance_after, label, reference_id, created_by)
    values (v_request.user_id, 'conversion', v_request.chip_amount, v_balance, 'Conversion validée depuis le Dashboard', v_request.id, auth.uid());
  end if;
  return true;
end;
$$;

create or replace function public.casino_adjust_wallet_v108(p_user_id uuid, p_amount bigint, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_balance bigint;
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  if p_amount = 0 or length(btrim(coalesce(p_reason,''))) < 3 then raise exception 'invalid_adjustment'; end if;
  insert into public.casino_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.casino_wallets set balance = balance + p_amount, updated_at = now()
  where user_id = p_user_id and balance + p_amount >= 0
  returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;
  insert into public.casino_transactions (user_id, kind, amount, balance_after, label, created_by)
  values (p_user_id, 'adjustment', p_amount, v_balance, left(btrim(p_reason),180), auth.uid());
  return true;
end;
$$;

create or replace function public.casino_begin_game_v108(p_game text, p_wager bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_balance bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_game not in ('poker','blackjack') or p_wager < 1 then raise exception 'invalid_game'; end if;
  if exists (select 1 from public.casino_game_rounds where user_id = auth.uid() and game = p_game and status = 'pending') then raise exception 'active_game_exists'; end if;
  insert into public.casino_wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.casino_wallets set balance = balance - p_wager, lifetime_wagered = lifetime_wagered + p_wager, updated_at = now()
  where user_id = auth.uid() and balance >= p_wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;
  insert into public.casino_game_rounds (user_id, game, wager) values (auth.uid(), p_game, p_wager) returning id into v_id;
  insert into public.casino_transactions (user_id, kind, amount, balance_after, label, reference_id)
  values (auth.uid(), 'wager', -p_wager, v_balance, 'Mise ' || p_game, v_id);
  return v_id;
end;
$$;

create or replace function public.casino_server_settle_v108(p_user_id uuid, p_round_id uuid, p_payout bigint, p_result jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_round public.casino_game_rounds%rowtype; v_balance bigint;
begin
  if p_payout < 0 then raise exception 'invalid_payout'; end if;
  select * into v_round from public.casino_game_rounds where id = p_round_id and user_id = p_user_id for update;
  if not found or v_round.status <> 'pending' then raise exception 'round_not_pending'; end if;
  update public.casino_game_rounds set payout = p_payout, result = coalesce(p_result,'{}'::jsonb), status = 'settled', settled_at = now() where id = p_round_id;
  update public.casino_wallets set
    balance = balance + p_payout,
    lifetime_won = lifetime_won + p_payout,
    games_played = games_played + 1,
    biggest_win = greatest(biggest_win, p_payout),
    xp = xp + greatest(10, least(250, floor(v_round.wager::numeric / 10)::bigint)),
    updated_at = now()
  where user_id = p_user_id returning balance into v_balance;
  if p_payout > 0 then
    insert into public.casino_transactions (user_id, kind, amount, balance_after, label, reference_id)
    values (p_user_id, 'payout', p_payout, v_balance, 'Gain ' || v_round.game, p_round_id);
  end if;
  return true;
end;
$$;

revoke all on function public.casino_server_settle_v108(uuid,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.casino_server_settle_v108(uuid,uuid,bigint,jsonb) to service_role;

-- Une coupure entre la mise et l'affichage ne bloque jamais définitivement le joueur.
-- Après 15 minutes, la mise d'une partie restée inachevée est remboursée automatiquement.
create or replace function public.casino_recover_stale_rounds_v108()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_round record; v_balance bigint; v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  for v_round in
    select id, game, wager from public.casino_game_rounds
    where user_id = auth.uid() and status = 'pending' and created_at < now() - interval '15 minutes'
    for update
  loop
    update public.casino_game_rounds set status='refunded', payout=v_round.wager, result=jsonb_build_object('result','Remboursement automatique'), settled_at=now() where id=v_round.id;
    update public.casino_wallets set balance=balance+v_round.wager, updated_at=now() where user_id=auth.uid() returning balance into v_balance;
    delete from public.casino_active_games where user_id=auth.uid() and round_id=v_round.id;
    insert into public.casino_transactions (user_id,kind,amount,balance_after,label,reference_id) values (auth.uid(),'refund',v_round.wager,v_balance,'Remboursement partie interrompue '||v_round.game,v_round.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.casino_play_simple_v108(p_game text, p_wager bigint, p_choice text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_balance bigint;
  v_payout bigint := 0;
  v_result jsonb := '{}'::jsonb;
  v_number integer;
  v_symbols text[] := array['◆','♠','✦','7','♛','●'];
  v_a text; v_b text; v_c text;
  v_multiplier numeric := 0;
  v_red integer[] := array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_game not in ('roulette','slots','dice','plinko','coinflip') or p_wager < 1 then raise exception 'invalid_game'; end if;
  insert into public.casino_wallets (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  update public.casino_wallets set balance = balance - p_wager, lifetime_wagered = lifetime_wagered + p_wager, updated_at = now()
  where user_id = auth.uid() and balance >= p_wager returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;

  if p_game = 'roulette' then
    v_number := floor(random() * 37)::integer;
    if (p_choice = 'green' and v_number = 0) then v_multiplier := 36;
    elsif (p_choice = 'red' and v_number = any(v_red)) then v_multiplier := 2;
    elsif (p_choice = 'black' and v_number > 0 and not (v_number = any(v_red))) then v_multiplier := 2;
    elsif (p_choice = 'even' and v_number > 0 and mod(v_number,2)=0) then v_multiplier := 2;
    elsif (p_choice = 'odd' and mod(v_number,2)=1) then v_multiplier := 2;
    elsif (p_choice = 'low' and v_number between 1 and 18) then v_multiplier := 2;
    elsif (p_choice = 'high' and v_number between 19 and 36) then v_multiplier := 2;
    elsif p_choice like 'number:%' and split_part(p_choice,':',2)::integer = v_number then v_multiplier := 36;
    end if;
    v_payout := floor(p_wager * v_multiplier)::bigint;
    v_result := jsonb_build_object('number',v_number,'result',case when v_payout>0 then 'Mise gagnante' else 'La bille tombe sur '||v_number end,'multiplier',v_multiplier);
  elsif p_game = 'slots' then
    v_a := v_symbols[1 + floor(random()*array_length(v_symbols,1))::integer];
    v_b := v_symbols[1 + floor(random()*array_length(v_symbols,1))::integer];
    v_c := v_symbols[1 + floor(random()*array_length(v_symbols,1))::integer];
    if v_a = v_b and v_b = v_c then v_multiplier := case v_a when '7' then 25 when '✦' then 15 when '◆' then 10 else 7 end;
    elsif v_a = v_b or v_b = v_c or v_a = v_c then v_multiplier := 2;
    end if;
    v_payout := floor(p_wager*v_multiplier)::bigint;
    v_result := jsonb_build_object('symbols',jsonb_build_array(v_a,v_b,v_c),'result',case when v_multiplier>=10 then 'Jackpot !' when v_payout>0 then 'Combinaison gagnante' else 'Aucune combinaison' end,'multiplier',v_multiplier);
  elsif p_game = 'dice' then
    v_number := floor(random()*100)::integer;
    if (p_choice='under' and v_number<50) or (p_choice='over' and v_number>=50) then v_multiplier:=1.9; end if;
    v_payout:=floor(p_wager*v_multiplier)::bigint;
    v_result:=jsonb_build_object('number',v_number,'result',case when v_payout>0 then 'Prédiction correcte' else 'Prédiction manquée' end,'multiplier',v_multiplier);
  elsif p_game = 'coinflip' then
    v_number:=floor(random()*2)::integer;
    v_a:=case when v_number=0 then 'heads' else 'tails' end;
    if p_choice=v_a then v_multiplier:=1.95; end if;
    v_payout:=floor(p_wager*v_multiplier)::bigint;
    v_result:=jsonb_build_object('outcome',v_a,'result',case when v_payout>0 then 'Bon côté !' else 'Mauvais côté' end,'multiplier',v_multiplier);
  else
    v_number:=floor(random()*100)::integer;
    if p_choice='low' then v_multiplier:=(array[0.5,0.8,1,1.2,1.5])[1+floor(random()*5)::integer];
    elsif p_choice='high' then v_multiplier:=(array[0,0.25,0.5,2,5,12])[1+floor(random()*6)::integer];
    else v_multiplier:=(array[0.25,0.5,0.8,1.5,2,4])[1+floor(random()*6)::integer]; end if;
    v_payout:=floor(p_wager*v_multiplier)::bigint;
    v_result:=jsonb_build_object('number',v_number,'result','Multiplicateur ×'||v_multiplier,'multiplier',v_multiplier);
  end if;

  update public.casino_wallets set balance=balance+v_payout, lifetime_won=lifetime_won+v_payout, games_played=games_played+1, biggest_win=greatest(biggest_win,v_payout), xp=xp+greatest(10,least(250,floor(p_wager::numeric/10)::bigint)), updated_at=now()
  where user_id=auth.uid() returning balance into v_balance;
  insert into public.casino_game_rounds (id,user_id,game,wager,payout,status,result,settled_at) values (v_id,auth.uid(),p_game,p_wager,v_payout,'settled',v_result,now());
  insert into public.casino_transactions (user_id,kind,amount,balance_after,label,reference_id) values (auth.uid(),'wager',-p_wager,v_balance-v_payout,'Mise '||p_game,v_id);
  if v_payout>0 then insert into public.casino_transactions (user_id,kind,amount,balance_after,label,reference_id) values (auth.uid(),'payout',v_payout,v_balance,'Gain '||p_game,v_id); end if;
  return v_result || jsonb_build_object('payout',v_payout,'balance',v_balance,'finished',true);
end;
$$;

create or replace function public.casino_leaderboard_v108(p_limit integer default 10)
returns table (user_id uuid, display_name text, games_played bigint, lifetime_won bigint, biggest_win bigint, level integer)
language sql
stable
security definer
set search_path = public
as $$
  select w.user_id, coalesce(public.casino_display_name_v108(w.user_id),'Joueur privé'), w.games_played, w.lifetime_won, w.biggest_win, w.level
  from public.casino_wallets w where w.games_played > 0
  order by w.biggest_win desc, w.lifetime_won desc
  limit greatest(1,least(coalesce(p_limit,10),50));
$$;

create or replace function public.casino_admin_overview_v108()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'conversions', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'user_id',r.user_id,'display_name',coalesce(public.casino_display_name_v108(r.user_id),'Citoyen Nostra'),'rp_amount',r.rp_amount,'chip_amount',r.chip_amount,'status',r.status,'created_at',r.created_at) order by r.created_at desc) from public.casino_conversion_requests r where r.status='pending'),'[]'::jsonb),
    'wallets', coalesce((select jsonb_agg(jsonb_build_object('user_id',w.user_id,'display_name',coalesce(public.casino_display_name_v108(w.user_id),'Citoyen Nostra'),'balance',w.balance,'lifetime_wagered',w.lifetime_wagered,'lifetime_won',w.lifetime_won,'games_played',w.games_played,'biggest_win',w.biggest_win,'xp',w.xp,'level',w.level) order by w.balance desc) from public.casino_wallets w),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.casino_my_wallet_v108() to authenticated;
grant execute on function public.casino_request_conversion_v108(bigint) to authenticated;
grant execute on function public.casino_update_settings_v108(boolean,text,text,bigint,bigint,bigint) to authenticated;
grant execute on function public.casino_review_conversion_v108(uuid,text) to authenticated;
grant execute on function public.casino_adjust_wallet_v108(uuid,bigint,text) to authenticated;
grant execute on function public.casino_begin_game_v108(text,bigint) to authenticated;
grant execute on function public.casino_recover_stale_rounds_v108() to authenticated;
grant execute on function public.casino_play_simple_v108(text,bigint,text) to authenticated;
grant execute on function public.casino_leaderboard_v108(integer) to authenticated;
grant execute on function public.casino_admin_overview_v108() to authenticated;

-- Realtime uniquement sur les éléments publics multijoueur (pas sur les cartes privées).
do $$ begin
  alter publication supabase_realtime add table public.casino_poker_tables;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.casino_poker_seats;
exception when duplicate_object then null; end $$;
