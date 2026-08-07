# Nostra Group V144 — Suppression de compte citoyen

## Objectif

La V144 ajoute une suppression de compte accessible directement par le citoyen depuis son profil.

## Accès

Profil → Paramètres du compte → Supprimer mon compte

URL : `/profil/compte`

## Sécurité de confirmation

La suppression n'est possible que si le citoyen :

1. coche la confirmation indiquant qu'il comprend que l'action est définitive ;
2. saisit exactement `SUPPRIMER MON COMPTE`.

La vérification est faite côté interface **et côté serveur**.

## Ce qui se passe lors de la suppression

- le compte Supabase Auth est désactivé définitivement via la suppression douce Admin ;
- la session est fermée ;
- le profil `member_profiles` est supprimé ;
- les licences officielles liées au compte sont retirées ;
- le parcours Academy actif est retiré ;
- favoris, notifications, badges, fidélité et paniers sont nettoyés ;
- les inscriptions en attente ciblées par le module sont supprimées ;
- l'utilisateur est redirigé vers `/compte-supprime`.

La suppression douce de l'utilisateur Auth conserve son UUID uniquement afin que les anciennes écritures comptables, commandes, factures ou contrats puissent rester cohérents techniquement sans profil citoyen actif.

## Installation

Aucun SQL n'est nécessaire.

Copier les fichiers du correctif dans le projet V143 puis redéployer Vercel.

La variable serveur `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` doit déjà être configurée. Le projet l'utilise déjà pour les fonctions administratives Steam/Supabase.

## Fichiers V144

- `app/actions/account.ts`
- `app/(protected)/profil/compte/page.tsx`
- `app/(protected)/profil/compte/page.module.css`
- `app/compte-supprime/page.tsx`
- `app/compte-supprime/page.module.css`
- `components/profile/delete-account-form.tsx`
- `components/profile/profile-navigation.tsx`
- `lib/supabase/proxy.ts`
