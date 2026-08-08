-- Nostra Group V147.2
-- Correctif Academy : questionnaires libres + rattachement ultérieur à une formation.
-- Compatible avec V143 / V147 / V147.1 déjà installées.

begin;

-- Un questionnaire peut désormais exister sans formation.
-- La contrainte UNIQUE sur course_id est conservée : une seule épreuve liée par formation,
-- mais PostgreSQL autorise plusieurs valeurs NULL.
alter table public.academy_quizzes_v143
  alter column course_id drop not null;

-- Création manuelle : p_course_id peut être NULL.
create or replace function public.academy_create_quiz_v147_1(
  p_course_id bigint,
  p_title text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_pass numeric(5,2) := 70;
begin
  if auth.uid() is null then
    raise exception using message='not_authenticated';
  end if;
  if not public.nostra_v137_has_any_role(array['manager','commissioner']) then
    raise exception using message='staff_required';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null then
    raise exception using message='quiz_invalid';
  end if;

  if p_course_id is not null then
    if exists(select 1 from public.academy_quizzes_v143 where course_id=p_course_id) then
      raise exception using message='quiz_already_exists';
    end if;

    select coalesce(theory_pass_score,70)
      into v_pass
    from public.academy_courses_v137
    where id=p_course_id;

    if not found then
      raise exception using message='course_not_found';
    end if;
  end if;

  insert into public.academy_quizzes_v143(
    course_id,title,pass_score,active,created_by
  ) values (
    p_course_id,left(btrim(p_title),180),v_pass,false,auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- La synchronisation reste réservée aux formations existantes.
create or replace function public.academy_sync_quizzes_v147_1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception using message='not_authenticated';
  end if;
  if not public.nostra_v137_has_any_role(array['manager','commissioner']) then
    raise exception using message='staff_required';
  end if;

  with inserted as (
    insert into public.academy_quizzes_v143(course_id,title,pass_score,active,created_by)
    select
      c.id,
      'Questionnaire théorique · ' || c.title,
      coalesce(c.theory_pass_score,70),
      false,
      auth.uid()
    from public.academy_courses_v137 c
    where not exists (
      select 1 from public.academy_quizzes_v143 q where q.course_id=c.id
    )
    on conflict (course_id) do nothing
    returning id
  )
  select count(*)::integer into v_count from inserted;

  return v_count;
end;
$$;

grant execute on function public.academy_create_quiz_v147_1(bigint,text) to authenticated;
grant execute on function public.academy_sync_quizzes_v147_1() to authenticated;

commit;
