-- NOSTRA GROUP — V98
-- Activation / désactivation des réservations avec acompte :
--   - réglage général pour tous les catalogues ;
--   - réglage indépendant par catalogue ;
--   - les commandes au prix total restent toujours disponibles ;
--   - les réservations déjà payées ou en cours ne sont jamais supprimées.
--
-- Prérequis : V93 Réserver / Commander déjà installée.
-- Script réexécutable, sans suppression des réservations existantes.

begin;

-- ==========================================================================
-- A. CONTRÔLE D’ACCÈS DIRECTION
-- ==========================================================================

create or replace function public.nostra_is_manager_v98()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      coalesce(
        auth.jwt() -> 'user_metadata' ->> 'provider_id',
        auth.jwt() -> 'user_metadata' ->> 'discord_id',
        auth.jwt() -> 'user_metadata' ->> 'sub'
      ) = '331843410962939908'
      or exists (
        select 1
        from public.member_profiles profile
        where profile.user_id = auth.uid()
          and (
            lower(coalesce(to_jsonb(profile) ->> 'role', ''))
              in ('manager', 'gerant', 'direction', 'administrator', 'admin')
            or lower(coalesce((to_jsonb(profile) -> 'roles')::text, ''))
              ~ '(manager|gerant|direction|administrator|admin)'
          )
      )
    );
$$;

revoke all on function public.nostra_is_manager_v98() from public, anon;
grant execute on function public.nostra_is_manager_v98() to authenticated;

-- ==========================================================================
-- B. PARAMÈTRES PAR CATALOGUE
-- ==========================================================================

create table if not exists public.vehicle_reservation_catalog_settings_v98 (
  catalog_type text primary key,
  reservations_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint vehicle_reservation_catalog_settings_v98_catalog_check
    check (catalog_type in ('standard', 'exclusive', 'heavy', 'used'))
);

insert into public.vehicle_reservation_catalog_settings_v98 (
  catalog_type,
  reservations_enabled
)
values
  ('standard', true),
  ('exclusive', true),
  ('heavy', true),
  ('used', true)
on conflict (catalog_type) do nothing;

alter table public.vehicle_reservation_catalog_settings_v98
  enable row level security;

drop policy if exists "reservation settings public read v98"
  on public.vehicle_reservation_catalog_settings_v98;
create policy "reservation settings public read v98"
  on public.vehicle_reservation_catalog_settings_v98
  for select
  to anon, authenticated
  using (true);

drop policy if exists "reservation settings manager write v98"
  on public.vehicle_reservation_catalog_settings_v98;
create policy "reservation settings manager write v98"
  on public.vehicle_reservation_catalog_settings_v98
  for all
  to authenticated
  using (public.nostra_is_manager_v98())
  with check (public.nostra_is_manager_v98());

grant select on public.vehicle_reservation_catalog_settings_v98
  to anon, authenticated;

-- ==========================================================================
-- C. MODIFICATION DEPUIS LE DASHBOARD
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

  if v_catalog_type not in ('standard', 'exclusive', 'heavy', 'used') then
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

  -- Lorsque les réservations ferment, on retire seulement les acomptes non
  -- payés des paniers. Aucune réservation déjà créée n’est supprimée.
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

-- ==========================================================================
-- D. PROTECTION EN BASE CONTRE LES CONTOURNEMENTS
-- ==========================================================================

create or replace function public.enforce_reservation_cart_setting_v98()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog_type text;
  v_enabled boolean;
begin
  if coalesce(new.item_type, '') <> 'reservation_deposit' then
    return new;
  end if;

  select coalesce(vehicle.catalog_type, 'standard')
  into v_catalog_type
  from public.catalog_vehicles vehicle
  where vehicle.id = new.vehicle_id;

  if v_catalog_type is null then
    return new;
  end if;

  select setting.reservations_enabled
  into v_enabled
  from public.vehicle_reservation_catalog_settings_v98 setting
  where setting.catalog_type = v_catalog_type;

  if coalesce(v_enabled, true) = false then
    raise exception using message = 'vehicle_reservations_disabled';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_reservation_cart_setting_v98
  on public.cart_items;
create trigger enforce_reservation_cart_setting_v98
before insert or update of item_type, vehicle_id
on public.cart_items
for each row
execute function public.enforce_reservation_cart_setting_v98();

create or replace function public.enforce_reservation_creation_setting_v98()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_catalog_type text := coalesce(nullif(btrim(new.catalog_type), ''), 'standard');
  v_enabled boolean;
begin
  select setting.reservations_enabled
  into v_enabled
  from public.vehicle_reservation_catalog_settings_v98 setting
  where setting.catalog_type = v_catalog_type;

  if coalesce(v_enabled, true) = false then
    raise exception using message = 'vehicle_reservations_disabled';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_reservation_creation_setting_v98
  on public.vehicle_reservations;
create trigger enforce_reservation_creation_setting_v98
before insert
on public.vehicle_reservations
for each row
execute function public.enforce_reservation_creation_setting_v98();

commit;

-- Vérification : les quatre lignes doivent apparaître.
select
  catalog_type,
  reservations_enabled,
  updated_at
from public.vehicle_reservation_catalog_settings_v98
order by catalog_type;
