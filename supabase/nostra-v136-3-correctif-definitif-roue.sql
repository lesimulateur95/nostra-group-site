-- NOSTRA GROUP V136.3
-- Correctif définitif : activation, désactivation et modification des cases.
-- Script additif, réexécutable et sans suppression de tirages existants.

begin;

-- Le site sait reconnaître le Gérant depuis plusieurs sources. La base doit
-- appliquer exactement la même logique, y compris lorsque l'identifiant
-- Discord se trouve dans auth.identities et non directement dans le JWT.
create or replace function public.nostra_games_is_manager()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_allowed boolean := false;
  v_roles text[];
  v_profile jsonb;
  v_identity jsonb;
  v_claims jsonb;
  v_text text;
begin
  if auth.uid() is null then
    return false;
  end if;

  -- Source principale : le système de rôles officiel du site.
  if to_regprocedure('public.nostra_roles()') is not null then
    begin
      execute 'select public.nostra_roles()' into v_roles;
      if 'manager' = any(coalesce(v_roles, array[]::text[])) then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  if to_regprocedure('public.has_nostra_dashboard_access()') is not null then
    begin
      execute 'select public.has_nostra_dashboard_access()' into v_allowed;
      if coalesce(v_allowed, false) then
        return true;
      end if;
    exception when others then
      null;
    end;
  end if;

  -- Compatibilité avec toutes les versions de member_profiles.
  begin
    select to_jsonb(profile)
      into v_profile
    from public.member_profiles profile
    where profile.user_id = auth.uid()
    limit 1;

    v_text := lower(coalesce(v_profile::text, ''));
    if coalesce(v_profile ->> 'discord_id', '') = '331843410962939908'
       or v_text ~ '(manager|gérant|gerant|direction|administrator|administrateur|admin)' then
      return true;
    end if;
  exception when others then
    null;
  end;

  -- Compatibilité Discord : Supabase peut placer l'identifiant dans
  -- auth.identities plutôt que dans user_metadata.
  begin
    select to_jsonb(ident)
      into v_identity
    from auth.identities ident
    where ident.user_id = auth.uid()
      and ident.provider = 'discord'
    limit 1;

    v_text := coalesce(v_identity::text, '');
    if v_text like '%331843410962939908%' then
      return true;
    end if;
  exception when others then
    null;
  end;

  -- Dernier secours pour les anciennes sessions Supabase.
  begin
    v_claims := auth.jwt();
    v_text := lower(coalesce(v_claims::text, ''));
    if v_text like '%331843410962939908%'
       or v_text ~ '(manager|gérant|gerant|direction|administrator|administrateur|admin)' then
      return true;
    end if;
  exception when others then
    null;
  end;

  return false;
end;
$$;

revoke all on function public.nostra_games_is_manager() from public, anon;
grant execute on function public.nostra_games_is_manager() to authenticated;

create or replace function public.save_nostra_wheel_configuration(
  p_enabled boolean,
  p_disabled_message text,
  p_segments jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.nostra_games_is_manager() then
    raise exception using errcode = '42501', message = 'manager_access_required';
  end if;

  if p_disabled_message is null
     or char_length(trim(p_disabled_message)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'invalid_disabled_message';
  end if;

  if p_segments is null or jsonb_typeof(p_segments) <> 'array' then
    raise exception using errcode = '22023', message = 'invalid_wheel_segments';
  end if;

  v_count := jsonb_array_length(p_segments);
  if v_count not between 2 and 40 then
    raise exception using errcode = '22023',
      message = 'wheel_segment_count_must_be_between_2_and_40';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_segments) as item(value)
    where coalesce(char_length(trim(value ->> 'label')), 0) not between 1 and 100
       or coalesce(char_length(trim(value ->> 'short_label')), 0) not between 1 and 18
       or coalesce(value ->> 'prize_type', '') not in ('bonus', 'loss')
       or coalesce(value ->> 'color', '') !~ '^#[0-9A-Fa-f]{6}$'
       or coalesce(value ->> 'text_color', '') !~ '^#[0-9A-Fa-f]{6}$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_wheel_segment';
  end if;

  -- Évite qu'un tirage et une modification simultanés mélangent deux versions.
  perform pg_advisory_xact_lock(13603);

  insert into public.game_wheel_settings (
    id, enabled, disabled_message, updated_by, updated_at
  ) values (
    1, coalesce(p_enabled, false), trim(p_disabled_message), auth.uid(), now()
  )
  on conflict (id) do update
  set enabled = excluded.enabled,
      disabled_message = excluded.disabled_message,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  delete from public.game_wheel_segments;

  insert into public.game_wheel_segments (
    slot_index, prize_key, label, short_label, prize_type,
    color, text_color, created_at, updated_at
  )
  select
    position::integer - 1,
    case
      when value ->> 'prize_type' = 'loss'
        then 'loss_' || (position::integer - 1)::text
      else 'custom_' || (position::integer - 1)::text
    end,
    trim(value ->> 'label'),
    trim(value ->> 'short_label'),
    value ->> 'prize_type',
    value ->> 'color',
    value ->> 'text_color',
    now(),
    now()
  from jsonb_array_elements(p_segments) with ordinality as item(value, position)
  order by position;
end;
$$;

revoke all on function public.save_nostra_wheel_configuration(boolean, text, jsonb)
  from public, anon;
grant execute on function public.save_nostra_wheel_configuration(boolean, text, jsonb)
  to authenticated;

commit;

notify pgrst, 'reload schema';
