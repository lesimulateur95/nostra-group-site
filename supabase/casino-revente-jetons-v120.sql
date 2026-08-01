-- Nostra Group · Le Cercle Nostra · V120
-- À exécuter une seule fois APRÈS la V119 corrigée.
-- Revente sécurisée des jetons vers le compte bancaire principal en jeu.

begin;

alter table public.casino_settings
  add column if not exists cashout_enabled boolean not null default true,
  add column if not exists cashout_rp_per_chip bigint not null default 1000,
  add column if not exists min_cashout bigint not null default 100,
  add column if not exists max_cashout bigint not null default 100000;

-- La première installation reprend les valeurs d'achat déjà configurées.
update public.casino_settings
set cashout_rp_per_chip = rp_per_chip,
    min_cashout = min_conversion,
    max_cashout = max_conversion
where id = 1;

alter table public.casino_settings drop constraint if exists casino_settings_cashout_rate_check_v120;
alter table public.casino_settings drop constraint if exists casino_settings_cashout_limits_check_v120;
alter table public.casino_settings add constraint casino_settings_cashout_rate_check_v120
  check (cashout_rp_per_chip > 0 and cashout_rp_per_chip <= rp_per_chip);
alter table public.casino_settings add constraint casino_settings_cashout_limits_check_v120
  check (min_cashout > 0 and max_cashout >= min_cashout);

create table if not exists public.casino_cashout_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  steam_id text not null,
  rp_amount bigint not null check (rp_amount > 0),
  chip_amount bigint not null check (chip_amount > 0),
  rate bigint not null check (rate > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists casino_one_pending_cashout_per_user_v120
on public.casino_cashout_requests(user_id)
where status = 'pending';

create index if not exists casino_cashout_requests_user_created_v120
on public.casino_cashout_requests(user_id,created_at desc);

alter table public.casino_cashout_requests enable row level security;
drop policy if exists "casino own cashouts readable" on public.casino_cashout_requests;
create policy "casino own cashouts readable"
on public.casino_cashout_requests for select to authenticated
using (user_id = auth.uid() or public.is_nostra_manager());
revoke all on table public.casino_cashout_requests from public,anon;
grant select on table public.casino_cashout_requests to authenticated;

-- On remplace la contrainte quel que soit son ancien suffixe afin d'éviter
-- le même blocage de nom rencontré lors de l'installation du baccarat V119.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.casino_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.casino_transactions drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.casino_transactions add constraint casino_transactions_kind_check_v120
  check (kind in ('conversion','cashout','wager','payout','adjustment','refund','table_buyin','table_cashout'));

create or replace function public.casino_update_cashier_settings_v120(
  p_public_enabled boolean,
  p_name text,
  p_subtitle text,
  p_rp_per_chip bigint,
  p_min_conversion bigint,
  p_max_conversion bigint,
  p_cashout_enabled boolean,
  p_cashout_rp_per_chip bigint,
  p_min_cashout bigint,
  p_max_cashout bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  if length(btrim(coalesce(p_name,''))) < 3
     or p_rp_per_chip < 1
     or p_min_conversion < 1
     or p_max_conversion < p_min_conversion
     or p_cashout_rp_per_chip < 1
     or p_cashout_rp_per_chip > p_rp_per_chip
     or p_min_cashout < 1
     or p_max_cashout < p_min_cashout then
    raise exception 'invalid_settings';
  end if;

  update public.casino_settings set
    public_enabled = p_public_enabled,
    name = left(btrim(p_name),80),
    subtitle = left(btrim(coalesce(p_subtitle,'')),120),
    rp_per_chip = p_rp_per_chip,
    min_conversion = p_min_conversion,
    max_conversion = p_max_conversion,
    cashout_enabled = p_cashout_enabled,
    cashout_rp_per_chip = p_cashout_rp_per_chip,
    min_cashout = p_min_cashout,
    max_cashout = p_max_cashout,
    updated_at = now(),
    updated_by = auth.uid()
  where id = 1;
  return true;
end;
$$;

create or replace function public.casino_reserve_cashout_v120(
  p_request_id uuid,
  p_user_id uuid,
  p_steam_id text,
  p_rp_amount bigint,
  p_chip_amount bigint,
  p_rate bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.casino_settings%rowtype;
  v_balance bigint;
begin
  if p_request_id is null or p_user_id is null or length(btrim(coalesce(p_steam_id,''))) < 5 then
    raise exception 'invalid_cashout_identity';
  end if;
  if exists(select 1 from public.casino_cashout_requests where id = p_request_id) then
    raise exception 'cashout_reference_used';
  end if;
  if exists(select 1 from public.casino_cashout_requests where user_id = p_user_id and status = 'pending') then
    raise exception 'pending_cashout_exists';
  end if;

  select * into v_settings from public.casino_settings where id = 1;
  if not found or not v_settings.cashout_enabled then raise exception 'cashout_closed'; end if;
  if p_chip_amount < v_settings.min_cashout or p_chip_amount > v_settings.max_cashout then
    raise exception 'invalid_amount';
  end if;
  if p_rate <> v_settings.cashout_rp_per_chip or p_rp_amount <> p_chip_amount * p_rate then
    raise exception 'invalid_rate';
  end if;

  insert into public.casino_cashout_requests(
    id,user_id,steam_id,rp_amount,chip_amount,rate,status
  ) values (
    p_request_id,p_user_id,left(btrim(p_steam_id),80),p_rp_amount,p_chip_amount,p_rate,'pending'
  );

  update public.casino_wallets
  set balance = balance - p_chip_amount,
      updated_at = now()
  where user_id = p_user_id and balance >= p_chip_amount
  returning balance into v_balance;
  if not found then raise exception 'insufficient_balance'; end if;

  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(p_user_id,'cashout',-p_chip_amount,v_balance,'Jetons réservés pour revente vers le compte en jeu',p_request_id);

  return jsonb_build_object('id',p_request_id,'status','pending','balance',v_balance);
end;
$$;

create or replace function public.casino_complete_cashout_v120(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_request public.casino_cashout_requests%rowtype;
begin
  select * into v_request from public.casino_cashout_requests where id = p_request_id for update;
  if not found then raise exception 'cashout_not_found'; end if;
  if v_request.status = 'approved' then
    return jsonb_build_object('id',v_request.id,'status','approved','already_completed',true);
  end if;
  if v_request.status <> 'pending' then raise exception 'cashout_not_pending'; end if;

  update public.casino_cashout_requests
  set status = 'approved', completed_at = now(), failure_reason = null
  where id = p_request_id;

  return jsonb_build_object(
    'id',v_request.id,'status','approved','rp_amount',v_request.rp_amount,
    'chip_amount',v_request.chip_amount,'already_completed',false
  );
end;
$$;

create or replace function public.casino_reject_cashout_v120(p_request_id uuid,p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.casino_cashout_requests%rowtype;
  v_balance bigint;
begin
  select * into v_request from public.casino_cashout_requests where id = p_request_id for update;
  if not found then raise exception 'cashout_not_found'; end if;
  if v_request.status = 'rejected' then
    return jsonb_build_object('id',v_request.id,'status','rejected','already_refunded',true);
  end if;
  if v_request.status <> 'pending' then raise exception 'cashout_not_pending'; end if;

  update public.casino_wallets
  set balance = balance + v_request.chip_amount,
      updated_at = now()
  where user_id = v_request.user_id
  returning balance into v_balance;
  if not found then raise exception 'wallet_not_found'; end if;

  insert into public.casino_transactions(user_id,kind,amount,balance_after,label,reference_id)
  values(v_request.user_id,'refund',v_request.chip_amount,v_balance,'Revente impossible · jetons rendus',v_request.id);

  update public.casino_cashout_requests
  set status = 'rejected', failure_reason = left(coalesce(p_reason,'unknown'),180), completed_at = now()
  where id = v_request.id;

  return jsonb_build_object('id',v_request.id,'status','rejected','balance',v_balance,'already_refunded',false);
end;
$$;

-- Le Dashboard reçoit maintenant les achats et les reventes.
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
    'conversions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.user_id,
        'display_name',coalesce(public.casino_display_name_v108(r.user_id),'Citoyen Nostra'),
        'rp_amount',r.rp_amount,'chip_amount',r.chip_amount,'status',r.status,'created_at',r.created_at
      ) order by r.created_at desc)
      from (select * from public.casino_conversion_requests order by created_at desc limit 50) r
    ),'[]'::jsonb),
    'cashouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'user_id',r.user_id,
        'display_name',coalesce(public.casino_display_name_v108(r.user_id),'Citoyen Nostra'),
        'rp_amount',r.rp_amount,'chip_amount',r.chip_amount,'rate',r.rate,
        'status',r.status,'created_at',r.created_at
      ) order by r.created_at desc)
      from (select * from public.casino_cashout_requests order by created_at desc limit 50) r
    ),'[]'::jsonb),
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',w.user_id,
        'display_name',coalesce(public.casino_display_name_v108(w.user_id),'Citoyen Nostra'),
        'balance',w.balance,'lifetime_wagered',w.lifetime_wagered,
        'lifetime_won',w.lifetime_won,'games_played',w.games_played,
        'biggest_win',w.biggest_win,'xp',w.xp,'level',w.level
      ) order by w.balance desc)
      from public.casino_wallets w
    ),'[]'::jsonb)
  );
end;
$$;

-- La remise à zéro totale supprime également toutes les reventes de test.
create or replace function public.casino_admin_opening_reset_v114(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.is_nostra_manager() and coalesce(public.nostra_jwt_discord_id(),'') <> '331843410962939908' then raise exception 'forbidden'; end if;
  if coalesce(p_confirmation,'') <> 'OUVRIR LE CASINO A ZERO' then raise exception 'invalid_confirmation'; end if;
  truncate table public.casino_live_players,public.casino_live_tables,public.casino_pvp_rooms,
    public.casino_poker_seats,public.casino_active_games,public.casino_transactions,
    public.casino_game_rounds,public.casino_cashout_requests,public.casino_conversion_requests,
    public.casino_poker_tables,public.casino_wallets restart identity;
  return jsonb_build_object(
    'complete',true,'purchases',0,'cashouts',0,'transactions',0,'rounds',0,
    'wallets',0,'players',0,'multiplayer_rooms',0,'live_tables',0,
    'total_wagered',0,'total_paid',0,'house_result',0,'real_rtp_percent',0,
    'settings_preserved',true,'rp_database_modified',false
  );
end;
$$;

revoke all on function public.casino_update_cashier_settings_v120(boolean,text,text,bigint,bigint,bigint,boolean,bigint,bigint,bigint) from public,anon;
grant execute on function public.casino_update_cashier_settings_v120(boolean,text,text,bigint,bigint,bigint,boolean,bigint,bigint,bigint) to authenticated;

revoke all on function public.casino_reserve_cashout_v120(uuid,uuid,text,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.casino_complete_cashout_v120(uuid) from public,anon,authenticated;
revoke all on function public.casino_reject_cashout_v120(uuid,text) from public,anon,authenticated;
grant execute on function public.casino_reserve_cashout_v120(uuid,uuid,text,bigint,bigint,bigint) to service_role;
grant execute on function public.casino_complete_cashout_v120(uuid) to service_role;
grant execute on function public.casino_reject_cashout_v120(uuid,text) to service_role;
grant execute on function public.casino_admin_overview_v108() to authenticated;
grant execute on function public.casino_admin_opening_reset_v114(text) to authenticated;

commit;
notify pgrst,'reload schema';
select 'V120 prête · revente sécurisée des jetons vers le compte en jeu' as status;
