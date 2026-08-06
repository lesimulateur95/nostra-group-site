-- Nostra Group V138.2 — Correctif Money Drop
-- À exécuter après la V138/V138.1 si Money Drop est déjà installé.
-- Corrections : toutes les trappes peuvent recevoir une mise + banque de 60 questions variées.

begin;

create or replace function public.money_drop_save_allocations(
  p_game_id uuid,
  p_allocations jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_game public.money_drop_games%rowtype;
  v_question public.money_drop_questions%rowtype;
  v_a bigint := greatest(0, coalesce((p_allocations ->> 'A')::bigint, 0));
  v_b bigint := greatest(0, coalesce((p_allocations ->> 'B')::bigint, 0));
  v_c bigint := greatest(0, coalesce((p_allocations ->> 'C')::bigint, 0));
  v_d bigint := greatest(0, coalesce((p_allocations ->> 'D')::bigint, 0));
  v_total bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into v_game from public.money_drop_games where id = p_game_id for update;
  if v_game.id is null or v_game.status <> 'question_open' then raise exception 'question_closed'; end if;
  if v_game.round_deadline is not null and now() > v_game.round_deadline then raise exception 'timer_expired'; end if;

  if not public.money_drop_is_manager() and not exists (
    select 1 from public.money_drop_players
    where game_id = p_game_id and user_id = auth.uid()
  ) then
    raise exception 'not_player';
  end if;

  select * into v_question from public.money_drop_questions where id = v_game.current_question_id;
  if v_question.id is null then raise exception 'question_missing'; end if;

  if nullif(trim(v_question.option_c), '') is null and v_c <> 0 then raise exception 'invalid_option'; end if;
  if nullif(trim(v_question.option_d), '') is null and v_d <> 0 then raise exception 'invalid_option'; end if;

  v_total := v_a + v_b + v_c + v_d;
  if v_total <> v_game.current_amount then raise exception 'allocations_total'; end if;


  delete from public.money_drop_allocations
  where game_id = p_game_id and round_number = v_game.current_round;

  insert into public.money_drop_allocations (game_id, round_number, option_key, amount, updated_by)
  values
    (p_game_id, v_game.current_round, 'A', v_a, auth.uid()),
    (p_game_id, v_game.current_round, 'B', v_b, auth.uid());

  if nullif(trim(v_question.option_c), '') is not null then
    insert into public.money_drop_allocations (game_id, round_number, option_key, amount, updated_by)
    values (p_game_id, v_game.current_round, 'C', v_c, auth.uid());
  end if;

  if nullif(trim(v_question.option_d), '') is not null then
    insert into public.money_drop_allocations (game_id, round_number, option_key, amount, updated_by)
    values (p_game_id, v_game.current_round, 'D', v_d, auth.uid());
  end if;
end;
$$;

grant execute on function public.money_drop_save_allocations(uuid, jsonb)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. BANQUE DE QUESTIONS DE DÉPART — AUTOMOBILE ET CULTURE GÉNÉRALE
-- ---------------------------------------------------------------------------
-- Cette banque est volontairement variée. Le Gérant peut ensuite ajouter,
-- désactiver ou choisir ses propres questions depuis le Dashboard.
insert into public.money_drop_questions (
  category, question, option_a, option_b, option_c, option_d, correct_option
)
values
  ('Automobile', 'Quel élément transmet la puissance du moteur aux roues motrices ?', 'La transmission', 'Le radiateur', 'Le catalyseur', 'Le démarreur', 'A'),
  ('Circuit', 'Quel drapeau indique la fin officielle d’une course ?', 'Le drapeau bleu', 'Le drapeau à damier', 'Le drapeau jaune', 'Le drapeau blanc', 'B'),
  ('Nostra Motors', 'Quel document permet d’identifier officiellement un véhicule ?', 'Le carnet d’entretien', 'La carte grise', 'Le devis commercial', 'Le bon de commande', 'B'),
  ('Sécurité routière', 'Sur route mouillée, quelle action réduit le plus le risque ?', 'Réduire la distance de sécurité', 'Accélérer dans les virages', 'Augmenter la distance de sécurité', 'Freiner plus tard', 'C'),
  ('Mécanique', 'Quelle pièce recharge principalement la batterie lorsque le moteur tourne ?', 'L’alternateur', 'Le turbo', 'L’embrayage', 'Le filtre à huile', 'A'),
  ('Hypercars', 'Quel matériau est souvent utilisé pour alléger une monocoque de supercar ?', 'Le plomb', 'La fibre de carbone', 'Le cuivre', 'Le béton', 'B'),
  ('Code de la route', 'À quoi sert principalement le système ABS ?', 'Empêcher le blocage des roues au freinage', 'Augmenter la puissance moteur', 'Réduire la consommation à l’arrêt', 'Gonfler automatiquement les pneus', 'A'),
  ('Entretien automobile', 'Quel contrôle est prioritaire avant une longue sortie sur circuit ?', 'La couleur des sièges', 'La pression et l’état des pneus', 'Le volume de l’autoradio', 'La taille du coffre', 'B'),
  ('Culture générale', 'Quelle est la capitale du Portugal ?', 'Madrid', 'Lisbonne', 'Porto', 'Rome', 'B'),
  ('Culture générale', 'Quelle langue est principalement parlée au Brésil ?', 'L’espagnol', 'Le portugais', 'Le français', 'L’italien', 'B'),
  ('Culture générale', 'Quel océan est le plus vaste de la planète ?', 'L’océan Atlantique', 'L’océan Indien', 'L’océan Pacifique', 'L’océan Arctique', 'C'),
  ('Culture générale', 'Dans quelle ville se trouve la tour Eiffel ?', 'Lyon', 'Bruxelles', 'Paris', 'Genève', 'C'),
  ('Géographie', 'Quelle est la capitale du Japon ?', 'Kyoto', 'Tokyo', 'Osaka', 'Séoul', 'B'),
  ('Géographie', 'Sur quel continent se trouve le désert du Sahara ?', 'L’Asie', 'L’Amérique du Sud', 'L’Afrique', 'L’Europe', 'C'),
  ('Géographie', 'Quel est le plus long fleuve entièrement situé en France ?', 'La Seine', 'La Garonne', 'Le Rhône', 'La Loire', 'D'),
  ('Géographie', 'Dans quelle chaîne de montagnes se trouve le mont Blanc ?', 'Les Pyrénées', 'Les Alpes', 'Les Andes', 'L’Himalaya', 'B'),
  ('Histoire', 'En quelle année débute la Révolution française ?', '1492', '1789', '1815', '1914', 'B'),
  ('Histoire', 'Quel peuple de l’Antiquité a construit les pyramides de Gizeh ?', 'Les Romains', 'Les Vikings', 'Les Égyptiens', 'Les Gaulois', 'C'),
  ('Histoire', 'Qui fut le premier humain à marcher sur la Lune ?', 'Youri Gagarine', 'Buzz Aldrin', 'Neil Armstrong', 'Thomas Pesquet', 'C'),
  ('Histoire', 'Quelle ville était au cœur de l’Empire romain ?', 'Athènes', 'Rome', 'Alexandrie', 'Londres', 'B'),
  ('Sciences', 'Que représente la formule chimique H₂O ?', 'Le dioxyde de carbone', 'L’eau', 'L’oxygène', 'Le sel', 'B'),
  ('Sciences', 'Quelle planète est surnommée la planète rouge ?', 'Vénus', 'Mars', 'Saturne', 'Neptune', 'B'),
  ('Sciences', 'Quelle est la plus grande planète du Système solaire ?', 'La Terre', 'Mars', 'Jupiter', 'Uranus', 'C'),
  ('Sciences', 'Combien de cavités possède normalement le cœur humain ?', 'Deux', 'Trois', 'Quatre', 'Six', 'C'),
  ('Sciences', 'Quel phénomène permet aux plantes de produire de la matière grâce à la lumière ?', 'La fermentation', 'La photosynthèse', 'L’évaporation', 'La combustion', 'B'),
  ('Technologie', 'Dans un ordinateur, que désigne généralement le sigle CPU ?', 'La carte graphique', 'Le processeur', 'Le disque dur', 'L’écran', 'B'),
  ('Technologie', 'Quels chiffres sont utilisés dans le système binaire ?', '0 et 1', '1 et 2', '0 à 9', '2 et 3', 'A'),
  ('Technologie', 'Qui est associé à l’invention du World Wide Web ?', 'Steve Jobs', 'Bill Gates', 'Tim Berners-Lee', 'Alan Turing', 'C'),
  ('Technologie', 'À quoi sert principalement le langage HTML ?', 'Structurer le contenu d’une page web', 'Retoucher des photos', 'Réparer un ordinateur', 'Chiffrer une carte bancaire', 'A'),
  ('Sport', 'Combien de joueurs une équipe de football aligne-t-elle normalement sur le terrain ?', '9', '10', '11', '12', 'C'),
  ('Sport', 'Combien de points vaut un essai au rugby à XV ?', '3 points', '5 points', '6 points', '7 points', 'B'),
  ('Sport', 'À quelle hauteur se trouve approximativement un panier de basket officiel ?', '2,05 m', '2,55 m', '3,05 m', '3,55 m', 'C'),
  ('Sport', 'À quelle fréquence ont lieu normalement les Jeux olympiques d’été ?', 'Tous les 2 ans', 'Tous les 3 ans', 'Tous les 4 ans', 'Tous les 5 ans', 'C'),
  ('Cinéma', 'Comment s’appelle le cow-boy dans Toy Story ?', 'Buzz', 'Woody', 'Rex', 'Sully', 'B'),
  ('Cinéma', 'Qui a réalisé le film Titanic sorti en 1997 ?', 'Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott', 'C'),
  ('Cinéma', 'Comment s’appelle l’école de magie de Harry Potter ?', 'Poudlard', 'Narnia', 'Camelot', 'Nevermore', 'A'),
  ('Cinéma', 'Quel est le nom du jeune lion héros du Roi Lion ?', 'Scar', 'Mufasa', 'Simba', 'Timon', 'C'),
  ('Musique', 'Combien de touches possède généralement un piano standard ?', '64', '72', '88', '96', 'C'),
  ('Musique', 'Combien de cordes possède un violon classique ?', '4', '5', '6', '8', 'A'),
  ('Musique', 'De quel pays est originaire le groupe The Beatles ?', 'Les États-Unis', 'Le Royaume-Uni', 'L’Australie', 'Le Canada', 'B'),
  ('Musique', 'Quel appareil aide un musicien à garder un tempo régulier ?', 'Un diapason', 'Un métronome', 'Un amplificateur', 'Un égaliseur', 'B'),
  ('Cuisine', 'Quel ingrédient est la base du guacamole ?', 'La courgette', 'L’avocat', 'Le concombre', 'Le poivron', 'B'),
  ('Cuisine', 'De quel pays les sushis sont-ils originaires ?', 'La Chine', 'La Thaïlande', 'Le Japon', 'La Corée du Sud', 'C'),
  ('Cuisine', 'Quel aliment constitue la base d’un risotto traditionnel ?', 'Le riz', 'Les pâtes', 'La semoule', 'La pomme de terre', 'A'),
  ('Cuisine', 'Quel plat provençal est composé principalement de légumes mijotés ?', 'La choucroute', 'La ratatouille', 'Le cassoulet', 'La tartiflette', 'B'),
  ('Nature', 'Quel est le plus grand animal vivant connu ?', 'L’éléphant d’Afrique', 'La baleine bleue', 'Le requin-baleine', 'La girafe', 'B'),
  ('Animaux', 'Combien de pattes possède une araignée ?', '6', '8', '10', '12', 'B'),
  ('Nature', 'Quel fruit pousse sur un chêne ?', 'Une noix', 'Un gland', 'Une châtaigne', 'Une noisette', 'B'),
  ('Animaux', 'Quelle substance est produite par les abeilles à partir du nectar ?', 'Le lait', 'Le miel', 'La farine', 'Le cacao', 'B'),
  ('Calcul', 'Quel est le résultat de 12 multiplié par 12 ?', '124', '132', '144', '154', 'C'),
  ('Calcul', 'Quelle est la moitié de 250 ?', '100', '115', '125', '150', 'C'),
  ('Calcul', 'Combien font 15 % de 200 ?', '15', '20', '30', '40', 'C'),
  ('Jeux', 'Combien de faces possède un dé classique ?', '4', '6', '8', '10', 'B'),
  ('Jeux', 'Combien de cartes contient un jeu standard sans joker ?', '32', '40', '52', '64', 'C'),
  ('Littérature', 'Qui a écrit Le Petit Prince ?', 'Victor Hugo', 'Antoine de Saint-Exupéry', 'Jules Verne', 'Albert Camus', 'B'),
  ('Français', 'Quel est le pluriel du mot cheval ?', 'Chevals', 'Chevaux', 'Chevales', 'Chevaus', 'B'),
  ('Finale', 'Quel est le symbole chimique de l’or ?', 'Au', 'Ag', null, null, 'A'),
  ('Finale', 'À quelle température l’eau pure gèle-t-elle normalement ?', '0 °C', '10 °C', null, null, 'A'),
  ('Finale', 'Quelle est la capitale de l’Australie ?', 'Canberra', 'Sydney', null, null, 'A'),
  ('Finale', 'Quelle planète est la plus proche du Soleil ?', 'Mercure', 'Vénus', null, null, 'A')
on conflict do nothing;

notify pgrst, 'reload schema';

commit;
