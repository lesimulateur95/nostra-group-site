# Connexion des informations bancaires au serveur de jeu

La page `Profil → Informations bancaires` est prête pour une base MySQL ou MariaDB.
Elle effectue uniquement une lecture côté serveur à partir de l'identifiant Steam lié au
compte du site. Les identifiants de la base ne sont jamais envoyés au navigateur.

## Variables à ajouter au déploiement du site

```env
GAME_DB_HOST=adresse-de-la-base
GAME_DB_PORT=3306
GAME_DB_USER=nostra_site_readonly
GAME_DB_PASSWORD=mot-de-passe
GAME_DB_NAME=nom_de_la_base

# Valeurs par défaut adaptées à une structure Arma Life classique
GAME_DB_PLAYERS_TABLE=players
GAME_DB_PLAYER_UID_COLUMN=playerid
GAME_DB_PLAYER_NAME_COLUMN=name
GAME_DB_PLAYER_CASH_COLUMN=cash

# Format : Libellé:colonne;Autre libellé:autre_colonne
GAME_DB_BANK_ACCOUNTS=Compte bancaire principal:bankacc

# Mettre true uniquement si le serveur MySQL utilise un certificat TLS valide
GAME_DB_SSL=false
```

Pour plusieurs comptes, par exemple :

```env
GAME_DB_BANK_ACCOUNTS=Compte courant:bankacc;Compte épargne:savings;Compte entreprise:company_bank
```

## Sécurité obligatoire

- créer un utilisateur MySQL dédié au site avec le droit `SELECT` uniquement ;
- limiter son accès à la table et aux colonnes nécessaires ;
- autoriser uniquement l'adresse IP du site dans le pare-feu de la base ;
- ne jamais préfixer les variables avec `NEXT_PUBLIC_` ;
- vérifier que `member_profiles.steam_id` contient le même identifiant que la colonne joueur du serveur.

Exemple de droits MySQL à adapter :

```sql
CREATE USER 'nostra_site_readonly'@'IP_DU_SITE' IDENTIFIED BY 'MOT_DE_PASSE_FORT';
GRANT SELECT (playerid, name, cash, bankacc)
ON nom_de_la_base.players
TO 'nostra_site_readonly'@'IP_DU_SITE';
FLUSH PRIVILEGES;
```

Après ajout des variables dans l'hébergeur, redéployer le site. Aucun SQL Supabase
supplémentaire n'est requis pour cette page si l'identifiant Steam est déjà enregistré
dans `member_profiles`.
