-- NOSTRA GROUP V138.4 — 50 QUESTIONS FINALES MONEY DROP
-- Migration additive et réexécutable.
-- Ajoute un vrai type « finale », 50 questions difficiles à deux trappes
-- et réserve automatiquement ces questions à la dernière manche.

alter table public.money_drop_questions
  add column if not exists is_final boolean not null default false;

update public.money_drop_questions
set is_final = false
where is_final is null;

create index if not exists money_drop_questions_final_active_idx
  on public.money_drop_questions (is_final, active, category, created_at desc);

-- Permet au gérant de créer une question classique ou finale.
drop function if exists public.money_drop_add_question(text, text, text, text, text, text, text);
drop function if exists public.money_drop_add_question(text, text, text, text, text, text, text, boolean);

create function public.money_drop_add_question(
  p_category text,
  p_question text,
  p_option_a text,
  p_option_b text,
  p_option_c text,
  p_option_d text,
  p_correct_option text,
  p_is_final boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id bigint;
  v_correct text := upper(trim(coalesce(p_correct_option, '')));
begin
  perform public.money_drop_require_manager();

  if char_length(trim(coalesce(p_category, ''))) < 2
     or char_length(trim(coalesce(p_question, ''))) < 5
     or nullif(trim(p_option_a), '') is null
     or nullif(trim(p_option_b), '') is null
     or v_correct not in ('A', 'B', 'C', 'D')
     or (v_correct = 'C' and nullif(trim(p_option_c), '') is null)
     or (v_correct = 'D' and nullif(trim(p_option_d), '') is null) then
    raise exception 'invalid_question';
  end if;

  insert into public.money_drop_questions (
    category, question, option_a, option_b, option_c, option_d,
    correct_option, is_final, created_by
  ) values (
    trim(p_category), trim(p_question), trim(p_option_a), trim(p_option_b),
    nullif(trim(p_option_c), ''), nullif(trim(p_option_d), ''),
    v_correct, coalesce(p_is_final, false), auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

-- Une question finale ne peut être utilisée que lors de la dernière manche.
create or replace function public.money_drop_select_question(
  p_game_id uuid,
  p_question_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_is_final boolean;
begin
  perform public.money_drop_require_manager();
  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.archived_at is not null then raise exception 'game_not_found'; end if;
  if v_game.status <> 'setup' then raise exception 'game_not_in_setup'; end if;

  select is_final into v_is_final
  from public.money_drop_questions
  where id = p_question_id and active;

  if v_is_final is null then raise exception 'question_not_found'; end if;
  if v_is_final <> (v_game.current_round >= v_game.total_rounds) then
    raise exception 'question_wrong_round';
  end if;

  if exists (
    select 1 from public.money_drop_round_history
    where game_id = p_game_id and question_id = p_question_id
  ) then
    raise exception 'question_already_used';
  end if;

  update public.money_drop_games
  set current_question_id = p_question_id, round_deadline = null
  where id = p_game_id;

  delete from public.money_drop_allocations
  where game_id = p_game_id and round_number = v_game.current_round;
end;
$$;

drop function if exists public.money_drop_select_random_question(uuid);
drop function if exists public.money_drop_select_random_question(uuid, text);

create function public.money_drop_select_random_question(
  p_game_id uuid,
  p_category text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question_id bigint;
begin
  perform public.money_drop_require_manager();

  select * into v_game
  from public.money_drop_games
  where id = p_game_id
  for update;

  if v_game.id is null or v_game.archived_at is not null then raise exception 'game_not_found'; end if;
  if v_game.status <> 'setup' then raise exception 'game_not_in_setup'; end if;

  select q.id into v_question_id
  from public.money_drop_questions q
  where q.active
    and q.is_final = (v_game.current_round >= v_game.total_rounds)
    and (
      nullif(trim(p_category), '') is null
      or lower(trim(q.category)) = lower(trim(p_category))
    )
    and not exists (
      select 1 from public.money_drop_round_history h
      where h.game_id = p_game_id and h.question_id = q.id
    )
  order by random()
  limit 1;

  if v_question_id is null then raise exception 'no_question_available'; end if;
  perform public.money_drop_select_question(p_game_id, v_question_id);
  return v_question_id;
end;
$$;

revoke all on function public.money_drop_add_question(text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.money_drop_select_question(uuid, bigint) from public, anon;
revoke all on function public.money_drop_select_random_question(uuid, text) from public, anon;

grant execute on function public.money_drop_add_question(text, text, text, text, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.money_drop_select_question(uuid, bigint) to authenticated, service_role;
grant execute on function public.money_drop_select_random_question(uuid, text) to authenticated, service_role;

-- 50 finales : 10 thèmes, 5 questions par thème, 2 trappes chacune.
insert into public.money_drop_questions (
  category, question, option_a, option_b, option_c, option_d,
  correct_option, is_final, active
) values
  ('Histoire', 'Quel traité de 843 partage l’Empire carolingien entre les petits-fils de Charlemagne ?', 'Le traité de Verdun', 'Le traité de Tordesillas', null, null, 'A', true, true),
  ('Histoire', 'Qui est traditionnellement considéré comme le dernier empereur romain d’Occident ?', 'Justinien Ier', 'Romulus Augustule', null, null, 'B', true, true),
  ('Histoire', 'En quelle année s’est déroulée la bataille de Hastings ?', '1066', '1215', null, null, 'A', true, true),
  ('Histoire', 'Quel pharaon fit construire les grands temples d’Abou Simbel ?', 'Toutânkhamon', 'Ramsès II', null, null, 'B', true, true),
  ('Histoire', 'La paix de Westphalie de 1648 met principalement fin à quelle guerre ?', 'La guerre de Trente Ans', 'La guerre de Cent Ans', null, null, 'A', true, true),
  ('Géographie', 'Quel détroit sépare l’Asie de l’Amérique du Nord ?', 'Le détroit de Gibraltar', 'Le détroit de Béring', null, null, 'B', true, true),
  ('Géographie', 'Le lac Titicaca est partagé entre quels deux pays ?', 'Le Pérou et la Bolivie', 'Le Chili et l’Argentine', null, null, 'A', true, true),
  ('Géographie', 'Quel pays est entièrement enclavé dans le territoire de l’Afrique du Sud ?', 'L’Eswatini', 'Le Lesotho', null, null, 'B', true, true),
  ('Géographie', 'Quelle chaîne de montagnes marque conventionnellement une partie de la limite entre l’Europe et l’Asie ?', 'L’Oural', 'Les Alpes', null, null, 'A', true, true),
  ('Géographie', 'Quel fleuve traverse la ville de Budapest ?', 'Le Dniepr', 'Le Danube', null, null, 'B', true, true),
  ('Sciences', 'Quelle valeur est la plus proche du nombre d’Avogadro ?', '6,02 × 10²³', '9,81 × 10²³', null, null, 'A', true, true),
  ('Sciences', 'Quel élément chimique porte le numéro atomique 74 ?', 'L’or', 'Le tungstène', null, null, 'B', true, true),
  ('Sciences', 'Quelle est l’unité SI de la conductance électrique ?', 'Le siemens', 'Le tesla', null, null, 'A', true, true),
  ('Sciences', 'Quelle particule est le quantum du champ électromagnétique ?', 'Le gluon', 'Le photon', null, null, 'B', true, true),
  ('Sciences', 'À 25 °C, quel est approximativement le pH d’une solution aqueuse neutre ?', '7', '0', null, null, 'A', true, true),
  ('Espace', 'Quelle planète possède une rotation rétrograde et un jour sidéral plus long que son année ?', 'Mercure', 'Vénus', null, null, 'B', true, true),
  ('Espace', 'Quelle est la plus grande lune de Saturne ?', 'Titan', 'Europe', null, null, 'A', true, true),
  ('Espace', 'Comment appelle-t-on le point d’une orbite où un objet est le plus proche du Soleil ?', 'L’aphélie', 'Le périhélie', null, null, 'B', true, true),
  ('Espace', 'Quelle grande galaxie est la plus proche de la Voie lactée ?', 'La galaxie d’Andromède', 'La galaxie du Triangle', null, null, 'A', true, true),
  ('Espace', 'Quelle sonde a été la première à entrer dans l’espace interstellaire ?', 'Pioneer 10', 'Voyager 1', null, null, 'B', true, true),
  ('Technologie', 'Qui a créé le langage de programmation Python ?', 'Guido van Rossum', 'Dennis Ritchie', null, null, 'A', true, true),
  ('Technologie', 'Lequel de ces algorithmes repose sur la cryptographie asymétrique ?', 'AES', 'RSA', null, null, 'B', true, true),
  ('Technologie', 'Quel est le rôle principal du DNS sur Internet ?', 'Associer des noms de domaine à des adresses IP', 'Chiffrer automatiquement tous les messages', null, null, 'A', true, true),
  ('Technologie', 'Combien de bits contient un octet ?', '16 bits', '8 bits', null, null, 'B', true, true),
  ('Technologie', 'Qui a créé le système de gestion de versions Git ?', 'Linus Torvalds', 'Tim Berners-Lee', null, null, 'A', true, true),
  ('Sport', 'Combien d’épreuves composent un décathlon ?', '12', '10', null, null, 'B', true, true),
  ('Sport', 'Quelle est la distance officielle d’un marathon ?', '42,195 km', '40 km', null, null, 'A', true, true),
  ('Sport', 'Quelles disciplines sont combinées dans le biathlon ?', 'Le saut à ski et le tir', 'Le ski de fond et le tir', null, null, 'B', true, true),
  ('Sport', 'Dans un tie-break classique au tennis, quel score minimal faut-il atteindre avec deux points d’écart ?', '7 points', '5 points', null, null, 'A', true, true),
  ('Sport', 'À quelle discipline est associé le style appelé Fosbury flop ?', 'Le saut à la perche', 'Le saut en hauteur', null, null, 'B', true, true),
  ('Cinéma & séries', 'Qui a réalisé Les Sept Samouraïs ?', 'Akira Kurosawa', 'Yasujirō Ozu', null, null, 'A', true, true),
  ('Cinéma & séries', 'Quel film a reçu la Palme d’or au Festival de Cannes en 1994 ?', 'Forrest Gump', 'Pulp Fiction', null, null, 'B', true, true),
  ('Cinéma & séries', 'Qui a réalisé 2001 : L’Odyssée de l’espace ?', 'Stanley Kubrick', 'Andreï Tarkovski', null, null, 'A', true, true),
  ('Cinéma & séries', 'Qui a réalisé le film muet Nosferatu sorti en 1922 ?', 'Fritz Lang', 'F. W. Murnau', null, null, 'B', true, true),
  ('Cinéma & séries', 'Lequel de ces artistes est cofondateur du Studio Ghibli ?', 'Hayao Miyazaki', 'Akira Toriyama', null, null, 'A', true, true),
  ('Musique', 'Qui a composé le Boléro ?', 'Claude Debussy', 'Maurice Ravel', null, null, 'B', true, true),
  ('Musique', 'Qui a composé Les Quatre Saisons ?', 'Antonio Vivaldi', 'Arcangelo Corelli', null, null, 'A', true, true),
  ('Musique', 'Qui a composé la Symphonie du Nouveau Monde ?', 'Bedřich Smetana', 'Antonín Dvořák', null, null, 'B', true, true),
  ('Musique', 'Sur quelle île Freddie Mercury est-il né ?', 'Zanzibar', 'Madagascar', null, null, 'A', true, true),
  ('Musique', 'Quel musicien est l’artiste principal de l’album Kind of Blue ?', 'John Coltrane', 'Miles Davis', null, null, 'B', true, true),
  ('Littérature & français', 'Quel nom donne le narrateur au début de Moby-Dick ?', 'Ishmaël', 'Achab', null, null, 'A', true, true),
  ('Littérature & français', 'Qui a écrit Le Nom de la rose ?', 'Italo Calvino', 'Umberto Eco', null, null, 'B', true, true),
  ('Littérature & français', 'Qui a écrit En attendant Godot ?', 'Samuel Beckett', 'Eugène Ionesco', null, null, 'A', true, true),
  ('Littérature & français', 'Dans quel roman apparaît la ville fictive de Macondo ?', 'La Maison aux esprits', 'Cent ans de solitude', null, null, 'B', true, true),
  ('Littérature & français', 'Qui a écrit le recueil Les Fleurs du mal ?', 'Charles Baudelaire', 'Arthur Rimbaud', null, null, 'A', true, true),
  ('Automobile', 'Quel modèle a popularisé la production automobile à la chaîne au début du XXe siècle ?', 'La Citroën Traction Avant', 'La Ford Model T', null, null, 'B', true, true),
  ('Automobile', 'Quel type de mouvement caractérise le moteur Wankel ?', 'Un piston rotatif', 'Des pistons opposés à plat', null, null, 'A', true, true),
  ('Automobile', 'Que signifie le sigle ABS dans le domaine du freinage automobile ?', 'Système automatique de suralimentation', 'Système antiblocage des roues', null, null, 'B', true, true),
  ('Automobile', 'Sur quel circuit se disputent les 24 Heures du Mans ?', 'Le circuit de la Sarthe', 'Le circuit de Magny-Cours', null, null, 'A', true, true),
  ('Automobile', 'Quelle monoplace est généralement reconnue comme la première Formule 1 à monocoque entièrement en fibre de carbone ?', 'La Lotus 79', 'La McLaren MP4/1', null, null, 'B', true, true)
on conflict (lower(trim(question))) do update set
  category = excluded.category,
  option_a = excluded.option_a,
  option_b = excluded.option_b,
  option_c = excluded.option_c,
  option_d = excluded.option_d,
  correct_option = excluded.correct_option,
  is_final = true,
  active = true,
  updated_at = now();

notify pgrst, 'reload schema';
