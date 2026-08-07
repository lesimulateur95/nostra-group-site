-- Nostra Group V140
-- Academy avancée : prérequis par licence, qualifications expirables,
-- durée des licences configurable, suspension/retrait et contrôle serveur.
-- Prérequis : V137 Academy + V139 Academy/Licences + module licences pilotes.

begin;

-- ---------------------------------------------------------------------------
-- 1. DURÉE DE VALIDITÉ DES QUALIFICATIONS ACADEMY
-- ---------------------------------------------------------------------------

alter table public.academy_courses_v137
  add column if not exists qualification_valid_days integer;

alter table public.academy_qualifications_v137
  add column if not exists valid_until date;

-- 0 / NULL = qualification permanente.
update public.academy_courses_v137
set qualification_valid_days = null
where qualification_valid_days is not null and qualification_valid_days <= 0;

create or replace function public.issue_academy_qualification_v137()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.academy_courses_v137%rowtype;
  v_valid_until date;
begin
  if new.status <> 'passed' then return new; end if;

  select * into v_course
  from public.academy_courses_v137
  where id = new.course_id;

  if new.theory_score is null or new.practical_score is null
     or new.theory_score < v_course.theory_pass_score
     or new.practical_score < v_course.practical_pass_score then
    raise exception using message='passing_scores_required';
  end if;

  v_valid_until := case
    when coalesce(v_course.qualification_valid_days, 0) > 0
      then current_date + v_course.qualification_valid_days
    else null
  end;

  insert into public.academy_qualifications_v137(
    qualification_number,
    enrollment_id,
    course_id,
    user_id,
    holder_name,
    qualification_label,
    theory_score,
    practical_score,
    issued_at,
    valid_until,
    active
  ) values(
    'NRA-' || to_char(current_date,'YYYY') || '-' || lpad(new.id::text,6,'0'),
    new.id,
    new.course_id,
    new.user_id,
    new.applicant_name,
    v_course.qualification_label,
    new.theory_score,
    new.practical_score,
    now(),
    v_valid_until,
    true
  ) on conflict (enrollment_id) do update set
    holder_name = excluded.holder_name,
    qualification_label = excluded.qualification_label,
    theory_score = excluded.theory_score,
    practical_score = excluded.practical_score,
    issued_at = now(),
    valid_until = excluded.valid_until,
    active = true;

  new.completed_at := coalesce(new.completed_at, now());
  return new;
end;
$$;

-- Backfill des anciennes qualifications si une durée est déjà configurée.
update public.academy_qualifications_v137 q
set valid_until = q.issued_at::date + c.qualification_valid_days
from public.academy_courses_v137 c
where c.id = q.course_id
  and q.valid_until is null
  and coalesce(c.qualification_valid_days, 0) > 0;

-- ---------------------------------------------------------------------------
-- 2. MATRICE DES PRÉREQUIS PAR LICENCE
-- ---------------------------------------------------------------------------

create table if not exists public.academy_license_requirements_v140 (
  license_code text primary key,
  license_label text not null,
  required_course_id bigint references public.academy_courses_v137(id) on delete set null,
  prerequisite_license_code text,
  min_theory_score numeric(5,2) not null default 0 check (min_theory_score between 0 and 100),
  min_practical_score numeric(5,2) not null default 0 check (min_practical_score between 0 and 100),
  license_validity_months integer not null default 5 check (license_validity_months between 1 and 60),
  active boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Copie automatiquement les types de licences du module existant.
do $$
begin
  if to_regclass('public.pilot_license_types') is not null then
    execute $q$
      insert into public.academy_license_requirements_v140(license_code, license_label)
      select code, label
      from public.pilot_license_types
      on conflict (license_code) do update
        set license_label = excluded.license_label
    $q$;
  end if;
end;
$$;

-- Préremplissage intelligent :
-- Licence Circuit/Pilote -> pas de licence précédente.
-- GT3 -> Licence Circuit/Pilote.
-- F1 -> Licence GT3.
do $$
declare
  v_base text;
  v_gt3 text;
  v_f1 text;
  v_base_course bigint;
  v_gt3_course bigint;
  v_f1_course bigint;
begin
  if to_regclass('public.pilot_license_types') is not null then
    select code into v_f1
    from public.pilot_license_types
    where upper(regexp_replace(code, '[^A-Z0-9]', '', 'g')) = 'F1'
    order by sort_order nulls last
    limit 1;

    select code into v_gt3
    from public.pilot_license_types
    where upper(regexp_replace(code, '[^A-Z0-9]', '', 'g')) like '%GT3%'
    order by sort_order nulls last
    limit 1;

    select code into v_base
    from public.pilot_license_types
    where upper(regexp_replace(code, '[^A-Z0-9]', '', 'g')) <> 'F1'
      and upper(regexp_replace(code, '[^A-Z0-9]', '', 'g')) not like '%GT3%'
    order by sort_order nulls last, code
    limit 1;

    select id into v_f1_course
    from public.academy_courses_v137
    where lower(title || ' ' || qualification_label) like '%f1%'
       or lower(title || ' ' || qualification_label) like '%monoplace%'
    order by active desc, sort_order, id
    limit 1;

    select id into v_gt3_course
    from public.academy_courses_v137
    where lower(title || ' ' || qualification_label) like '%gt3%'
       or lower(title || ' ' || qualification_label) like '%grand tourisme%'
    order by active desc, sort_order, id
    limit 1;

    select id into v_base_course
    from public.academy_courses_v137
    where (
      lower(title || ' ' || qualification_label) like '%circuit%'
      or lower(title || ' ' || qualification_label) like '%pilote%'
      or lower(title || ' ' || qualification_label) like '%initiation%'
    )
      and lower(title || ' ' || qualification_label) not like '%gt3%'
      and lower(title || ' ' || qualification_label) not like '%f1%'
      and lower(title || ' ' || qualification_label) not like '%monoplace%'
    order by active desc, sort_order, id
    limit 1;

    if v_base is not null then
      update public.academy_license_requirements_v140
      set required_course_id = coalesce(required_course_id, v_base_course)
      where license_code = v_base;
    end if;

    if v_gt3 is not null then
      update public.academy_license_requirements_v140
      set required_course_id = coalesce(required_course_id, v_gt3_course),
          prerequisite_license_code = coalesce(prerequisite_license_code, v_base)
      where license_code = v_gt3;
    end if;

    if v_f1 is not null then
      update public.academy_license_requirements_v140
      set required_course_id = coalesce(required_course_id, v_f1_course),
          prerequisite_license_code = coalesce(prerequisite_license_code, v_gt3)
      where license_code = v_f1;
    end if;
  end if;
end;
$$;

alter table public.academy_license_requirements_v140 enable row level security;

drop policy if exists "academy license requirements read v140" on public.academy_license_requirements_v140;
create policy "academy license requirements read v140"
on public.academy_license_requirements_v140
for select to authenticated
using (true);

drop policy if exists "academy license requirements manage v140" on public.academy_license_requirements_v140;
create policy "academy license requirements manage v140"
on public.academy_license_requirements_v140
for all to authenticated
using (public.nostra_v137_has_any_role(array['manager','commissioner']))
with check (public.nostra_v137_has_any_role(array['manager','commissioner']));

grant select,insert,update,delete on public.academy_license_requirements_v140 to authenticated;

-- ---------------------------------------------------------------------------
-- 3. SUSPENSION / RETRAIT ADMINISTRATIF DES LICENCES
-- ---------------------------------------------------------------------------

create table if not exists public.academy_licence_controls_v140 (
  licence_id text primary key,
  holder_user_id uuid references auth.users(id) on delete cascade,
  control_state text not null default 'active' check (control_state in ('active','suspended','revoked')),
  reason text,
  suspended_until date,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  updated_at timestamptz not null default now()
);

create index if not exists academy_licence_controls_holder_v140_idx
  on public.academy_licence_controls_v140(holder_user_id, updated_at desc);

alter table public.academy_licence_controls_v140 enable row level security;

drop policy if exists "academy licence controls read v140" on public.academy_licence_controls_v140;
create policy "academy licence controls read v140"
on public.academy_licence_controls_v140
for select to authenticated
using (
  holder_user_id = auth.uid()
  or public.nostra_v137_has_any_role(array['manager','commissioner'])
);

drop policy if exists "academy licence controls manage v140" on public.academy_licence_controls_v140;
create policy "academy licence controls manage v140"
on public.academy_licence_controls_v140
for all to authenticated
using (public.nostra_v137_has_any_role(array['manager','commissioner']))
with check (public.nostra_v137_has_any_role(array['manager','commissioner']));

grant select,insert,update,delete on public.academy_licence_controls_v140 to authenticated;

create or replace function public.nostra_v140_licence_is_blocked(p_licence_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blocked boolean := false;
begin
  select exists (
    select 1
    from public.academy_licence_controls_v140 c
    where c.licence_id = p_licence_id
      and (
        c.control_state = 'revoked'
        or (
          c.control_state = 'suspended'
          and (c.suspended_until is null or c.suspended_until >= current_date)
        )
      )
  ) into v_blocked;

  if v_blocked then
    return true;
  end if;

  -- Compatibilité avec le module disciplinaire déjà présent.
  if to_regclass('public.nostra_circuit_disciplinary_actions') is not null then
    execute $q$
      select exists (
        select 1
        from public.nostra_circuit_disciplinary_actions d
        where d.licence_id::text = $1
          and d.action_type = 'suspension'
          and coalesce(d.status, '') <> 'cancelled'
          and current_date between d.suspension_starts_on and d.suspension_ends_on
      )
    $q$ into v_blocked using p_licence_id;
  end if;

  return coalesce(v_blocked, false);
end;
$$;

revoke all on function public.nostra_v140_licence_is_blocked(text) from public;
grant execute on function public.nostra_v140_licence_is_blocked(text) to authenticated;

create or replace function public.nostra_v140_set_licence_control(
  p_licence_id text,
  p_action text,
  p_reason text default null,
  p_suspended_until date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_holder uuid;
  v_state text;
  v_actor uuid := auth.uid();
  v_actor_name text;
begin
  if not public.nostra_v137_has_any_role(array['manager','commissioner']) then
    raise exception using message = 'academy_staff_required';
  end if;

  if p_action not in ('activate','suspend','revoke') then
    raise exception using message = 'invalid_licence_control_action';
  end if;

  if p_action in ('suspend','revoke') and length(trim(coalesce(p_reason,''))) < 3 then
    raise exception using message = 'licence_control_reason_required';
  end if;

  if p_action = 'suspend' and p_suspended_until is not null and p_suspended_until < current_date then
    raise exception using message = 'invalid_suspension_end';
  end if;

  execute 'select holder_user_id from public.nostra_licences where id::text = $1 limit 1'
    into v_holder using p_licence_id;

  if v_holder is null then
    raise exception using message = 'licence_not_found';
  end if;

  v_state := case p_action
    when 'activate' then 'active'
    when 'suspend' then 'suspended'
    else 'revoked'
  end;

  begin
    select coalesce(
      nullif(trim(concat_ws(' ', mp.rp_first_name, mp.rp_last_name)), ''),
      nullif(trim(mp.discord_name), ''),
      'Direction Nostra'
    )
    into v_actor_name
    from public.member_profiles mp
    where mp.user_id = v_actor
    limit 1;
  exception when undefined_column or undefined_table then
    v_actor_name := 'Direction Nostra';
  end;

  insert into public.academy_licence_controls_v140(
    licence_id, holder_user_id, control_state, reason, suspended_until,
    updated_by, updated_by_name, updated_at
  ) values(
    p_licence_id,
    v_holder,
    v_state,
    case when v_state = 'active' then null else trim(p_reason) end,
    case when v_state = 'suspended' then p_suspended_until else null end,
    v_actor,
    coalesce(v_actor_name, 'Direction Nostra'),
    now()
  ) on conflict (licence_id) do update set
    holder_user_id = excluded.holder_user_id,
    control_state = excluded.control_state,
    reason = excluded.reason,
    suspended_until = excluded.suspended_until,
    updated_by = excluded.updated_by,
    updated_by_name = excluded.updated_by_name,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'licence_id', p_licence_id,
    'state', v_state,
    'suspended_until', case when v_state = 'suspended' then p_suspended_until else null end
  );
end;
$$;

revoke all on function public.nostra_v140_set_licence_control(text,text,text,date) from public;
grant execute on function public.nostra_v140_set_licence_control(text,text,text,date) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. ÉLIGIBILITÉ DÉTAILLÉE PAR LICENCE
-- ---------------------------------------------------------------------------

create or replace function public.nostra_v140_normalize(p_value text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_value,''), '[^A-Z0-9]', '', 'g'));
$$;

create or replace function public.nostra_v140_license_code_from_name(p_value text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_norm text := public.nostra_v140_normalize(p_value);
  v_code text;
begin
  if to_regclass('public.pilot_license_types') is null then
    return null;
  end if;

  select code into v_code
  from public.pilot_license_types
  where public.nostra_v140_normalize(code) = v_norm
     or public.nostra_v140_normalize(label) = v_norm
  order by sort_order nulls last
  limit 1;

  if v_code is not null then return v_code; end if;

  if v_norm like '%F1%' then
    select code into v_code
    from public.pilot_license_types
    where public.nostra_v140_normalize(code) = 'F1'
       or public.nostra_v140_normalize(label) like '%F1%'
    order by sort_order nulls last
    limit 1;
    if v_code is not null then return v_code; end if;
  end if;

  if v_norm like '%GT3%' then
    select code into v_code
    from public.pilot_license_types
    where public.nostra_v140_normalize(code) like '%GT3%'
       or public.nostra_v140_normalize(label) like '%GT3%'
    order by sort_order nulls last
    limit 1;
    if v_code is not null then return v_code; end if;
  end if;

  if v_norm like '%CIRCUIT%' or v_norm like '%PILOTE%' then
    select code into v_code
    from public.pilot_license_types
    where public.nostra_v140_normalize(code) <> 'F1'
      and public.nostra_v140_normalize(code) not like '%GT3%'
    order by sort_order nulls last, code
    limit 1;
  end if;

  return v_code;
end;
$$;

revoke all on function public.nostra_v140_license_code_from_name(text) from public;
grant execute on function public.nostra_v140_license_code_from_name(text) to authenticated;

create or replace function public.nostra_v140_license_eligibility(
  p_user uuid,
  p_license_code text
)
returns table (
  eligible boolean,
  reason text,
  license_code text,
  license_label text,
  required_course_id bigint,
  required_course_title text,
  qualification_id bigint,
  qualification_label text,
  qualification_valid_until date,
  prerequisite_license_code text,
  prerequisite_license_label text,
  training_ok boolean,
  prerequisite_ok boolean,
  license_validity_months integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_req public.academy_license_requirements_v140%rowtype;
  v_course_title text;
  v_q public.academy_qualifications_v137%rowtype;
  v_any_matching boolean := false;
  v_any_unexpired boolean := false;
  v_prereq_label text;
  v_prereq_ok boolean := true;
  v_prereq_code text;
  v_licence_id text;
  v_target_block_reason text := null;
  v_target_control_state text;
begin
  select * into v_req
  from public.academy_license_requirements_v140 r
  where public.nostra_v140_normalize(r.license_code) = public.nostra_v140_normalize(p_license_code)
  limit 1;

  if not found then
    -- Compatibilité : si une nouvelle licence apparaît avant configuration,
    -- on conserve au minimum le verrou V139 (une qualification valide).
    v_req.license_code := p_license_code;
    v_req.license_label := p_license_code;
    v_req.required_course_id := null;
    v_req.prerequisite_license_code := null;
    v_req.min_theory_score := 0;
    v_req.min_practical_score := 0;
    v_req.license_validity_months := 5;
    v_req.active := true;
  end if;

  if v_req.required_course_id is not null then
    select c.title into v_course_title
    from public.academy_courses_v137 c
    where c.id = v_req.required_course_id;
  end if;

  select exists (
    select 1
    from public.academy_qualifications_v137 q
    join public.academy_enrollments_v137 e on e.id = q.enrollment_id
    where q.user_id = p_user
      and q.active = true
      and e.status = 'passed'
      and (v_req.required_course_id is null or q.course_id = v_req.required_course_id)
      and q.theory_score >= v_req.min_theory_score
      and q.practical_score >= v_req.min_practical_score
  ) into v_any_matching;

  select exists (
    select 1
    from public.academy_qualifications_v137 q
    join public.academy_enrollments_v137 e on e.id = q.enrollment_id
    where q.user_id = p_user
      and q.active = true
      and e.status = 'passed'
      and (v_req.required_course_id is null or q.course_id = v_req.required_course_id)
      and q.theory_score >= v_req.min_theory_score
      and q.practical_score >= v_req.min_practical_score
      and (q.valid_until is null or q.valid_until >= current_date)
  ) into v_any_unexpired;

  select q.* into v_q
  from public.academy_qualifications_v137 q
  join public.academy_enrollments_v137 e on e.id = q.enrollment_id
  where q.user_id = p_user
    and q.active = true
    and e.status = 'passed'
    and (v_req.required_course_id is null or q.course_id = v_req.required_course_id)
    and q.theory_score >= v_req.min_theory_score
    and q.practical_score >= v_req.min_practical_score
    and (q.valid_until is null or q.valid_until >= current_date)
  order by q.issued_at desc
  limit 1;

  v_prereq_code := nullif(trim(coalesce(v_req.prerequisite_license_code,'')), '');

  if v_prereq_code is not null then
    if to_regclass('public.pilot_license_types') is not null then
      select label into v_prereq_label
      from public.pilot_license_types
      where public.nostra_v140_normalize(code) = public.nostra_v140_normalize(v_prereq_code)
      limit 1;
    end if;

    v_prereq_ok := false;

    if to_regclass('public.nostra_licences') is not null then
      for v_licence_id in
        select l.id::text
        from public.nostra_licences l
        where l.holder_user_id = p_user
          and public.nostra_v140_normalize(public.nostra_v140_license_code_from_name(l.licence_name)) = public.nostra_v140_normalize(v_prereq_code)
          and l.valid_from <= current_date
          and (l.valid_until is null or l.valid_until >= current_date)
          and lower(coalesce(l.status,'')) not like '%retir%'
          and lower(coalesce(l.status,'')) not like '%revok%'
          and lower(coalesce(l.status,'')) not like '%suspend%'
        order by l.valid_until desc nulls first
      loop
        if not public.nostra_v140_licence_is_blocked(v_licence_id) then
          v_prereq_ok := true;
          exit;
        end if;
      end loop;
    end if;
  end if;

  -- Une sanction/retrait sur la licence demandée empêche aussi son rachat ou renouvellement.
  if to_regclass('public.nostra_licences') is not null then
    for v_licence_id in
      select l.id::text
      from public.nostra_licences l
      where l.holder_user_id = p_user
        and public.nostra_v140_normalize(public.nostra_v140_license_code_from_name(l.licence_name)) = public.nostra_v140_normalize(p_license_code)
      order by l.valid_until desc nulls first
    loop
      v_target_control_state := null;
      if to_regclass('public.academy_licence_controls_v140') is not null then
        select c.control_state into v_target_control_state
        from public.academy_licence_controls_v140 c
        where c.licence_id = v_licence_id
        limit 1;
      end if;

      if v_target_control_state = 'revoked' then
        v_target_block_reason := 'license_revoked';
        exit;
      end if;

      if public.nostra_v140_licence_is_blocked(v_licence_id) then
        v_target_block_reason := 'license_suspended';
        exit;
      end if;
    end loop;
  end if;

  eligible := coalesce(v_req.active, true) and v_any_unexpired and v_prereq_ok and v_target_block_reason is null;

  reason := case
    when v_target_block_reason is not null then v_target_block_reason
    when coalesce(v_req.active, true) = false then 'academy_requirement_disabled'
    when not v_any_matching then
      case when v_req.required_course_id is null
        then 'academy_training_required'
        else 'academy_specific_training_required'
      end
    when v_any_matching and not v_any_unexpired then 'academy_training_expired'
    when not v_prereq_ok then 'prerequisite_license_required'
    else 'ok'
  end;

  license_code := coalesce(v_req.license_code, p_license_code);
  license_label := coalesce(v_req.license_label, p_license_code);
  required_course_id := v_req.required_course_id;
  required_course_title := v_course_title;
  qualification_id := v_q.id;
  qualification_label := v_q.qualification_label;
  qualification_valid_until := v_q.valid_until;
  prerequisite_license_code := v_prereq_code;
  prerequisite_license_label := coalesce(v_prereq_label, v_prereq_code);
  training_ok := v_any_unexpired;
  prerequisite_ok := v_prereq_ok;
  license_validity_months := coalesce(v_req.license_validity_months, 5);

  return next;
end;
$$;

revoke all on function public.nostra_v140_license_eligibility(uuid,text) from public;
grant execute on function public.nostra_v140_license_eligibility(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. VERROUS SERVEUR : PANIER + PAIEMENT
-- ---------------------------------------------------------------------------

create or replace function public.nostra_v140_require_academy_for_license()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check record;
  v_code text := coalesce(new.license_code, '');
  v_service_key text;
  v_service_open boolean := true;
begin
  select * into v_check
  from public.nostra_v140_license_eligibility(new.user_id, v_code)
  limit 1;

  if not found or not coalesce(v_check.eligible, false) then
    raise exception using
      errcode = 'P0001',
      message = coalesce(v_check.reason, 'academy_training_required'),
      detail = case coalesce(v_check.reason, 'academy_training_required')
        when 'academy_specific_training_required' then 'La formation Academy prévue pour cette licence doit être validée.'
        when 'academy_training_expired' then 'La qualification Academy nécessaire a expiré et doit être renouvelée.'
        when 'prerequisite_license_required' then 'Une licence de niveau inférieur valide est obligatoire avant cet achat.'
        when 'license_suspended' then 'Cette licence est actuellement suspendue. Achat et renouvellement bloqués.'
        when 'license_revoked' then 'Cette licence a été retirée par la Direction. Une réactivation administrative est obligatoire.'
        when 'academy_requirement_disabled' then 'Le parcours Academy de cette licence est temporairement désactivé.'
        else 'Une formation Nostra Racing Academy validée est obligatoire avant cet achat.'
      end;
  end if;

  v_service_key := case
    when public.nostra_v140_normalize(v_code) = 'F1' then 'circuit_license_f1'
    when public.nostra_v140_normalize(v_code) like '%GT3%' then 'circuit_license_gt3rs'
    else 'circuit_license_pilot'
  end;

  if to_regclass('public.nostra_service_availability') is not null then
    execute $q$
      select
        coalesce((select is_open from public.nostra_service_availability where service_key = $1 limit 1), true)
        and
        coalesce((select is_open from public.nostra_service_availability where service_key = 'circuit_services_master' limit 1), true)
    $q$ into v_service_open using v_service_key;

    if not coalesce(v_service_open, true) then
      raise exception using
        errcode = 'P0001',
        message = 'license_purchase_closed',
        detail = 'La Direction a clôturé l’achat de cette licence.';
    end if;
  end if;

  return new;
end;
$$;

-- Remplace les deux guards V139.
do $$
begin
  if to_regclass('public.pilot_license_cart_items') is not null then
    execute 'drop trigger if exists nostra_v139_academy_license_cart_guard on public.pilot_license_cart_items';
    execute 'drop trigger if exists nostra_v140_academy_license_cart_guard on public.pilot_license_cart_items';
    execute 'create trigger nostra_v140_academy_license_cart_guard before insert or update on public.pilot_license_cart_items for each row execute function public.nostra_v140_require_academy_for_license()';
  end if;

  if to_regclass('public.pilot_license_applications') is not null then
    execute 'drop trigger if exists nostra_v139_academy_license_application_guard on public.pilot_license_applications';
    execute 'drop trigger if exists nostra_v140_academy_license_application_guard on public.pilot_license_applications';
    execute 'create trigger nostra_v140_academy_license_application_guard before insert on public.pilot_license_applications for each row execute function public.nostra_v140_require_academy_for_license()';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. DURÉE DES LICENCES PILOTES CONFIGURABLE
-- ---------------------------------------------------------------------------

create or replace function public.nostra_v140_apply_pilot_license_duration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_months integer;
begin
  v_code := public.nostra_v140_license_code_from_name(new.licence_name);

  if v_code is null or new.valid_from is null then
    return new;
  end if;

  select r.license_validity_months into v_months
  from public.academy_license_requirements_v140 r
  where public.nostra_v140_normalize(r.license_code) = public.nostra_v140_normalize(v_code)
    and r.active = true
  limit 1;

  if coalesce(v_months, 0) > 0 then
    new.valid_until := (new.valid_from + make_interval(months => v_months))::date;
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.nostra_licences') is not null then
    execute 'drop trigger if exists nostra_v140_pilot_license_duration on public.nostra_licences';
    execute 'create trigger nostra_v140_pilot_license_duration before insert or update of licence_name,valid_from on public.nostra_licences for each row execute function public.nostra_v140_apply_pilot_license_duration()';
  end if;
end;
$$;

commit;

select 'V140 prête · progression Academy, prérequis par licence, expiration, suspension et retrait' as resultat;
