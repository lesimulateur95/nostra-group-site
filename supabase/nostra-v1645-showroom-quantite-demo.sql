-- Nostra Motors V164.5
-- Gestion directe des quantités SHOWROOM + DÉMONSTRATION par modèle.
-- Prérequis : V164 puis V164.3 déjà exécutés.

create or replace function public.nostra_set_showroom_demo_quantities_v1645(
  p_vehicle_id bigint,
  p_showroom_quantity integer,
  p_demo_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_showroom_target integer := greatest(coalesce(p_showroom_quantity, 0), 0);
  v_demo_target integer := greatest(coalesce(p_demo_quantity, 0), 0);
  v_showroom_current integer := 0;
  v_demo_current integer := 0;
  v_allocatable integer := 0;
  v_delta integer := 0;
begin
  if not (
    public.nostra_v164_is_manager()
    or public.nostra_v164_has_permission('inventory_manage')
    or public.nostra_v164_has_permission('catalogue_manage')
  ) then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1 from public.catalog_vehicles where id = p_vehicle_id
  ) then
    raise exception 'vehicle_not_found';
  end if;

  if v_demo_target > v_showroom_target then
    raise exception 'demo_exceeds_showroom';
  end if;

  -- Les unités mobilisables comprennent le stock, les arrivées et celles déjà au showroom,
  -- à condition qu'elles ne soient pas liées à une réservation ou une commande.
  select count(*)::integer
  into v_allocatable
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id = p_vehicle_id
    and status in ('stock', 'arrived', 'showroom')
    and hold_id is null
    and order_id is null;

  if v_showroom_target > v_allocatable then
    raise exception 'showroom_quantity_exceeds_available';
  end if;

  select count(*)::integer,
         count(*) filter (where coalesce(is_demo, false) = true)::integer
  into v_showroom_current, v_demo_current
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id = p_vehicle_id
    and status = 'showroom'
    and hold_id is null
    and order_id is null;

  -- Si on réduit le nombre de démos, on retire d'abord le statut démo aux unités en trop.
  if v_demo_current > v_demo_target then
    update public.motors_physical_vehicle_units_v162 u
    set is_demo = false,
        demo_mileage = 0,
        demo_original_price = null,
        demo_note = null,
        updated_at = now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id = p_vehicle_id
        and x.status = 'showroom'
        and coalesce(x.is_demo, false) = true
        and x.hold_id is null
        and x.order_id is null
      order by x.id desc
      limit (v_demo_current - v_demo_target)
    );
  end if;

  -- Ajustement du nombre d'exemplaires physiquement présents au showroom.
  select count(*)::integer
  into v_showroom_current
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id = p_vehicle_id
    and status = 'showroom'
    and hold_id is null
    and order_id is null;

  v_delta := v_showroom_target - v_showroom_current;

  if v_delta > 0 then
    update public.motors_physical_vehicle_units_v162 u
    set status = 'showroom',
        location = 'Showroom Nostra Motors',
        showroom_since = coalesce(u.showroom_since, now()),
        updated_at = now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id = p_vehicle_id
        and x.status in ('stock', 'arrived')
        and x.hold_id is null
        and x.order_id is null
      order by case x.status when 'stock' then 1 else 2 end, x.id
      limit v_delta
    );
  elsif v_delta < 0 then
    -- Les démos conservées restent au showroom. On retire uniquement des unités non-démo.
    update public.motors_physical_vehicle_units_v162 u
    set status = 'stock',
        location = 'Stock Nostra Motors',
        showroom_since = null,
        updated_at = now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id = p_vehicle_id
        and x.status = 'showroom'
        and coalesce(x.is_demo, false) = false
        and x.hold_id is null
        and x.order_id is null
      order by x.id desc
      limit abs(v_delta)
    );
  end if;

  -- Ajustement final du nombre de véhicules de démonstration parmi les unités showroom.
  select count(*) filter (where coalesce(is_demo, false) = true)::integer
  into v_demo_current
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id = p_vehicle_id
    and status = 'showroom'
    and hold_id is null
    and order_id is null;

  if v_demo_current < v_demo_target then
    update public.motors_physical_vehicle_units_v162 u
    set is_demo = true,
        demo_mileage = greatest(coalesce(u.demo_mileage, 0), 0),
        showroom_since = coalesce(u.showroom_since, now()),
        updated_at = now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id = p_vehicle_id
        and x.status = 'showroom'
        and coalesce(x.is_demo, false) = false
        and x.hold_id is null
        and x.order_id is null
      order by x.id
      limit (v_demo_target - v_demo_current)
    );
  elsif v_demo_current > v_demo_target then
    update public.motors_physical_vehicle_units_v162 u
    set is_demo = false,
        demo_mileage = 0,
        demo_original_price = null,
        demo_note = null,
        updated_at = now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id = p_vehicle_id
        and x.status = 'showroom'
        and coalesce(x.is_demo, false) = true
        and x.hold_id is null
        and x.order_id is null
      order by x.id desc
      limit (v_demo_current - v_demo_target)
    );
  end if;

  select count(*)::integer,
         count(*) filter (where coalesce(is_demo, false) = true)::integer
  into v_showroom_current, v_demo_current
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id = p_vehicle_id
    and status = 'showroom'
    and hold_id is null
    and order_id is null;

  if v_showroom_current <> v_showroom_target then
    raise exception 'showroom_quantity_exceeds_available';
  end if;

  if v_demo_current <> v_demo_target then
    raise exception 'demo_exceeds_showroom';
  end if;

  return jsonb_build_object(
    'vehicle_id', p_vehicle_id,
    'showroom_quantity', v_showroom_current,
    'demo_quantity', v_demo_current,
    'stock_quantity', greatest(v_allocatable - v_showroom_current, 0)
  );
end;
$$;

grant execute on function public.nostra_set_showroom_demo_quantities_v1645(bigint, integer, integer) to authenticated;
