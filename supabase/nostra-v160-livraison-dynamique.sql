-- Nostra Group V160 — Livraison dynamique Nostra Motors
-- Règle : livraison à domicile = 5 % de la valeur globale des véhicules livrés.
-- Le calcul est fait véhicule par véhicule puis cumulé : mathématiquement identique à 5 % du total livré.
-- Location et poids lourds restent en retrait showroom.
-- Réexécutable : ne supprime aucune commande, réservation ou dossier de financement existant.

begin;

-- ---------------------------------------------------------------------------
-- 1. Préparer le panier avant commande : choix global showroom / domicile
-- ---------------------------------------------------------------------------

create or replace function public.nostra_prepare_cart_delivery_v160(
  p_delivery_mode text,
  p_delivery_address text default null,
  p_delivery_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_line record;
  v_catalog_type text;
  v_regular_price numeric(14,2);
  v_effective_price numeric(14,2);
  v_sale_price numeric(14,2);
  v_flash_price numeric(14,2);
  v_delivery_fee numeric(14,2);
  v_vehicle_count integer := 0;
  v_delivery_total numeric(14,2) := 0;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if coalesce(p_delivery_mode, '') not in ('showroom', 'home') then
    raise exception using message = 'invalid_delivery_mode';
  end if;

  if p_delivery_mode = 'home' and length(btrim(coalesce(p_delivery_address, ''))) < 5 then
    raise exception using message = 'invalid_delivery_address';
  end if;

  if p_delivery_mode = 'home' and length(btrim(coalesce(p_delivery_phone, ''))) < 3 then
    raise exception using message = 'invalid_delivery_phone';
  end if;

  -- On reconstruit les lignes de livraison pour éviter les anciens tarifs fixes.
  delete from public.cart_items
  where user_id = v_user_id
    and item_type = 'delivery';

  for v_line in
    select
      ci.id as cart_id,
      ci.vehicle_id,
      greatest(coalesce(ci.quantity, 1), 1)::integer as quantity,
      cv.brand,
      cv.model,
      cv.price,
      coalesce(to_jsonb(cv) ->> 'catalog_type', 'standard') as catalog_type
    from public.cart_items ci
    join public.catalog_vehicles cv on cv.id = ci.vehicle_id
    where ci.user_id = v_user_id
      and ci.item_type = 'vehicle'
    order by ci.id
    for update of ci
  loop
    v_catalog_type := coalesce(v_line.catalog_type, 'standard');
    v_regular_price := round(greatest(coalesce(v_line.price, 0), 0), 2);
    v_effective_price := v_regular_price;

    -- Les locations conservent toujours leur tarif catalogue.
    if v_catalog_type <> 'concession' then
      begin
        v_sale_price := public.nostra_active_vehicle_sale_price_v157(v_line.vehicle_id);
      exception when undefined_function then
        v_sale_price := null;
      end;

      begin
        v_flash_price := public.nostra_active_flash_price_v156(v_line.vehicle_id);
      exception when undefined_function then
        v_flash_price := null;
      end;

      if v_sale_price is not null and v_sale_price >= 0 then
        v_effective_price := least(v_effective_price, v_sale_price);
      end if;
      if v_flash_price is not null and v_flash_price >= 0 then
        v_effective_price := least(v_effective_price, v_flash_price);
      end if;
    end if;

    update public.cart_items
    set unit_price = v_effective_price,
        original_unit_price = v_regular_price,
        delivery_mode = case
          when p_delivery_mode = 'home' and v_catalog_type not in ('concession', 'heavy') then 'home'
          else 'showroom'
        end,
        delivery_address = case
          when p_delivery_mode = 'home' and v_catalog_type not in ('concession', 'heavy') then btrim(p_delivery_address)
          else null
        end,
        delivery_phone = case
          when p_delivery_mode = 'home' and v_catalog_type not in ('concession', 'heavy') then btrim(p_delivery_phone)
          else null
        end
    where id = v_line.cart_id
      and user_id = v_user_id;

    if p_delivery_mode = 'home' and v_catalog_type not in ('concession', 'heavy') then
      v_delivery_fee := round(v_effective_price * 0.05, 2);

      insert into public.cart_items (
        user_id, vehicle_id, related_vehicle_id, reservation_id, item_type,
        delivery_mode, delivery_address, delivery_phone, item_name, quantity,
        unit_price, original_unit_price, image_url, locked
      ) values (
        v_user_id, null, v_line.vehicle_id, null, 'delivery',
        'home', btrim(p_delivery_address), btrim(p_delivery_phone),
        'Livraison à domicile — ' || btrim(v_line.brand || ' ' || v_line.model),
        v_line.quantity, v_delivery_fee, v_delivery_fee, null, false
      );

      v_vehicle_count := v_vehicle_count + v_line.quantity;
      v_delivery_total := v_delivery_total + (v_delivery_fee * v_line.quantity);
    end if;
  end loop;

  return jsonb_build_object(
    'delivery_mode', p_delivery_mode,
    'vehicle_count', v_vehicle_count,
    'delivery_rate_percent', 5,
    'delivery_total', round(v_delivery_total, 2)
  );
end;
$$;

revoke all on function public.nostra_prepare_cart_delivery_v160(text,text,text) from public, anon;
grant execute on function public.nostra_prepare_cart_delivery_v160(text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Le moteur V93 respecte désormais le prix de livraison présent dans le panier
--    au lieu de remettre automatiquement l'ancien forfait de 75 000 €.
-- ---------------------------------------------------------------------------

create or replace function public.place_nostra_order_v93(
  p_order_number text,
  p_customer_name text,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id bigint;
  v_total numeric(14,2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_line record;
  v_vehicle record;
  v_delivery record;
  v_vehicle_quantity integer;
  v_delivery_unit_price numeric(14,2);
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.cart_items
    where user_id = v_user_id and item_type = 'vehicle'
  ) then
    raise exception using message = 'empty_cart';
  end if;

  if exists (
    select 1 from public.cart_items
    where user_id = v_user_id and item_type = 'vehicle' and vehicle_id is null
  ) then
    raise exception using message = 'cart_needs_refresh';
  end if;

  for v_line in
    select vehicle_id, sum(quantity)::integer as quantity, max(image_url) as image_url
    from public.cart_items
    where user_id = v_user_id and item_type = 'vehicle'
    group by vehicle_id
    order by vehicle_id
  loop
    select id, brand, model, price, images, published, stock_quantity
    into v_vehicle
    from public.catalog_vehicles
    where id = v_line.vehicle_id
    for update;

    if not found or not v_vehicle.published then
      raise exception using message = 'vehicle_unavailable';
    end if;
    if v_vehicle.stock_quantity < v_line.quantity then
      raise exception using message = 'insufficient_stock';
    end if;

    update public.catalog_vehicles
    set stock_quantity = stock_quantity - v_line.quantity, updated_at = now()
    where id = v_vehicle.id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_type', 'vehicle',
      'vehicle_id', v_vehicle.id,
      'name', btrim(v_vehicle.brand || ' ' || v_vehicle.model),
      'quantity', v_line.quantity,
      'unit_price', v_vehicle.price,
      'image_url', coalesce(v_line.image_url, v_vehicle.images -> 0 ->> 'url')
    ));
    v_total := v_total + (v_vehicle.price * v_line.quantity);
  end loop;

  for v_delivery in
    select related_vehicle_id,
           sum(quantity)::integer as quantity,
           max(delivery_address) as delivery_address,
           max(delivery_phone) as delivery_phone,
           max(unit_price)::numeric(14,2) as unit_price
    from public.cart_items
    where user_id = v_user_id and item_type = 'delivery'
    group by related_vehicle_id
    order by related_vehicle_id
  loop
    if v_delivery.related_vehicle_id is null then
      raise exception using message = 'invalid_delivery_cart';
    end if;

    select coalesce(sum(quantity), 0)::integer into v_vehicle_quantity
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'vehicle'
      and vehicle_id = v_delivery.related_vehicle_id;

    if v_vehicle_quantity <= 0 or v_delivery.quantity > v_vehicle_quantity then
      raise exception using message = 'invalid_delivery_cart';
    end if;

    select * into v_vehicle
    from public.catalog_vehicles
    where id = v_delivery.related_vehicle_id;
    if not found then raise exception using message = 'vehicle_unavailable'; end if;
    if coalesce(to_jsonb(v_vehicle) ->> 'catalog_type', 'standard') = 'heavy' then
      raise exception using message = 'heavy_home_delivery_disabled';
    end if;
    if coalesce(to_jsonb(v_vehicle) ->> 'catalog_type', 'standard') = 'concession' then
      raise exception using message = 'rental_home_delivery_disabled';
    end if;
    if length(btrim(coalesce(v_delivery.delivery_address, ''))) < 5 then
      raise exception using message = 'invalid_delivery_address';
    end if;
    if length(btrim(coalesce(v_delivery.delivery_phone, ''))) < 3 then
      raise exception using message = 'invalid_delivery_phone';
    end if;

    v_delivery_unit_price := round(greatest(coalesce(v_delivery.unit_price, 0), 0), 2);

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_type', 'delivery',
      'vehicle_id', null,
      'related_vehicle_id', v_vehicle.id,
      'name', 'Livraison à domicile — ' || btrim(v_vehicle.brand || ' ' || v_vehicle.model),
      'delivery_address', v_delivery.delivery_address,
      'delivery_phone', v_delivery.delivery_phone,
      'quantity', v_delivery.quantity,
      'unit_price', v_delivery_unit_price,
      'delivery_rate_percent', 5,
      'image_url', null
    ));
    v_total := v_total + (v_delivery_unit_price * v_delivery.quantity);
  end loop;

  insert into public.orders (
    user_id, order_number, customer_name, status, total, items,
    customer_note, stock_deducted, updated_at
  ) values (
    v_user_id, p_order_number,
    coalesce(nullif(btrim(p_customer_name), ''), 'Client Nostra Motors'),
    'pending', v_total, v_items,
    nullif(btrim(coalesce(p_customer_note, '')), ''), true, now()
  ) returning id into v_order_id;

  delete from public.cart_items
  where user_id = v_user_id and item_type in ('vehicle', 'delivery');

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', p_order_number,
    'total', v_total
  );
end;
$$;

-- Les permissions du moteur historique restent inchangées, mais on les réaffirme.
revoke all on function public.place_nostra_order_v93(text,text,text) from public, anon;
grant execute on function public.place_nostra_order_v93(text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Réservations : le tarif 5 % est enregistré au paiement de l'acompte.
-- ---------------------------------------------------------------------------

create or replace function public.checkout_vehicle_reservation_deposits_v160(
  p_customer_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then raise exception using message = 'not_authenticated'; end if;

  v_result := public.checkout_vehicle_reservation_deposits_v93(p_customer_name);

  update public.vehicle_reservations
  set delivery_fee = case
        when delivery_mode = 'home' then round(greatest(coalesce(vehicle_price, 0), 0) * 0.05, 2)
        else 0
      end,
      updated_at = now()
  where user_id = v_user_id
    and status = 'pending_validation'
    and deposit_paid_at = now();

  return v_result;
end;
$$;

revoke all on function public.checkout_vehicle_reservation_deposits_v160(text) from public, anon;
grant execute on function public.checkout_vehicle_reservation_deposits_v160(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Financement 3x / 4x : même règle de 5 %.
-- ---------------------------------------------------------------------------

create or replace function public.submit_vehicle_financing_v160(
  p_vehicle_id bigint,
  p_term_count integer,
  p_delivery_mode text,
  p_delivery_address text default null,
  p_delivery_phone text default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
  v_application_id bigint;
  v_delivery_fee numeric(14,2) := 0;
begin
  if v_user_id is null then raise exception using message = 'not_authenticated'; end if;

  v_result := public.submit_vehicle_financing_v125(
    p_vehicle_id,
    p_term_count,
    p_delivery_mode,
    p_delivery_address,
    p_delivery_phone,
    p_customer_name,
    p_customer_phone,
    p_customer_note
  );

  v_application_id := nullif(v_result ->> 'application_id', '')::bigint;

  if v_application_id is not null then
    update public.vehicle_financing_applications
    set delivery_fee = case
          when delivery_mode = 'home' then round(greatest(coalesce(vehicle_price, 0), 0) * 0.05, 2)
          else 0
        end,
        updated_at = now()
    where id = v_application_id
      and user_id = v_user_id
    returning delivery_fee into v_delivery_fee;
  end if;

  return v_result || jsonb_build_object(
    'delivery_rate_percent', 5,
    'delivery_fee', coalesce(v_delivery_fee, 0)
  );
end;
$$;

revoke all on function public.submit_vehicle_financing_v160(bigint,integer,text,text,text,text,text,text) from public, anon;
grant execute on function public.submit_vehicle_financing_v160(bigint,integer,text,text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Corrige uniquement les paniers non finalisés encore au vieux forfait.
--    Les anciennes commandes / réservations / financements déjà validés ne sont pas modifiés.
-- ---------------------------------------------------------------------------

update public.cart_items delivery
set unit_price = round(greatest(coalesce(vehicle.unit_price, 0), 0) * 0.05, 2),
    original_unit_price = round(greatest(coalesce(vehicle.unit_price, 0), 0) * 0.05, 2)
from public.cart_items vehicle
where delivery.item_type = 'delivery'
  and vehicle.item_type = 'vehicle'
  and delivery.user_id = vehicle.user_id
  and delivery.related_vehicle_id = vehicle.vehicle_id
  and delivery.locked = false;

commit;

-- Vérifications utiles après exécution :
select
  to_regprocedure('public.nostra_prepare_cart_delivery_v160(text,text,text)') as preparation_panier,
  to_regprocedure('public.checkout_vehicle_reservation_deposits_v160(text)') as reservations_5_pourcent,
  to_regprocedure('public.submit_vehicle_financing_v160(bigint,integer,text,text,text,text,text,text)') as financement_5_pourcent,
  to_regprocedure('public.place_nostra_order_v93(text,text,text)') as moteur_commande_dynamique;
