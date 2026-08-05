-- Nostra Group V137.1
-- Commissions créditées automatiquement au paiement, compte commercial et net Nostra détaillé.

begin;

alter table public.orders
  add column if not exists paid_at timestamptz;
alter table public.orders
  alter column paid_at set default now();

alter table public.accounting_entries
  add column if not exists nostra_source_type text;
alter table public.accounting_entries
  add column if not exists nostra_source_id text;
create unique index if not exists accounting_entries_nostra_source_v92_uq
  on public.accounting_entries (nostra_source_type, nostra_source_id);

create table if not exists public.commercial_accounts_v137 (
  commercial_user_id uuid primary key references auth.users(id) on delete cascade,
  commercial_name text not null,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  total_credited numeric(14,2) not null default 0 check (total_credited >= 0),
  updated_at timestamptz not null default now()
);

alter table public.commercial_commissions_v137
  add column if not exists gross_accounting_entry_id bigint references public.accounting_entries(id) on delete set null;
alter table public.commercial_commissions_v137
  add column if not exists commission_accounting_entry_id bigint references public.accounting_entries(id) on delete set null;
alter table public.commercial_commissions_v137
  add column if not exists credited_at timestamptz;

create or replace function public.sync_order_commission_v137()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.commercial_commission_settings_v137%rowtype;
  v_existing public.commercial_commissions_v137%rowtype;
  v_amount numeric(14,2) := 0;
  v_net numeric(14,2) := 0;
  v_gross_entry_id bigint;
  v_commission_entry_id bigint;
  v_commission_id bigint;
  v_had_existing boolean := false;
  v_is_new_credit boolean := false;
begin
  if new.status = 'cancelled' then
    update public.commercial_commissions_v137
    set status = 'cancelled', updated_at = now()
    where order_id = new.id and status <> 'paid';
    return new;
  end if;

  if new.paid_at is null or new.commercial_user_id is null then
    return new;
  end if;

  select * into v_settings
  from public.commercial_commission_settings_v137
  where id = 1;

  if not coalesce(v_settings.enabled, false) then
    return new;
  end if;

  select * into v_existing
  from public.commercial_commissions_v137
  where order_id = new.id
  for update;
  v_had_existing := found;

  if v_had_existing and v_existing.status = 'paid' then
    return new;
  end if;

  v_amount := case
    when v_settings.commission_mode = 'fixed' then least(greatest(0, coalesce(new.total, 0)), greatest(0, v_settings.commission_value))
    else round(greatest(0, coalesce(new.total, 0)) * least(100, greatest(0, v_settings.commission_value)) / 100, 2)
  end;
  v_net := greatest(0, coalesce(new.total, 0) - v_amount);

  insert into public.accounting_entries (
    entry_date, entry_type, category, label, amount, notes,
    nostra_source_type, nostra_source_id
  ) values (
    current_date, 'income', 'Ventes Nostra Motors',
    'Vente ' || new.order_number || ' — paiement citoyen',
    greatest(0, coalesce(new.total, 0)),
    'Prix de vente : ' || greatest(0, coalesce(new.total, 0)) || ' € · Commission ' ||
      coalesce(nullif(new.commercial_name, ''), 'Commercial') || ' : ' || v_amount ||
      ' € · Net Nostra : ' || v_net || ' €',
    'commercial_sale_gross_v137_1', new.id::text
  )
  on conflict (nostra_source_type, nostra_source_id) do update set
    amount = excluded.amount,
    label = excluded.label,
    notes = excluded.notes
  returning id into v_gross_entry_id;

  if v_amount > 0 then
    insert into public.accounting_entries (
      entry_date, entry_type, category, label, amount, notes,
      nostra_source_type, nostra_source_id
    ) values (
      current_date, 'expense', 'Commissions commerciales',
      'Commission ' || coalesce(nullif(new.commercial_name, ''), 'Commercial') || ' — ' || new.order_number,
      v_amount,
      'Prix de vente : ' || greatest(0, coalesce(new.total, 0)) || ' € · Commission retirée automatiquement : ' ||
        v_amount || ' € · Net conservé par Nostra : ' || v_net || ' €',
      'commercial_commission_v137_1', new.id::text
    )
    on conflict (nostra_source_type, nostra_source_id) do update set
      amount = excluded.amount,
      label = excluded.label,
      notes = excluded.notes
    returning id into v_commission_entry_id;
  end if;

  insert into public.commercial_commissions_v137 (
    order_id, order_number, commercial_user_id, commercial_name, sale_amount,
    commission_mode, commission_value, commission_amount, status, sale_date,
    paid_at, credited_at, gross_accounting_entry_id,
    commission_accounting_entry_id, updated_at
  ) values (
    new.id, new.order_number, new.commercial_user_id,
    coalesce(nullif(new.commercial_name, ''), 'Commercial'),
    greatest(0, coalesce(new.total, 0)), v_settings.commission_mode,
    v_settings.commission_value, v_amount, 'paid', current_date,
    now(), now(), v_gross_entry_id, v_commission_entry_id, now()
  )
  on conflict (order_id) do update set
    order_number = excluded.order_number,
    commercial_user_id = excluded.commercial_user_id,
    commercial_name = excluded.commercial_name,
    sale_amount = excluded.sale_amount,
    commission_mode = excluded.commission_mode,
    commission_value = excluded.commission_value,
    commission_amount = excluded.commission_amount,
    status = 'paid',
    sale_date = excluded.sale_date,
    paid_at = coalesce(public.commercial_commissions_v137.paid_at, now()),
    credited_at = coalesce(public.commercial_commissions_v137.credited_at, now()),
    gross_accounting_entry_id = excluded.gross_accounting_entry_id,
    commission_accounting_entry_id = excluded.commission_accounting_entry_id,
    updated_at = now()
  returning id into v_commission_id;

  v_is_new_credit := not v_had_existing or v_existing.status <> 'paid';
  if v_is_new_credit and v_amount > 0 then
    insert into public.commercial_accounts_v137 (
      commercial_user_id, commercial_name, balance, total_credited, updated_at
    ) values (
      new.commercial_user_id,
      coalesce(nullif(new.commercial_name, ''), 'Commercial'),
      v_amount, v_amount, now()
    )
    on conflict (commercial_user_id) do update set
      commercial_name = excluded.commercial_name,
      balance = public.commercial_accounts_v137.balance + excluded.balance,
      total_credited = public.commercial_accounts_v137.total_credited + excluded.total_credited,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists sync_order_commission_v137 on public.orders;
create trigger sync_order_commission_v137
after insert or update of status, total, commercial_user_id, commercial_name, paid_at on public.orders
for each row execute function public.sync_order_commission_v137();

create or replace function public.assign_order_commercial_v137(
  p_order_id bigint,
  p_commercial_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_current_user_id uuid;
  v_paid_commercial_id uuid;
begin
  if not public.nostra_v137_has_any_role(array['manager']) then
    raise exception using message = 'manager_required';
  end if;

  select commercial_user_id into v_current_user_id
  from public.orders where id = p_order_id for update;
  if not found then raise exception using message = 'order_not_found'; end if;

  select commercial_user_id into v_paid_commercial_id
  from public.commercial_commissions_v137
  where order_id = p_order_id and status = 'paid';

  if v_paid_commercial_id is not null and v_paid_commercial_id is distinct from p_commercial_user_id then
    raise exception using message = 'commission_already_credited';
  end if;

  if p_commercial_user_id is null then
    update public.orders set commercial_user_id = null, commercial_name = null where id = p_order_id;
    return;
  end if;

  select coalesce(
    nullif(btrim(concat_ws(' ', rp_first_name, rp_last_name)), ''),
    nullif(discord_name, ''), nullif(email, '')
  ) into v_name
  from public.member_profiles
  where user_id = p_commercial_user_id;

  if v_name is null then raise exception using message = 'commercial_not_found'; end if;

  update public.orders
  set commercial_user_id = p_commercial_user_id, commercial_name = v_name
  where id = p_order_id;
end;
$$;

-- Le paiement mensuel ne concerne plus les commissions : elles sont déjà créditées.
-- Il reste uniquement utilisé pour verser une éventuelle prime d'objectif.
create or replace function public.pay_commercial_month_v137(
  p_commercial_user_id uuid,
  p_month date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_name text;
  v_revenue numeric(14,2) := 0;
  v_sales integer := 0;
  v_bonus numeric(14,2) := 0;
  v_payment_id bigint;
  v_accounting_id bigint;
  v_objective public.commercial_objectives_v137%rowtype;
begin
  if not public.nostra_v137_has_any_role(array['manager']) then
    raise exception using message = 'manager_required';
  end if;
  if exists (select 1 from public.commercial_payments_v137 where commercial_user_id = p_commercial_user_id and payment_month = v_month) then
    raise exception using message = 'month_already_paid';
  end if;

  select coalesce(max(commercial_name), 'Commercial'), coalesce(sum(sale_amount), 0), count(*)::integer
  into v_name, v_revenue, v_sales
  from public.commercial_commissions_v137
  where commercial_user_id = p_commercial_user_id
    and sale_date >= v_month
    and sale_date < (v_month + interval '1 month')::date
    and status = 'paid';

  select * into v_objective
  from public.commercial_objectives_v137
  where commercial_user_id = p_commercial_user_id and objective_month = v_month;

  if found and v_sales >= v_objective.sales_target and v_revenue >= v_objective.revenue_target then
    v_bonus := v_objective.target_bonus;
  end if;
  if v_bonus <= 0 then raise exception using message = 'nothing_to_pay'; end if;

  insert into public.accounting_entries (
    entry_date, entry_type, category, label, amount, notes,
    nostra_source_type, nostra_source_id
  ) values (
    current_date, 'expense', 'Primes commerciales',
    'Prime objectif ' || v_name || ' — ' || to_char(v_month, 'MM/YYYY'),
    v_bonus, 'Prime d’objectif uniquement · les commissions des ventes ont déjà été créditées automatiquement.',
    'commercial_objective_bonus_v137_1', p_commercial_user_id::text || ':' || v_month::text
  )
  returning id into v_accounting_id;

  insert into public.commercial_payments_v137 (
    commercial_user_id, commercial_name, payment_month, commission_total,
    objective_bonus, total_paid, accounting_entry_id, paid_by
  ) values (
    p_commercial_user_id, v_name, v_month, 0, v_bonus, v_bonus,
    v_accounting_id, auth.uid()
  ) returning id into v_payment_id;

  update public.commercial_objectives_v137
  set paid_at = now(), updated_at = now()
  where commercial_user_id = p_commercial_user_id and objective_month = v_month;

  return jsonb_build_object('payment_id', v_payment_id, 'commission', 0, 'bonus', v_bonus, 'total', v_bonus);
end;
$$;

alter table public.commercial_accounts_v137 enable row level security;
drop policy if exists "commercial accounts read v137" on public.commercial_accounts_v137;
create policy "commercial accounts read v137"
  on public.commercial_accounts_v137 for select to authenticated
  using (commercial_user_id = auth.uid() or public.nostra_v137_has_any_role(array['manager']));
grant select on public.commercial_accounts_v137 to authenticated;

-- Rejoue la synchronisation pour les commandes déjà payées et attribuées.
update public.orders
set paid_at = coalesce(paid_at, created_at)
where status <> 'cancelled'
  and commercial_user_id is not null;

commit;

select 'V137.1 prête · commissions créditées automatiquement et net Nostra détaillé' as resultat;
