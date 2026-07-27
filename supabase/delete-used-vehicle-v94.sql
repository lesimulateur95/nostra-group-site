-- NOSTRA GROUP — Correction V94
-- Suppression fiable d'un véhicule d'occasion après l'installation V93.
--
-- Cette fonction :
--   • refuse la suppression s'il existe une commande/réservation active ;
--   • refuse la suppression s'il existe une vente terminée ;
--   • nettoie les lignes de panier abandonnées ;
--   • nettoie uniquement les réservations refusées ou annulées ;
--   • supprime ensuite la fiche d'occasion et le véhicule du catalogue.

begin;

create or replace function public.nostra_can_delete_used_vehicle_v94()
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
              in ('manager', 'gerant', 'gérant', 'direction', 'administrator', 'admin')
            or lower(coalesce((to_jsonb(profile) -> 'roles')::text, ''))
              ~ '(manager|gerant|gérant|direction|administrator|admin)'
          )
      )
    );
$$;

create or replace function public.delete_used_vehicle_v94(p_vehicle_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.catalog_vehicles%rowtype;
begin
  if not public.nostra_can_delete_used_vehicle_v94() then
    raise exception using message = 'forbidden';
  end if;

  select * into v_vehicle
  from public.catalog_vehicles
  where id = p_vehicle_id
    and coalesce(catalog_type, 'standard') = 'used'
  for update;

  if not found then
    raise exception using message = 'vehicle_not_found';
  end if;

  -- Une réservation réellement en cours doit être traitée avant suppression.
  if to_regclass('public.vehicle_reservations') is not null and exists (
    select 1
    from public.vehicle_reservations reservation
    where reservation.vehicle_id = p_vehicle_id
      and reservation.status in ('pending_validation', 'balance_due', 'paid_full')
  ) then
    raise exception using message = 'vehicle_has_active_order';
  end if;

  -- Une réservation/vente terminée constitue un historique à conserver.
  if to_regclass('public.vehicle_reservations') is not null and exists (
    select 1
    from public.vehicle_reservations reservation
    where reservation.vehicle_id = p_vehicle_id
      and reservation.status = 'completed'
  ) then
    raise exception using message = 'vehicle_has_sales';
  end if;

  -- Les commandes sont stockées sous forme de lignes JSON dans orders.items.
  if exists (
    select 1
    from public.orders order_row
    cross join lateral jsonb_array_elements(coalesce(order_row.items, '[]'::jsonb)) item
    where coalesce(item ->> 'vehicle_id', '') ~ '^[0-9]+$'
      and (item ->> 'vehicle_id')::bigint = p_vehicle_id
      and order_row.status <> 'cancelled'
      and order_row.status <> 'completed'
  ) then
    raise exception using message = 'vehicle_has_active_order';
  end if;

  if exists (
    select 1
    from public.orders order_row
    cross join lateral jsonb_array_elements(coalesce(order_row.items, '[]'::jsonb)) item
    where coalesce(item ->> 'vehicle_id', '') ~ '^[0-9]+$'
      and (item ->> 'vehicle_id')::bigint = p_vehicle_id
      and order_row.status = 'completed'
  ) then
    raise exception using message = 'vehicle_has_sales';
  end if;

  -- Un article simplement présent dans un panier n'est pas une commande.
  delete from public.cart_items
  where vehicle_id = p_vehicle_id
     or related_vehicle_id = p_vehicle_id;

  -- Les réservations refusées/annulées ne doivent plus bloquer la FK V93.
  if to_regclass('public.vehicle_reservations') is not null then
    delete from public.vehicle_reservations
    where vehicle_id = p_vehicle_id
      and status in ('rejected', 'cancelled');
  end if;

  -- La fiche complémentaire V92 peut posséder une clé étrangère restrictive.
  if to_regclass('public.used_vehicle_details') is not null then
    execute 'delete from public.used_vehicle_details where vehicle_id = $1'
      using p_vehicle_id;
  end if;

  delete from public.catalog_vehicles
  where id = p_vehicle_id
    and coalesce(catalog_type, 'standard') = 'used';

  if not found then
    raise exception using message = 'vehicle_not_found';
  end if;

  return jsonb_build_object('deleted', true, 'vehicle_id', p_vehicle_id);
end;
$$;

revoke all on function public.nostra_can_delete_used_vehicle_v94() from public, anon, authenticated;
revoke all on function public.delete_used_vehicle_v94(bigint) from public, anon;

grant execute on function public.delete_used_vehicle_v94(bigint) to authenticated;

notify pgrst, 'reload schema';

commit;
