-- Nostra Group · Le Cercle Nostra · V111
-- Exécuter une seule fois APRÈS les SQL V108, V109 et V110.
-- Ajoute les remises à zéro globales du Casino depuis le Dashboard.
-- Les réglages du Casino et des jeux ne sont jamais modifiés par ces actions.

create table if not exists public.casino_reset_log_v111 (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('purchases', 'activity', 'players', 'all')),
  deleted_conversions bigint not null default 0,
  deleted_rounds bigint not null default 0,
  deleted_transactions bigint not null default 0,
  affected_wallets bigint not null default 0,
  deleted_tables bigint not null default 0,
  reset_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.casino_reset_log_v111 enable row level security;

drop policy if exists "casino managers read reset log v111"
on public.casino_reset_log_v111;
create policy "casino managers read reset log v111"
on public.casino_reset_log_v111
for select to authenticated
using (public.is_nostra_manager());

revoke all on public.casino_reset_log_v111 from public, anon;
grant select on public.casino_reset_log_v111 to authenticated;

create or replace function public.casino_admin_reset_data_v111(
  p_scope text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
  v_conversions bigint := 0;
  v_rounds bigint := 0;
  v_transactions bigint := 0;
  v_wallets bigint := 0;
  v_tables bigint := 0;
  v_count bigint := 0;
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;

  v_expected := case p_scope
    when 'purchases' then 'EFFACER LES ACHATS CASINO'
    when 'activity' then 'EFFACER LES PARTIES CASINO'
    when 'players' then 'REMETTRE TOUS LES JOUEURS A ZERO'
    when 'all' then 'REINITIALISER TOUT LE CASINO'
    else null
  end;

  if v_expected is null or coalesce(p_confirmation, '') <> v_expected then
    raise exception 'invalid_confirmation';
  end if;

  -- Achats/conversions : effacement du journal uniquement. Aucun appel n'est
  -- effectué vers la base RP du serveur et les soldes Casino restent inchangés.
  if p_scope in ('purchases', 'all') then
    delete from public.casino_transactions
    where kind = 'conversion'
       or reference_id in (select id from public.casino_conversion_requests);
    get diagnostics v_transactions = row_count;

    delete from public.casino_conversion_requests;
    get diagnostics v_conversions = row_count;
  end if;

  -- Activité de jeu : les tables et parties en cours sont supprimées avant les
  -- manches auxquelles elles sont rattachées.
  if p_scope in ('activity', 'players', 'all') then
    delete from public.casino_poker_seats;

    delete from public.casino_poker_tables;
    get diagnostics v_tables = row_count;

    delete from public.casino_active_games;

    delete from public.casino_transactions
    where kind in ('wager', 'payout', 'refund', 'table_buyin', 'table_cashout')
       or reference_id in (select id from public.casino_game_rounds);
    get diagnostics v_count = row_count;
    v_transactions := v_transactions + v_count;

    delete from public.casino_game_rounds;
    get diagnostics v_rounds = row_count;

    update public.casino_wallets
    set lifetime_wagered = 0,
        lifetime_won = 0,
        games_played = 0,
        biggest_win = 0,
        xp = 0,
        updated_at = now();
    get diagnostics v_wallets = row_count;
  end if;

  -- Remise à zéro de tous les joueurs : les ajustements restants sont effacés
  -- et chaque portefeuille repart sans jeton.
  if p_scope = 'players' then
    delete from public.casino_transactions;
    get diagnostics v_count = row_count;
    v_transactions := v_transactions + v_count;

    update public.casino_wallets
    set balance = 0,
        lifetime_wagered = 0,
        lifetime_won = 0,
        games_played = 0,
        biggest_win = 0,
        xp = 0,
        updated_at = now();
    get diagnostics v_wallets = row_count;
  end if;

  -- Reset complet : les portefeuilles sont supprimés. Ils seront recréés vides
  -- automatiquement à la prochaine ouverture du Casino par chaque citoyen.
  if p_scope = 'all' then
    delete from public.casino_transactions;
    get diagnostics v_count = row_count;
    v_transactions := v_transactions + v_count;

    delete from public.casino_wallets;
    get diagnostics v_wallets = row_count;
  end if;

  insert into public.casino_reset_log_v111 (
    scope,
    deleted_conversions,
    deleted_rounds,
    deleted_transactions,
    affected_wallets,
    deleted_tables,
    reset_by
  ) values (
    p_scope,
    v_conversions,
    v_rounds,
    v_transactions,
    v_wallets,
    v_tables,
    auth.uid()
  );

  return jsonb_build_object(
    'scope', p_scope,
    'deleted_conversions', v_conversions,
    'deleted_rounds', v_rounds,
    'deleted_transactions', v_transactions,
    'affected_wallets', v_wallets,
    'deleted_tables', v_tables,
    'settings_preserved', true,
    'rp_database_modified', false
  );
end;
$$;

revoke all on function public.casino_admin_reset_data_v111(text, text)
from public, anon;
grant execute on function public.casino_admin_reset_data_v111(text, text)
to authenticated;
