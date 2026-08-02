-- NOSTRA GROUP — V127
-- Contrôle indépendant de la réservation et de la vente, véhicule par véhicule.
--
-- Effets :
--   - ajoute les deux autorisations sur catalog_vehicles ;
--   - permet à la Direction de les modifier depuis les catalogues ;
--   - retire du panier les achats directs devenus indisponibles ;
--   - bloque en base toute nouvelle vente ou réservation interdite ;
--   - conserve les commandes, réservations et financements déjà validés.
--
-- Prérequis : V98 déjà installée.
-- Script réexécutable.

begin;

-- ==========================================================================
-- A. AUTORISATIONS INDIVIDUELLES
-- ==========================================================================

alter table public.catalog_vehicles
  add column if not exists reservation_enabled boolean not null default true;

alter table public.catalog_vehicles
  add column if not exists sale_enabled boolean not null default true;

comment on column public.catalog_vehicles.reservation_enabled is
  'Autorise une nouvelle réservation avec acompte pour ce véhicule.';

comment on column public.catalog_vehicles.sale_enabled is
  'Autorise une nouvelle commande directe ou un nouveau dossier de financement pour ce véhicule.';

-- ==========================================================================
-- B. MODIFICATION SÉCURISÉE DEPUIS LE DASHBOARD
-- ==========================================================================

create or replace function public.set_vehicle_commerce_availability_v99(
  p_vehicle_id bigint,
  p_reservation_enabled boolean,
  p_sale_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle_id bigint;
  v_removed_reservations integer := 0;
  v_removed_sales integer := 0;
  v_removed_deliveries integer := 0;
begin
  if not public.nostra_is_manager_v98() then
    raise exception using message = 'forbidden';
  end if;

  select vehicle.id
  into v_vehicle_id
  from public.catalog_vehicles vehicle
  where vehicle.id = p_vehicle_id
  for update;

  if v_vehicle_id is null then
    raise exception using message = 'vehicle_not_found';
  end if;

  update public.catalog_vehicles
  set reservation_enabled = coalesce(p_reservation_enabled, false),
      sale_enabled = coalesce(p_sale_enabled, false),
      updated_at = now(),
      updated_by = auth.uid()
  where id = v_vehicle_id;

  -- Les acomptes non réglés sont retirés du panier. Les réservations déjà
  -- payées ou validées restent intactes.
  if not coalesce(p_reservation_enabled, false) then
    delete from public.cart_items
    where vehicle_id = v_vehicle_id
      and item_type = 'reservation_deposit';
    get diagnostics v_removed_reservations = row_count;
  end if;

  -- Les commandes directes non payées et leur livraison sont retirées.
  -- Les soldes de réservation et échéances de financement existants restent.
  if not coalesce(p_sale_enabled, false) then
    delete from public.cart_items
    where related_vehicle_id = v_vehicle_id
      and item_type = 'delivery';
    get diagnostics v_removed_deliveries = row_count;

    delete from public.cart_items
    where vehicle_id = v_vehicle_id
      and item_type = 'vehicle';
    get diagnostics v_removed_sales = row_count;
  end if;

  return jsonb_build_object(
    'vehicle_id', v_vehicle_id,
    'reservation_enabled', coalesce(p_reservation_enabled, false),
    'sale_enabled', coalesce(p_sale_enabled, false),
    'removed_unpaid_reservations', v_removed_reservations,
    'removed_unpaid_sales', v_removed_sales,
    'removed_delivery_lines', v_removed_deliveries
  );
end;
$$;

revoke all on function public.set_vehicle_commerce_availability_v99(
  bigint,
  boolean,
  boolean
) from public, anon;

grant execute on function public.set_vehicle_commerce_availability_v99(
  bigint,
  boolean,
  boolean
) to authenticated;

-- ==========================================================================
-- C. PROTECTION CONTRE LE CONTOURNEMENT DE L'INTERFACE
-- ==========================================================================

create or replace function public.enforce_vehicle_commerce_v127()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_enabled boolean := true;
  v_sale_enabled boolean := true;
  v_vehicle_id bigint;
begin
  if coalesce(new.item_type, '') = 'reservation_deposit' then
    v_vehicle_id := new.vehicle_id;
  elsif coalesce(new.item_type, '') = 'vehicle' then
    v_vehicle_id := new.vehicle_id;
  elsif coalesce(new.item_type, '') = 'delivery' then
    v_vehicle_id := new.related_vehicle_id;
  else
    return new;
  end if;

  if v_vehicle_id is null then
    return new;
  end if;

  select
    coalesce(vehicle.reservation_enabled, true),
    coalesce(vehicle.sale_enabled, true)
  into v_reservation_enabled, v_sale_enabled
  from public.catalog_vehicles vehicle
  where vehicle.id = v_vehicle_id;

  if not found then
    raise exception using message = 'vehicle_unavailable';
  end if;

  if coalesce(new.item_type, '') = 'reservation_deposit'
     and not v_reservation_enabled then
    raise exception using message = 'vehicle_reservation_disabled';
  end if;

  if coalesce(new.item_type, '') in ('vehicle', 'delivery')
     and not v_sale_enabled then
    raise exception using message = 'vehicle_sale_disabled';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_vehicle_commerce_v127
  on public.cart_items;

create trigger enforce_vehicle_commerce_v127
before insert or update of item_type, vehicle_id, related_vehicle_id
on public.cart_items
for each row
execute function public.enforce_vehicle_commerce_v127();

commit;

select
  true as v127_prete,
  'V127 prête · vente véhicule par véhicule'::text as resultat;
