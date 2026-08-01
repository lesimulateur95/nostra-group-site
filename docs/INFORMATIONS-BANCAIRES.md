# Connexion des informations bancaires au serveur de jeu

La page `Profil → Informations bancaires` et la caisse du Casino sont prêtes pour une
base MySQL ou MariaDB. La page du profil lit les soldes ; la caisse peut débiter
l'argent RP pour acheter des jetons. Toutes les opérations sont réalisées côté serveur
à partir de l'identifiant Steam lié au compte du site. Les identifiants de la base ne
sont jamais envoyés au navigateur.

## Variables à ajouter au déploiement du site

```env
GAME_DB_HOST=adresse-de-la-base
GAME_DB_PORT=3306
GAME_DB_USER=nostra_site_casino
GAME_DB_PASSWORD=mot-de-passe
GAME_DB_NAME=nom_de_la_base

# Valeurs par défaut adaptées à une structure Arma Life classique
GAME_DB_PLAYERS_TABLE=players
GAME_DB_PLAYER_UID_COLUMN=playerid
GAME_DB_PLAYER_NAME_COLUMN=name
GAME_DB_PLAYER_CASH_COLUMN=cash

# Format : Libellé:colonne;Autre libellé:autre_colonne
GAME_DB_BANK_ACCOUNTS=Compte bancaire principal:bankacc

# Ordre des colonnes débitées pour un achat Casino (séparées par des virgules)
# Ici le compte bancaire est utilisé avant l'argent liquide.
GAME_DB_CASINO_DEBIT_ORDER=bankacc,cash

# Mettre true uniquement si le serveur MySQL utilise un certificat TLS valide
GAME_DB_SSL=false
```

Pour plusieurs comptes, par exemple :

```env
GAME_DB_BANK_ACCOUNTS=Compte courant:bankacc;Compte épargne:savings;Compte entreprise:company_bank
```

## Sécurité obligatoire

- créer un utilisateur MySQL dédié au site avec `SELECT` et `UPDATE` uniquement sur
  les colonnes d'argent nécessaires ;
- limiter son accès à la table et aux colonnes nécessaires ;
- autoriser uniquement l'adresse IP du site dans le pare-feu de la base ;
- ne jamais préfixer les variables avec `NEXT_PUBLIC_` ;
- vérifier que `member_profiles.steam_id` contient le même identifiant que la colonne joueur du serveur.

Exemple de droits MySQL à adapter :

```sql
CREATE USER 'nostra_site_casino'@'IP_DU_SITE' IDENTIFIED BY 'MOT_DE_PASSE_FORT';
GRANT SELECT (playerid, name, cash, bankacc)
ON nom_de_la_base.players
TO 'nostra_site_casino'@'IP_DU_SITE';
GRANT UPDATE (cash, bankacc)
ON nom_de_la_base.players
TO 'nostra_site_casino'@'IP_DU_SITE';
FLUSH PRIVILEGES;
```

Après ajout des variables dans l'hébergeur, redéployer le site. Pour le Casino, exécuter
aussi `supabase/casino-paiements-rp-reinitialisations-v109.sql` après le SQL V108.
L'identifiant Steam doit déjà être enregistré dans `member_profiles`.

Le débit est transactionnel dans MySQL : les lignes d'argent du joueur sont verrouillées
pendant le paiement afin d'éviter deux achats simultanés sur le même solde. Si Supabase
ne peut pas créditer les jetons après le débit, le site tente immédiatement de remettre
les montants dans leurs colonnes d'origine.
