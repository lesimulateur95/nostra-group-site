-- Nostra Group V160.1 — Sélection multi-véhicules Nostra Motors
-- À exécuter APRÈS la V160.
-- Ajoute une sélection groupée atomique : tous les véhicules sont ajoutés ensemble,
-- puis le mode de récupération global est préparé par le moteur V160.
-- Aucun véhicule du catalogue Location ne peut entrer dans cette sélection groupée.

begin;

create or replace function public.nostra_add_vehicle_selection_to_cart_v1601(
  p_vehicle_ids bigint[],
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
  v_vehicle_id bigint;
  v_unique_ids bigint[];
  v_added_count integer := 0;
  v_delivery jsonb;
begin
  if v_user_id is null then
    raise exception using message = 'not_authenticated';
  end if;

  if coalesce(p_delivery_mode, '') not in ('showroom', 'home') then
    raise exception using message = 'invalid_delivery_mode';
  end if;

  select array_agg(id order by id)
  into v_unique_ids
  from (
    select distinct value as id
    from unnest(coalesce(p_vehicle_ids, array[]::bigint[])) as u(value)
    where value is not null and value > 0
    limit 50
  ) ids;

  if coalesce(array_length(v_unique_ids, 1), 0) = 0 then
    raise exception using message = 'selection_empty';
  end if;

  if exists (
    select 1
    from public.catalog_vehicles
    where id = any(v_unique_ids)
      and coalesce(catalog_type, 'standard') = 'concession'
  ) then
    raise exception using message = 'rental_selection_disabled';
  end if;

  -- Le tout se déroule dans le même appel PostgreSQL : si un véhicule échoue
  -- (stock, publication, statut occasion...), aucun ajout partiel n'est conservé.
  foreach v_vehicle_id in array v_unique_ids
  loop
    perform public.add_vehicle_purchase_to_cart_v93(
      v_vehicle_id,
      'showroom',
      null,
      null,
      'order'
    );
    v_added_count := v_added_count + 1;
  end loop;

  v_delivery := public.nostra_prepare_cart_delivery_v160(
    p_delivery_mode,
    case when p_delivery_mode = 'home' then p_delivery_address else null end,
    case when p_delivery_mode = 'home' then p_delivery_phone else null end
  );

  return jsonb_build_object(
    'added_count', v_added_count,
    'vehicle_ids', to_jsonb(v_unique_ids),
    'delivery', coalesce(v_delivery, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.nostra_add_vehicle_selection_to_cart_v1601(bigint[],text,text,text) from public, anon;
grant execute on function public.nostra_add_vehicle_selection_to_cart_v1601(bigint[],text,text,text) to authenticated;

commit;

select
  to_regprocedure('public.nostra_add_vehicle_selection_to_cart_v1601(bigint[],text,text,text)') is not null as selection_multi_v1601_active;
