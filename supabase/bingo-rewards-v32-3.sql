-- NOSTRA GROUP V32.3 — RÉCOMPENSES DU BINGO
-- Tableau public des récompenses, configuration depuis le Dashboard
-- et validation du cadeau remis aux gagnants.
-- Script réexécutable : les données existantes sont conservées.

create table if not exists public.bingo_rewards (
  round_id bigint primary key references public.bingo_rounds(id) on delete cascade,
  one_line text not null default '',
  two_lines text not null default '',
  three_lines text not null default '',
  four_lines text not null default '',
  full_card text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.bingo_rewards (round_id)
select round.id
from public.bingo_rounds round
on conflict (round_id) do nothing;

alter table public.bingo_winners
  add column if not exists reward_text text not null default '',
  add column if not exists reward_status text not null default 'pending',
  add column if not exists reward_validated_at timestamptz,
  add column if not exists reward_validated_by uuid references auth.users(id) on delete set null;

alter table public.bingo_winners
  drop constraint if exists bingo_winner_reward_status_check;

alter table public.bingo_winners
  add constraint bingo_winner_reward_status_check
  check (reward_status in ('pending', 'validated'));

update public.bingo_winners winner
set reward_text = case winner.phase
  when 'one_line' then rewards.one_line
  when 'two_lines' then rewards.two_lines
  when 'three_lines' then rewards.three_lines
  when 'four_lines' then rewards.four_lines
  when 'full_card' then rewards.full_card
  else ''
end
from public.bingo_rewards rewards
where rewards.round_id = winner.round_id
  and coalesce(winner.reward_text, '') = '';

create or replace function public.update_bingo_rewards(
  p_one_line text,
  p_two_lines text,
  p_three_lines text,
  p_four_lines text,
  p_full_card text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round_id bigint;
begin
  if not public.nostra_bingo_is_manager() then
    raise exception 'manager_required';
  end if;

  select id into v_round_id
  from public.bingo_rounds
  where archived_at is null
  limit 1;

  if v_round_id is null then
    raise exception 'bingo_setup_missing';
  end if;

  insert into public.bingo_rewards (
    round_id,
    one_line,
    two_lines,
    three_lines,
    four_lines,
    full_card,
    updated_at,
    updated_by
  ) values (
    v_round_id,
    left(trim(coalesce(p_one_line, '')), 240),
    left(trim(coalesce(p_two_lines, '')), 240),
    left(trim(coalesce(p_three_lines, '')), 240),
    left(trim(coalesce(p_four_lines, '')), 240),
    left(trim(coalesce(p_full_card, '')), 240),
    now(),
    auth.uid()
  )
  on conflict (round_id) do update set
    one_line = excluded.one_line,
    two_lines = excluded.two_lines,
    three_lines = excluded.three_lines,
    four_lines = excluded.four_lines,
    full_card = excluded.full_card,
    updated_at = now(),
    updated_by = auth.uid();

  -- Un cadeau modifié avant sa remise est également actualisé
  -- sur les Bingo déjà détectés mais pas encore validés.
  update public.bingo_winners winner
  set reward_text = case winner.phase
    when 'one_line' then left(trim(coalesce(p_one_line, '')), 240)
    when 'two_lines' then left(trim(coalesce(p_two_lines, '')), 240)
    when 'three_lines' then left(trim(coalesce(p_three_lines, '')), 240)
    when 'four_lines' then left(trim(coalesce(p_four_lines, '')), 240)
    when 'full_card' then left(trim(coalesce(p_full_card, '')), 240)
    else winner.reward_text
  end
  where winner.round_id = v_round_id
    and winner.reward_status = 'pending';
end;
$$;

create or replace function public.validate_bingo_winner_reward(
  p_winner_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.nostra_bingo_is_manager() then
    raise exception 'manager_required';
  end if;

  update public.bingo_winners
  set
    reward_status = 'validated',
    reward_validated_at = now(),
    reward_validated_by = auth.uid()
  where id = p_winner_id
    and reward_status = 'pending';

  if not found then
    raise exception 'winner_not_found_or_already_validated';
  end if;
end;
$$;

create or replace function public.nostra_bingo_register_winners(
  p_round_id bigint,
  p_trigger_ball integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase text;
  v_drawn integer[];
  v_reward_text text := '';
  v_count integer := 0;
begin
  select phase into v_phase
  from public.bingo_rounds
  where id = p_round_id;

  select case v_phase
    when 'one_line' then rewards.one_line
    when 'two_lines' then rewards.two_lines
    when 'three_lines' then rewards.three_lines
    when 'four_lines' then rewards.four_lines
    when 'full_card' then rewards.full_card
    else ''
  end
  into v_reward_text
  from public.bingo_rewards rewards
  where rewards.round_id = p_round_id;

  v_reward_text := coalesce(v_reward_text, '');

  select coalesce(array_agg(ball_number order by draw_order), array[]::integer[])
    into v_drawn
  from public.bingo_draws
  where round_id = p_round_id;

  insert into public.bingo_winners (
    round_id,
    card_id,
    phase,
    card_number,
    customer_name,
    trigger_ball,
    reward_text,
    reward_status
  )
  select
    card.round_id,
    card.id,
    v_phase,
    card.card_number,
    card.customer_name,
    p_trigger_ball,
    v_reward_text,
    'pending'
  from public.bingo_cards card
  where card.round_id = p_round_id
    and public.nostra_bingo_card_matches(card.numbers, v_drawn, v_phase)
  on conflict (round_id, phase, card_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.reset_bingo_round()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.bingo_rounds%rowtype;
  v_new_id bigint;
  v_rewards public.bingo_rewards%rowtype;
begin
  if not public.nostra_bingo_is_manager() then
    raise exception 'manager_required';
  end if;

  select * into v_current
  from public.bingo_rounds
  where archived_at is null
  limit 1
  for update;

  if v_current.id is null then
    raise exception 'bingo_setup_missing';
  end if;

  select * into v_rewards
  from public.bingo_rewards
  where round_id = v_current.id;

  update public.bingo_rounds
  set status = 'archived', archived_at = now(), updated_at = now()
  where id = v_current.id;

  insert into public.bingo_rounds (title, card_price, status, phase)
  values (v_current.title, v_current.card_price, 'open', 'one_line')
  returning id into v_new_id;

  insert into public.bingo_rewards (
    round_id,
    one_line,
    two_lines,
    three_lines,
    four_lines,
    full_card,
    updated_at,
    updated_by
  ) values (
    v_new_id,
    coalesce(v_rewards.one_line, ''),
    coalesce(v_rewards.two_lines, ''),
    coalesce(v_rewards.three_lines, ''),
    coalesce(v_rewards.four_lines, ''),
    coalesce(v_rewards.full_card, ''),
    now(),
    auth.uid()
  );

  return v_new_id;
end;
$$;

revoke all on function public.update_bingo_rewards(text, text, text, text, text) from public;
revoke all on function public.validate_bingo_winner_reward(bigint) from public;
grant execute on function public.update_bingo_rewards(text, text, text, text, text) to authenticated;
grant execute on function public.validate_bingo_winner_reward(bigint) to authenticated;

alter table public.bingo_rewards enable row level security;

drop policy if exists "bingo authenticated read rewards" on public.bingo_rewards;
create policy "bingo authenticated read rewards"
on public.bingo_rewards
for select
to authenticated
using (true);

grant select on public.bingo_rewards to authenticated;

-- La table des récompenses se met à jour en direct sur la page publique.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bingo_rewards'
  ) then
    alter publication supabase_realtime add table public.bingo_rewards;
  end if;
end $$;

notify pgrst, 'reload schema';
