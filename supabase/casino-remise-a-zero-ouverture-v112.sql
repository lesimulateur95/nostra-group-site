-- Nostra Group · Le Cercle Nostra · V112
-- À exécuter une seule fois après les SQL V108, V109 et V110.
-- Remplace la remise à zéro V111 et ne conserve aucun journal de test.

drop function if exists public.casino_admin_reset_data_v111(text, text);
drop table if exists public.casino_reset_log_v111;

create or replace function public.casino_admin_opening_reset_v112(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversions bigint := 0;
  v_rounds bigint := 0;
  v_transactions bigint := 0;
  v_wallets bigint := 0;
  v_tables bigint := 0;
begin
  if not public.is_nostra_manager() then
    raise exception 'forbidden';
  end if;

  if coalesce(p_confirmation, '') <> 'OUVRIR LE CASINO A ZERO' then
    raise exception 'invalid_confirmation';
  end if;

  -- Les éléments enfants sont supprimés en premier pour respecter toutes les
  -- contraintes de la base, même si une partie ou une table est encore active.
  delete from public.casino_poker_seats;

  delete from public.casino_active_games;

  delete from public.casino_transactions;
  get diagnostics v_transactions = row_count;

  delete from public.casino_game_rounds;
  get diagnostics v_rounds = row_count;

  delete from public.casino_conversion_requests;
  get diagnostics v_conversions = row_count;

  delete from public.casino_poker_tables;
  get diagnostics v_tables = row_count;

  delete from public.casino_wallets;
  get diagnostics v_wallets = row_count;

  -- Aucun INSERT de journal n'est effectué : après validation de la
  -- transaction, les tables opérationnelles du Casino sont entièrement vides.
  return jsonb_build_object(
    'complete', true,
    'deleted_conversions', v_conversions,
    'deleted_rounds', v_rounds,
    'deleted_transactions', v_transactions,
    'deleted_wallets', v_wallets,
    'deleted_tables', v_tables,
    'settings_preserved', true,
    'rp_database_modified', false
  );
end;
$$;

revoke all on function public.casino_admin_opening_reset_v112(text)
from public, anon;
grant execute on function public.casino_admin_opening_reset_v112(text)
to authenticated;
