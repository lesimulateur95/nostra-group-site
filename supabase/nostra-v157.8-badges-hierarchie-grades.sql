-- Nostra Group V157.8 — Badges premium + hiérarchie Silver / Gold / Black Signature
-- Compatible avec V157.1+ : ne touche pas aux cautions/location. Réexécutable.
-- Peut être réexécuté sans supprimer les réglages existants.

begin;

-- ---------------------------------------------------------------------------
-- 1. Merchandising véhicule : soldes + accès Silver / Gold / Black Signature
-- ---------------------------------------------------------------------------
create table if not exists public.nostra_vehicle_merchandising_v157 (
  vehicle_id bigint primary key references public.catalog_vehicles(id) on delete cascade,
  sale_enabled boolean not null default false,
  sale_mode text not null default 'percent' check (sale_mode in ('percent','price')),
  sale_value numeric(14,2) not null default 0 check (sale_value >= 0),
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  required_tier text not null default 'all' check (required_tier in ('all','silver','gold','black_signature')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (sale_ends_at is null or sale_starts_at is null or sale_ends_at > sale_starts_at)
);

alter table public.nostra_vehicle_merchandising_v157 enable row level security;

drop policy if exists "v157 vehicle merchandising read" on public.nostra_vehicle_merchandising_v157;
create policy "v157 vehicle merchandising read"
on public.nostra_vehicle_merchandising_v157
for select to authenticated
using (true);

drop policy if exists "v157 vehicle merchandising manager" on public.nostra_vehicle_merchandising_v157;
create policy "v157 vehicle merchandising manager"
on public.nostra_vehicle_merchandising_v157
for all to authenticated
using (public.nostra_role() = 'manager')
with check (public.nostra_role() = 'manager');

grant select,insert,update,delete on public.nostra_vehicle_merchandising_v157 to authenticated;

create or replace function public.nostra_normalize_loyalty_tier_v157(p_tier text)
returns text
language sql
immutable
as $$
  select case
    when lower(trim(coalesce(p_tier,''))) = 'silver' then 'silver'
    when lower(trim(coalesce(p_tier,''))) = 'gold' then 'gold'
    when lower(trim(coalesce(p_tier,''))) in ('black','black signature','black_signature') then 'black_signature'
    else 'all'
  end
$$;

create or replace function public.nostra_loyalty_tier_rank_v157(p_tier text)
returns integer
language sql
immutable
as $$
  select case public.nostra_normalize_loyalty_tier_v157(p_tier)
    when 'silver' then 1
    when 'gold' then 2
    when 'black_signature' then 3
    else 0
  end
$$;
grant execute on function public.nostra_loyalty_tier_rank_v157(text) to authenticated;

create or replace function public.nostra_current_loyalty_tier_v157(p_user_id uuid default auth.uid())
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_tier text;
begin
  if p_user_id is null then return 'all'; end if;

  if to_regclass('public.loyalty_cards') is not null then
    select tier into v_tier
    from public.loyalty_cards
    where user_id=p_user_id and active=true
    order by issued_at desc
    limit 1;
  end if;

  if coalesce(trim(v_tier),'') = '' and to_regclass('public.loyalty_profiles') is not null then
    select tier into v_tier
    from public.loyalty_profiles
    where user_id=p_user_id
    limit 1;
  end if;

  return public.nostra_normalize_loyalty_tier_v157(v_tier);
end;
$$;
grant execute on function public.nostra_current_loyalty_tier_v157(uuid) to authenticated;

create or replace function public.nostra_active_vehicle_sale_price_v157(p_vehicle_id bigint)
returns numeric
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_regular numeric(14,2);
  v_merch public.nostra_vehicle_merchandising_v157%rowtype;
  v_price numeric(14,2);
begin
  select price into v_regular from public.catalog_vehicles where id=p_vehicle_id;
  if not found or coalesce(v_regular,0) <= 0 then return null; end if;

  select * into v_merch
  from public.nostra_vehicle_merchandising_v157
  where vehicle_id=p_vehicle_id and sale_enabled=true;
  if not found then return null; end if;

  if v_merch.sale_starts_at is not null and now() < v_merch.sale_starts_at then return null; end if;
  if v_merch.sale_ends_at is not null and now() > v_merch.sale_ends_at then return null; end if;

  if v_merch.sale_mode='price' then
    v_price := v_merch.sale_value;
  else
    v_price := round(v_regular * (1 - (v_merch.sale_value / 100)),2);
  end if;

  if v_price < 0 or v_price >= v_regular then return null; end if;
  return v_price;
end;
$$;
grant execute on function public.nostra_active_vehicle_sale_price_v157(bigint) to authenticated;

create or replace function public.nostra_vehicle_tier_access_v157(p_vehicle_id bigint, p_user_id uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_required text := 'all';
  v_current text := 'all';
begin
  select required_tier into v_required
  from public.nostra_vehicle_merchandising_v157
  where vehicle_id=p_vehicle_id;

  v_required := coalesce(v_required,'all');
  if v_required='all' then return true; end if;
  v_current := public.nostra_current_loyalty_tier_v157(p_user_id);
  return public.nostra_loyalty_tier_rank_v157(v_current) >= public.nostra_loyalty_tier_rank_v157(v_required);
end;
$$;
grant execute on function public.nostra_vehicle_tier_access_v157(bigint,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Commande V157 : grade vérifié avant achat + vrai prix soldé dans l'ordre
-- ---------------------------------------------------------------------------
create or replace function public.place_nostra_order_v157(
  p_order_number text,
  p_customer_name text,
  p_customer_note text default null,
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_cart record;
  v_required text;
  v_current text;
  v_result jsonb;
  v_order_id bigint;
  v_items jsonb;
  v_new_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_vehicle_id bigint;
  v_quantity integer;
  v_regular numeric(14,2);
  v_sale numeric(14,2);
  v_flash numeric(14,2);
  v_effective numeric(14,2);
  v_line_total numeric(14,2);
  v_total numeric(14,2) := 0;
  v_quote jsonb;
  v_discount numeric(14,2) := 0;
begin
  if v_uid is null then raise exception using message='not_authenticated'; end if;

  -- Contrôle du grade avant que le moteur V93 ne retire le stock.
  v_current := public.nostra_current_loyalty_tier_v157(v_uid);
  for v_cart in
    select distinct vehicle_id
    from public.cart_items
    where user_id=v_uid and item_type='vehicle' and vehicle_id is not null
  loop
    select required_tier into v_required
    from public.nostra_vehicle_merchandising_v157
    where vehicle_id=v_cart.vehicle_id;
    v_required := coalesce(v_required,'all');
    if v_required <> 'all'
       and public.nostra_loyalty_tier_rank_v157(v_current) < public.nostra_loyalty_tier_rank_v157(v_required) then
      raise exception using message='loyalty_tier_required';
    end if;
  end loop;

  v_result := public.place_nostra_order_v93(p_order_number,p_customer_name,p_customer_note);
  v_order_id := (v_result->>'id')::bigint;
  select items into v_items from public.orders where id=v_order_id;

  -- Le moteur historique V93 crée l'ordre au prix catalogue. On recalcule ensuite
  -- les lignes de véhicule à partir des soldes V157 / ventes flash V156.
  for v_item in select value from jsonb_array_elements(coalesce(v_items,'[]'::jsonb))
  loop
    if coalesce(v_item->>'item_type','')='vehicle' and coalesce(v_item->>'vehicle_id','')<>'' then
      v_vehicle_id := (v_item->>'vehicle_id')::bigint;
      v_quantity := greatest(1,coalesce((v_item->>'quantity')::integer,1));
      select price into v_regular from public.catalog_vehicles where id=v_vehicle_id;
      v_sale := public.nostra_active_vehicle_sale_price_v157(v_vehicle_id);
      begin
        v_flash := public.nostra_active_flash_price_v156(v_vehicle_id);
      exception when undefined_function then
        v_flash := null;
      end;
      v_effective := coalesce(v_regular,0);
      if v_sale is not null then v_effective := least(v_effective,v_sale); end if;
      if v_flash is not null then v_effective := least(v_effective,v_flash); end if;

      if v_effective < coalesce(v_regular,0) then
        v_item := v_item || jsonb_build_object(
          'unit_price',v_effective,
          'original_unit_price',v_regular,
          'sale_applied',true
        );
      end if;
      v_line_total := v_effective * v_quantity;
    else
      v_quantity := greatest(1,coalesce((v_item->>'quantity')::integer,1));
      v_line_total := coalesce((v_item->>'unit_price')::numeric,0) * v_quantity;
    end if;

    v_new_items := v_new_items || jsonb_build_array(v_item);
    v_total := v_total + v_line_total;
  end loop;

  update public.orders set items=v_new_items,total=v_total,updated_at=now() where id=v_order_id;

  if coalesce(btrim(p_promo_code),'') <> '' then
    v_quote := public.nostra_redeem_promo_v153(p_promo_code,'motors',v_total,'order',v_order_id::text);
    if coalesce((v_quote->>'valid')::boolean,false) is false then
      raise exception using message='promo_' || coalesce(v_quote->>'reason','invalid');
    end if;
    v_discount := coalesce((v_quote->>'discount_amount')::numeric,0);
    update public.orders
      set total=greatest(0,total-v_discount),
          items=coalesce(items,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'item_type','discount','name','Code promo ' || upper(btrim(p_promo_code)),
            'quantity',1,'unit_price',-v_discount,'image_url',null
          )), updated_at=now()
      where id=v_order_id;
  end if;

  select total into v_total from public.orders where id=v_order_id;
  return v_result || jsonb_build_object('total',v_total,'discount',v_discount);
end;
$$;
grant execute on function public.place_nostra_order_v157(text,text,text,text) to authenticated;

commit;

-- Vérifications utiles après exécution :
select
  to_regclass('public.nostra_vehicle_merchandising_v157') as merchandising_table,
  to_regprocedure('public.nostra_current_loyalty_tier_v157(uuid)') as loyalty_function,
  to_regprocedure('public.nostra_active_vehicle_sale_price_v157(bigint)') as sale_function,
  to_regprocedure('public.place_nostra_order_v157(text,text,text,text)') as order_function;
