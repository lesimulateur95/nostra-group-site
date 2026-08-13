-- NOSTRA GROUP — V151
-- Nouveau catalogue officiel « Catalogue concession » dans Nostra Motors.
-- Script réexécutable. Il ne supprime aucun véhicule ni aucune commande.

begin;

-- ==========================================================================
-- 1. AUTORISER LE TYPE « concession » DANS catalog_vehicles
-- ==========================================================================

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.catalog_vehicles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%catalog_type%'
  loop
    execute format(
      'alter table public.catalog_vehicles drop constraint if exists %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.catalog_vehicles
  add constraint catalog_vehicles_catalog_type_v151_check
  check (catalog_type in ('standard', 'concession', 'heavy', 'exclusive', 'used')) not valid;

alter table public.catalog_vehicles
  validate constraint catalog_vehicles_catalog_type_v151_check;

-- ==========================================================================
-- 2. AJOUTER LE CATALOGUE AUX RÉGLAGES DE RÉSERVATION EXISTANTS
-- ==========================================================================

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.vehicle_reservation_catalog_settings_v98') is not null then
    for constraint_row in
      select conname
      from pg_constraint
      where conrelid = 'public.vehicle_reservation_catalog_settings_v98'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%catalog_type%'
    loop
      execute format(
        'alter table public.vehicle_reservation_catalog_settings_v98 drop constraint if exists %I',
        constraint_row.conname
      );
    end loop;

    alter table public.vehicle_reservation_catalog_settings_v98
      add constraint vehicle_reservation_catalog_settings_v151_catalog_check
      check (catalog_type in ('standard', 'concession', 'exclusive', 'heavy', 'used')) not valid;

    alter table public.vehicle_reservation_catalog_settings_v98
      validate constraint vehicle_reservation_catalog_settings_v151_catalog_check;

    insert into public.vehicle_reservation_catalog_settings_v98 (
      catalog_type,
      reservations_enabled
    ) values ('concession', true)
    on conflict (catalog_type) do nothing;
  end if;
end;
$$;

-- ==========================================================================
-- 3. RPC V98 : LE NOUVEAU CATALOGUE PEUT ÊTRE OUVERT/FERMÉ INDÉPENDAMMENT
-- ==========================================================================

create or replace function public.set_vehicle_reservation_catalog_v98(
  p_catalog_type text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog_type text := lower(btrim(coalesce(p_catalog_type, '')));
  v_deleted_cart_lines integer := 0;
begin
  if not public.nostra_is_manager_v98() then
    raise exception using message = 'forbidden';
  end if;

  if v_catalog_type not in ('standard', 'concession', 'exclusive', 'heavy', 'used') then
    raise exception using message = 'invalid_catalog_type';
  end if;

  insert into public.vehicle_reservation_catalog_settings_v98 (
    catalog_type,
    reservations_enabled,
    updated_at,
    updated_by
  ) values (
    v_catalog_type,
    coalesce(p_enabled, false),
    now(),
    auth.uid()
  )
  on conflict (catalog_type) do update
  set reservations_enabled = excluded.reservations_enabled,
      updated_at = now(),
      updated_by = auth.uid();

  if not coalesce(p_enabled, false) then
    delete from public.cart_items cart
    using public.catalog_vehicles vehicle
    where cart.item_type = 'reservation_deposit'
      and cart.vehicle_id = vehicle.id
      and coalesce(vehicle.catalog_type, 'standard') = v_catalog_type;

    get diagnostics v_deleted_cart_lines = row_count;
  end if;

  return jsonb_build_object(
    'catalog_type', v_catalog_type,
    'reservations_enabled', coalesce(p_enabled, false),
    'removed_unpaid_deposits', v_deleted_cart_lines
  );
end;
$$;

create or replace function public.set_all_vehicle_reservations_v98(
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_cart_lines integer := 0;
begin
  if not public.nostra_is_manager_v98() then
    raise exception using message = 'forbidden';
  end if;

  insert into public.vehicle_reservation_catalog_settings_v98 (
    catalog_type,
    reservations_enabled,
    updated_at,
    updated_by
  )
  values
    ('standard', coalesce(p_enabled, false), now(), auth.uid()),
    ('concession', coalesce(p_enabled, false), now(), auth.uid()),
    ('exclusive', coalesce(p_enabled, false), now(), auth.uid()),
    ('heavy', coalesce(p_enabled, false), now(), auth.uid()),
    ('used', coalesce(p_enabled, false), now(), auth.uid())
  on conflict (catalog_type) do update
  set reservations_enabled = excluded.reservations_enabled,
      updated_at = now(),
      updated_by = auth.uid();

  if not coalesce(p_enabled, false) then
    delete from public.cart_items
    where item_type = 'reservation_deposit';

    get diagnostics v_deleted_cart_lines = row_count;
  end if;

  return jsonb_build_object(
    'reservations_enabled', coalesce(p_enabled, false),
    'removed_unpaid_deposits', v_deleted_cart_lines
  );
end;
$$;

revoke all on function public.set_vehicle_reservation_catalog_v98(text, boolean)
  from public, anon;
revoke all on function public.set_all_vehicle_reservations_v98(boolean)
  from public, anon;

grant execute on function public.set_vehicle_reservation_catalog_v98(text, boolean)
  to authenticated;
grant execute on function public.set_all_vehicle_reservations_v98(boolean)
  to authenticated;

commit;
