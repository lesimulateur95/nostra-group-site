# Préproduction et retour arrière — Nostra Group

## Architecture recommandée

### Production

- Branche GitHub : `main`
- Vercel : environnement Production
- `NOSTRA_APP_ENV=production`
- `NOSTRA_DATA_ENV=production`
- Supabase : projet officiel contenant les vraies données

### Préproduction

- Branche GitHub : `staging`
- Vercel : environnement Preview
- `NOSTRA_APP_ENV=preproduction`
- `NOSTRA_DATA_ENV=preproduction`
- Supabase : projet de test séparé

Ne connectez jamais le site de test à la base de production.

## Création de la branche staging

1. Ouvrir le dépôt GitHub.
2. Cliquer sur le sélecteur de branche `main`.
3. Saisir `staging`.
4. Choisir `Create branch: staging from main`.

Chaque modification doit être envoyée sur `staging` avant `main`.

## Variables Vercel

Dans Vercel :

`Project > Settings > Environment Variables`

### Preview

- `NOSTRA_APP_ENV` = `preproduction`
- `NOSTRA_DATA_ENV` = `preproduction`
- `NOSTRA_RELEASE` = `preproduction`
- URL et clé du Supabase de test

### Production

- `NOSTRA_APP_ENV` = `production`
- `NOSTRA_DATA_ENV` = `production`
- `NOSTRA_RELEASE` = `production`
- URL et clé du Supabase officiel

## Vérification avant publication

1. Le déploiement staging doit être `Ready`.
2. Le bandeau `PRÉPRODUCTION — SITE DE TEST` doit être visible.
3. Ouvrir `/api/health`.
4. Vérifier :
   - `status: ok`
   - `environment: preproduction`
   - `data_environment: preproduction`
   - `environment_mismatch: false`
5. Tester les fonctions importantes.
6. Créer une Pull Request de `staging` vers `main`.
7. Fusionner uniquement si les vérifications GitHub sont vertes.

## Retour arrière Vercel

En cas de panne de production :

1. Ouvrir Vercel.
2. Ouvrir le projet Nostra Group.
3. Sur le déploiement de production, cliquer sur `Instant Rollback`.
4. Sélectionner la dernière version fonctionnelle.
5. Vérifier le site et `/api/health`.

Le retour Vercel restaure le code et le build précédent. Il ne restaure pas
automatiquement les changements de base de données.

## Retour arrière SQL

Toute migration qui supprime ou transforme des données doit être accompagnée
d’un deuxième fichier :

`rollback-nom-version.sql`

Les ajouts de colonnes ou de tables sont généralement laissés en place lors
d’un retour du code. Une suppression de données doit toujours être sauvegardée
avant exécution.
