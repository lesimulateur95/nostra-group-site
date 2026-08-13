-- NOSTRA GROUP V155 — Expansion globale
-- Réexécutable. Aucun citoyen, commande, licence ou historique existant n'est supprimé.

begin;

-- ---------------------------------------------------------------------------
-- 0. Helper Direction
-- ---------------------------------------------------------------------------
create or replace function public.nostra_v155_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.nostra_role() = 'manager', false);
$$;
grant execute on function public.nostra_v155_is_manager() to authenticated;

create or replace function public.nostra_v155_is_motors_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.nostra_has_role('manager') or public.nostra_has_role('employee') or public.nostra_has_role('commercial'), false);
$$;
grant execute on function public.nostra_v155_is_motors_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Location Nostra Motors
-- ---------------------------------------------------------------------------
create table if not exists public.motors_rental_settings_v155 (
  vehicle_id bigint primary key references public.catalog_vehicles(id) on delete cascade,
  daily_rate numeric(14,2) not null default 0,
  deposit_amount numeric(14,2) not null default 0,
  min_days integer not null default 1 check (min_days >= 1),
  max_days integer not null default 30 check (max_days >= 1),
  mileage_included_per_day integer not null default 200,
  extra_km_price numeric(12,2) not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.motors_rental_bookings_v155 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id bigint not null references public.catalog_vehicles(id) on delete restrict,
  rental_number text not null unique,
  start_date date not null,
  end_date date not null,
  days integer not null check (days >= 1),
  daily_rate numeric(14,2) not null,
  deposit_amount numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','ready','active','returned','cancelled','rejected')),
  pickup_location text not null default 'Nostra Motors',
  mileage_out integer,
  mileage_in integer,
  condition_out text,
  condition_in text,
  damage_notes text,
  staff_notes text,
  contract_signed_at timestamptz,
  picked_up_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (end_date >= start_date)
);
create index if not exists motors_rental_booking_vehicle_dates_v155 on public.motors_rental_bookings_v155(vehicle_id,start_date,end_date,status);
create index if not exists motors_rental_booking_user_v155 on public.motors_rental_bookings_v155(user_id,created_at desc);

insert into public.motors_rental_settings_v155(vehicle_id,daily_rate,deposit_amount)
select id, greatest(coalesce(price,0),0), greatest(round(coalesce(price,0) * 0.25),0)
from public.catalog_vehicles
where coalesce(catalog_type,'standard') = 'concession'
on conflict (vehicle_id) do nothing;

create or replace function public.nostra_create_rental_v155(p_vehicle_id bigint, p_start_date date, p_end_date date)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_setting public.motors_rental_settings_v155%rowtype;
  v_vehicle public.catalog_vehicles%rowtype;
  v_days integer;
  v_id uuid;
  v_number text;
  v_overlap integer;
  v_stock integer;
begin
  if auth.uid() is null then raise exception using message='auth_required'; end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date or p_start_date < current_date then
    raise exception using message='invalid_dates';
  end if;
  select * into v_vehicle from public.catalog_vehicles where id=p_vehicle_id and published=true;
  if not found or coalesce(v_vehicle.catalog_type,'standard') <> 'concession' then raise exception using message='invalid_vehicle'; end if;
  select * into v_setting from public.motors_rental_settings_v155 where vehicle_id=p_vehicle_id and active=true;
  if not found then raise exception using message='rental_unavailable'; end if;
  v_days := (p_end_date-p_start_date)+1;
  if v_days < v_setting.min_days or v_days > v_setting.max_days then raise exception using message='invalid_duration'; end if;
  v_stock := greatest(coalesce(v_vehicle.stock_quantity,0),0);
  if v_stock <= 0 then raise exception using message='rental_unavailable'; end if;
  select count(*)::integer into v_overlap
  from public.motors_rental_bookings_v155
  where vehicle_id=p_vehicle_id and status in ('pending','confirmed','ready','active')
    and daterange(start_date,end_date,'[]') && daterange(p_start_date,p_end_date,'[]');
  if v_overlap >= v_stock then raise exception using message='dates_unavailable'; end if;
  if exists(select 1 from public.motors_vehicle_stock_v155 where vehicle_id=p_vehicle_id and operational_status in ('workshop','unavailable')) then
    raise exception using message='rental_unavailable';
  end if;
  v_number := 'NRL-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.motors_rental_bookings_v155(user_id,vehicle_id,rental_number,start_date,end_date,days,daily_rate,deposit_amount,total_amount)
  values(auth.uid(),p_vehicle_id,v_number,p_start_date,p_end_date,v_days,v_setting.daily_rate,v_setting.deposit_amount,round(v_setting.daily_rate*v_days,2))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.nostra_create_rental_v155(bigint,date,date) to authenticated;

create or replace function public.nostra_cancel_rental_v155(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception using message='auth_required'; end if;
  update public.motors_rental_bookings_v155
  set status='cancelled', updated_at=now()
  where id=p_booking_id and user_id=auth.uid() and status='pending';
  if not found then raise exception using message='rental_cannot_cancel'; end if;
  return true;
end $$;
grant execute on function public.nostra_cancel_rental_v155(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Stock réel Nostra Motors
-- ---------------------------------------------------------------------------
create table if not exists public.motors_vehicle_stock_v155 (
  vehicle_id bigint primary key references public.catalog_vehicles(id) on delete cascade,
  operational_status text not null default 'available' check (operational_status in ('available','reserved','rented','workshop','unavailable')),
  physical_location text not null default 'Concession Nostra Motors',
  minimum_stock integer not null default 1,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.motors_vehicle_stock_v155(vehicle_id)
select id from public.catalog_vehicles on conflict(vehicle_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Wallet Nostra + fidélité globale
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_wallet_ledger_v155 (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null default 'activity',
  label text not null,
  amount_rp numeric(14,2) not null default 0,
  loyalty_points integer not null default 0,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id,source_type,source_id,entry_type)
);
create index if not exists nostra_wallet_user_v155 on public.nostra_wallet_ledger_v155(user_id,created_at desc);

do $$
begin
  if to_regclass('public.loyalty_tiers') is not null then
    alter table public.loyalty_tiers add column if not exists min_points integer not null default 0;
    alter table public.loyalty_tiers add column if not exists public_description text;
  end if;
end $$;

do $$
begin
  if to_regclass('public.loyalty_tiers') is not null then
    update public.loyalty_tiers set min_points=100 where lower(coalesce(label,'')) like '%silver%' and min_points=0;
    update public.loyalty_tiers set min_points=500 where lower(coalesce(label,'')) like '%gold%' and min_points=0;
    update public.loyalty_tiers set min_points=1500 where lower(coalesce(label,'')) like '%black%' and min_points=0;
  end if;
end $$;

create or replace function public.nostra_loyalty_points_v155(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path=public
as $$ select coalesce(sum(loyalty_points),0)::integer from public.nostra_wallet_ledger_v155 where user_id=p_user_id $$;
grant execute on function public.nostra_loyalty_points_v155(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 3B. Points fidélité gagnés dans plusieurs pôles
-- ---------------------------------------------------------------------------
create or replace function public.nostra_v155_loyalty_from_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare pts integer;
begin
  if coalesce(new.status,'') = 'cancelled' then return new; end if;
  pts := greatest(0, floor(coalesce(new.total,0)/10000)::integer);
  if pts > 0 then
    insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    values(new.user_id,'loyalty','Achat Nostra Motors',pts,'order',new.id::text)
    on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points,label=excluded.label;
  end if;
  return new;
end $$;
drop trigger if exists nostra_v155_loyalty_order on public.orders;
create trigger nostra_v155_loyalty_order after insert or update of total,status on public.orders for each row execute function public.nostra_v155_loyalty_from_order();

create or replace function public.nostra_v155_loyalty_from_ticket()
returns trigger language plpgsql security definer set search_path=public as $$
declare pts integer;
begin
  if coalesce(new.status,'') in ('cancelled','refunded') then return new; end if;
  pts := greatest(0, floor(coalesce(new.total,0)/5000)::integer);
  if pts > 0 then
    insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    values(new.user_id,'loyalty','Billetterie Nostra Group',pts,'ticket',new.id::text)
    on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points,label=excluded.label;
  end if;
  return new;
end $$;
do $$ begin
  if to_regclass('public.nostra_ticket_orders_v153') is not null then
    drop trigger if exists nostra_v155_loyalty_ticket on public.nostra_ticket_orders_v153;
    create trigger nostra_v155_loyalty_ticket after insert or update of total,status on public.nostra_ticket_orders_v153 for each row execute function public.nostra_v155_loyalty_from_ticket();
  end if;
end $$;

create or replace function public.nostra_v155_loyalty_from_rental()
returns trigger language plpgsql security definer set search_path=public as $$
declare pts integer;
begin
  if coalesce(new.status,'') not in ('confirmed','ready','active','returned') then return new; end if;
  pts := greatest(0, floor(coalesce(new.total_amount,0)/5000)::integer);
  if pts > 0 then
    insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    values(new.user_id,'loyalty','Location Nostra Motors',pts,'rental',new.id::text)
    on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points,label=excluded.label;
  end if;
  return new;
end $$;
drop trigger if exists nostra_v155_loyalty_rental on public.motors_rental_bookings_v155;
create trigger nostra_v155_loyalty_rental after insert or update of total_amount,status on public.motors_rental_bookings_v155 for each row execute function public.nostra_v155_loyalty_from_rental();

create or replace function public.nostra_v155_loyalty_from_casino_conversion()
returns trigger language plpgsql security definer set search_path=public as $$
declare pts integer;
begin
  if coalesce(new.status,'') <> 'approved' then return new; end if;
  pts := greatest(0, floor(coalesce(new.rp_amount,0)/5000)::integer);
  if pts > 0 then
    insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    values(new.user_id,'loyalty','Caisse Nostra Cercle',pts,'casino_conversion',new.id::text)
    on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points,label=excluded.label;
  end if;
  return new;
end $$;
do $$ begin
  if to_regclass('public.casino_conversion_requests') is not null then
    drop trigger if exists nostra_v155_loyalty_casino_conversion on public.casino_conversion_requests;
    create trigger nostra_v155_loyalty_casino_conversion after insert or update of rp_amount,status on public.casino_conversion_requests for each row execute function public.nostra_v155_loyalty_from_casino_conversion();
  end if;
end $$;

-- Rattrapage des activités déjà présentes.
insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
select user_id,'loyalty','Achat Nostra Motors',greatest(0,floor(coalesce(total,0)/10000)::integer),'order',id::text
from public.orders where coalesce(status,'') <> 'cancelled' and coalesce(total,0) >= 10000
on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points;

do $$ begin
  if to_regclass('public.nostra_ticket_orders_v153') is not null then
    insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    select user_id,'loyalty','Billetterie Nostra Group',greatest(0,floor(coalesce(total,0)/5000)::integer),'ticket',id::text
    from public.nostra_ticket_orders_v153 where coalesce(status,'') not in ('cancelled','refunded') and coalesce(total,0) >= 5000
    on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points;
  end if;
end $$;
do $$ begin
  if to_regclass('public.casino_conversion_requests') is not null then
    insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    select user_id,'loyalty','Caisse Nostra Cercle',greatest(0,floor(coalesce(rp_amount,0)/5000)::integer),'casino_conversion',id::text
    from public.casino_conversion_requests where status='approved' and coalesce(rp_amount,0)>=5000
    on conflict(user_id,source_type,source_id,entry_type) do update set loyalty_points=excluded.loyalty_points;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Parrainage citoyen
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_referral_codes_v155 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists public.nostra_referrals_v155 (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  status text not null default 'validated' check(status in ('pending','validated','cancelled')),
  reward_referrer integer not null default 100,
  reward_referred integer not null default 50,
  created_at timestamptz not null default now(),
  validated_at timestamptz
);
create or replace function public.nostra_ensure_referral_code_v155()
returns text language plpgsql security definer set search_path=public as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  select code into v_code from public.nostra_referral_codes_v155 where user_id=auth.uid();
  if v_code is null then
    v_code := 'NG-'||upper(substr(replace(auth.uid()::text,'-',''),1,8));
    insert into public.nostra_referral_codes_v155(user_id,code) values(auth.uid(),v_code) on conflict(user_id) do update set code=excluded.code returning code into v_code;
  end if;
  return v_code;
end $$;
grant execute on function public.nostra_ensure_referral_code_v155() to authenticated;

create or replace function public.nostra_apply_referral_v155(p_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_referrer uuid; v_code text:=upper(trim(coalesce(p_code,'')));
begin
  if auth.uid() is null then raise exception 'auth_required'; end if;
  if exists(select 1 from public.nostra_referrals_v155 where referred_user_id=auth.uid()) then raise exception using message='already_referred'; end if;
  select user_id into v_referrer from public.nostra_referral_codes_v155 where upper(code)=v_code;
  if v_referrer is null or v_referrer=auth.uid() then raise exception using message='invalid_code'; end if;
  insert into public.nostra_referrals_v155(referrer_user_id,referred_user_id,code,status,validated_at) values(v_referrer,auth.uid(),v_code,'validated',now());
  insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    values(v_referrer,'referral','Parrainage validé',100,'referral',auth.uid()::text)
    on conflict do nothing;
  insert into public.nostra_wallet_ledger_v155(user_id,entry_type,label,loyalty_points,source_type,source_id)
    values(auth.uid(),'referral','Bienvenue via parrainage',50,'referral',v_referrer::text)
    on conflict do nothing;
  return true;
end $$;
grant execute on function public.nostra_apply_referral_v155(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ventes privées / accès VIP
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_private_sales_v155 (
  id uuid primary key default gen_random_uuid(),
  vehicle_id bigint not null references public.catalog_vehicles(id) on delete cascade,
  title text not null,
  description text not null default '',
  min_loyalty_points integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean not null default true,
  stock_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- ---------------------------------------------------------------------------
-- 6. Liste d'attente + favoris enrichis
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_vehicle_waitlist_v155 (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_id bigint not null references public.catalog_vehicles(id) on delete cascade,
  reason text not null default 'stock' check(reason in ('stock','rental','private_sale')),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,vehicle_id,reason)
);

do $$ begin
  if to_regclass('public.vehicle_favorites') is not null then
    alter table public.vehicle_favorites add column if not exists price_alert boolean not null default false;
    alter table public.vehicle_favorites add column if not exists showroom_alert boolean not null default false;
    alter table public.vehicle_favorites add column if not exists last_known_price numeric(14,2);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Remboursements Direction
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_refunds_v155 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source_type text not null default 'manual',
  source_id text,
  refund_kind text not null default 'partial' check(refund_kind in ('partial','total')),
  amount numeric(14,2) not null check(amount>0),
  reason text not null,
  status text not null default 'pending' check(status in ('pending','approved','paid','rejected','cancelled')),
  payment_reference text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);
alter table public.nostra_refunds_v155 add column if not exists refund_kind text not null default 'partial';
alter table public.nostra_refunds_v155 alter column user_id drop not null;
alter table public.nostra_refunds_v155 drop constraint if exists nostra_refunds_v155_user_id_fkey;
alter table public.nostra_refunds_v155 add constraint nostra_refunds_v155_user_id_fkey foreign key(user_id) references auth.users(id) on delete set null;
do $$ begin
  alter table public.nostra_refunds_v155 drop constraint if exists nostra_refunds_v155_refund_kind_check;
  alter table public.nostra_refunds_v155 add constraint nostra_refunds_v155_refund_kind_check check(refund_kind in ('partial','total'));
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Journal d'audit ultra complet
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_audit_log_v155 (
  id bigint generated by default as identity primary key,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists nostra_audit_created_v155 on public.nostra_audit_log_v155(created_at desc);

create or replace function public.nostra_audit_trigger_v155()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_id text;
begin
  v_id := coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',
                   (case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'user_id', '');
  insert into public.nostra_audit_log_v155(actor_user_id,action,entity_type,entity_id,summary,old_data,new_data)
  values(auth.uid(),lower(tg_op),tg_table_name,v_id,tg_table_name||' · '||tg_op,
         case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
         case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end);
  return coalesce(new,old);
end $$;

do $$
declare t text; trig text;
begin
  foreach t in array array[
    'catalog_vehicles','orders','vehicle_reservations','vehicle_favorites','loyalty_tiers',
    'nostra_promo_codes_v153','nostra_pole_maintenance_v153','nostra_ticket_events_v153',
    'motors_rental_settings_v155','motors_rental_bookings_v155','motors_vehicle_stock_v155',
    'nostra_private_sales_v155','nostra_vehicle_waitlist_v155','nostra_refunds_v155',
    'nostra_news_v155','nostra_banners_v155','nostra_announcements_v155'
  ] loop
    if to_regclass('public.'||t) is not null then
      trig := 'nostra_audit_'||t||'_v155';
      execute format('drop trigger if exists %I on public.%I',trig,t);
      execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.nostra_audit_trigger_v155()',trig,t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Actualités, bannières, annonces
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_news_v155 (
  id uuid primary key default gen_random_uuid(),
  pole text not null default 'group',
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  image_url text,
  published boolean not null default true,
  featured boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.nostra_banners_v155 (
  id uuid primary key default gen_random_uuid(),
  pole text not null default 'group',
  title text not null,
  message text not null default '',
  cta_label text,
  cta_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  priority integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.nostra_announcements_v155 (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  severity text not null default 'important' check(severity in ('info','important','critical')),
  active boolean not null default true,
  dismissible boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Les tables de communication viennent d'être créées : activer leur audit maintenant.
do $$
declare t text; trig text;
begin
  foreach t in array array['nostra_news_v155','nostra_banners_v155','nostra_announcements_v155'] loop
    trig := 'nostra_audit_'||t||'_v155';
    execute format('drop trigger if exists %I on public.%I',trig,t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.nostra_audit_trigger_v155()',trig,t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Corbeille administrative
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_trash_v155 (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  title text not null,
  payload jsonb not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '30 days'),
  restored_at timestamptz
);
create index if not exists nostra_trash_active_v155 on public.nostra_trash_v155(deleted_at desc) where restored_at is null;

-- ---------------------------------------------------------------------------
-- 11. Notifications automatiques favoris / attente
-- ---------------------------------------------------------------------------
create or replace function public.nostra_vehicle_watch_notify_v155()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if to_regclass('public.user_notifications') is null then return new; end if;
  if old.stock_quantity is distinct from new.stock_quantity and coalesce(old.stock_quantity,0)<=0 and coalesce(new.stock_quantity,0)>0 then
    insert into public.user_notifications(user_id,notification_type,title,message,target_url,source_type,source_id,priority,category)
    select w.user_id,'vehicle_stock','Véhicule de nouveau disponible',new.brand||' '||new.model||' est revenu en stock.','/motors/catalogue/'||new.id||'/commande','vehicle',new.id::text,'important','motors'
    from public.nostra_vehicle_waitlist_v155 w where w.vehicle_id=new.id and w.reason='stock';
    update public.nostra_vehicle_waitlist_v155 set notified_at=now() where vehicle_id=new.id and reason='stock';
    if to_regclass('public.vehicle_favorites') is not null then
      insert into public.user_notifications(user_id,notification_type,title,message,target_url,source_type,source_id,priority,category)
      select f.user_id,'vehicle_stock','Favori de nouveau en stock',new.brand||' '||new.model||' est de nouveau disponible.','/motors/catalogue/'||new.id||'/commande','vehicle',new.id::text,'normal','motors'
      from public.vehicle_favorites f where f.vehicle_id=new.id and coalesce(f.stock_alert,false)=true;
    end if;
  end if;
  if old.price is distinct from new.price and coalesce(new.price,0)<coalesce(old.price,0) and to_regclass('public.vehicle_favorites') is not null then
    insert into public.user_notifications(user_id,notification_type,title,message,target_url,source_type,source_id,priority,category)
    select f.user_id,'vehicle_price','Baisse de prix sur un favori',new.brand||' '||new.model||' vient de baisser de prix.','/motors/catalogue/'||new.id||'/commande','vehicle',new.id::text,'normal','motors'
    from public.vehicle_favorites f where f.vehicle_id=new.id and coalesce(f.price_alert,false)=true;
  end if;
  if old.showroom_visible is distinct from new.showroom_visible and new.showroom_visible=true and to_regclass('public.vehicle_favorites') is not null then
    insert into public.user_notifications(user_id,notification_type,title,message,target_url,source_type,source_id,priority,category)
    select f.user_id,'vehicle_showroom','Ton favori est au showroom',new.brand||' '||new.model||' est maintenant présent au showroom Nostra Motors.','/motors/showroom','vehicle',new.id::text,'normal','motors'
    from public.vehicle_favorites f where f.vehicle_id=new.id and coalesce(f.showroom_alert,false)=true;
  end if;
  return new;
end $$;
drop trigger if exists nostra_vehicle_watch_notify_v155 on public.catalog_vehicles;
create trigger nostra_vehicle_watch_notify_v155 after update of stock_quantity,price,showroom_visible on public.catalog_vehicles for each row execute function public.nostra_vehicle_watch_notify_v155();

create or replace function public.nostra_rental_waitlist_notify_v155()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status is distinct from new.status and new.status in ('returned','cancelled','rejected') then
    insert into public.user_notifications(user_id,notification_type,title,message,target_url,source_type,source_id,priority,category)
    select w.user_id,'rental_available','Location de nouveau disponible','Un créneau peut être de nouveau disponible pour le véhicule que tu surveilles.','/motors/location/'||new.vehicle_id,'vehicle',new.vehicle_id::text,'normal','motors'
    from public.nostra_vehicle_waitlist_v155 w where w.vehicle_id=new.vehicle_id and w.reason='rental';
    update public.nostra_vehicle_waitlist_v155 set notified_at=now() where vehicle_id=new.vehicle_id and reason='rental';
  end if;
  return new;
end $$;
drop trigger if exists nostra_rental_waitlist_notify_v155 on public.motors_rental_bookings_v155;
create trigger nostra_rental_waitlist_notify_v155 after update of status on public.motors_rental_bookings_v155 for each row execute function public.nostra_rental_waitlist_notify_v155();

-- Garder notification_type extensible.
do $$ begin
  if to_regclass('public.user_notifications') is not null then
    alter table public.user_notifications drop constraint if exists user_notifications_type_check;
    alter table public.user_notifications drop constraint if exists user_notifications_notification_type_check;
    update public.user_notifications set notification_type='general' where notification_type is null or btrim(notification_type)='';
    alter table public.user_notifications add constraint user_notifications_type_check check (notification_type is not null and btrim(notification_type) <> '');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 12. Sauvegardes V153 étendues aux réglages V155
-- ---------------------------------------------------------------------------
-- On conserve les noms de fonctions V153 pour que la page Dashboard existante
-- continue de fonctionner, mais les nouveaux snapshots incluent désormais les
-- réglages sûrs de la location, du stock, de la fidélité, des ventes privées et
-- de la communication. Les transactions/historiques citoyens ne sont pas écrasés.
create or replace function public.nostra_v153_table_snapshot(p_table text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_data jsonb;
begin
  if not public.nostra_v155_is_manager() then raise exception using message='forbidden'; end if;
  if p_table not in (
    'site_pages','custom_circuit_pages','hidden_circuit_pages','circuit_settings','motors_settings','catalog_vehicles','events',
    'casino_settings','casino_cashier_packages_v148','nostra_promo_codes_v153','casino_status_tiers_v153','nostra_pole_maintenance_v153','nostra_ticket_events_v153',
    'motors_rental_settings_v155','motors_vehicle_stock_v155','loyalty_tiers','nostra_private_sales_v155','nostra_news_v155','nostra_banners_v155','nostra_announcements_v155'
  ) then raise exception using message='table_not_allowed'; end if;
  if to_regclass('public.'||p_table) is null then return '[]'::jsonb; end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t',p_table) into v_data;
  return coalesce(v_data,'[]'::jsonb);
end $$;

create or replace function public.nostra_v153_restore_table_snapshot(p_table text, p_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_cols text; v_select_cols text; v_pk text; v_updates text; v_sql text;
begin
  if p_table not in (
    'site_pages','custom_circuit_pages','hidden_circuit_pages','circuit_settings','motors_settings','catalog_vehicles','events',
    'casino_settings','casino_cashier_packages_v148','nostra_promo_codes_v153','casino_status_tiers_v153','nostra_pole_maintenance_v153','nostra_ticket_events_v153',
    'motors_rental_settings_v155','motors_vehicle_stock_v155','loyalty_tiers','nostra_private_sales_v155','nostra_news_v155','nostra_banners_v155','nostra_announcements_v155'
  ) then raise exception using message='table_not_allowed'; end if;
  if to_regclass('public.'||p_table) is null or coalesce(jsonb_array_length(coalesce(p_data,'[]'::jsonb)),0)=0 then return; end if;
  select string_agg(format('%I',a.attname),',' order by a.attnum), string_agg(format('r.%I',a.attname),',' order by a.attnum)
    into v_cols,v_select_cols from pg_attribute a
    where a.attrelid=to_regclass('public.'||p_table) and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  select string_agg(format('%I',a.attname),',' order by x.ord) into v_pk
    from pg_index i cross join lateral unnest(i.indkey) with ordinality as x(attnum,ord)
    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=x.attnum
    where i.indrelid=to_regclass('public.'||p_table) and i.indisprimary;
  if v_pk is null then raise exception using message='missing_primary_key'; end if;
  select string_agg(format('%1$I=excluded.%1$I',a.attname),',' order by a.attnum) into v_updates
    from pg_attribute a
    where a.attrelid=to_regclass('public.'||p_table) and a.attnum>0 and not a.attisdropped and a.attgenerated=''
      and not (a.attname = any(string_to_array(replace(v_pk,'"',''),',')));
  v_sql := format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1) r on conflict (%s) do %s',
    p_table,v_cols,v_select_cols,p_table,v_pk,case when coalesce(v_updates,'')='' then 'nothing' else 'update set '||v_updates end);
  execute v_sql using p_data;
end $$;
revoke all on function public.nostra_v153_restore_table_snapshot(text,jsonb) from public, anon, authenticated;

create or replace function public.nostra_create_backup_v153(p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_snapshot jsonb;
begin
  if not public.nostra_v155_is_manager() then raise exception using message='forbidden'; end if;
  v_snapshot := jsonb_build_object(
    'version','V155','created_at',now(),
    'site_pages',public.nostra_v153_table_snapshot('site_pages'),
    'custom_circuit_pages',public.nostra_v153_table_snapshot('custom_circuit_pages'),
    'hidden_circuit_pages',public.nostra_v153_table_snapshot('hidden_circuit_pages'),
    'circuit_settings',public.nostra_v153_table_snapshot('circuit_settings'),
    'motors_settings',public.nostra_v153_table_snapshot('motors_settings'),
    'catalog_vehicles',public.nostra_v153_table_snapshot('catalog_vehicles'),
    'events',public.nostra_v153_table_snapshot('events'),
    'casino_settings',public.nostra_v153_table_snapshot('casino_settings'),
    'casino_cashier_packages_v148',public.nostra_v153_table_snapshot('casino_cashier_packages_v148'),
    'promo_codes',public.nostra_v153_table_snapshot('nostra_promo_codes_v153'),
    'casino_status_tiers',public.nostra_v153_table_snapshot('casino_status_tiers_v153'),
    'maintenance',public.nostra_v153_table_snapshot('nostra_pole_maintenance_v153'),
    'ticket_events',public.nostra_v153_table_snapshot('nostra_ticket_events_v153'),
    'rental_settings_v155',public.nostra_v153_table_snapshot('motors_rental_settings_v155'),
    'stock_settings_v155',public.nostra_v153_table_snapshot('motors_vehicle_stock_v155'),
    'loyalty_tiers_v155',public.nostra_v153_table_snapshot('loyalty_tiers'),
    'private_sales_v155',public.nostra_v153_table_snapshot('nostra_private_sales_v155'),
    'news_v155',public.nostra_v153_table_snapshot('nostra_news_v155'),
    'banners_v155',public.nostra_v153_table_snapshot('nostra_banners_v155'),
    'announcements_v155',public.nostra_v153_table_snapshot('nostra_announcements_v155')
  );
  insert into public.nostra_backups_v153(name,snapshot,created_by)
  values(coalesce(nullif(btrim(p_name),''),'Sauvegarde '||to_char(now(),'DD/MM/YYYY HH24:MI')),v_snapshot,auth.uid()) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.nostra_create_backup_v153(text) to authenticated;

create or replace function public.nostra_restore_backup_v153(p_backup_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not public.nostra_v155_is_manager() then raise exception using message='forbidden'; end if;
  select snapshot into v from public.nostra_backups_v153 where id=p_backup_id;
  if v is null then raise exception using message='backup_not_found'; end if;
  perform public.nostra_create_backup_v153('Sauvegarde automatique avant restauration '||to_char(now(),'DD/MM/YYYY HH24:MI'));
  perform public.nostra_v153_restore_table_snapshot('site_pages',coalesce(v->'site_pages','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('custom_circuit_pages',coalesce(v->'custom_circuit_pages','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('hidden_circuit_pages',coalesce(v->'hidden_circuit_pages','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('circuit_settings',coalesce(v->'circuit_settings','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('motors_settings',coalesce(v->'motors_settings','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('catalog_vehicles',coalesce(v->'catalog_vehicles','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('events',coalesce(v->'events','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('casino_settings',coalesce(v->'casino_settings','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('casino_cashier_packages_v148',coalesce(v->'casino_cashier_packages_v148','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_promo_codes_v153',coalesce(v->'promo_codes','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('casino_status_tiers_v153',coalesce(v->'casino_status_tiers','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_pole_maintenance_v153',coalesce(v->'maintenance','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_ticket_events_v153',coalesce(v->'ticket_events','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('motors_rental_settings_v155',coalesce(v->'rental_settings_v155','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('motors_vehicle_stock_v155',coalesce(v->'stock_settings_v155','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('loyalty_tiers',coalesce(v->'loyalty_tiers_v155','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_private_sales_v155',coalesce(v->'private_sales_v155','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_news_v155',coalesce(v->'news_v155','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_banners_v155',coalesce(v->'banners_v155','[]'::jsonb));
  perform public.nostra_v153_restore_table_snapshot('nostra_announcements_v155',coalesce(v->'announcements_v155','[]'::jsonb));
  return true;
end $$;
grant execute on function public.nostra_restore_backup_v153(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. RLS
-- ---------------------------------------------------------------------------
alter table public.motors_rental_settings_v155 enable row level security;
alter table public.motors_rental_bookings_v155 enable row level security;
alter table public.motors_vehicle_stock_v155 enable row level security;
alter table public.nostra_wallet_ledger_v155 enable row level security;
alter table public.nostra_referral_codes_v155 enable row level security;
alter table public.nostra_referrals_v155 enable row level security;
alter table public.nostra_private_sales_v155 enable row level security;
alter table public.nostra_vehicle_waitlist_v155 enable row level security;
alter table public.nostra_refunds_v155 enable row level security;
alter table public.nostra_audit_log_v155 enable row level security;
alter table public.nostra_news_v155 enable row level security;
alter table public.nostra_banners_v155 enable row level security;
alter table public.nostra_announcements_v155 enable row level security;
alter table public.nostra_trash_v155 enable row level security;

-- Manager CRUD policies helper pattern.
do $$
declare t text;
begin
  foreach t in array array['nostra_private_sales_v155','nostra_refunds_v155','nostra_news_v155','nostra_banners_v155','nostra_announcements_v155','nostra_trash_v155'] loop
    execute format('drop policy if exists "v155 manager all" on public.%I',t);
    execute format('create policy "v155 manager all" on public.%I for all to authenticated using (public.nostra_v155_is_manager()) with check (public.nostra_v155_is_manager())',t);
  end loop;
end $$;

-- Équipe Motors : gestion location et stock réel.
drop policy if exists "v155 motors staff settings" on public.motors_rental_settings_v155;
create policy "v155 motors staff settings" on public.motors_rental_settings_v155 for all to authenticated using(public.nostra_v155_is_motors_staff()) with check(public.nostra_v155_is_motors_staff());
drop policy if exists "v155 motors staff stock" on public.motors_vehicle_stock_v155;
create policy "v155 motors staff stock" on public.motors_vehicle_stock_v155 for all to authenticated using(public.nostra_v155_is_motors_staff()) with check(public.nostra_v155_is_motors_staff());

-- Rental settings readable by all authenticated.
drop policy if exists "v155 rental settings read" on public.motors_rental_settings_v155;
create policy "v155 rental settings read" on public.motors_rental_settings_v155 for select to authenticated using(true);
-- Bookings own + manager.
drop policy if exists "v155 rental own read" on public.motors_rental_bookings_v155;
create policy "v155 rental own read" on public.motors_rental_bookings_v155 for select to authenticated using(user_id=auth.uid() or public.nostra_v155_is_motors_staff());
drop policy if exists "v155 rental own insert" on public.motors_rental_bookings_v155;
create policy "v155 rental own insert" on public.motors_rental_bookings_v155 for insert to authenticated with check(user_id=auth.uid() or public.nostra_v155_is_motors_staff());
drop policy if exists "v155 rental manager update" on public.motors_rental_bookings_v155;
create policy "v155 rental manager update" on public.motors_rental_bookings_v155 for update to authenticated using(public.nostra_v155_is_motors_staff()) with check(public.nostra_v155_is_motors_staff());
-- Stock public read.
drop policy if exists "v155 stock read" on public.motors_vehicle_stock_v155;
create policy "v155 stock read" on public.motors_vehicle_stock_v155 for select to authenticated using(true);
-- Wallet own read / manager.
drop policy if exists "v155 wallet own" on public.nostra_wallet_ledger_v155;
create policy "v155 wallet own" on public.nostra_wallet_ledger_v155 for select to authenticated using(user_id=auth.uid() or public.nostra_v155_is_manager());
drop policy if exists "v155 wallet manager write" on public.nostra_wallet_ledger_v155;
create policy "v155 wallet manager write" on public.nostra_wallet_ledger_v155 for all to authenticated using(public.nostra_v155_is_manager()) with check(public.nostra_v155_is_manager());
-- Referral.
drop policy if exists "v155 referral codes own" on public.nostra_referral_codes_v155;
create policy "v155 referral codes own" on public.nostra_referral_codes_v155 for select to authenticated using(user_id=auth.uid() or public.nostra_v155_is_manager());
drop policy if exists "v155 referrals own" on public.nostra_referrals_v155;
create policy "v155 referrals own" on public.nostra_referrals_v155 for select to authenticated using(referrer_user_id=auth.uid() or referred_user_id=auth.uid() or public.nostra_v155_is_manager());
-- Private sales active readable.
drop policy if exists "v155 private sales read" on public.nostra_private_sales_v155;
create policy "v155 private sales read" on public.nostra_private_sales_v155 for select to authenticated using(enabled=true or public.nostra_v155_is_manager());
-- Waitlist own + manager.
drop policy if exists "v155 waitlist own" on public.nostra_vehicle_waitlist_v155;
create policy "v155 waitlist own" on public.nostra_vehicle_waitlist_v155 for all to authenticated using(user_id=auth.uid() or public.nostra_v155_is_manager()) with check(user_id=auth.uid() or public.nostra_v155_is_manager());
-- Audit manager only.
drop policy if exists "v155 audit manager" on public.nostra_audit_log_v155;
create policy "v155 audit manager" on public.nostra_audit_log_v155 for select to authenticated using(public.nostra_v155_is_manager());
drop policy if exists "v155 audit manager insert" on public.nostra_audit_log_v155;
create policy "v155 audit manager insert" on public.nostra_audit_log_v155 for insert to authenticated with check(public.nostra_v155_is_manager());
-- Public content.
drop policy if exists "v155 news read" on public.nostra_news_v155;
create policy "v155 news read" on public.nostra_news_v155 for select to authenticated using(published=true or public.nostra_v155_is_manager());
drop policy if exists "v155 banners read" on public.nostra_banners_v155;
create policy "v155 banners read" on public.nostra_banners_v155 for select to authenticated using(active=true or public.nostra_v155_is_manager());
drop policy if exists "v155 announcements read" on public.nostra_announcements_v155;
create policy "v155 announcements read" on public.nostra_announcements_v155 for select to authenticated using(active=true or public.nostra_v155_is_manager());

do $$ begin
  if to_regclass('public.loyalty_tiers') is not null then
    alter table public.loyalty_tiers enable row level security;
    drop policy if exists "v155 loyalty tiers read" on public.loyalty_tiers;
    create policy "v155 loyalty tiers read" on public.loyalty_tiers for select to authenticated using(true);
    drop policy if exists "v155 loyalty tiers manager update" on public.loyalty_tiers;
    create policy "v155 loyalty tiers manager update" on public.loyalty_tiers for update to authenticated using(public.nostra_v155_is_manager()) with check(public.nostra_v155_is_manager());
  end if;
end $$;

commit;
