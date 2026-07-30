-- Nostra Group V118
-- 1. Aligne toutes les remises fidélité sur les modèles officiels :
--    Silver 2 %, Gold 5 %, Black Signature 15 %.
-- 2. Supprime toutes les cartes de fidélité actuellement enregistrées.
-- 3. Remet les compteurs Silver, Gold et Black Signature à zéro.
-- 4. Ajoute au Dashboard les fonctions permettant de refaire ces opérations.
--
-- Prérequis : les SQL V114 et V116 doivent déjà avoir été exécutés.

begin;

do $$
begin
  if to_regclass('public.loyalty_cards') is null
    or to_regclass('public.loyalty_profiles') is null
    or to_regclass('public.loyalty_card_counters_v116') is null then
    raise exception 'missing_loyalty_v114_or_v116';
  end if;
end;
$$;

-- Une seule règle pour les pourcentages, utilisée aussi par la génération.
create or replace function public.loyalty_discount_percent_v118(p_tier text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_tier, '')))
    when 'silver' then 2::numeric
    when 'gold' then 5::numeric
    when 'black' then 15::numeric
    when 'black signature' then 15::numeric
    else 0::numeric
  end;
$$;

-- Corrige immédiatement les profils existants.
update public.loyalty_profiles
set discount_percent = public.loyalty_discount_percent_v118(tier),
    updated_at = now()
where discount_percent is distinct from public.loyalty_discount_percent_v118(tier);

-- Empêche qu'une future modification recrée l'incohérence 10 % / 15 %.
create or replace function public.enforce_loyalty_discount_v118()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.discount_percent := public.loyalty_discount_percent_v118(new.tier);
  return new;
end;
$$;

drop trigger if exists trg_enforce_loyalty_discount_v118
  on public.loyalty_profiles;
create trigger trg_enforce_loyalty_discount_v118
before insert or update of tier, discount_percent
on public.loyalty_profiles
for each row execute function public.enforce_loyalty_discount_v118();

-- Suppression demandée : toutes les anciennes cartes disparaissent maintenant.
delete from public.loyalty_cards;

-- Les trois séries repartent de zéro pour l'année en cours.
delete from public.loyalty_card_counters_v116;
insert into public.loyalty_card_counters_v116 (
  tier,
  card_year,
  last_number,
  updated_at
)
values
  ('Silver', extract(year from current_date)::integer, 0, now()),
  ('Gold', extract(year from current_date)::integer, 0, now()),
  ('Black Signature', extract(year from current_date)::integer, 0, now());

-- Ancien compteur global conservé uniquement par compatibilité.
select setval('public.loyalty_card_number_v114_seq', 1, false);

-- Génération d'un numéro avec un compteur indépendant par grade.
create or replace function public.next_loyalty_card_number_v116(
  p_tier text,
  p_issued_on date default current_date
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_prefix text;
  v_year integer;
  v_next bigint;
begin
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

  v_prefix := case v_tier
    when 'Silver' then 'NMS'
    when 'Gold' then 'NMG'
    else 'NMB'
  end;

  v_year := extract(year from coalesce(p_issued_on, current_date))::integer;

  insert into public.loyalty_card_counters_v116 (
    tier,
    card_year,
    last_number,
    updated_at
  )
  values (v_tier, v_year, 1, now())
  on conflict (tier, card_year) do update
  set last_number = public.loyalty_card_counters_v116.last_number + 1,
      updated_at = now()
  returning last_number into v_next;

  return format(
    '%s-%s-%s',
    v_prefix,
    v_year,
    lpad(v_next::text, 6, '0')
  );
end;
$$;

-- Génération manuelle depuis le Dashboard.
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

  v_number := public.next_loyalty_card_number_v116(v_tier, current_date);
  v_discount := public.loyalty_discount_percent_v118(v_tier);

  insert into public.loyalty_cards (
    user_id, card_number, tier, first_name, last_name,
    template_image_url, active, created_by
  ) values (
    p_user_id, v_number, v_tier, v_first_name, v_last_name,
    v_template, true, auth.uid()
  ) returning id into v_id;

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

-- Génération automatique lors d'un changement de grade.
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

  v_number := public.next_loyalty_card_number_v116(v_tier, current_date);

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

-- Création d'une carte lorsqu'un nom RP est ajouté après le grade fidélité.
create or replace function public.sync_loyalty_card_from_profile_v114()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
  v_template text;
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

  v_number := public.next_loyalty_card_number_v116(v_tier, current_date);

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

-- Remet seulement les compteurs à zéro. Refus si une carte existe encore,
-- afin d'éviter de générer un numéro déjà attribué.
create or replace function public.reset_loyalty_card_counters_v118()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  if exists (select 1 from public.loyalty_cards) then
    raise exception 'cards_exist';
  end if;

  delete from public.loyalty_card_counters_v116;
  insert into public.loyalty_card_counters_v116 (
    tier, card_year, last_number, updated_at
  ) values
    ('Silver', v_year, 0, now()),
    ('Gold', v_year, 0, now()),
    ('Black Signature', v_year, 0, now());

  perform setval('public.loyalty_card_number_v114_seq', 1, false);

  return jsonb_build_object('reset', true, 'year', v_year);
end;
$$;

-- Suppression complète disponible depuis le Dashboard.
create or replace function public.delete_all_loyalty_cards_and_reset_v118()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint;
  v_year integer := extract(year from current_date)::integer;
begin
  if not public.nostra_is_manager_v114() then
    raise exception 'forbidden';
  end if;

  delete from public.loyalty_cards;
  get diagnostics v_deleted = row_count;

  delete from public.loyalty_card_counters_v116;
  insert into public.loyalty_card_counters_v116 (
    tier, card_year, last_number, updated_at
  ) values
    ('Silver', v_year, 0, now()),
    ('Gold', v_year, 0, now()),
    ('Black Signature', v_year, 0, now());

  perform setval('public.loyalty_card_number_v114_seq', 1, false);

  return jsonb_build_object(
    'deleted_cards', v_deleted,
    'reset', true,
    'year', v_year
  );
end;
$$;

grant execute on function public.loyalty_discount_percent_v118(text) to authenticated;
grant execute on function public.next_loyalty_card_number_v116(text, date) to authenticated;
grant execute on function public.generate_loyalty_card_v114(uuid, text) to authenticated;
grant execute on function public.reset_loyalty_card_counters_v118() to authenticated;
grant execute on function public.delete_all_loyalty_cards_and_reset_v118() to authenticated;
grant select on public.loyalty_card_counters_v116 to authenticated;

commit;

-- Résultat attendu après ce SQL :
-- select tier, discount_percent from public.loyalty_profiles order by tier;
-- select count(*) from public.loyalty_cards; -- 0
-- select * from public.loyalty_card_counters_v116 order by tier; -- 000000
