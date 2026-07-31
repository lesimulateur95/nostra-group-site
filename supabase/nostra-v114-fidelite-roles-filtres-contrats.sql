-- NOSTRA GROUP — V114
-- 1. Cartes de fidélité personnalisées et numéros uniques
-- 2. Plusieurs rôles par citoyen, avec le rôle Citoyen toujours conservé
-- 3. Contrats mensuels Nostra Circuit avec reconduction dans le panier
--
-- Script réexécutable. Il ne supprime aucune commande, carte ou contrat existant.

begin;

-- ============================================================================
-- A. ACCÈS DIRECTION
-- ============================================================================

create or replace function public.nostra_is_manager_v114()
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

-- ============================================================================
-- B. PLUSIEURS RÔLES PAR CITOYEN
-- ============================================================================

create or replace function public.nostra_roles_from_json_v114(p_value jsonb)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_roles text[] := array[]::text[];
  v_item text;
begin
  if p_value is null or p_value = 'null'::jsonb then
    return array['citizen']::text[];
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_item in select jsonb_array_elements_text(p_value)
    loop
      v_roles := array_append(v_roles, v_item);
    end loop;
  elsif jsonb_typeof(p_value) = 'string' then
    v_roles := regexp_split_to_array(trim(both '"' from p_value::text), '\s*,\s*');
  else
    v_roles := regexp_split_to_array(p_value::text, '\s*,\s*');
  end if;

  return coalesce(v_roles, array['citizen']::text[]);
end;
$$;

create or replace function public.nostra_normalize_roles_v114(p_roles text[])
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  v_result text[] := array['citizen']::text[];
  v_role text;
  v_normalized text;
begin
  foreach v_role in array coalesce(p_roles, array[]::text[])
  loop
    v_normalized := lower(trim(coalesce(v_role, '')));
    v_normalized := case v_normalized
      when 'citoyen' then 'citizen'
      when 'employé' then 'employee'
      when 'employe' then 'employee'
      when 'commissaire' then 'commissioner'
      when 'gérant' then 'manager'
      when 'gerant' then 'manager'
      when 'direction' then 'manager'
      when 'admin' then 'administrator'
      else v_normalized
    end;

    if v_normalized in (
      'citizen', 'member', 'employee', 'commercial', 'commissioner',
      'manager', 'staff', 'administrator'
    ) and not (v_normalized = any(v_result)) then
      v_result := array_append(v_result, v_normalized);
    end if;
  end loop;

  return v_result;
end;
$$;

do $$
declare
  v_udt_name text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_profiles'
      and column_name = 'roles'
  ) then
    alter table public.member_profiles
      add column roles text[] not null default array['citizen']::text[];
  else
    select udt_name
      into v_udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'member_profiles'
      and column_name = 'roles';

    if coalesce(v_udt_name, '') <> '_text' then
      execute $alter$
        alter table public.member_profiles
        alter column roles type text[]
        using public.nostra_roles_from_json_v114(to_jsonb(roles))
      $alter$;
    end if;
  end if;
end;
$$;

alter table public.member_profiles
  alter column roles set default array['citizen']::text[];

update public.member_profiles
set roles = public.nostra_normalize_roles_v114(
  coalesce(roles, array[]::text[]) || array[coalesce(role, 'citizen')]
);

alter table public.member_profiles
  alter column roles set not null;

create or replace function public.nostra_keep_citizen_role_v114()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_roles text[];
  v_primary text;
begin
  if tg_op = 'UPDATE'
    and new.roles is not distinct from old.roles
    and new.role is distinct from old.role then
    v_roles := coalesce(old.roles, array[]::text[]) || array[coalesce(new.role, 'citizen')];
  else
    v_roles := coalesce(new.roles, array[]::text[]);
    if tg_op = 'INSERT' then
      v_roles := v_roles || array[coalesce(new.role, 'citizen')];
    elsif new.role is distinct from old.role then
      v_roles := v_roles || array[coalesce(new.role, 'citizen')];
    end if;
  end if;

  new.roles := public.nostra_normalize_roles_v114(v_roles);

  select role_key
    into v_primary
  from unnest(array[
    'manager', 'administrator', 'commissioner', 'commercial',
    'employee', 'staff', 'member', 'citizen'
  ]) with ordinality as preferred(role_key, position)
  where role_key = any(new.roles)
  order by position
  limit 1;

  new.role := coalesce(v_primary, 'citizen');
  return new;
end;
$$;

drop trigger if exists trg_nostra_keep_citizen_role_v114 on public.member_profiles;
create trigger trg_nostra_keep_citizen_role_v114
before insert or update of role, roles on public.member_profiles
for each row execute function public.nostra_keep_citizen_role_v114();

create or replace function public.update_member_roles_v114(
  p_user_id uuid,
  p_roles text[]
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_roles text[];
  v_primary text;
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  v_roles := public.nostra_normalize_roles_v114(p_roles);

  select role_key
    into v_primary
  from unnest(array[
    'manager', 'administrator', 'commissioner', 'commercial',
    'employee', 'staff', 'member', 'citizen'
  ]) with ordinality as preferred(role_key, position)
  where role_key = any(v_roles)
  order by position
  limit 1;

  update public.member_profiles
  set roles = v_roles,
      role = coalesce(v_primary, 'citizen'),
      updated_at = now()
  where user_id = p_user_id;

  if not found then
    raise exception 'member_not_found';
  end if;

  return v_roles;
end;
$$;

grant execute on function public.update_member_roles_v114(uuid, text[]) to authenticated;

-- ============================================================================
-- C. CARTES DE FIDÉLITÉ
-- ============================================================================

create sequence if not exists public.loyalty_card_number_v114_seq start 1;

create table if not exists public.loyalty_card_templates (
  tier text primary key check (tier in ('Silver', 'Gold', 'Black Signature')),
  label text not null,
  image_url text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.loyalty_card_templates (tier, label)
values
  ('Silver', 'Carte Silver'),
  ('Gold', 'Carte Gold'),
  ('Black Signature', 'Carte Black Signature')
on conflict (tier) do update
set label = excluded.label;

create table if not exists public.loyalty_cards (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  card_number text not null unique,
  tier text not null check (tier in ('Silver', 'Gold', 'Black Signature')),
  first_name text not null,
  last_name text not null,
  template_image_url text,
  active boolean not null default true,
  issued_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivation_reason text,
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists loyalty_cards_one_active_per_user_v114
  on public.loyalty_cards(user_id)
  where active;

create index if not exists loyalty_cards_user_history_v114
  on public.loyalty_cards(user_id, issued_at desc);

alter table public.loyalty_card_templates enable row level security;
alter table public.loyalty_cards enable row level security;

drop policy if exists loyalty_templates_read_v114 on public.loyalty_card_templates;
create policy loyalty_templates_read_v114
on public.loyalty_card_templates for select
to authenticated
using (true);

drop policy if exists loyalty_templates_manage_v114 on public.loyalty_card_templates;
create policy loyalty_templates_manage_v114
on public.loyalty_card_templates for all
to authenticated
using (public.nostra_is_manager_v114())
with check (public.nostra_is_manager_v114());

drop policy if exists loyalty_cards_read_own_v114 on public.loyalty_cards;
create policy loyalty_cards_read_own_v114
on public.loyalty_cards for select
to authenticated
using (user_id = auth.uid() or public.nostra_is_manager_v114());

drop policy if exists loyalty_cards_manage_v114 on public.loyalty_cards;
create policy loyalty_cards_manage_v114
on public.loyalty_cards for all
to authenticated
using (public.nostra_is_manager_v114())
with check (public.nostra_is_manager_v114());

create or replace function public.generate_loyalty_card_v114(
  p_user_id uuid,
  p_tier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_first_name text;
  v_last_name text;
  v_template text;
  v_existing_tier text;
  v_prefix text;
  v_number text;
  v_id bigint;
  v_discount numeric;
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  v_tier := case lower(trim(coalesce(p_tier, '')))
    when 'silver' then 'Silver'
    when 'gold' then 'Gold'
    when 'black' then 'Black Signature'
    when 'black signature' then 'Black Signature'
    else null
  end;

  if v_tier is null then
    raise exception 'invalid_tier';
  end if;

  select nullif(trim(rp_first_name), ''), nullif(trim(rp_last_name), '')
    into v_first_name, v_last_name
  from public.member_profiles
  where user_id = p_user_id;

  if v_first_name is null or v_last_name is null then
    raise exception 'missing_citizen_name';
  end if;

  select tier
    into v_existing_tier
  from public.loyalty_cards
  where user_id = p_user_id and active
  order by issued_at desc
  limit 1;

  update public.loyalty_cards
  set active = false,
      deactivated_at = now(),
      deactivation_reason = case
        when tier is distinct from v_tier then 'grade_change'
        else 'replacement'
      end
  where user_id = p_user_id and active;

  select image_url into v_template
  from public.loyalty_card_templates
  where tier = v_tier and enabled;

  v_prefix := case v_tier
    when 'Silver' then 'NMS'
    when 'Gold' then 'NMG'
    else 'NMB'
  end;

  v_number := format(
    '%s-%s-%s',
    v_prefix,
    extract(year from current_date)::int,
    lpad(nextval('public.loyalty_card_number_v114_seq')::text, 6, '0')
  );

  insert into public.loyalty_cards (
    user_id, card_number, tier, first_name, last_name,
    template_image_url, active, created_by
  ) values (
    p_user_id, v_number, v_tier, v_first_name, v_last_name,
    v_template, true, auth.uid()
  ) returning id into v_id;

  v_discount := case v_tier
    when 'Silver' then 2
    when 'Gold' then 5
    else 15
  end;

  perform set_config('nostra.skip_loyalty_auto_card', '1', true);

  insert into public.loyalty_profiles (
    user_id, tier, purchases_count, discount_percent, updated_at
  ) values (
    p_user_id, v_tier, 0, v_discount, now()
  )
  on conflict (user_id) do update
  set tier = excluded.tier,
      discount_percent = excluded.discount_percent,
      updated_at = now();

  return jsonb_build_object(
    'id', v_id,
    'card_number', v_number,
    'tier', v_tier,
    'previous_tier', v_existing_tier
  );
end;
$$;

create or replace function public.deactivate_loyalty_card_v114(p_card_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  update public.loyalty_cards
  set active = false,
      deactivated_at = now(),
      deactivation_reason = 'manual'
  where id = p_card_id and active;
end;
$$;

create or replace function public.set_loyalty_card_template_v114(
  p_tier text,
  p_image_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  update public.loyalty_card_templates
  set image_url = nullif(trim(p_image_url), ''),
      updated_at = now()
  where lower(tier) = lower(trim(p_tier));

  if not found then
    raise exception 'invalid_tier';
  end if;
end;
$$;

grant execute on function public.generate_loyalty_card_v114(uuid, text) to authenticated;
grant execute on function public.deactivate_loyalty_card_v114(bigint) to authenticated;
grant execute on function public.set_loyalty_card_template_v114(text, text) to authenticated;

create or replace function public.auto_generate_loyalty_card_v114()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_first_name text;
  v_last_name text;
  v_template text;
  v_prefix text;
  v_number text;
  v_active_tier text;
begin
  if current_setting('nostra.skip_loyalty_auto_card', true) = '1' then
    return new;
  end if;

  v_tier := case lower(trim(coalesce(new.tier, '')))
    when 'silver' then 'Silver'
    when 'gold' then 'Gold'
    when 'black' then 'Black Signature'
    when 'black signature' then 'Black Signature'
    else null
  end;

  if v_tier is null then
    return new;
  end if;

  select tier
    into v_active_tier
  from public.loyalty_cards
  where user_id = new.user_id and active
  order by issued_at desc
  limit 1;

  if v_active_tier = v_tier then
    return new;
  end if;

  select nullif(trim(rp_first_name), ''), nullif(trim(rp_last_name), '')
    into v_first_name, v_last_name
  from public.member_profiles
  where user_id = new.user_id;

  if v_first_name is null or v_last_name is null then
    return new;
  end if;

  update public.loyalty_cards
  set active = false,
      deactivated_at = now(),
      deactivation_reason = 'grade_change'
  where user_id = new.user_id and active;

  select image_url into v_template
  from public.loyalty_card_templates
  where tier = v_tier and enabled;

  v_prefix := case v_tier
    when 'Silver' then 'NMS'
    when 'Gold' then 'NMG'
    else 'NMB'
  end;

  v_number := format(
    '%s-%s-%s',
    v_prefix,
    extract(year from current_date)::int,
    lpad(nextval('public.loyalty_card_number_v114_seq')::text, 6, '0')
  );

  insert into public.loyalty_cards (
    user_id, card_number, tier, first_name, last_name,
    template_image_url, active, created_by
  ) values (
    new.user_id, v_number, v_tier, v_first_name, v_last_name,
    v_template, true, auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists trg_auto_generate_loyalty_card_v114 on public.loyalty_profiles;
create trigger trg_auto_generate_loyalty_card_v114
after insert or update of tier on public.loyalty_profiles
for each row execute function public.auto_generate_loyalty_card_v114();

-- Crée immédiatement une carte pour les citoyens qui possèdent déjà un grade
-- au moment de l'installation de la V114. Les cartes des autres citoyens ne
-- sont jamais désactivées.
with loyalty_candidates as (
  select
    lp.user_id,
    case lower(trim(coalesce(lp.tier, '')))
      when 'silver' then 'Silver'
      when 'gold' then 'Gold'
      when 'black' then 'Black Signature'
      when 'black signature' then 'Black Signature'
      else null
    end as normalized_tier,
    nullif(trim(mp.rp_first_name), '') as first_name,
    nullif(trim(mp.rp_last_name), '') as last_name
  from public.loyalty_profiles lp
  join public.member_profiles mp on mp.user_id = lp.user_id
)
insert into public.loyalty_cards (
  user_id, card_number, tier, first_name, last_name,
  template_image_url, active, created_by
)
select
  candidate.user_id,
  format(
    '%s-%s-%s',
    case candidate.normalized_tier
      when 'Silver' then 'NMS'
      when 'Gold' then 'NMG'
      else 'NMB'
    end,
    extract(year from current_date)::int,
    lpad(nextval('public.loyalty_card_number_v114_seq')::text, 6, '0')
  ),
  candidate.normalized_tier,
  candidate.first_name,
  candidate.last_name,
  template.image_url,
  true,
  null
from loyalty_candidates candidate
left join public.loyalty_card_templates template
  on template.tier = candidate.normalized_tier and template.enabled
where candidate.normalized_tier is not null
  and candidate.first_name is not null
  and candidate.last_name is not null
  and not exists (
    select 1
    from public.loyalty_cards active_card
    where active_card.user_id = candidate.user_id and active_card.active
  )
on conflict do nothing;

-- Si le nom RP est corrigé, la carte active est mise à jour. Si le citoyen
-- avait déjà un grade mais pas encore de carte faute de nom complet, la carte
-- est créée dès que son prénom et son nom deviennent disponibles.
create or replace function public.sync_loyalty_card_from_profile_v114()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_template text;
  v_prefix text;
  v_number text;
begin
  if nullif(trim(new.rp_first_name), '') is null
    or nullif(trim(new.rp_last_name), '') is null then
    return new;
  end if;

  update public.loyalty_cards
  set first_name = trim(new.rp_first_name),
      last_name = trim(new.rp_last_name)
  where user_id = new.user_id and active;

  if found then
    return new;
  end if;

  select case lower(trim(coalesce(profile.tier, '')))
    when 'silver' then 'Silver'
    when 'gold' then 'Gold'
    when 'black' then 'Black Signature'
    when 'black signature' then 'Black Signature'
    else null
  end
  into v_tier
  from public.loyalty_profiles profile
  where profile.user_id = new.user_id;

  if v_tier is null then
    return new;
  end if;

  select image_url into v_template
  from public.loyalty_card_templates
  where tier = v_tier and enabled;

  v_prefix := case v_tier
    when 'Silver' then 'NMS'
    when 'Gold' then 'NMG'
    else 'NMB'
  end;

  v_number := format(
    '%s-%s-%s',
    v_prefix,
    extract(year from current_date)::int,
    lpad(nextval('public.loyalty_card_number_v114_seq')::text, 6, '0')
  );

  insert into public.loyalty_cards (
    user_id, card_number, tier, first_name, last_name,
    template_image_url, active, created_by
  ) values (
    new.user_id, v_number, v_tier, trim(new.rp_first_name), trim(new.rp_last_name),
    v_template, true, auth.uid()
  ) on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_sync_loyalty_card_from_profile_v114 on public.member_profiles;
create trigger trg_sync_loyalty_card_from_profile_v114
after insert or update of rp_first_name, rp_last_name on public.member_profiles
for each row execute function public.sync_loyalty_card_from_profile_v114();

grant select on public.loyalty_card_templates to authenticated;
grant select on public.loyalty_cards to authenticated;

-- ============================================================================
-- D. CONTRATS NOSTRA CIRCUIT
-- ============================================================================

create sequence if not exists public.circuit_contract_number_v114_seq start 1;

create table if not exists public.circuit_contracts (
  id bigint generated by default as identity primary key,
  contract_number text not null unique,
  organization_name text not null,
  responsible_user_id uuid not null references auth.users(id) on delete restrict,
  responsible_name text not null,
  monthly_price numeric(14,2) not null check (monthly_price >= 0),
  billing_day integer not null default 1 check (billing_day between 1 and 28),
  payment_due_days integer not null default 10 check (payment_due_days between 0 and 31),
  started_on date not null,
  ends_on date,
  next_billing_on date not null,
  access_scope text not null default 'Accès mensuel au circuit pour les entraînements',
  authorized_people integer check (authorized_people is null or authorized_people > 0),
  notes text,
  status text not null default 'active'
    check (status in ('draft', 'active', 'suspended', 'terminated', 'expired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.circuit_contract_price_history (
  id bigint generated by default as identity primary key,
  contract_id bigint not null references public.circuit_contracts(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  effective_from date not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(contract_id, effective_from)
);

create table if not exists public.circuit_contract_installments (
  id bigint generated by default as identity primary key,
  contract_id bigint not null references public.circuit_contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  billing_period date not null,
  due_on date not null,
  item_name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'in_cart'
    check (status in ('in_cart', 'paid', 'cancelled')),
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique(contract_id, billing_period)
);

create index if not exists circuit_contracts_responsible_v114
  on public.circuit_contracts(responsible_user_id, status);
create index if not exists circuit_contract_installments_cart_v114
  on public.circuit_contract_installments(user_id, status, due_on);

alter table public.circuit_contracts enable row level security;
alter table public.circuit_contract_price_history enable row level security;
alter table public.circuit_contract_installments enable row level security;

drop policy if exists circuit_contracts_read_v114 on public.circuit_contracts;
create policy circuit_contracts_read_v114
on public.circuit_contracts for select
to authenticated
using (responsible_user_id = auth.uid() or public.nostra_is_manager_v114());

drop policy if exists circuit_contracts_manage_v114 on public.circuit_contracts;
create policy circuit_contracts_manage_v114
on public.circuit_contracts for all
to authenticated
using (public.nostra_is_manager_v114())
with check (public.nostra_is_manager_v114());

drop policy if exists circuit_contract_price_read_v114 on public.circuit_contract_price_history;
create policy circuit_contract_price_read_v114
on public.circuit_contract_price_history for select
to authenticated
using (
  public.nostra_is_manager_v114()
  or exists (
    select 1 from public.circuit_contracts c
    where c.id = circuit_contract_price_history.contract_id
      and c.responsible_user_id = auth.uid()
  )
);

drop policy if exists circuit_contract_price_manage_v114 on public.circuit_contract_price_history;
create policy circuit_contract_price_manage_v114
on public.circuit_contract_price_history for all
to authenticated
using (public.nostra_is_manager_v114())
with check (public.nostra_is_manager_v114());

drop policy if exists circuit_contract_installments_read_v114 on public.circuit_contract_installments;
create policy circuit_contract_installments_read_v114
on public.circuit_contract_installments for select
to authenticated
using (user_id = auth.uid() or public.nostra_is_manager_v114());

drop policy if exists circuit_contract_installments_manage_v114 on public.circuit_contract_installments;
create policy circuit_contract_installments_manage_v114
on public.circuit_contract_installments for all
to authenticated
using (public.nostra_is_manager_v114())
with check (public.nostra_is_manager_v114());

create or replace function public.nostra_contract_month_label_v114(p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select (case extract(month from p_date)::int
    when 1 then 'Janvier'
    when 2 then 'Février'
    when 3 then 'Mars'
    when 4 then 'Avril'
    when 5 then 'Mai'
    when 6 then 'Juin'
    when 7 then 'Juillet'
    when 8 then 'Août'
    when 9 then 'Septembre'
    when 10 then 'Octobre'
    when 11 then 'Novembre'
    else 'Décembre'
  end) || ' ' || extract(year from p_date)::int;
$$;

create or replace function public.nostra_next_contract_date_v114(
  p_current date,
  p_billing_day integer
)
returns date
language sql
immutable
set search_path = public
as $$
  with next_month as (
    select (date_trunc('month', p_current) + interval '1 month')::date as first_day
  )
  select make_date(
    extract(year from first_day)::int,
    extract(month from first_day)::int,
    least(
      greatest(p_billing_day, 1),
      extract(day from (first_day + interval '1 month - 1 day'))::int
    )
  )
  from next_month;
$$;

create or replace function public.create_circuit_contract_v114(
  p_organization_name text,
  p_responsible_user_id uuid,
  p_monthly_price numeric,
  p_billing_day integer,
  p_payment_due_days integer,
  p_started_on date,
  p_ends_on date,
  p_access_scope text,
  p_authorized_people integer,
  p_notes text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_number text;
  v_name text;
  v_first_billing date;
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  if nullif(trim(p_organization_name), '') is null
    or p_responsible_user_id is null
    or p_monthly_price is null
    or p_monthly_price < 0
    or p_started_on is null then
    raise exception 'invalid_contract';
  end if;

  select trim(concat_ws(' ', rp_first_name, rp_last_name))
    into v_name
  from public.member_profiles
  where user_id = p_responsible_user_id;

  if nullif(v_name, '') is null then
    raise exception 'responsible_not_found';
  end if;

  v_number := format(
    'NC-%s-%s',
    extract(year from current_date)::int,
    lpad(nextval('public.circuit_contract_number_v114_seq')::text, 5, '0')
  );

  v_first_billing := make_date(
    extract(year from p_started_on)::int,
    extract(month from p_started_on)::int,
    least(
      greatest(coalesce(p_billing_day, 1), 1),
      extract(day from (date_trunc('month', p_started_on) + interval '1 month - 1 day'))::int
    )
  );

  if v_first_billing < p_started_on then
    v_first_billing := public.nostra_next_contract_date_v114(
      v_first_billing,
      coalesce(p_billing_day, 1)
    );
  end if;

  insert into public.circuit_contracts (
    contract_number, organization_name, responsible_user_id, responsible_name,
    monthly_price, billing_day, payment_due_days, started_on, ends_on,
    next_billing_on, access_scope, authorized_people, notes, status, created_by
  ) values (
    v_number, trim(p_organization_name), p_responsible_user_id, v_name,
    p_monthly_price, greatest(1, least(coalesce(p_billing_day, 1), 28)),
    greatest(0, least(coalesce(p_payment_due_days, 10), 31)),
    p_started_on, p_ends_on, v_first_billing,
    coalesce(nullif(trim(p_access_scope), ''), 'Accès mensuel au circuit pour les entraînements'),
    p_authorized_people, nullif(trim(p_notes), ''), 'active', auth.uid()
  ) returning id into v_id;

  insert into public.circuit_contract_price_history (
    contract_id, amount, effective_from, reason, created_by
  ) values (
    v_id, p_monthly_price, p_started_on, 'Tarif initial', auth.uid()
  );

  return v_id;
end;
$$;

create or replace function public.update_circuit_contract_price_v114(
  p_contract_id bigint,
  p_new_price numeric,
  p_effective_from date,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  if p_new_price is null or p_new_price < 0 or p_effective_from is null then
    raise exception 'invalid_price';
  end if;

  insert into public.circuit_contract_price_history (
    contract_id, amount, effective_from, reason, created_by
  ) values (
    p_contract_id, p_new_price, p_effective_from,
    nullif(trim(p_reason), ''), auth.uid()
  )
  on conflict (contract_id, effective_from) do update
  set amount = excluded.amount,
      reason = excluded.reason,
      created_by = auth.uid(),
      created_at = now();

  update public.circuit_contracts
  set monthly_price = p_new_price,
      updated_at = now()
  where id = p_contract_id;

  if not found then
    raise exception 'contract_not_found';
  end if;
end;
$$;

create or replace function public.update_circuit_contract_status_v114(
  p_contract_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  if p_status not in ('draft', 'active', 'suspended', 'terminated', 'expired') then
    raise exception 'invalid_status';
  end if;

  update public.circuit_contracts
  set status = p_status,
      updated_at = now()
  where id = p_contract_id;

  if not found then
    raise exception 'contract_not_found';
  end if;
end;
$$;

create or replace function public.generate_due_contract_renewals_v114(
  p_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.circuit_contracts%rowtype;
  v_price numeric;
  v_created integer := 0;
  v_iterations integer;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  if p_user_id is null and not public.nostra_is_manager_v114() then
    p_user_id := auth.uid();
  elsif p_user_id is not null
    and p_user_id <> auth.uid()
    and not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  for v_contract in
    select *
    from public.circuit_contracts
    where status = 'active'
      and next_billing_on <= current_date
      and (ends_on is null or next_billing_on <= ends_on)
      and (p_user_id is null or responsible_user_id = p_user_id)
    order by id
    for update
  loop
    v_iterations := 0;

    while v_contract.next_billing_on <= current_date
      and (v_contract.ends_on is null or v_contract.next_billing_on <= v_contract.ends_on)
      and v_iterations < 120
    loop
      select amount
        into v_price
      from public.circuit_contract_price_history
      where contract_id = v_contract.id
        and effective_from <= v_contract.next_billing_on
      order by effective_from desc, id desc
      limit 1;

      v_price := coalesce(v_price, v_contract.monthly_price);
      v_label := format(
        'Reconduction du contrat — %s — %s',
        v_contract.organization_name,
        public.nostra_contract_month_label_v114(v_contract.next_billing_on)
      );

      insert into public.circuit_contract_installments (
        contract_id, user_id, billing_period, due_on, item_name, amount, status
      ) values (
        v_contract.id,
        v_contract.responsible_user_id,
        v_contract.next_billing_on,
        v_contract.next_billing_on + v_contract.payment_due_days,
        v_label,
        v_price,
        'in_cart'
      )
      on conflict (contract_id, billing_period) do nothing;

      if found then
        v_created := v_created + 1;
      end if;

      v_contract.next_billing_on := public.nostra_next_contract_date_v114(
        v_contract.next_billing_on,
        v_contract.billing_day
      );
      v_iterations := v_iterations + 1;
    end loop;

    update public.circuit_contracts
    set next_billing_on = v_contract.next_billing_on,
        status = case
          when ends_on is not null and v_contract.next_billing_on > ends_on then 'expired'
          else status
        end,
        updated_at = now()
    where id = v_contract.id;
  end loop;

  return v_created;
end;
$$;

create or replace function public.checkout_contract_renewals_v114()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_total numeric := 0;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'forbidden';
  end if;

  perform public.generate_due_contract_renewals_v114(auth.uid());

  for v_row in
    select i.id, i.item_name, i.amount, i.contract_id
    from public.circuit_contract_installments i
    where i.user_id = auth.uid()
      and i.status = 'in_cart'
    order by i.billing_period
    for update
  loop
    update public.circuit_contract_installments
    set status = 'paid', paid_at = now()
    where id = v_row.id;

    if to_regclass('public.accounting_entries') is not null then
      insert into public.accounting_entries (
        entry_date, entry_type, category, label, amount, notes
      ) values (
        current_date, 'income', 'Contrats circuit', v_row.item_name,
        v_row.amount, format('Paiement du contrat #%s', v_row.contract_id)
      );
    end if;

    v_count := v_count + 1;
    v_total := v_total + v_row.amount;
  end loop;

  if v_count = 0 then
    raise exception 'empty_contract_cart';
  end if;

  return jsonb_build_object('count', v_count, 'total', v_total);
end;
$$;

create or replace function public.cancel_contract_installment_v114(p_installment_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  update public.circuit_contract_installments
  set status = 'cancelled', cancelled_at = now()
  where id = p_installment_id and status = 'in_cart';
end;
$$;

grant select on public.circuit_contracts to authenticated;
grant select on public.circuit_contract_price_history to authenticated;
grant select on public.circuit_contract_installments to authenticated;

grant execute on function public.create_circuit_contract_v114(text, uuid, numeric, integer, integer, date, date, text, integer, text) to authenticated;
grant execute on function public.update_circuit_contract_price_v114(bigint, numeric, date, text) to authenticated;
grant execute on function public.update_circuit_contract_status_v114(bigint, text) to authenticated;
grant execute on function public.generate_due_contract_renewals_v114(uuid) to authenticated;
grant execute on function public.checkout_contract_renewals_v114() to authenticated;
grant execute on function public.cancel_contract_installment_v114(bigint) to authenticated;

commit;
