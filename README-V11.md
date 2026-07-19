# Nostra Group V11 — Correctif réservations

Cette version corrige le calendrier des créneaux :

- les heures déjà passées sont désactivées ;
- chaque horaire indique clairement **Disponible**, **Réservé** ou **Passé** ;
- une journée indique le nombre de créneaux déjà réservés et encore disponibles ;
- une demande valide apparaît dans **Dashboard → Demandes de réservation** ;
- après validation par le gérant, le créneau apparaît immédiatement comme **Réservé** sur le calendrier ;
- les erreurs indiquent désormais précisément si le créneau est passé, déjà occupé ou si Supabase n’est pas activé.

## Si aucune demande n’arrive dans le Dashboard

Ouvrir **Dashboard → Demandes de réservation**. Si « Activation nécessaire » apparaît, copier le SQL affiché et l’exécuter dans **Supabase → SQL Editor → New query → Run query**.

Le même script se trouve dans `supabase/reservations-v11.sql`.
