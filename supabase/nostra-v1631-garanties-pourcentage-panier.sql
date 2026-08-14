-- NOSTRA V163.1 — Garanties Nostra Care : pourcentage + panier + date de fin modifiable
-- À exécuter APRÈS : nostra-v163-gestion-commerciale-garanties.sql
-- Réexécutable. Aucun module assurance.

begin;

-- -----------------------------------------------------------------------------
-- 1) Tarification des formules en pourcentage du prix réellement payé du VL
-- -----------------------------------------------------------------------------
alter table public.motors_warranty_plans_v163
  add column if not exists rate_percent numeric(7,3) not null default 3;

alter table public.motors_warranty_contracts_v163
  add column if not exists rate_percent numeric(7,3) not null default 3;
alter table public.motors_warranty_contracts_v163
  add column if not exists reference_vehicle_price numeric(14,2) not null default 0;
alter table public.motors_warranty_contracts_v163
  add column if not exists paid_at timestamptz;

-- Les deux formules de départ passent respectivement à 3 % et 5 %.
update public.motors_warranty_plans_v163
set rate_percent = 3, price = 0, updated_at = now()
where name = 'Nostra Care 90';

update public.motors_warranty_plans_v163
set rate_percent = 5, price = 0, updated_at = now()
where name = 'Nostra Care+ 180';

-- Les éventuelles autres formules historiques restent à 3 % si aucun taux n'était défini.
update public.motors_warranty_plans_v163
set rate_percent = 3
where rate_percent is null or rate_percent <= 0;

-- Snapshot du prix réellement payé pour les contrats déjà créés mais non payés.
update public.motors_warranty_contracts_v163 c
set reference_vehicle_price = greatest(coalesce(v.purchase_price, 0), 0),
    rate_percent = coalesce(nullif(p.rate_percent, 0), 3),
    amount = round(
      greatest(coalesce(v.purchase_price, 0), 0)
      * coalesce(nullif(p.rate_percent, 0), 3) / 100,
      2
    ),
    updated_at = now()
from public.customer_vehicles v,
     public.motors_warranty_plans_v163 p
where c.customer_vehicle_id = v.id
  and p.id = c.plan_id
  and c.status = 'pending_payment';

-- -----------------------------------------------------------------------------
-- 2) Souscription : crée une ligne "en attente de paiement" dans le panier Nostra
--    Le prix est figé à partir du purchase_price enregistré dans le garage.
-- -----------------------------------------------------------------------------
create or replace function public.nostra_subscribe_warranty_v163(
  p_customer_vehicle_id bigint,
  p_plan_id bigint,
  p_start_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_vehicle record;
  v_plan record;
  v_id bigint;
  v_number text;
  v_start timestamptz := coalesce(p_start_at, now());
  v_reference numeric(14,2);
  v_rate numeric(7,3);
  v_amount numeric(14,2);
begin
  if v_uid is null then
    raise exception using message = 'not_authenticated';
  end if;

  select id, user_id, purchase_price, garage_status
  into v_vehicle
  from public.customer_vehicles
  where id = p_customer_vehicle_id
    and user_id = v_uid
    and garage_status <> 'cancelled';

  if not found then
    raise exception using message = 'vehicle_not_found';
  end if;

  v_reference := greatest(coalesce(v_vehicle.purchase_price, 0), 0);
  if v_reference <= 0 then
    raise exception using message = 'vehicle_purchase_price_missing';
  end if;

  select *
  into v_plan
  from public.motors_warranty_plans_v163
  where id = p_plan_id
    and active;

  if not found then
    raise exception using message = 'warranty_plan_not_found';
  end if;

  v_rate := greatest(coalesce(v_plan.rate_percent, 0), 0);
  if v_rate <= 0 then
    raise exception using message = 'invalid_warranty_rate';
  end if;

  if exists (
    select 1
    from public.motors_warranty_contracts_v163
    where user_id = v_uid
      and customer_vehicle_id = p_customer_vehicle_id
      and (
        status = 'pending_payment'
        or (status = 'active' and ends_at > now())
      )
  ) then
    raise exception using message = 'warranty_already_exists';
  end if;

  v_amount := round(v_reference * v_rate / 100, 2);
  v_number := 'NG-' || to_char(now(), 'YYYYMMDD') || '-' ||
              upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7));

  insert into public.motors_warranty_contracts_v163 (
    contract_number,
    user_id,
    customer_vehicle_id,
    plan_id,
    plan_name,
    duration_days,
    rate_percent,
    reference_vehicle_price,
    amount,
    deductible,
    starts_at,
    ends_at,
    status,
    coverage_snapshot
  ) values (
    v_number,
    v_uid,
    p_customer_vehicle_id,
    v_plan.id,
    v_plan.name,
    v_plan.duration_days,
    v_rate,
    v_reference,
    v_amount,
    v_plan.deductible,
    v_start,
    v_start + make_interval(days => v_plan.duration_days),
    'pending_payment',
    jsonb_build_object(
      'engine', v_plan.engine,
      'gearbox', v_plan.gearbox,
      'electronics', v_plan.electronics,
      'suspension', v_plan.suspension,
      'bodywork', v_plan.bodywork,
      'tyres', v_plan.tyres,
      'rate_percent', v_rate,
      'reference_vehicle_price', v_reference
    )
  ) returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'contract_number', v_number,
    'amount', v_amount,
    'rate_percent', v_rate,
    'reference_vehicle_price', v_reference,
    'duration_days', v_plan.duration_days
  );
end;
$$;

grant execute on function public.nostra_subscribe_warranty_v163(bigint,bigint,timestamptz) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) Retirer une garantie encore non payée du panier
-- -----------------------------------------------------------------------------
create or replace function public.nostra_cancel_pending_warranty_v1631(
  p_contract_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated';
  end if;

  update public.motors_warranty_contracts_v163
  set status = 'cancelled', updated_at = now()
  where id = p_contract_id
    and user_id = auth.uid()
    and status = 'pending_payment';

  if not found then
    raise exception using message = 'warranty_cart_item_not_found';
  end if;
end;
$$;

grant execute on function public.nostra_cancel_pending_warranty_v1631(bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Paiement depuis le panier Nostra
--    Le paiement démarre réellement la garantie et recalcule sa date de fin.
-- -----------------------------------------------------------------------------
create or replace function public.nostra_checkout_warranty_cart_v1631()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count integer := 0;
  v_total numeric(14,2) := 0;
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception using message = 'not_authenticated';
  end if;

  for v_row in
    select *
    from public.motors_warranty_contracts_v163
    where user_id = auth.uid()
      and status = 'pending_payment'
    order by created_at
    for update
  loop
    update public.motors_warranty_contracts_v163
    set status = 'active',
        starts_at = v_now,
        ends_at = v_now + make_interval(days => greatest(v_row.duration_days, 1)),
        paid_at = v_now,
        updated_at = v_now
    where id = v_row.id;

    if to_regclass('public.accounting_entries') is not null then
      insert into public.accounting_entries (
        entry_date,
        entry_type,
        category,
        label,
        amount,
        notes
      ) values (
        current_date,
        'income',
        'Garanties Nostra Care',
        'Garantie ' || v_row.plan_name,
        v_row.amount,
        format(
          'Contrat %s · véhicule garage #%s · taux %s%%',
          v_row.contract_number,
          v_row.customer_vehicle_id,
          v_row.rate_percent
        )
      );
    end if;

    v_count := v_count + 1;
    v_total := v_total + v_row.amount;
  end loop;

  if v_count = 0 then
    raise exception using message = 'empty_warranty_cart';
  end if;

  return jsonb_build_object('count', v_count, 'total', round(v_total, 2));
end;
$$;

grant execute on function public.nostra_checkout_warranty_cart_v1631() to authenticated;

commit;

select
  to_regprocedure('public.nostra_subscribe_warranty_v163(bigint,bigint,timestamptz)') as subscribe_function,
  to_regprocedure('public.nostra_checkout_warranty_cart_v1631()') as checkout_function,
  to_regprocedure('public.nostra_cancel_pending_warranty_v1631(bigint)') as cancel_function;
