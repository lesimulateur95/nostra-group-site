-- NOSTRA GROUP — V135
-- Suppression sécurisée des dossiers de financement par le Gérant.
-- Les échéances et lignes de panier liées sont supprimées automatiquement.
-- Un véhicule réservé est remis en stock si le financement n'est pas terminé.

begin;

create or replace function public.delete_vehicle_financing_application_v135(
  p_application_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.vehicle_financing_applications%rowtype;
  v_stock_restored boolean := false;
begin
  if not public.nostra_is_manager_v125() then
    raise exception using message = 'manager_required';
  end if;

  if coalesce(p_application_id, 0) <= 0 then
    raise exception using message = 'invalid_financing_application';
  end if;

  select * into v_application
  from public.vehicle_financing_applications
  where id = p_application_id
  for update;

  if not found then
    raise exception using message = 'financing_not_found';
  end if;

  -- Les financements acceptés ont déjà retiré une unité du stock.
  -- Une commande entièrement payée reste définitive et ne restitue pas le stock.
  if v_application.stock_reserved
     and v_application.status in ('deposit_due', 'active')
     and v_application.final_order_id is null then
    update public.catalog_vehicles
    set stock_quantity = greatest(coalesce(stock_quantity, 0), 0) + 1,
        updated_at = now()
    where id = v_application.vehicle_id;
    v_stock_restored := found;
  end if;

  delete from public.cart_items
  where financing_application_id = v_application.id;

  -- Les échéances sont supprimées par la cascade de la clé étrangère.
  -- La commande finale éventuelle est volontairement conservée.
  delete from public.vehicle_financing_applications
  where id = v_application.id;

  return jsonb_build_object(
    'status', 'deleted',
    'application_id', v_application.id,
    'application_number', v_application.application_number,
    'stock_restored', v_stock_restored,
    'final_order_preserved', v_application.final_order_id is not null
  );
end;
$$;

revoke all on function public.delete_vehicle_financing_application_v135(bigint)
  from public, anon;
grant execute on function public.delete_vehicle_financing_application_v135(bigint)
  to authenticated;

commit;

select
  'V135 prête · suppression des dossiers de financement activée' as resultat,
  to_regprocedure('public.delete_vehicle_financing_application_v135(bigint)') is not null
    as suppression_securisee;
