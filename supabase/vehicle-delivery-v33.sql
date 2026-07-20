-- NOSTRA GROUP V33
-- Configuration d'achat véhicule + livraison showroom ou domicile.
-- Réexécutable : conserve les paniers, commandes et stocks existants.

alter table public.cart_items
  add column if not exists item_type text not null default 'vehicle';

alter table public.cart_items
  add column if not exists related_vehicle_id bigint;

alter table public.cart_items
  add column if not exists delivery_mode text;

update public.cart_items
set item_type = 'vehicle'
where item_type is null or item_type not in ('vehicle', 'delivery');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cart_items_item_type_check'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_item_type_check
      check (item_type in ('vehicle', 'delivery'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cart_items_delivery_mode_check'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      add constraint cart_items_delivery_mode_check
      check (delivery_mode is null or delivery_mode in ('showroom', 'home'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'cart_items_related_vehicle_id_fkey'
      and conrelid = 'public.cart_items'::regclass
  ) then
    alter table public.cart_items
      drop constraint cart_items_related_vehicle_id_fkey;
  end if;

  alter table public.cart_items
    add constraint cart_items_related_vehicle_id_fkey
    foreign key (related_vehicle_id)
    references public.catalog_vehicles(id)
    on delete cascade;
end $$;

create index if not exists cart_items_item_type_index
  on public.cart_items(user_id, item_type);

create index if not exists cart_items_related_vehicle_index
  on public.cart_items(user_id, related_vehicle_id);

create or replace function public.add_configured_vehicle_to_cart(
  p_vehicle_id bigint,
  p_delivery_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_vehicle public.catalog_vehicles%rowtype;
  v_vehicle_line public.cart_items%rowtype;
  v_delivery_line public.cart_items%rowtype;
  v_next_quantity integer;
  v_image_url text;
  v_item_name text;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if p_delivery_mode not in ('showroom', 'home') then
    raise exception using message = 'invalid_delivery_mode';
  end if;

  select *
  into v_vehicle
  from public.catalog_vehicles
  where id = p_vehicle_id
    and published = true
  for share;

  if not found then
    raise exception using message = 'vehicle_unavailable';
  end if;

  select *
  into v_vehicle_line
  from public.cart_items
  where user_id = v_user_id
    and item_type = 'vehicle'
    and vehicle_id = p_vehicle_id
  order by id
  limit 1
  for update;

  v_next_quantity := coalesce(v_vehicle_line.quantity, 0) + 1;

  if v_next_quantity > v_vehicle.stock_quantity then
    raise exception using message = 'insufficient_stock';
  end if;

  v_item_name := trim(v_vehicle.brand || ' ' || v_vehicle.model);
  v_image_url := case
    when jsonb_typeof(v_vehicle.images) = 'array'
      and jsonb_array_length(v_vehicle.images) > 0
    then v_vehicle.images -> 0 ->> 'url'
    else null
  end;

  if v_vehicle_line.id is null then
    insert into public.cart_items (
      user_id,
      vehicle_id,
      related_vehicle_id,
      item_type,
      delivery_mode,
      item_name,
      quantity,
      unit_price,
      image_url
    ) values (
      v_user_id,
      p_vehicle_id,
      null,
      'vehicle',
      p_delivery_mode,
      v_item_name,
      1,
      v_vehicle.price,
      v_image_url
    );
  else
    update public.cart_items
    set
      quantity = v_next_quantity,
      item_name = v_item_name,
      unit_price = v_vehicle.price,
      image_url = v_image_url,
      delivery_mode = p_delivery_mode
    where id = v_vehicle_line.id;
  end if;

  if p_delivery_mode = 'home' then
    select *
    into v_delivery_line
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'delivery'
      and related_vehicle_id = p_vehicle_id
    order by id
    limit 1
    for update;

    if v_delivery_line.id is null then
      insert into public.cart_items (
        user_id,
        vehicle_id,
        related_vehicle_id,
        item_type,
        delivery_mode,
        item_name,
        quantity,
        unit_price,
        image_url
      ) values (
        v_user_id,
        null,
        p_vehicle_id,
        'delivery',
        'home',
        'Livraison à domicile — ' || v_item_name,
        1,
        75000,
        null
      );
    else
      update public.cart_items
      set
        quantity = quantity + 1,
        item_name = 'Livraison à domicile — ' || v_item_name,
        unit_price = 75000,
        delivery_mode = 'home'
      where id = v_delivery_line.id;
    end if;
  end if;

  return jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'delivery_mode', p_delivery_mode,
    'delivery_price', case when p_delivery_mode = 'home' then 75000 else 0 end
  );
end;
$$;

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
  v_delivery record;
  v_vehicle_quantity integer;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'vehicle'
  ) then
    raise exception using message = 'empty_cart';
  end if;

  if exists (
    select 1
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'vehicle'
      and vehicle_id is null
  ) then
    raise exception using message = 'cart_needs_refresh';
  end if;

  for v_line in
    select
      vehicle_id,
      sum(quantity)::integer as quantity,
      max(image_url) as image_url
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'vehicle'
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
    set
      stock_quantity = stock_quantity - v_line.quantity,
      updated_at = now()
    where id = v_vehicle.id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_type', 'vehicle',
      'vehicle_id', v_vehicle.id,
      'name', trim(v_vehicle.brand || ' ' || v_vehicle.model),
      'quantity', v_line.quantity,
      'unit_price', v_vehicle.price,
      'image_url', coalesce(v_line.image_url, v_vehicle.images -> 0 ->> 'url')
    ));

    v_total := v_total + (v_vehicle.price * v_line.quantity);
  end loop;

  for v_delivery in
    select
      related_vehicle_id,
      sum(quantity)::integer as quantity
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'delivery'
    group by related_vehicle_id
    order by related_vehicle_id
  loop
    if v_delivery.related_vehicle_id is null then
      raise exception using message = 'invalid_delivery_cart';
    end if;

    select coalesce(sum(quantity), 0)::integer
    into v_vehicle_quantity
    from public.cart_items
    where user_id = v_user_id
      and item_type = 'vehicle'
      and vehicle_id = v_delivery.related_vehicle_id;

    if v_vehicle_quantity <= 0 or v_delivery.quantity > v_vehicle_quantity then
      raise exception using message = 'invalid_delivery_cart';
    end if;

    select id, brand, model
    into v_vehicle
    from public.catalog_vehicles
    where id = v_delivery.related_vehicle_id;

    if not found then
      raise exception using message = 'vehicle_unavailable';
    end if;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'item_type', 'delivery',
      'vehicle_id', null,
      'related_vehicle_id', v_vehicle.id,
      'name', 'Livraison à domicile — ' || trim(v_vehicle.brand || ' ' || v_vehicle.model),
      'quantity', v_delivery.quantity,
      'unit_price', 75000,
      'image_url', null
    ));

    v_total := v_total + (75000 * v_delivery.quantity);
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

  delete from public.cart_items
  where user_id = v_user_id;

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

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'order_not_found';
  end if;

  if v_order.stock_deducted and p_status = 'cancelled' then
    for v_item in
      select value
      from jsonb_array_elements(v_order.items)
    loop
      v_vehicle_id := nullif(v_item ->> 'vehicle_id', '')::bigint;
      v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));

      if v_vehicle_id is not null then
        update public.catalog_vehicles
        set
          stock_quantity = stock_quantity + v_quantity,
          updated_at = now()
        where id = v_vehicle_id;
      end if;
    end loop;

    v_order.stock_deducted := false;
  end if;

  if not v_order.stock_deducted
    and v_order.status = 'cancelled'
    and p_status <> 'cancelled'
  then
    for v_item in
      select value
      from jsonb_array_elements(v_order.items)
    loop
      v_vehicle_id := nullif(v_item ->> 'vehicle_id', '')::bigint;
      v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));

      if v_vehicle_id is not null then
        perform 1
        from public.catalog_vehicles
        where id = v_vehicle_id
          and stock_quantity >= v_quantity
        for update;

        if not found then
          raise exception using message = 'insufficient_stock';
        end if;

        update public.catalog_vehicles
        set
          stock_quantity = stock_quantity - v_quantity,
          updated_at = now()
        where id = v_vehicle_id;
      end if;
    end loop;

    v_order.stock_deducted := true;
  end if;

  update public.orders
  set
    status = p_status,
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

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception using message = 'order_not_found';
  end if;

  if v_order.stock_deducted then
    for v_item in
      select value
      from jsonb_array_elements(v_order.items)
    loop
      v_vehicle_id := nullif(v_item ->> 'vehicle_id', '')::bigint;
      v_quantity := greatest(1, coalesce((v_item ->> 'quantity')::integer, 1));

      if v_vehicle_id is not null then
        update public.catalog_vehicles
        set
          stock_quantity = stock_quantity + v_quantity,
          updated_at = now()
        where id = v_vehicle_id;
      end if;
    end loop;
  end if;

  delete from public.orders
  where id = p_order_id;
end;
$$;

revoke all on function public.add_configured_vehicle_to_cart(bigint,text) from public;
revoke all on function public.place_nostra_order(text,text,text) from public;
revoke all on function public.update_nostra_order(bigint,text,text) from public;
revoke all on function public.delete_nostra_order(bigint) from public;

grant execute on function public.add_configured_vehicle_to_cart(bigint,text) to authenticated;
grant execute on function public.place_nostra_order(text,text,text) to authenticated;
grant execute on function public.update_nostra_order(bigint,text,text) to authenticated;
grant execute on function public.delete_nostra_order(bigint) to authenticated;

notify pgrst, 'reload schema';
