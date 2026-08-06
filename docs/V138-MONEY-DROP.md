# Nostra Group V138 — Money Drop

## Installation

1. Déployer les fichiers du projet sur GitHub/Vercel.
2. Dans Supabase, ouvrir **SQL Editor → New query**.
3. Exécuter une seule fois le fichier `supabase/nostra-v138-money-drop.sql`.
4. Ouvrir `/dashboard/jeux/money-drop` avec le compte Gérant.
5. Configurer la cagnotte, les manches et le chronomètre, puis activer le jeu.

## Visibilité civile

- Désactivé dans le Dashboard : aucune carte Money Drop n’apparaît dans Nostra Motors.
- Une ouverture directe de `/motors/money-drop` renvoie vers Nostra Motors.
- Activé : la carte civile apparaît dans Nostra Motors et ouvre l’écran de jeu.

## Déroulement d’une partie

1. Le Gérant crée une équipe de 1 à 4 citoyens.
2. Il choisit une question ou lance un tirage aléatoire.
3. Il ouvre la répartition.
4. L’équipe place toute la cagnotte sur les réponses avec au moins une trappe vide.
5. Le Gérant verrouille les mises.
6. Il révèle la réponse : toutes les mauvaises trappes s’ouvrent et leur argent est perdu.
7. La cagnotte restante passe à la manche suivante.

## Sécurité

Les règles essentielles sont contrôlées dans Supabase : droits Gérant, appartenance à l’équipe, somme totale, trappe vide obligatoire, options valides, chronomètre et réponse correcte cachée avant la révélation.
