-- NOSTRA GROUP V164.3 — Gestion Showroom par exemplaire physique
-- À exécuter APRÈS V162 et V164.
-- Objectif : ne plus marquer toute une fiche catalogue comme showroom/démo.
-- Chaque exemplaire physique peut être au stock, au showroom et éventuellement être démo.

begin;

-- -----------------------------------------------------------------------------
-- 1) Informations showroom / démonstration portées par l'EXEMPLAIRE physique
-- -----------------------------------------------------------------------------
alter table public.motors_physical_vehicle_units_v162
  add column if not exists is_demo boolean not null default false;
alter table public.motors_physical_vehicle_units_v162
  add column if not exists demo_mileage integer not null default 0;
alter table public.motors_physical_vehicle_units_v162
  add column if not exists demo_original_price numeric(14,2);
alter table public.motors_physical_vehicle_units_v162
  add column if not exists demo_note text;
alter table public.motors_physical_vehicle_units_v162
  add column if not exists showroom_since timestamptz;

create index if not exists motors_physical_units_v1643_showroom_idx
on public.motors_physical_vehicle_units_v162(catalog_vehicle_id, status, is_demo);

-- Les employés créés via la gestion V164 peuvent aussi accéder au stock physique
-- s'ils possèdent la permission inventaire ou catalogue.
drop policy if exists "v162 physical stock staff" on public.motors_physical_vehicle_units_v162;
create policy "v162 physical stock staff" on public.motors_physical_vehicle_units_v162
for all to authenticated
using (
  public.nostra_v162_is_staff()
  or public.nostra_v164_has_permission('inventory_manage')
  or public.nostra_v164_has_permission('catalogue_manage')
)
with check (
  public.nostra_v162_is_staff()
  or public.nostra_v164_has_permission('inventory_manage')
  or public.nostra_v164_has_permission('catalogue_manage')
);

-- Une unité qui quitte le showroom ne reste jamais marquée comme démo.
create or replace function public.nostra_v1643_clear_demo_outside_showroom()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'showroom' then
    new.is_demo := false;
    new.demo_mileage := 0;
    new.demo_original_price := null;
    new.demo_note := null;
    new.showroom_since := null;
  elsif old.status is distinct from new.status and new.status = 'showroom' then
    new.showroom_since := coalesce(new.showroom_since, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_v1643_clear_demo_outside_showroom on public.motors_physical_vehicle_units_v162;
create trigger trg_v1643_clear_demo_outside_showroom
before update of status on public.motors_physical_vehicle_units_v162
for each row execute function public.nostra_v1643_clear_demo_outside_showroom();

-- -----------------------------------------------------------------------------
-- 2) Migration douce des anciens réglages modèle -> un seul exemplaire physique
-- -----------------------------------------------------------------------------
-- Ancien showroom_visible=true : on place UN exemplaire disponible au showroom
-- uniquement si aucun exemplaire de ce modèle n'y est déjà.
do $$
declare
  v record;
  v_unit bigint;
begin
  for v in
    select id
    from public.catalog_vehicles
    where coalesce(showroom_visible, false) = true
  loop
    if not exists (
      select 1 from public.motors_physical_vehicle_units_v162 u
      where u.catalog_vehicle_id = v.id and u.status = 'showroom'
    ) then
      select u.id into v_unit
      from public.motors_physical_vehicle_units_v162 u
      where u.catalog_vehicle_id = v.id
        and u.status in ('stock','arrived')
        and u.hold_id is null
        and u.order_id is null
      order by case u.status when 'stock' then 1 else 2 end, u.id
      limit 1;

      if v_unit is not null then
        update public.motors_physical_vehicle_units_v162
        set status='showroom', location='Showroom Nostra Motors', showroom_since=now(), updated_at=now()
        where id=v_unit;
      end if;
    end if;
  end loop;
end $$;

-- Ancien is_demo=true : on transfère le statut vers UN exemplaire du showroom.
do $$
declare
  v record;
  v_unit bigint;
begin
  for v in
    select id, demo_mileage, demo_original_price, demo_note
    from public.catalog_vehicles
    where coalesce(is_demo, false) = true
  loop
    select u.id into v_unit
    from public.motors_physical_vehicle_units_v162 u
    where u.catalog_vehicle_id = v.id and u.status='showroom'
    order by u.id
    limit 1;

    if v_unit is null then
      select u.id into v_unit
      from public.motors_physical_vehicle_units_v162 u
      where u.catalog_vehicle_id = v.id
        and u.status in ('stock','arrived')
        and u.hold_id is null
        and u.order_id is null
      order by case u.status when 'stock' then 1 else 2 end, u.id
      limit 1;

      if v_unit is not null then
        update public.motors_physical_vehicle_units_v162
        set status='showroom', location='Showroom Nostra Motors', showroom_since=now(), updated_at=now()
        where id=v_unit;
      end if;
    end if;

    if v_unit is not null then
      update public.motors_physical_vehicle_units_v162
      set is_demo=true,
          demo_mileage=greatest(coalesce(v.demo_mileage,0),0),
          demo_original_price=v.demo_original_price,
          demo_note=v.demo_note,
          showroom_since=coalesce(showroom_since,now()),
          updated_at=now()
      where id=v_unit;
    end if;
  end loop;
end $$;

-- Les anciens drapeaux modèle ne pilotent plus rien après la migration.
-- On les neutralise pour éviter qu'une réexécution de V164.3 ne recrée une présence
-- showroom qui aurait volontairement été retirée depuis la nouvelle page.
update public.catalog_vehicles
set showroom_visible=false
where coalesce(showroom_visible,false)=true;

update public.catalog_vehicles
set is_demo=false, demo_mileage=0, demo_original_price=null, demo_note=null
where coalesce(is_demo,false)=true;

-- -----------------------------------------------------------------------------
-- 3) RPC : fixer un NOMBRE EXACT d'exemplaires showroom pour un modèle
-- -----------------------------------------------------------------------------
create or replace function public.nostra_set_showroom_quantity_v1643(
  p_vehicle_id bigint,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target integer := greatest(coalesce(p_quantity,0),0);
  v_current integer;
  v_demo integer;
  v_allocatable integer;
  v_delta integer;
begin
  if not (
    public.nostra_v164_is_manager()
    or public.nostra_v164_has_permission('inventory_manage')
    or public.nostra_v164_has_permission('catalogue_manage')
  ) then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.catalog_vehicles where id=p_vehicle_id) then
    raise exception 'vehicle_not_found';
  end if;

  select count(*)::integer into v_current
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id=p_vehicle_id and status='showroom';

  select count(*)::integer into v_demo
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id=p_vehicle_id and status='showroom' and is_demo=true;

  -- Exemplaires réellement mobilisables pour ce modèle : stock + arrivés + showroom,
  -- sans réservation ni commande en cours.
  select count(*)::integer into v_allocatable
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id=p_vehicle_id
    and status in ('stock','arrived','showroom')
    and hold_id is null
    and order_id is null;

  if v_target > v_allocatable then
    raise exception 'showroom_quantity_exceeds_available';
  end if;

  if v_target < v_demo then
    raise exception 'showroom_quantity_below_demo';
  end if;

  v_delta := v_target - v_current;

  if v_delta > 0 then
    update public.motors_physical_vehicle_units_v162 u
    set status='showroom',
        location='Showroom Nostra Motors',
        showroom_since=coalesce(u.showroom_since,now()),
        updated_at=now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id=p_vehicle_id
        and x.status in ('stock','arrived')
        and x.hold_id is null
        and x.order_id is null
      order by case x.status when 'stock' then 1 else 2 end, x.id
      limit v_delta
    );
  elsif v_delta < 0 then
    -- On retire d'abord les exemplaires showroom NON démo.
    update public.motors_physical_vehicle_units_v162 u
    set status='stock',
        location='Stock Nostra Motors',
        updated_at=now()
    where u.id in (
      select x.id
      from public.motors_physical_vehicle_units_v162 x
      where x.catalog_vehicle_id=p_vehicle_id
        and x.status='showroom'
        and x.is_demo=false
        and x.hold_id is null
        and x.order_id is null
      order by x.id desc
      limit abs(v_delta)
    );
  end if;

  select count(*)::integer into v_current
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id=p_vehicle_id and status='showroom';

  select count(*)::integer into v_demo
  from public.motors_physical_vehicle_units_v162
  where catalog_vehicle_id=p_vehicle_id and status='showroom' and is_demo=true;

  return jsonb_build_object(
    'vehicle_id',p_vehicle_id,
    'showroom_quantity',v_current,
    'demo_quantity',v_demo
  );
end;
$$;

grant execute on function public.nostra_set_showroom_quantity_v1643(bigint,integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) RPC : marquer UN EXEMPLAIRE précis du showroom comme démonstration
-- -----------------------------------------------------------------------------
create or replace function public.nostra_set_demo_unit_v1643(
  p_unit_id bigint,
  p_is_demo boolean,
  p_mileage integer default 0,
  p_original_price numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unit public.motors_physical_vehicle_units_v162%rowtype;
begin
  if not (
    public.nostra_v164_is_manager()
    or public.nostra_v164_has_permission('inventory_manage')
    or public.nostra_v164_has_permission('catalogue_manage')
  ) then
    raise exception 'forbidden';
  end if;

  select * into v_unit
  from public.motors_physical_vehicle_units_v162
  where id=p_unit_id;

  if not found then
    raise exception 'unit_not_found';
  end if;

  if v_unit.status <> 'showroom' then
    raise exception 'unit_not_in_showroom';
  end if;

  update public.motors_physical_vehicle_units_v162
  set is_demo=coalesce(p_is_demo,false),
      demo_mileage=case when coalesce(p_is_demo,false) then greatest(coalesce(p_mileage,0),0) else 0 end,
      demo_original_price=case when coalesce(p_is_demo,false) then p_original_price else null end,
      demo_note=case when coalesce(p_is_demo,false) then nullif(btrim(coalesce(p_note,'')),'') else null end,
      showroom_since=coalesce(showroom_since,now()),
      updated_at=now()
  where id=p_unit_id;

  return jsonb_build_object(
    'unit_id',p_unit_id,
    'vehicle_id',v_unit.catalog_vehicle_id,
    'is_demo',coalesce(p_is_demo,false)
  );
end;
$$;

grant execute on function public.nostra_set_demo_unit_v1643(bigint,boolean,integer,numeric,text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) Les commandes prennent le stock normal AVANT le showroom et la démo
-- -----------------------------------------------------------------------------
create or replace function public.nostra_sync_units_from_hold_v162()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare need integer;
begin
  if new.status='active' then
    update public.motors_physical_vehicle_units_v162
      set status='stock',hold_id=null,user_id=null,updated_at=now()
    where hold_id=new.id and status='reserved_temp';

    need:=greatest(coalesce(new.quantity,1),1);

    update public.motors_physical_vehicle_units_v162 u
      set status='reserved_temp',hold_id=new.id,user_id=new.user_id,updated_at=now()
    where u.id in (
      select id
      from public.motors_physical_vehicle_units_v162
      where catalog_vehicle_id=new.vehicle_id
        and status in ('stock','showroom','arrived')
        and hold_id is null
      order by
        case
          when status='stock' then 1
          when status='arrived' then 2
          when status='showroom' and coalesce(is_demo,false)=false then 3
          else 4
        end,
        id
      limit need
    );
  elsif new.status='converted' then
    update public.motors_physical_vehicle_units_v162
      set status='preparation',order_id=new.order_id,user_id=new.user_id,updated_at=now()
    where hold_id=new.id;
  elsif new.status in ('released','expired') then
    update public.motors_physical_vehicle_units_v162
      set status='stock',hold_id=null,order_id=null,user_id=null,updated_at=now()
    where hold_id=new.id and status='reserved_temp';
  end if;
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6) Résumé showroom lisible par les clients sans exposer le stock physique
-- -----------------------------------------------------------------------------
create or replace function public.nostra_get_showroom_summary_v1643(
  p_vehicle_ids bigint[] default null
)
returns table(
  catalog_vehicle_id bigint,
  showroom_count bigint,
  demo_count bigint,
  demo_mileage integer,
  demo_original_price numeric,
  demo_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.catalog_vehicle_id,
    count(*)::bigint as showroom_count,
    count(*) filter (where u.is_demo=true)::bigint as demo_count,
    coalesce(min(u.demo_mileage) filter (where u.is_demo=true),0)::integer as demo_mileage,
    max(u.demo_original_price) filter (where u.is_demo=true) as demo_original_price,
    max(u.demo_note) filter (where u.is_demo=true) as demo_note
  from public.motors_physical_vehicle_units_v162 u
  where u.status='showroom'
    and (p_vehicle_ids is null or u.catalog_vehicle_id = any(p_vehicle_ids))
  group by u.catalog_vehicle_id
  order by u.catalog_vehicle_id;
$$;

grant execute on function public.nostra_get_showroom_summary_v1643(bigint[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 7) Anciennes colonnes conservées uniquement pour compatibilité historique
-- -----------------------------------------------------------------------------

commit;
