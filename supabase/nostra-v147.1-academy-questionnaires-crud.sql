-- Nostra Group V147.1
-- Correctif Questionnaires Academy : génération des questionnaires manquants + création/suppression depuis le Dashboard.
-- Prérequis : module Academy V137 + Questionnaires V143/V147.

begin;

-- 1) Rattrapage immédiat : chaque formation existante reçoit son questionnaire si absent.
insert into public.academy_quizzes_v143(course_id,title,pass_score,active)
select
  c.id,
  'Questionnaire théorique · ' || c.title,
  coalesce(c.theory_pass_score,70),
  false
from public.academy_courses_v137 c
where not exists (
  select 1
  from public.academy_quizzes_v143 q
  where q.course_id = c.id
)
on conflict (course_id) do nothing;

-- 2) Sécurité : garde le trigger de création automatique pour les futures formations.
create or replace function public.academy_create_course_quiz_v143()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.academy_quizzes_v143(course_id,title,pass_score,active)
  values(new.id,'Questionnaire théorique · ' || new.title,coalesce(new.theory_pass_score,70),false)
  on conflict (course_id) do nothing;
  return new;
end;
$$;

drop trigger if exists academy_create_course_quiz_v143 on public.academy_courses_v137;
create trigger academy_create_course_quiz_v143
after insert on public.academy_courses_v137
for each row execute function public.academy_create_course_quiz_v143();

-- 3) Bouton Dashboard : générer tous les questionnaires manquants.
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

-- 4) Création manuelle depuis le Dashboard.
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
  v_pass numeric(5,2);
begin
  if auth.uid() is null then
    raise exception using message='not_authenticated';
  end if;
  if not public.nostra_v137_has_any_role(array['manager','commissioner']) then
    raise exception using message='staff_required';
  end if;
  if p_course_id is null or nullif(btrim(coalesce(p_title,'')),'') is null then
    raise exception using message='quiz_invalid';
  end if;

  if exists(select 1 from public.academy_quizzes_v143 where course_id=p_course_id) then
    raise exception using message='quiz_already_exists';
  end if;

  select theory_pass_score into v_pass
  from public.academy_courses_v137
  where id=p_course_id;
  if not found then
    raise exception using message='course_not_found';
  end if;

  insert into public.academy_quizzes_v143(
    course_id,title,pass_score,active,created_by
  ) values (
    p_course_id,left(btrim(p_title),180),coalesce(v_pass,70),false,auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- 5) Suppression réelle d'un questionnaire depuis le Dashboard.
-- Les questions, invitations et tentatives sont supprimées via les FK ON DELETE CASCADE.
-- Si la note théorie provenait de ce questionnaire, elle est remise à zéro pour éviter une note orpheline.
create or replace function public.academy_delete_quiz_v147_1(p_quiz_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception using message='not_authenticated';
  end if;
  if not public.nostra_v137_has_any_role(array['manager','commissioner']) then
    raise exception using message='staff_required';
  end if;

  if not exists(select 1 from public.academy_quizzes_v143 where id=p_quiz_id) then
    raise exception using message='quiz_not_found';
  end if;

  update public.academy_enrollments_v137 e
  set
    theory_score = null,
    theory_quiz_passed_at = null,
    theory_quiz_attempt_id = null,
    updated_at = now()
  where e.theory_quiz_attempt_id in (
    select a.id
    from public.academy_quiz_attempts_v143 a
    where a.quiz_id=p_quiz_id
  );

  delete from public.academy_quizzes_v143 where id=p_quiz_id;
end;
$$;

grant execute on function public.academy_sync_quizzes_v147_1() to authenticated;
grant execute on function public.academy_create_quiz_v147_1(bigint,text) to authenticated;
grant execute on function public.academy_delete_quiz_v147_1(bigint) to authenticated;

commit;
