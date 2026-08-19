-- Nostra Group · Casino V164.10
-- Correctif caisse : achat de jetons + revente de jetons
-- Réexécutable. À lancer dans Supabase > SQL Editor AVANT le correctif GitHub.

begin;

-- ============================================================================
-- 1) ACHATS : structure complète + nettoyage du verrou fantôme actuel
-- ============================================================================

alter table public.casino_conversion_requests
  add column if not exists steam_id text,
  add column if not exists payment_mode text not null default 'manual',
  add column if not exists base_chip_amount bigint,
  add column if not exists bonus_chip_amount bigint not null default 0,
  add column if not exists package_id uuid,
  add column if not exists discount_amount bigint not null default 0,
  add column if not exists promo_code text;

update public.casino_conversion_requests
set base_chip_amount = greatest(1, chip_amount - coalesce(bonus_chip_amount, 0))
where base_chip_amount is null;

alter table public.casino_conversion_requests
  alter column base_chip_amount set not null;

-- Les anciennes demandes pending viennent de l'ancien flux cassé et bloquent
-- la caisse alors qu'aucun paiement n'est réellement en cours.
update public.casino_conversion_requests
set status = 'cancelled', reviewed_at = now()
where status = 'pending';

-- Le minimum demandé est 10 000 $RP. On aligne aussi le réglage actuel en
-- nombre de jetons selon le taux courant, sans réduire un minimum plus élevé.
update public.casino_settings
set min_conversion = greatest(
  min_conversion,
  ceil(10000::numeric / greatest(rp_per_chip, 1))::bigint
)
where id = 1;

create or replace function public.casino_reserve_purchase_v16410(
  p_request_id uuid,
  p_user_id uuid,
  p_steam_id text,
  p_rp_amount bigint,
  p_discount_amount bigint,
  p_promo_code text,
  p_chip_amount bigint,
  p_base_chip_amount bigint,
  p_bonus_chip_amount bigint,
  p_rate bigint,
  p_package_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.casino_settings%rowtype;
begin
  if p_request_id is null or p_user_id is null
     or length(btrim(coalesce(p_steam_id,''))) < 5 then
    raise exception 'invalid_purchase';
  end if;

  if p_rp_amount < 10000 then
    raise exception 'minimum_purchase';
  end if;

  if p_discount_amount < 0 or p_discount_amount > p_rp_amount
     or p_rate < 1
     or p_base_chip_amount < 1
     or p_bonus_chip_amount < 0
     or p_chip_amount <> p_base_chip_amount + p_bonus_chip_amount
     or p_rp_amount <> p_base_chip_amount * p_rate then
    raise exception 'invalid_purchase';
  end if;

  select * into v_settings
  from public.casino_settings
  where id = 1;

  if not found then raise exception 'casino_not_configured'; end if;
  if p_rate <> v_settings.rp_per_chip then raise exception 'invalid_purchase_rate'; end if;

  if exists(select 1 from public.casino_conversion_requests where id = p_request_id) then
    raise exception 'purchase_reference_used';
  end if;

  -- Un pending récent est un vrai paiement encore en cours. Les vieux verrous
  -- de plus de 3 minutes sont automatiquement libérés.
  update public.casino_conversion_requests
  set status = 'cancelled', reviewed_at = now()
  where user_id = p_user_id
    and status = 'pending'
    and created_at < now() - interval '3 minutes';

  if exists(
    select 1 from public.casino_conversion_requests
    where user_id = p_user_id and status = 'pending'
  ) then
    raise exception 'pending_purchase_exists';
  end if;

  insert into public.casino_conversion_requests(
    id,user_id,steam_id,rp_amount,discount_amount,promo_code,
    chip_amount,base_chip_amount,bonus_chip_amount,package_id,
    rate,payment_mode,status
  ) values (
    p_request_id,p_user_id,left(btrim(p_steam_id),80),p_rp_amount,
    p_discount_amount,nullif(left(btrim(coalesce(p_promo_code,'')),40),''),
    p_chip_amount,p_base_chip_amount,p_bonus_chip_amount,p_package_id,
    p_rate,'rp_database','pending'
  );

  return jsonb_build_object(
    'id',p_request_id,
    'status','pending',
    'rp_amount',p_rp_amount,
    'payable_rp',p_rp_amount-p_discount_amount,
    'chip_amount',p_chip_amount
  );
end;
$$;

create or replace function public.casino_complete_rp_purchase_v16410(
  p_request_id uuid,
  p_user_id uuid,
  p_steam_id text,
  p_rp_amount bigint,
  p_base_chip_amount bigint,
  p_bonus_chip_amount bigint,
  p_rate bigint,
  p_package_id uuid,
  p_discount_amount bigint,
  p_promo_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.casino_conversion_requests%rowtype;
  v_balance bigint;
  v_total_chips bigint;
begin
  v_total_chips := p_base_chip_amount + p_bonus_chip_amount;

  select * into v_request
  from public.casino_conversion_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'purchase_not_reserved'; end if;

  if v_request.status = 'approved' then
    select balance into v_balance
    from public.casino_wallets where user_id = p_user_id;
    return jsonb_build_object(
      'id',v_request.id,'status','approved','balance',coalesce(v_balance,0),
      'already_completed',true
    );
  end if;

  if v_request.status <> 'pending' then raise exception 'purchase_not_pending'; end if;

  if v_request.user_id <> p_user_id
     or v_request.steam_id is distinct from left(btrim(p_steam_id),80)
     or v_request.rp_amount <> p_rp_amount
     or v_request.discount_amount <> p_discount_amount
     or coalesce(v_request.promo_code,'') <> coalesce(nullif(left(btrim(coalesce(p_promo_code,'')),40),''),'')
     or v_request.base_chip_amount <> p_base_chip_amount
     or v_request.bonus_chip_amount <> p_bonus_chip_amount
     or v_request.chip_amount <> v_total_chips
     or v_request.rate <> p_rate
     or v_request.package_id is distinct from p_package_id then
    raise exception 'purchase_reference_conflict';
  end if;

  update public.casino_conversion_requests
  set status = 'approved', reviewed_at = now()
  where id = p_request_id;

  insert into public.casino_wallets(user_id,balance)
  values (p_user_id,v_total_chips)
  on conflict(user_id) do update
    set balance = public.casino_wallets.balance + excluded.balance,
        updated_at = now()
  returning balance into v_balance;

  insert into public.casino_transactions(
    user_id,kind,amount,balance_after,label,reference_id
  ) values (
    p_user_id,'conversion',v_total_chips,v_balance,
    case when p_bonus_chip_amount > 0
      then 'Achat de jetons Casino + bonus'
      else 'Achat de jetons Casino'
    end,
    p_request_id
  );

  return jsonb_build_object(
    'id',p_request_id,'status','approved','balance',v_balance,
    'chips_credited',v_total_chips,'already_completed',false
  );
end;
$$;

revoke all on function public.casino_reserve_purchase_v16410(
  uuid,uuid,text,bigint,bigint,text,bigint,bigint,bigint,bigint,uuid
) from public,anon,authenticated;
grant execute on function public.casino_reserve_purchase_v16410(
  uuid,uuid,text,bigint,bigint,text,bigint,bigint,bigint,bigint,uuid
) to service_role;

revoke all on function public.casino_complete_rp_purchase_v16410(
  uuid,uuid,text,bigint,bigint,bigint,bigint,uuid,bigint,text
) from public,anon,authenticated;
grant execute on function public.casino_complete_rp_purchase_v16410(
  uuid,uuid,text,bigint,bigint,bigint,bigint,uuid,bigint,text
) to service_role;

-- ============================================================================
-- 2) REVENTES : RPC simplifiée et fiable
-- ============================================================================

alter table public.casino_cashout_requests
  add column if not exists gross_rp_amount bigint,
  add column if not exists commission_percent numeric(6,2),
  add column if not exists commission_amount bigint;

-- S'assurer que le type cashout/refund est accepté dans l'historique.
do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.casino_transactions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.casino_transactions drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.casino_transactions
  add constraint casino_transactions_kind_check_v16410
  check (kind in ('conversion','cashout','wager','payout','adjustment','refund','table_buyin','table_cashout'));

create or replace function public.casino_reserve_cashout_v16410(
  p_request_id uuid,
  p_user_id uuid,
  p_steam_id text,
  p_rp_amount bigint,
  p_chip_amount bigint,
  p_rate bigint,
  p_commission_percent numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.casino_settings%rowtype;
  v_balance bigint;
  v_gross bigint;
  v_net bigint;
  v_commission bigint;
begin
  if p_request_id is null or p_user_id is null
     or length(btrim(coalesce(p_steam_id,''))) < 5 then
    raise exception 'invalid_cashout';
  end if;

  if exists(select 1 from public.casino_cashout_requests where id = p_request_id) then
    raise exception 'cashout_reference_used';
  end if;

  if exists(
    select 1 from public.casino_cashout_requests
    where user_id = p_user_id and status = 'pending'
  ) then
    raise exception 'pending_cashout_exists';
  end if;

  select * into v_settings
  from public.casino_settings
  where id = 1;

  if not found or not coalesce(v_settings.cashout_enabled,true) then
    raise exception 'cashout_closed';
  end if;

  if p_chip_amount < v_settings.min_cashout
     or p_chip_amount > v_settings.max_cashout
     or p_rate <> v_settings.rp_per_chip
     or p_commission_percent <> v_settings.cashout_commission_percent then
    raise exception 'invalid_cashout';
  end if;

  v_gross := p_chip_amount * p_rate;
  v_net := floor(v_gross * (100 - p_commission_percent) / 100.0)::bigint;
  v_commission := v_gross - v_net;

  if v_net <= 0 or p_rp_amount <> v_net then
    raise exception 'invalid_cashout';
  end if;

  -- Verrouille le wallet avant toute modification.
  select balance into v_balance
  from public.casino_wallets
  where user_id = p_user_id
  for update;

  if not found or v_balance < p_chip_amount then
    raise exception 'insufficient_balance';
  end if;

  insert into public.casino_cashout_requests(
    id,user_id,steam_id,rp_amount,chip_amount,rate,status,
    gross_rp_amount,commission_percent,commission_amount
  ) values (
    p_request_id,p_user_id,left(btrim(p_steam_id),80),v_net,
    p_chip_amount,p_rate,'pending',v_gross,p_commission_percent,v_commission
  );

  update public.casino_wallets
  set balance = balance - p_chip_amount,
      updated_at = now()
  where user_id = p_user_id
  returning balance into v_balance;

  return jsonb_build_object(
    'id',p_request_id,'status','pending','chips_debited',p_chip_amount,
    'chip_balance_after',v_balance,'gross_rp',v_gross,
    'commission_rp',v_commission,'rp_to_credit',v_net
  );
end;
$$;

create or replace function public.casino_complete_cashout_v16410(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.casino_cashout_requests%rowtype;
  v_balance bigint;
begin
  select * into v_request
  from public.casino_cashout_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'cashout_not_found'; end if;
  if v_request.status = 'approved' then
    return jsonb_build_object('id',v_request.id,'status','approved','already_completed',true);
  end if;
  if v_request.status <> 'pending' then raise exception 'cashout_not_pending'; end if;

  select balance into v_balance
  from public.casino_wallets
  where user_id = v_request.user_id;

  update public.casino_cashout_requests
  set status = 'approved',completed_at = now(),failure_reason = null
  where id = v_request.id;

  insert into public.casino_transactions(
    user_id,kind,amount,balance_after,label,reference_id
  ) values (
    v_request.user_id,'cashout',-v_request.chip_amount,coalesce(v_balance,0),
    'Revente de jetons Casino vers le compte en jeu',v_request.id
  );

  return jsonb_build_object(
    'id',v_request.id,'status','approved','rp_amount',v_request.rp_amount,
    'chip_amount',v_request.chip_amount,'already_completed',false
  );
end;
$$;

create or replace function public.casino_reject_cashout_v16410(
  p_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.casino_cashout_requests%rowtype;
  v_balance bigint;
begin
  select * into v_request
  from public.casino_cashout_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'cashout_not_found'; end if;
  if v_request.status = 'rejected' then
    return jsonb_build_object('id',v_request.id,'status','rejected','already_refunded',true);
  end if;
  if v_request.status <> 'pending' then raise exception 'cashout_not_pending'; end if;

  update public.casino_wallets
  set balance = balance + v_request.chip_amount,
      updated_at = now()
  where user_id = v_request.user_id
  returning balance into v_balance;

  if not found then raise exception 'wallet_not_found'; end if;

  update public.casino_cashout_requests
  set status = 'rejected',failure_reason = left(coalesce(p_reason,'unknown'),180),
      completed_at = now()
  where id = v_request.id;

  insert into public.casino_transactions(
    user_id,kind,amount,balance_after,label,reference_id
  ) values (
    v_request.user_id,'refund',v_request.chip_amount,v_balance,
    'Revente annulée · jetons rendus',v_request.id
  );

  return jsonb_build_object(
    'id',v_request.id,'status','rejected','balance',v_balance,
    'already_refunded',false
  );
end;
$$;

revoke all on function public.casino_reserve_cashout_v16410(
  uuid,uuid,text,bigint,bigint,bigint,numeric
) from public,anon,authenticated;
grant execute on function public.casino_reserve_cashout_v16410(
  uuid,uuid,text,bigint,bigint,bigint,numeric
) to service_role;

revoke all on function public.casino_complete_cashout_v16410(uuid)
from public,anon,authenticated;
grant execute on function public.casino_complete_cashout_v16410(uuid)
to service_role;

revoke all on function public.casino_reject_cashout_v16410(uuid,text)
from public,anon,authenticated;
grant execute on function public.casino_reject_cashout_v16410(uuid,text)
to service_role;

notify pgrst, 'reload schema';
commit;

-- Contrôle après installation :
-- select rp_per_chip,min_conversion,cashout_enabled,min_cashout,max_cashout
-- from public.casino_settings where id=1;
