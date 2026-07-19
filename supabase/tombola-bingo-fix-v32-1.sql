-- NOSTRA GROUP V32.1
-- Correction Tombola + cartons Bingo classiques 75 boules.
-- Script réexécutable.

-- TOMBOLA
-- Le reset archive déjà l'ancienne édition. Le site filtre désormais le profil
-- sur l'édition active, donc les anciens numéros ne sont plus affichés au citoyen.

-- BINGO 75 BOULES
-- B = 1-15, I = 16-30, N = 31-45, G = 46-60, O = 61-75.

alter table public.bingo_draws
  drop constraint if exists bingo_draw_ball_check;

-- Retire d'abord les anciens tirages incompatibles avant de recréer la contrainte.
delete from public.bingo_draws
where ball_number > 75;

alter table public.bingo_draws
  add constraint bingo_draw_ball_check
  check (ball_number between 1 and 75);

create or replace function public.nostra_bingo_generate_card()
returns integer[]
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_b integer[];
  v_i integer[];
  v_n integer[];
  v_g integer[];
  v_o integer[];
begin
  select array_agg(candidate order by candidate) into v_b
  from (
    select candidate
    from generate_series(1, 15) as candidates(candidate)
    order by random()
    limit 5
  ) picked;

  select array_agg(candidate order by candidate) into v_i
  from (
    select candidate
    from generate_series(16, 30) as candidates(candidate)
    order by random()
    limit 5
  ) picked;

  select array_agg(candidate order by candidate) into v_n
  from (
    select candidate
    from generate_series(31, 45) as candidates(candidate)
    order by random()
    limit 4
  ) picked;

  select array_agg(candidate order by candidate) into v_g
  from (
    select candidate
    from generate_series(46, 60) as candidates(candidate)
    order by random()
    limit 5
  ) picked;

  select array_agg(candidate order by candidate) into v_o
  from (
    select candidate
    from generate_series(61, 75) as candidates(candidate)
    order by random()
    limit 5
  ) picked;

  return array[
    v_b[1], v_i[1], v_n[1], v_g[1], v_o[1],
    v_b[2], v_i[2], v_n[2], v_g[2], v_o[2],
    v_b[3], v_i[3], 0,      v_g[3], v_o[3],
    v_b[4], v_i[4], v_n[3], v_g[4], v_o[4],
    v_b[5], v_i[5], v_n[4], v_g[5], v_o[5]
  ];
end;
$$;

-- Les anciens résultats ne correspondent plus aux cartons régénérés.
delete from public.bingo_winners winner
where winner.round_id in (
  select round.id
  from public.bingo_rounds round
  where round.archived_at is null
);

-- Les cartons de l'édition active sont régénérés avec les bonnes colonnes.
-- Les anciennes éditions archivées restent intactes.
update public.bingo_cards card
set numbers = public.nostra_bingo_generate_card()
where card.round_id in (
  select round.id
  from public.bingo_rounds round
  where round.archived_at is null
);

create or replace function public.draw_bingo_number()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_round public.bingo_rounds%rowtype;
  v_ball integer;
  v_order integer;
  v_new_winners integer;
  v_winners jsonb;
begin
  if not public.nostra_bingo_is_manager() then raise exception 'manager_required'; end if;

  select * into v_round
  from public.bingo_rounds
  where archived_at is null
  limit 1
  for update;

  if v_round.id is null then raise exception 'bingo_setup_missing'; end if;

  if v_round.phase = 'full_card' and exists (
    select 1 from public.bingo_winners
    where round_id = v_round.id and phase = 'full_card'
  ) then
    raise exception 'full_card_complete';
  end if;

  select candidate into v_ball
  from generate_series(1, 75) as candidates(candidate)
  where not exists (
    select 1 from public.bingo_draws draw
    where draw.round_id = v_round.id
      and draw.ball_number = candidate
  )
  order by random()
  limit 1;

  if v_ball is null then raise exception 'no_numbers_left'; end if;

  select coalesce(max(draw_order), 0) + 1
    into v_order
  from public.bingo_draws
  where round_id = v_round.id;

  insert into public.bingo_draws (
    round_id, ball_number, draw_order, drawn_by
  ) values (
    v_round.id, v_ball, v_order, v_user_id
  );

  update public.bingo_rounds
  set status = 'playing', updated_at = now()
  where id = v_round.id;

  v_new_winners := public.nostra_bingo_register_winners(v_round.id, v_ball);

  if v_round.phase = 'full_card' and v_new_winners > 0 then
    update public.bingo_rounds
    set status = 'completed', updated_at = now()
    where id = v_round.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'card_number', winner.card_number,
    'customer_name', winner.customer_name,
    'phase', winner.phase
  ) order by winner.card_number), '[]'::jsonb)
    into v_winners
  from public.bingo_winners winner
  where winner.round_id = v_round.id
    and winner.phase = v_round.phase
    and winner.trigger_ball = v_ball;

  return jsonb_build_object(
    'ball_number', v_ball,
    'draw_order', v_order,
    'phase', v_round.phase,
    'new_winners', v_winners
  );
end;
$$;

revoke all on function public.nostra_bingo_generate_card() from public;
revoke all on function public.draw_bingo_number() from public;
grant execute on function public.nostra_bingo_generate_card() to authenticated;
grant execute on function public.draw_bingo_number() to authenticated;

notify pgrst, 'reload schema';
