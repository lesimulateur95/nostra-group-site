-- NOSTRA GROUP V74
-- 1) Corrige définitivement la conversion JSON du générateur de licences.
-- 2) Ajoute la suppression ciblée des dossiers SAV par la Direction.
-- Script réexécutable.

begin;

create or replace function public.issue_nostra_licence_safe_v74(
  p_holder_user_id uuid,
  p_licence_name text,
  p_category text,
  p_authority text,
  p_valid_from date,
  p_valid_until date,
  p_permissions text,
  p_notes text,
  p_send_to_citizen boolean
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result text;
  v_permissions_json jsonb := case
    when nullif(btrim(p_permissions), '') is null then null
    else jsonb_build_object('text', p_permissions)
  end;
  v_notes_json jsonb := case
    when nullif(btrim(p_notes), '') is null then null
    else jsonb_build_object('text', p_notes)
  end;
begin
  -- Fonction historique : permissions JSONB, notes texte.
  if to_regprocedure(
    'public.issue_nostra_licence(uuid,text,text,text,date,date,jsonb,text,boolean)'
  ) is not null then
    execute $sql$
      select public.issue_nostra_licence(
        $1::uuid, $2::text, $3::text, $4::text,
        $5::date, $6::date, $7::jsonb, $8::text, $9::boolean
      )::text
    $sql$
    into v_result
    using p_holder_user_id, p_licence_name, p_category, p_authority,
          p_valid_from, p_valid_until, v_permissions_json, p_notes,
          p_send_to_citizen;

  -- Fonction historique : permissions JSON, notes texte.
  elsif to_regprocedure(
    'public.issue_nostra_licence(uuid,text,text,text,date,date,json,text,boolean)'
  ) is not null then
    execute $sql$
      select public.issue_nostra_licence(
        $1::uuid, $2::text, $3::text, $4::text,
        $5::date, $6::date, $7::json, $8::text, $9::boolean
      )::text
    $sql$
    into v_result
    using p_holder_user_id, p_licence_name, p_category, p_authority,
          p_valid_from, p_valid_until, v_permissions_json::json, p_notes,
          p_send_to_citizen;

  -- Fonction historique : permissions texte ensuite converties en JSON en interne.
  elsif to_regprocedure(
    'public.issue_nostra_licence(uuid,text,text,text,date,date,text,text,boolean)'
  ) is not null then
    execute $sql$
      select public.issue_nostra_licence(
        $1::uuid, $2::text, $3::text, $4::text,
        $5::date, $6::date, $7::text, $8::text, $9::boolean
      )::text
    $sql$
    into v_result
    using p_holder_user_id, p_licence_name, p_category, p_authority,
          p_valid_from, p_valid_until,
          case when v_permissions_json is null then null else v_permissions_json::text end,
          p_notes, p_send_to_citizen;

  -- Variante où les notes sont aussi stockées en JSONB.
  elsif to_regprocedure(
    'public.issue_nostra_licence(uuid,text,text,text,date,date,jsonb,jsonb,boolean)'
  ) is not null then
    execute $sql$
      select public.issue_nostra_licence(
        $1::uuid, $2::text, $3::text, $4::text,
        $5::date, $6::date, $7::jsonb, $8::jsonb, $9::boolean
      )::text
    $sql$
    into v_result
    using p_holder_user_id, p_licence_name, p_category, p_authority,
          p_valid_from, p_valid_until, v_permissions_json, v_notes_json,
          p_send_to_citizen;

  elsif to_regprocedure(
    'public.issue_nostra_licence(uuid,text,text,text,date,date,text,jsonb,boolean)'
  ) is not null then
    execute $sql$
      select public.issue_nostra_licence(
        $1::uuid, $2::text, $3::text, $4::text,
        $5::date, $6::date, $7::text, $8::jsonb, $9::boolean
      )::text
    $sql$
    into v_result
    using p_holder_user_id, p_licence_name, p_category, p_authority,
          p_valid_from, p_valid_until,
          case when v_permissions_json is null then null else v_permissions_json::text end,
          v_notes_json, p_send_to_citizen;

  else
    raise exception using
      message = 'Signature de issue_nostra_licence introuvable',
      hint = 'Vérifie que le module historique du générateur de licences est installé.';
  end if;

  return v_result;
end;
$$;

revoke all on function public.issue_nostra_licence_safe_v74(
  uuid, text, text, text, date, date, text, text, boolean
) from public;

grant execute on function public.issue_nostra_licence_safe_v74(
  uuid, text, text, text, date, date, text, text, boolean
) to authenticated;

create or replace function public.nostra_delete_sav_ticket_v74(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if not public.has_nostra_dashboard_access() then
    raise exception 'Accès Direction requis';
  end if;

  if not exists (
    select 1
    from public.motors_sav_tickets
    where id = p_id
  ) then
    raise exception 'Dossier SAV introuvable';
  end if;

  delete from public.motors_sav_messages
  where ticket_id = p_id;

  delete from public.motors_sav_tickets
  where id = p_id;
end;
$$;

revoke all on function public.nostra_delete_sav_ticket_v74(bigint) from public;
grant execute on function public.nostra_delete_sav_ticket_v74(bigint) to authenticated;

commit;

-- Vérifications facultatives :
-- select to_regprocedure('public.issue_nostra_licence_safe_v74(uuid,text,text,text,date,date,text,text,boolean)');
-- select to_regprocedure('public.nostra_delete_sav_ticket_v74(bigint)');
