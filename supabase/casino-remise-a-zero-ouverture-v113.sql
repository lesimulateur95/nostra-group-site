-- Nostra Group · Le Cercle Nostra · V113
-- À exécuter une seule fois après les SQL V108, V109, V110 et V112.
-- Corrige le blocage du bouton V112 causé par la double vérification du rôle.
-- L'appel est réservé au serveur du site avec la clé service_role.

drop function if exists public.casino_admin_opening_reset_v113(text);

create function public.casino_admin_opening_reset_v113(
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
  if coalesce(p_confirmation, '') <> 'OUVRIR LE CASINO A ZERO' then
    raise exception 'invalid_confirmation';
  end if;

  -- Enfants et parties actives en premier pour respecter les dépendances.
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

  -- Aucun journal n'est recréé : toutes les données Casino de test restent
  -- réellement vides. Les réglages du Casino et des jeux sont conservés.
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

revoke all on function public.casino_admin_opening_reset_v113(text)
from public, anon, authenticated;
grant execute on function public.casino_admin_opening_reset_v113(text)
to service_role;

-- L'ancienne V112 n'est plus appelable directement depuis un compte citoyen.
revoke all on function public.casino_admin_opening_reset_v112(text)
from public, anon, authenticated;
