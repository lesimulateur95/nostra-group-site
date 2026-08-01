-- Nostra Group · Le Cercle Nostra · V114
-- À exécuter une seule fois après la V113.
-- Reset total des données Casino de test, sans clé privée Vercel.
-- Les réglages du Casino et l'argent RP du serveur sont conservés.

drop function if exists public.casino_admin_opening_reset_v114(text);
drop function if exists public.casino_admin_opening_reset_v113(text);
drop function if exists public.casino_admin_opening_reset_v112(text);
drop function if exists public.casino_admin_reset_data_v111(text, text);
drop table if exists public.casino_reset_log_v111;

create function public.casino_admin_opening_reset_v114(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication_required';
  end if;

  -- Même autorisation Gérant que le Dashboard. Le contrôle Discord explicite
  -- garde la compatibilité avec les anciens rôles du site.
  if not public.is_nostra_manager()
     and coalesce(public.nostra_jwt_discord_id(), '') <> '331843410962939908' then
    raise exception 'forbidden';
  end if;

  if coalesce(p_confirmation, '') <> 'OUVRIR LE CASINO A ZERO' then
    raise exception 'invalid_confirmation';
  end if;

  -- Supprime en une seule transaction toutes les données opérationnelles.
  -- Toutes les tables dépendantes sont incluses pour éviter les blocages de
  -- clés étrangères, même lorsqu'une partie ou une table est encore active.
  truncate table
    public.casino_poker_seats,
    public.casino_active_games,
    public.casino_transactions,
    public.casino_game_rounds,
    public.casino_conversion_requests,
    public.casino_poker_tables,
    public.casino_wallets
  restart identity;

  -- Contrôle final : le bouton ne peut annoncer une réussite que si tout est
  -- réellement vide. Les totaux, le résultat maison et le RTP repartent à 0.
  if exists (select 1 from public.casino_poker_seats)
     or exists (select 1 from public.casino_active_games)
     or exists (select 1 from public.casino_transactions)
     or exists (select 1 from public.casino_game_rounds)
     or exists (select 1 from public.casino_conversion_requests)
     or exists (select 1 from public.casino_poker_tables)
     or exists (select 1 from public.casino_wallets) then
    raise exception 'casino_reset_incomplete';
  end if;

  return jsonb_build_object(
    'complete', true,
    'purchases', 0,
    'transactions', 0,
    'rounds', 0,
    'wallets', 0,
    'players', 0,
    'total_wagered', 0,
    'total_paid', 0,
    'house_result', 0,
    'real_rtp_percent', 0,
    'settings_preserved', true,
    'rp_database_modified', false
  );
end;
$$;

revoke all on function public.casino_admin_opening_reset_v114(text)
from public, anon;
grant execute on function public.casino_admin_opening_reset_v114(text)
to authenticated;
