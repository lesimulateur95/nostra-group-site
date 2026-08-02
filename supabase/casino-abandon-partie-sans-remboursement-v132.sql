-- Nostra Group · Casino · V132
-- Une partie solo quittée est clôturée comme une perte, sans remboursement.

begin;

create or replace function public.casino_abandon_active_game_v132(p_game text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_active public.casino_active_games%rowtype;
  v_round public.casino_game_rounds%rowtype;
  v_balance bigint := 0;
  v_abandoned boolean := false;
begin
  if v_user_id is null then raise exception 'authentication_required'; end if;
  if p_game not in ('poker', 'blackjack', 'double_or_quit', 'mines') then
    raise exception 'invalid_game';
  end if;

  select * into v_active
  from public.casino_active_games
  where user_id = v_user_id and game = p_game
  for update;

  if found then
    select * into v_round
    from public.casino_game_rounds
    where id = v_active.round_id and user_id = v_user_id and status = 'pending'
    for update;
  else
    select * into v_round
    from public.casino_game_rounds
    where user_id = v_user_id and game = p_game and status = 'pending'
    order by created_at desc
    limit 1
    for update;
  end if;

  if found then
    update public.casino_game_rounds
    set status = 'settled',
        payout = 0,
        result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
          'result', 'abandoned',
          'summary', 'Partie quittée · jetons engagés perdus',
          'abandoned', true
        ),
        settled_at = now()
    where id = v_round.id and status = 'pending';

    if found then
      v_abandoned := true;
      update public.casino_wallets
      set games_played = games_played + 1,
          updated_at = now()
      where user_id = v_user_id;
    end if;
  end if;

  delete from public.casino_active_games
  where user_id = v_user_id and game = p_game;

  select coalesce(balance, 0) into v_balance
  from public.casino_wallets
  where user_id = v_user_id;

  return jsonb_build_object(
    'abandoned', v_abandoned,
    'game', p_game,
    'balance', coalesce(v_balance, 0),
    'refunded', false
  );
end;
$$;

-- Les parties oubliées ne sont plus remboursées après le délai de sécurité.
-- Elles sont enregistrées comme perdues et le portefeuille n'est jamais recrédité.
create or replace function public.casino_recover_stale_rounds_v108()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round record;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  for v_round in
    select r.id, r.user_id, r.game
    from public.casino_game_rounds r
    left join public.casino_active_games a on a.round_id = r.id
    where r.status = 'pending'
      and r.game in ('poker', 'blackjack', 'double_or_quit', 'mines')
      and coalesce(a.updated_at, r.created_at) < now() - interval '30 minutes'
    for update of r skip locked
  loop
    update public.casino_game_rounds
    set status = 'settled',
        payout = 0,
        result = coalesce(result, '{}'::jsonb) || jsonb_build_object(
          'result', 'abandoned',
          'summary', 'Partie interrompue · jetons engagés perdus',
          'abandoned', true,
          'automatic', true
        ),
        settled_at = now()
    where id = v_round.id and status = 'pending';

    if found then
      delete from public.casino_active_games where round_id = v_round.id;
      update public.casino_wallets
      set games_played = games_played + 1,
          updated_at = now()
      where user_id = v_round.user_id;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.casino_abandon_active_game_v132(text) from public, anon;
revoke all on function public.casino_recover_stale_rounds_v108() from public, anon;
grant execute on function public.casino_abandon_active_game_v132(text) to authenticated;
grant execute on function public.casino_recover_stale_rounds_v108() to authenticated;

notify pgrst, 'reload schema';

commit;

select 'V132 prête · abandon sans remboursement et Dashboard synchronisé' as status;
