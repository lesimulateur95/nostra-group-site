# Nostra Group V141 — Money Drop / Refonte plateau TV

## Objectifs de la V141

Cette version corrige l'emplacement public de Money Drop, le lancement de partie bloqué en salle d'attente et refond entièrement l'écran de jeu dans un style plateau télévisé original Nostra Group.

## Emplacement public

Money Drop n'est plus présenté dans Nostra Motors.

Côté citoyen :

- `Événements & Jeux → Money Drop → Plateau de jeu`
- `Événements & Jeux → Money Drop → Inscription`
- `Événements & Jeux → Money Drop → Écran spectateur` si cette option est activée.

Quand Money Drop est désactivé depuis la régie :

- l'entrée disparaît du menu Événements & Jeux ;
- la carte disparaît de la page Jeux ;
- les URLs publiques Money Drop redirigent vers `/evenements/jeux`.

Les anciennes URLs `/motors/money-drop` et `/motors/money-drop/spectateur` ne présentent plus aucun contenu Motors et redirigent seulement vers les nouvelles URLs.

## Correction du lancement

La V141 ajoute la RPC `money_drop_start_round`.

Depuis `Dashboard → Jeux → Money Drop`, lorsque la partie est en préparation :

1. Le gérant peut charger manuellement une question ; ou
2. cliquer directement sur `LANCER LA PARTIE` / `LANCER LA MANCHE`.

Si aucune question n'est chargée, le serveur en choisit automatiquement une adaptée à la manche et à sa difficulté. Le même clic passe ensuite la partie en `question_open` et démarre le chronomètre.

Le joueur n'est donc plus bloqué sur l'état « Salle d'attente » après le lancement.

## Interface V141

- plateau sombre original Nostra Group avec éclairages de scène ;
- wordmark Money Drop ;
- cagnotte, manche, phase et chrono en bandeau de contrôle ;
- progression Préparation → Placement → Verrouillage → Révélation ;
- grandes trappes avec réponses ;
- piles de liasses virtuelles selon le montant placé ;
- ouverture animée des mauvaises trappes ;
- chute animée de l'argent perdu ;
- finale à deux trappes ;
- plein écran sur le plateau uniquement ;
- écran joueur et écran spectateur synchronisés plus rapidement ;
- jokers toujours visibles lorsque le module Jokers est activé ;
- indication claire si les jokers sont réservés à l'équipe, disponibles, utilisés ou indisponibles ;
- page d'inscription publique dédiée.

## Installation sur la V140

1. Copier les fichiers du correctif V141 dans le projet.
2. Exécuter `supabase/nostra-v141-money-drop-refonte.sql` dans Supabase → SQL Editor.
3. Déployer sur Vercel.
4. Aller dans `Dashboard → Jeux → Money Drop`.
5. Activer Money Drop.
6. Ouvrir les inscriptions si besoin.
7. Créer une équipe puis cliquer sur `LANCER LA PARTIE`.

Aucune suppression de données Money Drop n'est effectuée par cette migration. Les 200 questions classiques, les 50 questions finales, les archives et classements existants restent en place.
