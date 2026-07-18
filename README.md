# Nostra Group — Dashboard V4

Cette version réorganise complètement le Dashboard Gérant.

## Modules du dashboard

- Modification des pages du Nostra Circuit
- État du circuit affiché en direct sur toutes les pages Circuit
- Demandes d’homologation des véhicules et des écuries
- Gestion privée des stocks
- Comptabilité : recettes, dépenses et solde
- Création et publication des événements

## Espace profil

Chaque membre retrouve :

- son identité RP ;
- ses commandes ;
- son statut de fidélité ;
- son panier ;
- ses factures.

## Activation Supabase

Après le premier déploiement de cette version :

1. Connectez-vous avec le compte Gérant.
2. Ouvrez `/dashboard`.
3. Dans **Activer les nouveaux modules**, copiez tout le code SQL.
4. Dans Supabase : **SQL Editor → New query**.
5. Collez le code et cliquez sur **Run query**.
6. Revenez sur le dashboard et faites `Ctrl + F5`.

Le même script est fourni dans `supabase/nostra-backoffice.sql`.

Le script conserve la table `site_pages` et les contenus déjà publiés.
