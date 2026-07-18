# Nostra Group

Base du site Nostra Group pour **Universe Life — Saint-Martin V2**.

## Ce qui est déjà créé

- Page de connexion minimaliste avec les logos Universe Life et Nostra Group.
- Connexion Discord avec Supabase.
- Pages protégées : aucun accès sans connexion.
- Accueil avec trois grandes entrées :
  - Nostra Motors
  - Nostra Circuit
  - Événements & Jeux
- Navigation latérale propre à chaque section.
- Catalogue Nostra Motors affiché en **Coming Soon**.
- Design sombre noir, or et touches bleues.

## Installation locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir ensuite `http://localhost:3000`.

## Configuration Supabase

1. Créer un projet Supabase.
2. Copier l’URL du projet et la clé **Publishable** dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://VOTRE_PROJET.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLISHABLE
```

3. Dans Supabase, ouvrir **Authentication > Providers > Discord** et activer Discord.
4. Dans l’application Discord Developer, ajouter l’URL de callback Supabase indiquée dans le panneau Discord de Supabase.
5. Dans **Authentication > URL Configuration**, ajouter :
   - `http://localhost:3000/auth/callback`
   - `https://VOTRE-SITE.vercel.app/auth/callback`

## Déploiement Vercel

1. Envoyer ce dossier sur GitHub.
2. Importer le dépôt dans Vercel.
3. Ajouter les deux variables d’environnement Supabase dans les réglages Vercel.
4. Déployer.

## Logos

Les fichiers `public/universe-life.svg` et `public/nostra-group.svg` sont des versions temporaires propres. Ils peuvent être remplacés plus tard par les logos officiels en gardant les mêmes noms de fichiers.

## Mise à jour Circuit + Dashboard modifiable

Cette version ajoute :

- le nouveau règlement général et le règlement en piste ;
- des sous-onglets dans toute la navigation Nostra Circuit ;
- Administration sportive avec règlement des licences, tarifs, homologation des véhicules et homologation des écuries ;
- un Dashboard Gérant permettant de modifier le contenu des pages.

Pour activer les sauvegardes du Dashboard, exécuter une seule fois le fichier `supabase/site-content.sql` dans **Supabase > SQL Editor**.
