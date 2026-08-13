-- NOSTRA GROUP — V152
-- Showroom Nostra Motors
-- Permet à la Direction d'indiquer quels véhicules du catalogue sont
-- physiquement présents dans le showroom de la concession.
-- Script réexécutable. Aucun véhicule ni commande n'est supprimé.

begin;

alter table public.catalog_vehicles
  add column if not exists showroom_visible boolean not null default false;

alter table public.catalog_vehicles
  add column if not exists showroom_updated_at timestamptz;

alter table public.catalog_vehicles
  add column if not exists showroom_updated_by uuid;

create index if not exists catalog_vehicles_showroom_visible_v152_idx
  on public.catalog_vehicles (showroom_visible, showroom_updated_at desc)
  where showroom_visible = true;

create or replace function public.set_vehicle_showroom_v152(
  p_vehicle_id bigint,
  p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if not public.nostra_v137_has_any_role(array['manager','employee','commercial']) then
    raise exception using message = 'forbidden';
  end if;

  if coalesce(p_vehicle_id, 0) <= 0 then
    raise exception using message = 'invalid_vehicle';
  end if;

  update public.catalog_vehicles
  set showroom_visible = coalesce(p_visible, false),
      showroom_updated_at = now(),
      showroom_updated_by = auth.uid()
  where id = p_vehicle_id
    and coalesce(catalog_type, 'standard') <> 'used';

  get diagnostics v_updated = row_count;

  return v_updated > 0;
end;
$$;

revoke all on function public.set_vehicle_showroom_v152(bigint, boolean)
  from public, anon;

grant execute on function public.set_vehicle_showroom_v152(bigint, boolean)
  to authenticated;

commit;
