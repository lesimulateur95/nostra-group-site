-- NOSTRA GROUP — V138.3 MONEY DROP
-- Correctif : 200 questions, 20 thèmes et tirage aléatoire par thème.
-- À exécuter après la V138 ou la V138.2.

begin;

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
  v_question_id bigint;
begin
  perform public.money_drop_require_manager();

  select q.id into v_question_id
  from public.money_drop_questions q
  where q.active
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

revoke all on function public.money_drop_select_random_question(uuid, text) from public, anon;
grant execute on function public.money_drop_select_random_question(uuid, text) to authenticated, service_role;

insert into public.money_drop_questions (
  category, question, option_a, option_b, option_c, option_d, correct_option
)
values
  ('Automobile', 'Quel élément transmet la puissance du moteur aux roues motrices ?', 'La transmission', 'Le radiateur', 'Le catalyseur', 'Le démarreur', 'A'),
  ('Automobile', 'Quel drapeau indique la fin officielle d’une course ?', 'Le drapeau bleu', 'Le drapeau à damier', 'Le drapeau jaune', 'Le drapeau blanc', 'B'),
  ('Automobile', 'Quel document permet d’identifier officiellement un véhicule ?', 'Le carnet d’entretien', 'La carte grise', 'Le devis commercial', 'Le bon de commande', 'B'),
  ('Automobile', 'Sur route mouillée, quelle action réduit le plus le risque ?', 'Réduire la distance de sécurité', 'Accélérer dans les virages', 'Augmenter la distance de sécurité', 'Freiner plus tard', 'C'),
  ('Automobile', 'Quelle pièce recharge principalement la batterie lorsque le moteur tourne ?', 'L’alternateur', 'Le turbo', 'L’embrayage', 'Le filtre à huile', 'A'),
  ('Automobile', 'Quel matériau est souvent utilisé pour alléger une monocoque de supercar ?', 'Le plomb', 'La fibre de carbone', 'Le cuivre', 'Le béton', 'B'),
  ('Automobile', 'À quoi sert principalement le système ABS ?', 'Empêcher le blocage des roues au freinage', 'Augmenter la puissance moteur', 'Réduire la consommation à l’arrêt', 'Gonfler automatiquement les pneus', 'A'),
  ('Automobile', 'Quel contrôle est prioritaire avant une longue sortie sur circuit ?', 'La couleur des sièges', 'La pression et l’état des pneus', 'Le volume de l’autoradio', 'La taille du coffre', 'B'),
  ('Automobile', 'Quel liquide transmet la pression dans un système de freinage hydraulique ?', 'Le liquide de refroidissement', 'Le liquide de frein', 'L’huile moteur', 'Le carburant', 'B'),
  ('Automobile', 'Quel élément utilise les gaz d’échappement pour comprimer l’air admis ?', 'Le turbocompresseur', 'Le démarreur', 'Le différentiel', 'Le thermostat', 'A'),
  ('Culture générale', 'Quelle est la capitale du Portugal ?', 'Madrid', 'Lisbonne', 'Porto', 'Rome', 'B'),
  ('Culture générale', 'Quelle langue est principalement parlée au Brésil ?', 'L’espagnol', 'Le portugais', 'Le français', 'L’italien', 'B'),
  ('Culture générale', 'Quel océan est le plus vaste de la planète ?', 'L’océan Atlantique', 'L’océan Indien', 'L’océan Pacifique', 'L’océan Arctique', 'C'),
  ('Culture générale', 'Dans quelle ville se trouve la tour Eiffel ?', 'Lyon', 'Bruxelles', 'Paris', 'Genève', 'C'),
  ('Culture générale', 'Quel est le plus grand continent par sa superficie ?', 'L’Afrique', 'L’Asie', 'L’Europe', 'L’Amérique du Sud', 'B'),
  ('Culture générale', 'Combien de jours compte une année bissextile ?', '364', '365', '366', '367', 'C'),
  ('Culture générale', 'Quelle couleur obtient-on en mélangeant du bleu et du jaune ?', 'Orange', 'Vert', 'Violet', 'Rouge', 'B'),
  ('Culture générale', 'Quelle valeur représente le chiffre romain X ?', '5', '10', '50', '100', 'B'),
  ('Culture générale', 'Combien de jours compte une semaine ?', '5', '6', '7', '8', 'C'),
  ('Culture générale', 'Quel instrument sert à mesurer la température ?', 'Un baromètre', 'Un thermomètre', 'Un altimètre', 'Un chronomètre', 'B'),
  ('Géographie', 'Quelle est la capitale du Japon ?', 'Kyoto', 'Tokyo', 'Osaka', 'Séoul', 'B'),
  ('Géographie', 'Sur quel continent se trouve le désert du Sahara ?', 'L’Asie', 'L’Amérique du Sud', 'L’Afrique', 'L’Europe', 'C'),
  ('Géographie', 'Quel est le plus long fleuve entièrement situé en France ?', 'La Seine', 'La Garonne', 'Le Rhône', 'La Loire', 'D'),
  ('Géographie', 'Dans quelle chaîne de montagnes se trouve le mont Blanc ?', 'Les Pyrénées', 'Les Alpes', 'Les Andes', 'L’Himalaya', 'B'),
  ('Géographie', 'Quelle est la capitale de l’Australie ?', 'Canberra', 'Sydney', 'Melbourne', 'Perth', 'A'),
  ('Géographie', 'Quel est le plus vaste pays du monde par sa superficie ?', 'Le Canada', 'La Chine', 'La Russie', 'Les États-Unis', 'C'),
  ('Géographie', 'Quelle est la capitale du Canada ?', 'Toronto', 'Vancouver', 'Ottawa', 'Montréal', 'C'),
  ('Géographie', 'Sur quel continent se trouve la cordillère des Andes ?', 'L’Amérique du Sud', 'L’Asie', 'L’Afrique', 'L’Europe', 'A'),
  ('Géographie', 'Quelle mer se situe au sud de l’Europe ?', 'La mer Baltique', 'La mer Méditerranée', 'La mer du Nord', 'La mer de Béring', 'B'),
  ('Géographie', 'Dans quelle mer le Nil se jette-t-il ?', 'La mer Rouge', 'La mer Noire', 'La mer Méditerranée', 'La mer Caspienne', 'C'),
  ('Histoire', 'En quelle année débute la Révolution française ?', '1492', '1789', '1815', '1914', 'B'),
  ('Histoire', 'Quel peuple de l’Antiquité a construit les pyramides de Gizeh ?', 'Les Romains', 'Les Vikings', 'Les Égyptiens', 'Les Gaulois', 'C'),
  ('Histoire', 'Qui fut le premier humain à marcher sur la Lune ?', 'Youri Gagarine', 'Buzz Aldrin', 'Neil Armstrong', 'Thomas Pesquet', 'C'),
  ('Histoire', 'Quelle ville était au cœur de l’Empire romain ?', 'Athènes', 'Rome', 'Alexandrie', 'Londres', 'B'),
  ('Histoire', 'En quelle année le mur de Berlin est-il tombé ?', '1961', '1975', '1989', '1999', 'C'),
  ('Histoire', 'À quel conflit Jeanne d’Arc est-elle principalement associée ?', 'La guerre de Cent Ans', 'Les guerres napoléoniennes', 'La guerre de Trente Ans', 'La guerre de Crimée', 'A'),
  ('Histoire', 'En quelle année Christophe Colomb atteint-il les Amériques ?', '1066', '1492', '1515', '1789', 'B'),
  ('Histoire', 'En quelle année commence la Première Guerre mondiale ?', '1870', '1914', '1939', '1945', 'B'),
  ('Histoire', 'Qui est généralement associé à l’invention de l’imprimerie à caractères mobiles en Europe ?', 'Galilée', 'Gutenberg', 'Newton', 'Pasteur', 'B'),
  ('Histoire', 'Quel roi de France était surnommé le Roi-Soleil ?', 'Louis IX', 'Louis XIII', 'Louis XIV', 'Louis XVI', 'C'),
  ('Sciences', 'Que représente la formule chimique H₂O ?', 'Le dioxyde de carbone', 'L’eau', 'L’oxygène', 'Le sel', 'B'),
  ('Sciences', 'Combien de cavités possède normalement le cœur humain ?', 'Deux', 'Trois', 'Quatre', 'Six', 'C'),
  ('Sciences', 'Quel est le symbole chimique de l’or ?', 'Au', 'Ag', 'Or', 'Fe', 'A'),
  ('Sciences', 'À quelle température l’eau pure gèle-t-elle normalement ?', '0 °C', '10 °C', '-10 °C', '100 °C', 'A'),
  ('Sciences', 'Quel gaz est le plus abondant dans l’atmosphère terrestre ?', 'L’oxygène', 'L’azote', 'Le dioxyde de carbone', 'L’hydrogène', 'B'),
  ('Sciences', 'Quelle force attire les objets vers le sol ?', 'Le magnétisme', 'La gravité', 'La poussée', 'La friction', 'B'),
  ('Sciences', 'Quelle est l’unité de l’intensité électrique ?', 'Le volt', 'Le watt', 'L’ampère', 'L’ohm', 'C'),
  ('Sciences', 'Quel pH correspond à une solution neutre ?', '0', '5', '7', '14', 'C'),
  ('Sciences', 'Combien d’os compte généralement le squelette humain adulte ?', '106', '206', '306', '406', 'B'),
  ('Sciences', 'Quel organe filtre principalement le sang pour produire l’urine ?', 'Le poumon', 'Le rein', 'L’estomac', 'Le pancréas', 'B'),
  ('Espace', 'Quelle planète est surnommée la planète rouge ?', 'Vénus', 'Mars', 'Saturne', 'Neptune', 'B'),
  ('Espace', 'Quelle est la plus grande planète du Système solaire ?', 'La Terre', 'Mars', 'Jupiter', 'Uranus', 'C'),
  ('Espace', 'Quelle planète est la plus proche du Soleil ?', 'Mercure', 'Vénus', 'La Terre', 'Mars', 'A'),
  ('Espace', 'Quel est le satellite naturel de la Terre ?', 'Phobos', 'La Lune', 'Europe', 'Titan', 'B'),
  ('Espace', 'Dans quelle galaxie se trouve le Système solaire ?', 'Andromède', 'La Voie lactée', 'Le Grand Nuage de Magellan', 'La galaxie du Sombrero', 'B'),
  ('Espace', 'Qui fut le premier humain envoyé dans l’espace ?', 'Neil Armstrong', 'Youri Gagarine', 'John Glenn', 'Buzz Aldrin', 'B'),
  ('Espace', 'Quelle planète est célèbre pour ses anneaux très visibles ?', 'Mercure', 'Mars', 'Saturne', 'Vénus', 'C'),
  ('Espace', 'Quelle étoile est la plus proche de la Terre ?', 'Sirius', 'Le Soleil', 'Véga', 'Bételgeuse', 'B'),
  ('Espace', 'Quel instrument permet d’observer les astres lointains ?', 'Un microscope', 'Un télescope', 'Un sismographe', 'Un hygromètre', 'B'),
  ('Espace', 'Qu’est-ce que le Soleil ?', 'Une planète', 'Une étoile', 'Un satellite', 'Une comète', 'B'),
  ('Technologie', 'Dans un ordinateur, que désigne généralement le sigle CPU ?', 'La carte graphique', 'Le processeur', 'Le disque dur', 'L’écran', 'B'),
  ('Technologie', 'Quels chiffres sont utilisés dans le système binaire ?', '0 et 1', '1 et 2', '0 à 9', '2 et 3', 'A'),
  ('Technologie', 'Qui est associé à l’invention du World Wide Web ?', 'Steve Jobs', 'Bill Gates', 'Tim Berners-Lee', 'Alan Turing', 'C'),
  ('Technologie', 'À quoi sert principalement le langage HTML ?', 'Structurer le contenu d’une page web', 'Retoucher des photos', 'Réparer un ordinateur', 'Chiffrer une carte bancaire', 'A'),
  ('Technologie', 'À quoi sert principalement la mémoire RAM ?', 'Stocker temporairement les données utilisées', 'Imprimer des documents', 'Refroidir le processeur', 'Alimenter l’écran', 'A'),
  ('Technologie', 'Que signifie le S dans HTTPS ?', 'Simple', 'Secure', 'System', 'Static', 'B'),
  ('Technologie', 'Que représente une URL ?', 'L’adresse d’une ressource sur Internet', 'Un type de batterie', 'Un format audio', 'Une carte graphique', 'A'),
  ('Technologie', 'Quel type de code est un QR code ?', 'Un code sonore', 'Un code-barres en deux dimensions', 'Un mot de passe vocal', 'Un fichier vidéo', 'B'),
  ('Technologie', 'Lequel de ces noms désigne un système d’exploitation ?', 'Linux', 'Bluetooth', 'HDMI', 'JPEG', 'A'),
  ('Technologie', 'Quel raccourci clavier sert généralement à copier sur Windows ?', 'Ctrl + V', 'Ctrl + C', 'Ctrl + Z', 'Ctrl + P', 'B'),
  ('Sport', 'Combien de joueurs une équipe de football aligne-t-elle normalement sur le terrain ?', '9', '10', '11', '12', 'C'),
  ('Sport', 'Combien de points vaut un essai au rugby à XV ?', '3 points', '5 points', '6 points', '7 points', 'B'),
  ('Sport', 'À quelle hauteur se trouve approximativement un panier de basket officiel ?', '2,05 m', '2,55 m', '3,05 m', '3,55 m', 'C'),
  ('Sport', 'À quelle fréquence ont lieu normalement les Jeux olympiques d’été ?', 'Tous les 2 ans', 'Tous les 3 ans', 'Tous les 4 ans', 'Tous les 5 ans', 'C'),
  ('Sport', 'Quelle suite de points est utilisée au tennis avant l’avantage ?', '10, 20, 30', '15, 30, 40', '20, 40, 60', '25, 50, 75', 'B'),
  ('Sport', 'Quelle est la distance officielle d’un marathon ?', '21,097 km', '40 km', '42,195 km', '50 km', 'C'),
  ('Sport', 'Combien de joueurs une équipe de volley-ball aligne-t-elle sur le terrain ?', '5', '6', '7', '8', 'B'),
  ('Sport', 'Dans quel espace se déroule un combat de boxe ?', 'Un court', 'Un ring', 'Une piste', 'Un tatami uniquement', 'B'),
  ('Sport', 'Combien de nages différentes composent le quatre nages ?', '2', '3', '4', '5', 'C'),
  ('Sport', 'Le Tour de France est une compétition de quel sport ?', 'Cyclisme', 'Athlétisme', 'Natation', 'Ski', 'A'),
  ('Football', 'À quelle distance du but se trouve le point de penalty ?', '9 mètres', '10 mètres', '11 mètres', '12 mètres', 'C'),
  ('Football', 'Que provoque normalement un carton rouge ?', 'Un simple avertissement', 'L’exclusion du joueur', 'Un remplacement obligatoire', 'La fin du match', 'B'),
  ('Football', 'Dans quelle zone le gardien peut-il normalement toucher le ballon avec les mains ?', 'Dans tout le terrain', 'Dans sa surface de réparation', 'Seulement dans le rond central', 'Uniquement sur corner', 'B'),
  ('Football', 'Quelle est la durée réglementaire d’un match sans prolongation ?', '60 minutes', '80 minutes', '90 minutes', '100 minutes', 'C'),
  ('Football', 'Comment appelle-t-on trois buts marqués par le même joueur dans un match ?', 'Un doublé', 'Un triplé', 'Un hat-trick', 'Un clean sheet', 'C'),
  ('Football', 'Quel coup de pied est accordé lorsque le ballon sort derrière le but après avoir été touché en dernier par un défenseur ?', 'Un coup franc', 'Un corner', 'Une touche', 'Un penalty automatique', 'B'),
  ('Football', 'Que représente généralement un carton jaune ?', 'Un avertissement', 'Une expulsion définitive', 'Un but annulé', 'Une prolongation', 'A'),
  ('Football', 'À quelle fréquence se déroule normalement la Coupe du monde masculine ?', 'Tous les 2 ans', 'Tous les 3 ans', 'Tous les 4 ans', 'Tous les 6 ans', 'C'),
  ('Football', 'Comment s’appelle la barre horizontale située au-dessus du but ?', 'Le poteau', 'La transversale', 'La ligne de touche', 'Le filet', 'B'),
  ('Football', 'Quelle partie du corps un joueur de champ ne peut-il pas utiliser volontairement ?', 'La tête', 'Le torse', 'Le pied', 'La main', 'D'),
  ('Cinéma & séries', 'Comment s’appelle le cow-boy dans Toy Story ?', 'Buzz', 'Woody', 'Rex', 'Sully', 'B'),
  ('Cinéma & séries', 'Qui a réalisé le film Titanic sorti en 1997 ?', 'Steven Spielberg', 'Christopher Nolan', 'James Cameron', 'Ridley Scott', 'C'),
  ('Cinéma & séries', 'Comment s’appelle l’école de magie de Harry Potter ?', 'Poudlard', 'Narnia', 'Camelot', 'Nevermore', 'A'),
  ('Cinéma & séries', 'Quel est le nom du jeune lion héros du Roi Lion ?', 'Scar', 'Mufasa', 'Simba', 'Timon', 'C'),
  ('Cinéma & séries', 'Dans quelle saga apparaît Dark Vador ?', 'Star Trek', 'Star Wars', 'Le Seigneur des anneaux', 'Indiana Jones', 'B'),
  ('Cinéma & séries', 'Comment s’appellent les deux sœurs principales de La Reine des neiges ?', 'Anna et Elsa', 'Ariel et Jasmine', 'Belle et Aurore', 'Mulan et Mérida', 'A'),
  ('Cinéma & séries', 'Quels animaux sont au centre de Jurassic Park ?', 'Des dragons', 'Des dinosaures', 'Des requins', 'Des robots', 'B'),
  ('Cinéma & séries', 'Comment s’appelle le héros principal de Matrix ?', 'Neo', 'Morpheus', 'Trinity', 'Smith', 'A'),
  ('Cinéma & séries', 'Comment s’appelle le café fréquenté dans la série Friends ?', 'Central Perk', 'Monk’s Café', 'Luke’s Diner', 'The Max', 'A'),
  ('Cinéma & séries', 'Dans quelle ville fictive se déroule principalement Stranger Things ?', 'Sunnydale', 'Hawkins', 'Springfield', 'Gotham', 'B'),
  ('Musique', 'Combien de touches possède généralement un piano standard ?', '64', '72', '88', '96', 'C'),
  ('Musique', 'Combien de cordes possède un violon classique ?', '4', '5', '6', '8', 'A'),
  ('Musique', 'De quel pays est originaire le groupe The Beatles ?', 'Les États-Unis', 'Le Royaume-Uni', 'L’Australie', 'Le Canada', 'B'),
  ('Musique', 'Quel appareil aide un musicien à garder un tempo régulier ?', 'Un diapason', 'Un métronome', 'Un amplificateur', 'Un égaliseur', 'B'),
  ('Musique', 'Quelle clé est couramment utilisée pour les notes aiguës ?', 'La clé de sol', 'La clé de fa', 'La clé d’ut quatrième', 'La clé de percussion', 'A'),
  ('Musique', 'Quel instrument possède généralement six cordes ?', 'La guitare', 'Le violon', 'La trompette', 'La flûte', 'A'),
  ('Musique', 'De quel pays Mozart était-il originaire ?', 'Autriche', 'Italie', 'France', 'Espagne', 'A'),
  ('Musique', 'Que désigne le tempo en musique ?', 'La vitesse d’exécution', 'Le volume sonore', 'La hauteur d’une note', 'Le nombre d’instruments', 'A'),
  ('Musique', 'Qui dirige habituellement un orchestre ?', 'Le soliste', 'Le chef d’orchestre', 'Le luthier', 'Le choriste', 'B'),
  ('Musique', 'À quelle famille appartient le saxophone ?', 'Les cordes', 'Les bois', 'Les percussions', 'Les claviers', 'B'),
  ('Cuisine', 'Quel ingrédient est la base du guacamole ?', 'La courgette', 'L’avocat', 'Le concombre', 'Le poivron', 'B'),
  ('Cuisine', 'De quel pays les sushis sont-ils originaires ?', 'La Chine', 'La Thaïlande', 'Le Japon', 'La Corée du Sud', 'C'),
  ('Cuisine', 'Quel aliment constitue la base d’un risotto traditionnel ?', 'Le riz', 'Les pâtes', 'La semoule', 'La pomme de terre', 'A'),
  ('Cuisine', 'Quel plat provençal est composé principalement de légumes mijotés ?', 'La choucroute', 'La ratatouille', 'Le cassoulet', 'La tartiflette', 'B'),
  ('Cuisine', 'Quel ingrédient est à la base du houmous ?', 'Les pois chiches', 'Les lentilles', 'Les haricots rouges', 'Le maïs', 'A'),
  ('Cuisine', 'Quels ingrédients forment principalement une mayonnaise classique ?', 'Huile et jaune d’œuf', 'Lait et farine', 'Eau et sucre', 'Tomate et vinaigre', 'A'),
  ('Cuisine', 'À quelle famille appartient le croissant ?', 'Les viennoiseries', 'Les charcuteries', 'Les confiseries', 'Les potages', 'A'),
  ('Cuisine', 'De quel pays la paella est-elle originaire ?', 'Italie', 'Espagne', 'Grèce', 'Portugal', 'B'),
  ('Cuisine', 'À partir de quelle plante fabrique-t-on principalement le tofu ?', 'Le soja', 'Le blé', 'Le riz', 'Le pois', 'A'),
  ('Cuisine', 'Quel ingrédient chauffe-t-on pour obtenir du caramel ?', 'Le sel', 'Le sucre', 'La farine', 'Le beurre seul', 'B'),
  ('Nature', 'Quel fruit pousse sur un chêne ?', 'Une noix', 'Un gland', 'Une châtaigne', 'Une noisette', 'B'),
  ('Nature', 'Quel phénomène permet aux plantes de produire de la matière grâce à la lumière ?', 'La fermentation', 'La photosynthèse', 'L’évaporation', 'La combustion', 'B'),
  ('Nature', 'Quel phénomène transforme l’eau liquide en vapeur ?', 'La condensation', 'L’évaporation', 'La solidification', 'La fusion', 'B'),
  ('Nature', 'Comment appelle-t-on une roche formée par le refroidissement du magma ?', 'Une roche magmatique', 'Une roche sédimentaire uniquement', 'Une roche organique', 'Une roche artificielle', 'A'),
  ('Nature', 'Que permettent souvent d’estimer les cernes d’un tronc d’arbre ?', 'Son âge', 'Sa hauteur exacte', 'Le nombre de feuilles', 'La profondeur de ses racines', 'A'),
  ('Nature', 'Quels organismes construisent principalement les récifs coralliens ?', 'Des poissons', 'Des coraux', 'Des algues uniquement', 'Des coquillages uniquement', 'B'),
  ('Nature', 'Laquelle de ces sources d’énergie est renouvelable ?', 'Le charbon', 'Le pétrole', 'Le solaire', 'Le gaz naturel', 'C'),
  ('Nature', 'Quelle saison vient juste après le printemps ?', 'L’automne', 'L’été', 'L’hiver', 'La mousson', 'B'),
  ('Nature', 'Quel déchet convient généralement au compostage ?', 'Une peau de banane', 'Une pile électrique', 'Une bouteille en verre', 'Une canette en aluminium', 'A'),
  ('Nature', 'Comment appelle-t-on l’eau qui tombe des nuages sous forme liquide ?', 'La rosée', 'La pluie', 'Le brouillard', 'La vapeur', 'B'),
  ('Animaux', 'Quel est le plus grand animal vivant connu ?', 'L’éléphant d’Afrique', 'La baleine bleue', 'Le requin-baleine', 'La girafe', 'B'),
  ('Animaux', 'Combien de pattes possède une araignée ?', '6', '8', '10', '12', 'B'),
  ('Animaux', 'Quelle substance est produite par les abeilles à partir du nectar ?', 'Le lait', 'Le miel', 'La farine', 'Le cacao', 'B'),
  ('Animaux', 'Quel mammifère pond des œufs ?', 'Le dauphin', 'L’ornithorynque', 'Le cheval', 'Le lion', 'B'),
  ('Animaux', 'Quel est l’animal terrestre le plus rapide ?', 'Le guépard', 'Le lion', 'L’antilope', 'Le cheval', 'A'),
  ('Animaux', 'Quel est le plus grand animal terrestre actuel ?', 'Le rhinocéros blanc', 'L’éléphant d’Afrique', 'La girafe', 'L’hippopotame', 'B'),
  ('Animaux', 'À quelle classe appartient la grenouille ?', 'Les reptiles', 'Les amphibiens', 'Les mammifères', 'Les oiseaux', 'B'),
  ('Animaux', 'Combien de bras possède une pieuvre ?', '6', '8', '10', '12', 'B'),
  ('Animaux', 'Le manchot appartient à quelle classe animale ?', 'Les poissons', 'Les oiseaux', 'Les mammifères', 'Les reptiles', 'B'),
  ('Animaux', 'Quel mammifère est capable de vol actif ?', 'L’écureuil', 'La chauve-souris', 'Le lémurien', 'Le koala', 'B'),
  ('Logique & maths', 'Quel est le résultat de 12 multiplié par 12 ?', '124', '132', '144', '154', 'C'),
  ('Logique & maths', 'Quelle est la moitié de 250 ?', '100', '115', '125', '150', 'C'),
  ('Logique & maths', 'Combien font 15 % de 200 ?', '15', '20', '30', '40', 'C'),
  ('Logique & maths', 'Combien font 3 + 4 × 2 en respectant les priorités ?', '11', '14', '10', '16', 'A'),
  ('Logique & maths', 'Quel est le périmètre d’un carré de 5 cm de côté ?', '10 cm', '20 cm', '25 cm', '30 cm', 'B'),
  ('Logique & maths', 'Quelle est la somme des angles d’un triangle ?', '90°', '180°', '270°', '360°', 'B'),
  ('Logique & maths', 'Combien font 1 000 divisé par 8 ?', '100', '120', '125', '150', 'C'),
  ('Logique & maths', 'Quel nombre complète la suite 2, 4, 8, 16, ... ?', '18', '24', '30', '32', 'D'),
  ('Logique & maths', 'À quel pourcentage correspondent trois quarts ?', '25 %', '50 %', '75 %', '80 %', 'C'),
  ('Logique & maths', 'Lequel de ces nombres est premier ?', '21', '29', '35', '39', 'B'),
  ('Jeux de société', 'Combien de faces possède un dé classique ?', '4', '6', '8', '10', 'B'),
  ('Jeux de société', 'Combien de cartes contient un jeu standard sans joker ?', '32', '40', '52', '64', 'C'),
  ('Jeux de société', 'Combien de pièces chaque joueur possède-t-il au début d’une partie d’échecs ?', '8', '12', '16', '20', 'C'),
  ('Jeux de société', 'Comment se termine une partie d’échecs lorsque le roi ne peut plus échapper à une attaque ?', 'Par un roque', 'Par un échec et mat', 'Par une promotion', 'Par une prise en passant', 'B'),
  ('Jeux de société', 'Dans quel jeu peut-on acheter des rues et construire des hôtels ?', 'Monopoly', 'Cluedo', 'Scrabble', 'Risk', 'A'),
  ('Jeux de société', 'Dans quel jeu forme-t-on des mots avec des lettres sur un plateau ?', 'Uno', 'Scrabble', 'Puissance 4', 'Bataille navale', 'B'),
  ('Jeux de société', 'Combien de dominos contient un jeu traditionnel double-six ?', '21', '24', '28', '36', 'C'),
  ('Jeux de société', 'Quelle carte d’Uno change le sens du jeu ?', 'La carte Inversion', 'La carte +2 uniquement', 'La carte 0', 'La carte 7', 'A'),
  ('Jeux de société', 'Comment se déplacent généralement les pions aux dames ?', 'En diagonale', 'En ligne droite seulement', 'Comme un cavalier', 'Sans règle', 'A'),
  ('Jeux de société', 'Au poker, qu’est-ce qu’une couleur ?', 'Cinq cartes de la même enseigne', 'Cinq cartes consécutives seulement', 'Quatre cartes identiques', 'Deux paires', 'A'),
  ('Jeux vidéo', 'Comment s’appelle le frère de Mario ?', 'Wario', 'Luigi', 'Toad', 'Yoshi', 'B'),
  ('Jeux vidéo', 'Quel jeu est célèbre pour son monde construit avec des blocs ?', 'Minecraft', 'Rocket League', 'FIFA', 'Gran Turismo', 'A'),
  ('Jeux vidéo', 'Comment s’appelle la ville principale de GTA V ?', 'Liberty City', 'Vice City', 'Los Santos', 'San Fierro', 'C'),
  ('Jeux vidéo', 'À quel genre appartient principalement Fortnite Battle Royale ?', 'Jeu de course', 'Battle royale', 'Jeu de gestion', 'Jeu de rythme', 'B'),
  ('Jeux vidéo', 'Quelle entreprise fabrique les consoles PlayStation ?', 'Nintendo', 'Sony', 'Microsoft', 'Sega', 'B'),
  ('Jeux vidéo', 'Quelle entreprise fabrique les consoles Xbox ?', 'Microsoft', 'Sony', 'Nintendo', 'Atari', 'A'),
  ('Jeux vidéo', 'Comment s’appelle le héros principal de The Legend of Zelda ?', 'Zelda', 'Link', 'Ganondorf', 'Epona', 'B'),
  ('Jeux vidéo', 'Quel type de Pokémon est Pikachu ?', 'Feu', 'Eau', 'Électrik', 'Plante', 'C'),
  ('Jeux vidéo', 'Comment appelle-t-on les formes composées de quatre blocs dans Tetris ?', 'Des pentominos', 'Des tétriminos', 'Des dominos', 'Des hexagones', 'B'),
  ('Jeux vidéo', 'Quel personnage jaune mange des gommes dans un labyrinthe ?', 'Sonic', 'Pac-Man', 'Kirby', 'Mega Man', 'B'),
  ('Littérature & français', 'Qui a écrit Le Petit Prince ?', 'Victor Hugo', 'Antoine de Saint-Exupéry', 'Jules Verne', 'Albert Camus', 'B'),
  ('Littérature & français', 'Quel est le pluriel du mot cheval ?', 'Chevals', 'Chevaux', 'Chevales', 'Chevaus', 'B'),
  ('Littérature & français', 'Qui a écrit Les Misérables ?', 'Émile Zola', 'Victor Hugo', 'Molière', 'Marcel Proust', 'B'),
  ('Littérature & français', 'Qui a écrit Les Trois Mousquetaires ?', 'Alexandre Dumas', 'Jules Verne', 'Gustave Flaubert', 'Honoré de Balzac', 'A'),
  ('Littérature & français', 'Quel mot est un synonyme de rapide ?', 'Lent', 'Vif', 'Lourd', 'Calme', 'B'),
  ('Littérature & français', 'Quel est le rôle principal d’un adjectif qualificatif ?', 'Qualifier un nom', 'Remplacer un verbe', 'Indiquer une ponctuation', 'Former un nombre', 'A'),
  ('Littérature & français', 'Quel est l’infinitif de « nous faisons » ?', 'Faire', 'Faisir', 'Faisonner', 'Fait', 'A'),
  ('Littérature & français', 'Quel est le féminin du mot acteur ?', 'Acteuse', 'Actrice', 'Acteure', 'Acteuresse', 'B'),
  ('Littérature & français', 'Quel est l’antonyme du mot chaud ?', 'Tiède', 'Froid', 'Brûlant', 'Sec', 'B'),
  ('Littérature & français', 'Combien de lettres compte l’alphabet français moderne ?', '24', '25', '26', '27', 'C'),
  ('Mythologie', 'Qui est le roi des dieux dans la mythologie grecque ?', 'Apollon', 'Zeus', 'Hermès', 'Arès', 'B'),
  ('Mythologie', 'Quel dieu grec règne sur la mer ?', 'Hadès', 'Poséidon', 'Héphaïstos', 'Dionysos', 'B'),
  ('Mythologie', 'Quel dieu grec règne sur le monde souterrain ?', 'Hadès', 'Zeus', 'Pan', 'Éros', 'A'),
  ('Mythologie', 'Comment s’appelle le marteau de Thor ?', 'Excalibur', 'Mjöllnir', 'Gungnir', 'Gram', 'B'),
  ('Mythologie', 'Qui est le dieu principal de la mythologie nordique ?', 'Loki', 'Odin', 'Baldr', 'Týr', 'B'),
  ('Mythologie', 'Quelle créature mi-homme mi-taureau vivait dans un labyrinthe ?', 'Le Cyclope', 'Le Minotaure', 'Le Centaure', 'Le Sphinx', 'B'),
  ('Mythologie', 'Quel héros grec possède un célèbre point faible au talon ?', 'Héraclès', 'Achille', 'Persée', 'Ulysse', 'B'),
  ('Mythologie', 'Quel dieu égyptien est représenté avec une tête de chacal ?', 'Râ', 'Anubis', 'Horus', 'Thot', 'B'),
  ('Mythologie', 'Quel animal est Pégase ?', 'Un cheval ailé', 'Un lion ailé', 'Un serpent géant', 'Un taureau de feu', 'A'),
  ('Mythologie', 'Quelle déesse grecque est associée à la sagesse ?', 'Aphrodite', 'Athéna', 'Héra', 'Artémis', 'B'),
  ('France & patrimoine', 'Quelle est la capitale de la France ?', 'Lyon', 'Paris', 'Marseille', 'Bordeaux', 'B'),
  ('France & patrimoine', 'Quelle est la devise de la République française ?', 'Honneur et Patrie', 'Liberté, Égalité, Fraternité', 'Unité et Travail', 'Ordre et Progrès', 'B'),
  ('France & patrimoine', 'À quelle date est célébrée la fête nationale française ?', 'Le 1er mai', 'Le 8 mai', 'Le 14 juillet', 'Le 11 novembre', 'C'),
  ('France & patrimoine', 'Quel fleuve traverse Paris ?', 'La Loire', 'La Seine', 'Le Rhône', 'La Garonne', 'B'),
  ('France & patrimoine', 'Dans quelle région se trouve le Mont-Saint-Michel ?', 'Normandie', 'Bretagne administrative', 'Provence-Alpes-Côte d’Azur', 'Grand Est', 'A'),
  ('France & patrimoine', 'Pour quelle exposition la tour Eiffel a-t-elle été construite ?', 'L’Exposition universelle de 1889', 'L’Exposition coloniale de 1931', 'Les Jeux olympiques de 1900', 'L’Exposition universelle de 1900', 'A'),
  ('France & patrimoine', 'Quel célèbre musée parisien abrite la Joconde ?', 'Le musée d’Orsay', 'Le Louvre', 'Le Centre Pompidou', 'Le musée Rodin', 'B'),
  ('France & patrimoine', 'De quelle région le camembert est-il originaire ?', 'Normandie', 'Alsace', 'Bourgogne', 'Corse', 'A'),
  ('France & patrimoine', 'Quelle grande ville française est située sur la Méditerranée ?', 'Lille', 'Marseille', 'Rennes', 'Orléans', 'B'),
  ('France & patrimoine', 'Quel numéro porte le département de la Vendée ?', '75', '85', '95', '44', 'B')
on conflict (lower(trim(question))) do update set
  category = excluded.category,
  option_a = excluded.option_a,
  option_b = excluded.option_b,
  option_c = excluded.option_c,
  option_d = excluded.option_d,
  correct_option = excluded.correct_option,
  active = true;

notify pgrst, 'reload schema';
commit;
