-- Nostra Group V124
-- Répare les boutons :
--   - Remettre les compteurs à zéro
--   - Supprimer toutes les cartes et remettre à zéro
--
-- Ce script ne supprime aucune carte au moment de son installation.
-- La suppression ne se produit que lorsque le bouton du Dashboard est utilisé.

begin;

do $$
begin
  if to_regclass('public.loyalty_cards') is null
    or to_regclass('public.loyalty_card_counters_v116') is null
    or to_regclass('public.member_profiles') is null then
    raise exception 'missing_loyalty_tables';
  end if;
end;
$$;

-- Vérification Direction/Gérant compatible avec les rôles multiples et Steam.
create or replace function public.nostra_can_manage_loyalty_v124()
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

-- Remise à zéro interne des trois compteurs.
create or replace function public.reset_loyalty_counters_internal_v124()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
  v_identity_sequence text;
begin
  delete from public.loyalty_card_counters_v116;

  insert into public.loyalty_card_counters_v116 (
    tier,
    card_year,
    last_number,
    updated_at
  ) values
    ('Silver', v_year, 0, now()),
    ('Gold', v_year, 0, now()),
    ('Black Signature', v_year, 0, now());

  -- Ancienne séquence globale : compatibilité uniquement.
  -- Son absence ne doit jamais empêcher la maintenance.
  if to_regclass('public.loyalty_card_number_v114_seq') is not null then
    begin
      execute 'alter sequence public.loyalty_card_number_v114_seq restart with 1';
    exception when others then
      null;
    end;
  end if;

  -- Réinitialise aussi l'identité technique des cartes si elle existe.
  begin
    v_identity_sequence := pg_get_serial_sequence('public.loyalty_cards', 'id');
    if v_identity_sequence is not null then
      execute format('alter sequence %s restart with 1', v_identity_sequence);
    end if;
  exception when others then
    null;
  end;
end;
$$;

create or replace function public.reset_loyalty_card_counters_v124()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from current_date)::integer;
begin
  if not public.nostra_can_manage_loyalty_v124() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('nostra_loyalty_cards_maintenance'));

  if exists (select 1 from public.loyalty_cards) then
    raise exception 'cards_exist';
  end if;

  perform public.reset_loyalty_counters_internal_v124();

  return jsonb_build_object(
    'reset', true,
    'year', v_year
  );
end;
$$;

create or replace function public.delete_all_loyalty_cards_and_reset_v124()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted bigint := 0;
  v_year integer := extract(year from current_date)::integer;
begin
  if not public.nostra_can_manage_loyalty_v124() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('nostra_loyalty_cards_maintenance'));

  delete from public.loyalty_cards;
  get diagnostics v_deleted = row_count;

  perform public.reset_loyalty_counters_internal_v124();

  return jsonb_build_object(
    'deleted_cards', v_deleted,
    'reset', true,
    'year', v_year
  );
end;
$$;

revoke all on function public.nostra_can_manage_loyalty_v124() from public;
revoke all on function public.reset_loyalty_counters_internal_v124() from public;
revoke all on function public.reset_loyalty_card_counters_v124() from public;
revoke all on function public.delete_all_loyalty_cards_and_reset_v124() from public;

grant execute on function public.nostra_can_manage_loyalty_v124() to authenticated;
grant execute on function public.reset_loyalty_card_counters_v124() to authenticated;
grant execute on function public.delete_all_loyalty_cards_and_reset_v124() to authenticated;

-- Recharge immédiatement les fonctions RPC dans PostgREST/Supabase.
notify pgrst, 'reload schema';

commit;
