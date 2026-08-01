-- Nostra Group · Le Cercle Nostra · V109
-- À exécuter une seule fois APRÈS casino-le-cercle-v108.sql.
-- Active les achats réellement débités sur la base RP et les remises à zéro Dashboard.

alter table public.casino_conversion_requests
  add column if not exists steam_id text,
  add column if not exists payment_mode text not null default 'manual'
    check (payment_mode in ('manual', 'rp_database'));

-- Les anciennes demandes V108 ne doivent plus pouvoir créer des jetons fictifs.
update public.casino_conversion_requests
set status = 'cancelled', reviewed_at = now()
where status = 'pending';

-- Seul le serveur du site, avec la clé service_role, peut confirmer un débit RP.
create or replace function public.casino_complete_rp_purchase_v109(
  p_request_id uuid,
  p_user_id uuid,
  p_steam_id text,
  p_rp_amount bigint,
  p_chip_amount bigint,
  p_rate bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.casino_settings%rowtype;
  v_balance bigint;
  v_existing public.casino_conversion_requests%rowtype;
begin
  if p_request_id is null or p_user_id is null or length(btrim(coalesce(p_steam_id, ''))) < 5 then
    raise exception 'invalid_purchase_identity';
  end if;

  select * into v_settings from public.casino_settings where id = 1;
  if not found then raise exception 'casino_not_configured'; end if;
  if p_chip_amount < v_settings.min_conversion or p_chip_amount > v_settings.max_conversion then
    raise exception 'invalid_amount';
  end if;
  if p_rate <> v_settings.rp_per_chip or p_rp_amount <> p_chip_amount * p_rate then
    raise exception 'invalid_rate';
  end if;

  select * into v_existing
  from public.casino_conversion_requests
  where id = p_request_id
  for update;

  if found then
    if v_existing.user_id <> p_user_id
       or v_existing.steam_id is distinct from left(btrim(p_steam_id), 80)
       or v_existing.rp_amount <> p_rp_amount
       or v_existing.chip_amount <> p_chip_amount
       or v_existing.rate <> p_rate then
      raise exception 'purchase_reference_conflict';
    end if;
    if v_existing.status = 'approved' then
      select balance into v_balance from public.casino_wallets where user_id = p_user_id;
      return jsonb_build_object(
        'id', v_existing.id,
        'status', v_existing.status,
        'balance', coalesce(v_balance, 0),
        'already_completed', true
      );
    end if;
    if v_existing.status <> 'pending' then raise exception 'purchase_not_pending'; end if;
  else
    raise exception 'purchase_not_reserved';
  end if;

  update public.casino_conversion_requests
  set status = 'approved', reviewed_at = now()
  where id = p_request_id;

  insert into public.casino_wallets (user_id, balance)
  values (p_user_id, p_chip_amount)
  on conflict (user_id) do update
  set balance = casino_wallets.balance + excluded.balance,
      updated_at = now()
  returning balance into v_balance;

  insert into public.casino_transactions (
    user_id, kind, amount, balance_after, label, reference_id
  ) values (
    p_user_id, 'conversion', p_chip_amount, v_balance,
    'Achat de jetons payé avec l''argent RP', p_request_id
  );

  return jsonb_build_object(
    'id', p_request_id,
    'status', 'approved',
    'balance', v_balance,
    'already_completed', false
  );
end;
$$;

revoke all on function public.casino_complete_rp_purchase_v109(uuid,uuid,text,bigint,bigint,bigint)
from public, anon, authenticated;
grant execute on function public.casino_complete_rp_purchase_v109(uuid,uuid,text,bigint,bigint,bigint)
to service_role;

-- L'ancien mécanisme créait une demande manuelle sans débit réel.
revoke execute on function public.casino_request_conversion_v108(bigint) from authenticated;

create or replace function public.casino_admin_reset_player_v109(
  p_user_id uuid,
  p_scope text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_balance bigint;
  v_new_level integer;
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  if p_user_id is null or p_scope not in ('balance', 'level', 'total') then
    raise exception 'invalid_reset';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'reason_required'; end if;

  insert into public.casino_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select balance into v_old_balance
  from public.casino_wallets
  where user_id = p_user_id
  for update;

  if p_scope <> 'total' and exists (
    select 1 from public.casino_game_rounds
    where user_id = p_user_id and status = 'pending'
  ) then
    raise exception 'active_game_exists';
  end if;

  if p_scope = 'total' then
    delete from public.casino_active_games where user_id = p_user_id;
    update public.casino_game_rounds
    set status = 'settled', payout = 0,
        result = jsonb_build_object('result', 'Réinitialisation totale Dashboard'),
        settled_at = now()
    where user_id = p_user_id and status = 'pending';
  end if;

  update public.casino_wallets
  set balance = case when p_scope in ('balance', 'total') then 0 else balance end,
      xp = case when p_scope in ('level', 'total') then 0 else xp end,
      lifetime_wagered = case when p_scope = 'total' then 0 else lifetime_wagered end,
      lifetime_won = case when p_scope = 'total' then 0 else lifetime_won end,
      games_played = case when p_scope = 'total' then 0 else games_played end,
      biggest_win = case when p_scope = 'total' then 0 else biggest_win end,
      updated_at = now()
  where user_id = p_user_id
  returning level into v_new_level;

  if p_scope in ('balance', 'total') and v_old_balance > 0 then
    insert into public.casino_transactions (
      user_id, kind, amount, balance_after, label, created_by
    ) values (
      p_user_id, 'adjustment', -v_old_balance, 0,
      left(btrim(p_reason), 180), auth.uid()
    );
  end if;

  return jsonb_build_object(
    'user_id', p_user_id,
    'scope', p_scope,
    'removed_balance', case when p_scope in ('balance', 'total') then v_old_balance else 0 end,
    'level', v_new_level
  );
end;
$$;

revoke all on function public.casino_admin_reset_player_v109(uuid,text,text) from public, anon;
grant execute on function public.casino_admin_reset_player_v109(uuid,text,text) to authenticated;

-- Le Dashboard reçoit les achats récents, pas uniquement les anciennes demandes en attente.
create or replace function public.casino_admin_overview_v108()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_nostra_manager() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'conversions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'display_name', coalesce(public.casino_display_name_v108(r.user_id), 'Citoyen Nostra'),
        'rp_amount', r.rp_amount,
        'chip_amount', r.chip_amount,
        'status', r.status,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from (
        select * from public.casino_conversion_requests
        order by created_at desc
        limit 50
      ) r
    ), '[]'::jsonb),
    'wallets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', w.user_id,
        'display_name', coalesce(public.casino_display_name_v108(w.user_id), 'Citoyen Nostra'),
        'balance', w.balance,
        'lifetime_wagered', w.lifetime_wagered,
        'lifetime_won', w.lifetime_won,
        'games_played', w.games_played,
        'biggest_win', w.biggest_win,
        'xp', w.xp,
        'level', w.level
      ) order by w.balance desc)
      from public.casino_wallets w
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.casino_admin_overview_v108() to authenticated;
