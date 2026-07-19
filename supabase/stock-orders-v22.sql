-- NOSTRA GROUP — Stock catalogue, panier et commandes V22
-- Script réexécutable : il conserve les véhicules, paniers et commandes existants.

alter table public.catalog_vehicles
  add column if not exists stock_quantity integer not null default 0;

alter table public.orders
  add column if not exists stock_deducted boolean not null default false;

alter table public.cart_items
  add column if not exists vehicle_id bigint;

-- Rattache les anciens paniers aux véhicules du catalogue lorsque le nom correspond.
update public.cart_items as cart
set vehicle_id = vehicle.id
from public.catalog_vehicles as vehicle
where cart.vehicle_id is null
  and lower(trim(cart.item_name)) = lower(trim(vehicle.brand || ' ' || vehicle.model));

-- Supprime les lignes de panier orphelines : elles ne correspondent plus à aucun véhicule.
delete from public.cart_items
where vehicle_id is null;

-- Empêche un stock négatif.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalog_vehicles_stock_quantity_check'
      and conrelid = 'public.catalog_vehicles'::regclass
  ) then
    alter table public.catalog_vehicles
      add constraint catalog_vehicles_stock_quantity_check
      check (stock_quantity >= 0);
  end if;
end $$;

create index if not exists cart_items_vehicle_id_index
on public.cart_items (vehicle_id);

-- La suppression d'un véhicule nettoie automatiquement tous les paniers.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'cart_items_vehicle_id_fkey'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items drop constraint cart_items_vehicle_id_fkey;
  end if;

  alter table public.cart_items
    add constraint cart_items_vehicle_id_fkey
    foreign key (vehicle_id)
    references public.catalog_vehicles(id)
    on delete cascade;
end $$;

-- Les citoyens ne créent plus les commandes directement : la fonction ci-dessous
-- vérifie le stock et effectue toute l'opération dans une seule transaction.
drop policy if exists "users create own orders" on public.orders;

create or replace function public.place_nostra_order(
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
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if not exists (select 1 from public.cart_items where user_id = v_user_id) then
    raise exception using message = 'empty_cart';
  end if;

  if exists (
    select 1 from public.cart_items
    where user_id = v_user_id and vehicle_id is null
  ) then
    raise exception using message = 'cart_needs_refresh';
  end if;

  for v_line in
    select vehicle_id, sum(quantity)::integer as quantity, max(image_url) as image_url
    from public.cart_items
    where user_id = v_user_id
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
    set stock_quantity = stock_quantity - v_line.quantity,
        updated_at = now()
    where id = v_vehicle.id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'vehicle_id', v_vehicle.id,
      'name', trim(v_vehicle.brand || ' ' || v_vehicle.model),
      'quantity', v_line.quantity,
      'unit_price', v_vehicle.price,
      'image_url', coalesce(v_line.image_url, v_vehicle.images -> 0 ->> 'url')
    ));
    v_total := v_total + (v_vehicle.price * v_line.quantity);
  end loop;

  insert into public.orders (
    user_id,
    order_number,
    customer_name,
    status,
    total,
    items,
    customer_note,
    stock_deducted,
    updated_at
  ) values (
    v_user_id,
    p_order_number,
    coalesce(nullif(trim(p_customer_name), ''), 'Client Nostra Motors'),
    'pending',
    v_total,
    v_items,
    nullif(trim(coalesce(p_customer_note, '')), ''),
    true,
    now()
  )
  returning id into v_order_id;

  delete from public.cart_items where user_id = v_user_id;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', p_order_number,
    'total', v_total
  );
end;
$$;

create or replace function public.update_nostra_order(
  p_order_id bigint,
  p_status text,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_vehicle_id bigint;
  v_quantity integer;
begin
  if not public.has_nostra_dashboard_access() then
    raise exception using message = 'forbidden';
  end if;

  if p_status not in ('pending','confirmed','preparing','ready','completed','cancelled') then
    raise exception using message = 'invalid_status';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'order_not_found';
  end if;

  -- Une annulation remet immédiatement les véhicules dans le stock, une seule fois.
  if v_order.stock_deducted and p_status = 'cancelled' then
    for v_item in select value from jsonb_array_elements(v_order.items)
    loop
      v_vehicle_id := nullif(v_item ->> 'vehicle_id', '')::bigint;
      v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
      if v_vehicle_id is not null then
        update public.catalog_vehicles
        set stock_quantity = stock_quantity + v_quantity,
            updated_at = now()
        where id = v_vehicle_id;
      end if;
    end loop;
    v_order.stock_deducted := false;
  end if;

  -- Si une commande annulée est réactivée, le stock est de nouveau réservé.
  if not v_order.stock_deducted and v_order.status = 'cancelled' and p_status <> 'cancelled' then
    for v_item in select value from jsonb_array_elements(v_order.items)
    loop
      v_vehicle_id := nullif(v_item ->> 'vehicle_id', '')::bigint;
      v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
      if v_vehicle_id is null then
        raise exception using message = 'order_without_stock_links';
      end if;

      perform 1
      from public.catalog_vehicles
      where id = v_vehicle_id and stock_quantity >= v_quantity
      for update;

      if not found then
        raise exception using message = 'insufficient_stock';
      end if;

      update public.catalog_vehicles
      set stock_quantity = stock_quantity - v_quantity,
          updated_at = now()
      where id = v_vehicle_id;
    end loop;
    v_order.stock_deducted := true;
  end if;

  update public.orders
  set status = p_status,
      admin_note = nullif(trim(coalesce(p_admin_note, '')), ''),
      stock_deducted = v_order.stock_deducted,
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function public.delete_nostra_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_vehicle_id bigint;
  v_quantity integer;
begin
  if not public.has_nostra_dashboard_access() then
    raise exception using message = 'forbidden';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'order_not_found';
  end if;

  if v_order.stock_deducted then
    for v_item in select value from jsonb_array_elements(v_order.items)
    loop
      v_vehicle_id := nullif(v_item ->> 'vehicle_id', '')::bigint;
      v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));
      if v_vehicle_id is not null then
        update public.catalog_vehicles
        set stock_quantity = stock_quantity + v_quantity,
            updated_at = now()
        where id = v_vehicle_id;
      end if;
    end loop;
  end if;

  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.place_nostra_order(text,text,text) from public;
revoke all on function public.update_nostra_order(bigint,text,text) from public;
revoke all on function public.delete_nostra_order(bigint) from public;

grant execute on function public.place_nostra_order(text,text,text) to authenticated;
grant execute on function public.update_nostra_order(bigint,text,text) to authenticated;
grant execute on function public.delete_nostra_order(bigint) to authenticated;
