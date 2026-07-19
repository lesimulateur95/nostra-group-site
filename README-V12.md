# Nostra Group V12 — Libération et suppression des créneaux

Cette version corrige les réservations qui restaient affichées comme occupées après une annulation.

## Fonctionnement

- Seul le statut `approved` réserve réellement un créneau.
- Les statuts `pending`, `rejected` et `cancelled` libèrent automatiquement le créneau.
- Le bouton **Supprimer définitivement la demande** retire la demande et libère son créneau.
- Les calendriers actualisent leurs données automatiquement toutes les 10 secondes et quand l'utilisateur revient sur l'onglet.

## Installation

Envoyer le contenu du dossier sur le dépôt GitHub `nostra-group-site`, puis attendre le redéploiement Vercel.
Aucun nouveau SQL n'est nécessaire si le SQL Réservations V11 a déjà été exécuté.
