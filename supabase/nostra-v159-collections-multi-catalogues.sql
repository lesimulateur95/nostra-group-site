-- Nostra Group V159 — Collections multi-catalogues sans duplication de fiches
-- Un véhicule garde son catalogue principal et peut aussi appartenir à une ou plusieurs collections.
-- Réexécutable. Ne supprime aucune fiche véhicule ni aucune collection V158.

begin;

create table if not exists public.nostra_collection_vehicle_links_v159 (
  collection_id text not null,
  vehicle_id bigint not null references public.catalog_vehicles(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  primary key (collection_id, vehicle_id)
);

create index if not exists nostra_collection_vehicle_links_v159_vehicle_idx
  on public.nostra_collection_vehicle_links_v159(vehicle_id);
create index if not exists nostra_collection_vehicle_links_v159_collection_sort_idx
  on public.nostra_collection_vehicle_links_v159(collection_id, sort_order, created_at);

-- Reprend automatiquement les rattachements V158 déjà existants.
do $$
begin
  if to_regclass('public.nostra_exclusive_collection_vehicles_v158') is not null then
    execute $sql$
      insert into public.nostra_collection_vehicle_links_v159 (
        collection_id, vehicle_id, sort_order, created_at, updated_at, created_by, updated_by
      )
      select
        collection_id::text,
        vehicle_id,
        0,
        coalesce(created_at, now()),
        coalesce(updated_at, now()),
        null,
        updated_by
      from public.nostra_exclusive_collection_vehicles_v158
      where collection_id is not null
      on conflict (collection_id, vehicle_id) do nothing
    $sql$;
  end if;
exception
  when undefined_column then
    -- Certaines installations V158 ne possèdent pas created_at/updated_by : migration minimale.
    execute $sql$
      insert into public.nostra_collection_vehicle_links_v159 (collection_id, vehicle_id)
      select collection_id::text, vehicle_id
      from public.nostra_exclusive_collection_vehicles_v158
      where collection_id is not null
      on conflict (collection_id, vehicle_id) do nothing
    $sql$;
end;
$$;

create or replace function public.nostra_cleanup_collection_links_v159()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  delete from public.nostra_collection_vehicle_links_v159
  where collection_id=old.id::text;
  return old;
end;
$$;

drop trigger if exists nostra_cleanup_collection_links_v159_trigger
  on public.nostra_exclusive_collections_v158;
create trigger nostra_cleanup_collection_links_v159_trigger
after delete on public.nostra_exclusive_collections_v158
for each row execute function public.nostra_cleanup_collection_links_v159();

alter table public.nostra_collection_vehicle_links_v159 enable row level security;

drop policy if exists "v159 collection links read" on public.nostra_collection_vehicle_links_v159;
create policy "v159 collection links read"
on public.nostra_collection_vehicle_links_v159
for select to authenticated
using (true);

drop policy if exists "v159 collection links manager" on public.nostra_collection_vehicle_links_v159;
create policy "v159 collection links manager"
on public.nostra_collection_vehicle_links_v159
for all to authenticated
using (public.nostra_role() = 'manager')
with check (public.nostra_role() = 'manager');

grant select,insert,update,delete on public.nostra_collection_vehicle_links_v159 to authenticated;

-- Achat groupé V159 : utilise tous les véhicules rattachés, quel que soit leur catalogue principal.
create or replace function public.nostra_add_collection_to_cart_v159(p_collection_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_vehicle record;
  v_existing public.cart_items%rowtype;
  v_next_quantity integer;
  v_image_url text;
  v_count integer := 0;
  v_current_tier text := 'all';
begin
  if v_uid is null then raise exception using message='not_authenticated'; end if;
  if not exists (
    select 1 from public.nostra_exclusive_collections_v158
    where id::text=p_collection_id and active=true
  ) then
    raise exception using message='collection_empty';
  end if;

  begin
    v_current_tier := public.nostra_current_loyalty_tier_v157(v_uid);
  exception when undefined_function then
    v_current_tier := 'all';
  end;

  for v_vehicle in
    select cv.*
    from public.nostra_collection_vehicle_links_v159 link
    join public.catalog_vehicles cv on cv.id=link.vehicle_id
    where link.collection_id=p_collection_id
      and cv.published=true
      and coalesce(to_jsonb(cv)->>'catalog_type','standard') <> 'used'
    order by link.sort_order, link.created_at
  loop
    v_count := v_count + 1;

    if greatest(coalesce(v_vehicle.stock_quantity,0),0) <= 0 then
      raise exception using message='insufficient_stock';
    end if;
    if coalesce((to_jsonb(v_vehicle)->>'sale_enabled')::boolean,true) = false then
      raise exception using message='vehicle_sale_disabled';
    end if;

    begin
      if not public.nostra_vehicle_tier_access_v157(v_vehicle.id,v_uid) then
        raise exception using message='loyalty_tier_required';
      end if;
    exception when undefined_function then
      null;
    end;

    v_image_url := case
      when jsonb_typeof(v_vehicle.images)='array' and jsonb_array_length(v_vehicle.images)>0
      then v_vehicle.images->0->>'url'
      else null
    end;

    select * into v_existing
    from public.cart_items
    where user_id=v_uid
      and vehicle_id=v_vehicle.id
      and coalesce(item_type,'vehicle')='vehicle'
    order by id
    limit 1;

    v_next_quantity := case when found then greatest(1,coalesce(v_existing.quantity,1))+1 else 1 end;
    if v_next_quantity > greatest(coalesce(v_vehicle.stock_quantity,0),0) then
      raise exception using message='insufficient_stock';
    end if;

    if found then
      update public.cart_items
      set quantity=v_next_quantity,
          item_name=btrim(v_vehicle.brand || ' ' || v_vehicle.model),
          unit_price=coalesce(v_vehicle.price,0),
          original_unit_price=coalesce(v_vehicle.price,0),
          image_url=v_image_url
      where id=v_existing.id and user_id=v_uid;
    else
      insert into public.cart_items (
        user_id, vehicle_id, related_vehicle_id, item_type, item_name,
        quantity, unit_price, original_unit_price, image_url, locked
      ) values (
        v_uid, v_vehicle.id, v_vehicle.id, 'vehicle',
        btrim(v_vehicle.brand || ' ' || v_vehicle.model),
        1, coalesce(v_vehicle.price,0), coalesce(v_vehicle.price,0), v_image_url, false
      );
    end if;
  end loop;

  if v_count=0 then raise exception using message='collection_empty'; end if;
  return jsonb_build_object('vehicles_added',v_count);
end;
$$;

revoke all on function public.nostra_add_collection_to_cart_v159(text) from public, anon;
grant execute on function public.nostra_add_collection_to_cart_v159(text) to authenticated;

commit;
