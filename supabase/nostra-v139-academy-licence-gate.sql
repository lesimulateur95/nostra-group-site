-- Nostra Group V139
-- Nostra Racing Academy -> verrouillage automatique de l'achat des licences.
-- Prérequis : SQL V137 (Academy) + module licences pilotes déjà installé.
--
-- Règle : un citoyen doit posséder au moins une qualification Academy ACTIVE
-- avant de pouvoir ajouter ou payer une licence pilote.

begin;

create or replace function public.nostra_v139_has_valid_academy_training(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.academy_qualifications_v137 q
    where q.user_id = p_user
      and q.active = true
  );
$$;

revoke all on function public.nostra_v139_has_valid_academy_training(uuid) from public;
grant execute on function public.nostra_v139_has_valid_academy_training(uuid) to authenticated;

create or replace function public.nostra_v139_require_academy_for_license()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(coalesce(new.license_code, ''), '[^A-Z0-9]', '', 'g'));
  v_service_key text;
  v_service_open boolean := true;
begin
  if new.user_id is null
     or not public.nostra_v139_has_valid_academy_training(new.user_id) then
    raise exception using
      errcode = 'P0001',
      message = 'academy_training_required',
      detail = 'Une formation Nostra Racing Academy validée est obligatoire avant tout achat de licence.';
  end if;

  -- Même logique que le Dashboard : F1, GT3 RS ou licence pilote / Circuit.
  v_service_key := case
    when v_code = 'F1' then 'circuit_license_f1'
    when v_code like '%GT3%' then 'circuit_license_gt3rs'
    else 'circuit_license_pilot'
  end;

  -- La requête dynamique garde la migration compatible avec une base où le
  -- module de clôture n'aurait pas encore été créé : dans ce cas seul le
  -- verrou Academy s'applique jusqu'à l'installation du module de clôture.
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


-- Maintient la qualification alignée avec le statut réel de la formation.
-- Si une formation précédemment validée est annulée/échouée/réouverte, sa
-- qualification ne doit plus autoriser l'achat d'une licence.
create or replace function public.nostra_v139_sync_academy_qualification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'passed' then
    update public.academy_qualifications_v137
    set active = false
    where enrollment_id = new.id
      and active = true;
  end if;

  return new;
end;
$$;

drop trigger if exists nostra_v139_sync_academy_qualification_status on public.academy_enrollments_v137;
create trigger nostra_v139_sync_academy_qualification_status
after insert or update of status on public.academy_enrollments_v137
for each row execute function public.nostra_v139_sync_academy_qualification_status();

-- Nettoyage immédiat des anciennes qualifications qui ne correspondent plus
-- à une formation actuellement marquée comme réussie.
update public.academy_qualifications_v137 q
set active = false
from public.academy_enrollments_v137 e
where e.id = q.enrollment_id
  and e.status <> 'passed'
  and q.active = true;

-- Empêche l'ajout/modification d'un panier licence sans formation validée.
drop trigger if exists nostra_v139_academy_license_cart_guard on public.pilot_license_cart_items;
create trigger nostra_v139_academy_license_cart_guard
before insert or update on public.pilot_license_cart_items
for each row execute function public.nostra_v139_require_academy_for_license();

-- Deuxième verrou au moment de la création de la demande payée.
-- Ainsi, une ancienne ligne de panier ne peut pas contourner la règle si la
-- qualification a été désactivée entre-temps.
drop trigger if exists nostra_v139_academy_license_application_guard on public.pilot_license_applications;
create trigger nostra_v139_academy_license_application_guard
before insert on public.pilot_license_applications
for each row execute function public.nostra_v139_require_academy_for_license();

commit;

select 'V139 prête · formation Academy obligatoire avant achat de licence' as resultat;
