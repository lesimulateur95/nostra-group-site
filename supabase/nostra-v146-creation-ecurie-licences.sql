-- NOSTRA GROUP V146
-- Création d'écurie : Licence F1 / GT3 RS officielle obligatoire.
-- IMPORTANT : ne modifie pas le système d'achat des licences.
-- Prérequis : V140 + V142 + table team_registration_requests.
-- Script réexécutable.

begin;

create or replace function public.nostra_v146_has_valid_team_licence(
  p_user uuid,
  p_championship text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_target text := lower(trim(coalesce(p_championship, '')));
  v_found boolean := false;
begin
  if p_user is null or v_target not in ('f1', 'gt3rs') then
    return false;
  end if;

  if to_regclass('public.nostra_licences') is null then
    return false;
  end if;

  select exists (
    select 1
    from public.nostra_licences l
    where l.holder_user_id = p_user
      and l.valid_from <= current_date
      and (l.valid_until is null or l.valid_until >= current_date)
      and lower(coalesce(l.status, '')) not like '%retir%'
      and lower(coalesce(l.status, '')) not like '%revok%'
      and lower(coalesce(l.status, '')) not like '%suspend%'
      and not public.nostra_v140_licence_is_blocked(l.id::text)
      and (
        (
          v_target = 'f1'
          and public.nostra_v140_normalize(
            public.nostra_v142_official_licence_code(l.id::text, l.licence_name)
          ) = 'F1'
        )
        or
        (
          v_target = 'gt3rs'
          and public.nostra_v140_normalize(
            public.nostra_v142_official_licence_code(l.id::text, l.licence_name)
          ) like '%GT3%'
        )
      )
  ) into v_found;

  return coalesce(v_found, false);
end;
$$;

revoke all on function public.nostra_v146_has_valid_team_licence(uuid,text) from public;
revoke all on function public.nostra_v146_has_valid_team_licence(uuid,text) from authenticated;

create or replace function public.nostra_v146_guard_team_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_f1 boolean := false;
  v_has_gt3rs boolean := false;
begin
  if new.user_id is null then
    raise exception using errcode = 'P0001', message = 'authentication_required';
  end if;

  if new.registration_type in ('f1', 'both') then
    v_has_f1 := public.nostra_v146_has_valid_team_licence(new.user_id, 'f1');
    if not v_has_f1 then
      raise exception using
        errcode = 'P0001',
        message = 'team_license_f1_required',
        detail = 'Une Licence F1 officielle, valide et non suspendue est obligatoire pour créer une écurie F1.';
    end if;
  end if;

  if new.registration_type in ('gt3rs', 'both') then
    v_has_gt3rs := public.nostra_v146_has_valid_team_licence(new.user_id, 'gt3rs');
    if not v_has_gt3rs then
      raise exception using
        errcode = 'P0001',
        message = 'team_license_gt3rs_required',
        detail = 'Une Licence GT3 RS officielle, valide et non suspendue est obligatoire pour créer une écurie GT3 RS.';
    end if;
  end if;

  -- Ces colonnes deviennent des résultats de contrôle serveur et non plus
  -- des déclarations Oui/Non du citoyen.
  new.has_f1_license := case when new.registration_type in ('f1','both') then v_has_f1 else false end;
  new.has_gt3rs_license := case when new.registration_type in ('gt3rs','both') then v_has_gt3rs else false end;

  return new;
end;
$$;

revoke all on function public.nostra_v146_guard_team_registration() from public;
grant execute on function public.nostra_v146_guard_team_registration() to authenticated;

do $$
begin
  if to_regclass('public.team_registration_requests') is not null then
    execute 'drop trigger if exists nostra_v146_team_registration_license_guard on public.team_registration_requests';
    execute 'create trigger nostra_v146_team_registration_license_guard before insert on public.team_registration_requests for each row execute function public.nostra_v146_guard_team_registration()';
  end if;
end;
$$;

-- Corrige l'indicateur des demandes déjà présentes dans le Dashboard sans
-- supprimer ni refuser automatiquement les anciennes demandes.
do $$
begin
  if to_regclass('public.team_registration_requests') is not null then
    update public.team_registration_requests r
    set
      has_f1_license = case
        when r.registration_type in ('f1','both')
          then public.nostra_v146_has_valid_team_licence(r.user_id, 'f1')
        else false
      end,
      has_gt3rs_license = case
        when r.registration_type in ('gt3rs','both')
          then public.nostra_v146_has_valid_team_licence(r.user_id, 'gt3rs')
        else false
      end,
      updated_at = now();
  end if;
end;
$$;

commit;
