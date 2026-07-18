import type { EditablePageSlug } from "@/lib/content/site-content";

export const DEFAULT_EDITOR_CONTENT: Record<EditablePageSlug, { title: string; content: string }> = {
  "circuit-presentation": { title: "Nostra Circuit", content: `Bienvenue au NOSTRA CIRCUIT, un complexe automobile dédié à la passion de la conduite, de la compétition et du sport automobile.

Notre objectif est de proposer un environnement professionnel où chaque pilote, débutant ou expérimenté, pourra évoluer dans des conditions optimales.

Utilise les pages détaillées de cette catégorie pour consulter les activités, les valeurs et les installations du circuit.

« Chaque virage est un défi. Chaque victoire entre dans la légende. »` },
  "circuit-activities": { title: "Nos activités", content: `Le Nostra Circuit vous propose :

• Sessions libres
• Essais privés
• Privatisation du circuit
• Championnat Formule 1
• Championnat Porsche GT3 RS
• Création d’écuries officielles
• Homologation des véhicules
• Délivrance de licences pilotes
• Événements automobiles
• Journées découvertes` },
  "circuit-values": { title: "Nos valeurs", content: `Au Nostra Circuit, nous mettons un point d’honneur à promouvoir :

✅ La sécurité
✅ Le respect entre pilotes
✅ Le fair-play
✅ Le professionnalisme
✅ La passion de l’automobile

Chaque participant est invité à respecter les règlements afin de garantir une expérience agréable pour tous.` },
  "circuit-installations": { title: "Nos installations", content: `Le complexe comprend notamment :

🏁 Une piste dédiée à la compétition
🏎️ Des stands réservés aux écuries
👥 Une zone d’accueil
📋 Une direction de course
🏆 Un système de championnat officiel` },
  "administration-sportive": { title: "Administration sportive", content: `Retrouvez dans cette rubrique les règlements, les licences pilotes et les procédures d’homologation officielles du Nostra Circuit.

Chaque sous-page possède son propre contenu et peut être modifiée séparément depuis le Dashboard Gérant.` },
  "licence-reglement": { title: "Règlement des licences pilotes", content: `🏁 RÈGLEMENT DES LICENCES PILOTES — NOSTRA CIRCUIT

Toute personne souhaitant participer aux activités officielles du Nostra Circuit doit être titulaire d’une licence pilote valide.

ARTICLE 1 — CONDITIONS D’OBTENTION
✅ Être en possession d’un certificat médical valide.
✅ Ne présenter aucun trouble de la vision pouvant compromettre la sécurité.
✅ Avoir pris connaissance du règlement du Nostra Circuit.
✅ Respecter les consignes des commissaires et du personnel.

ARTICLE 2 — CERTIFICAT MÉDICAL
Le certificat médical est obligatoire pour toute première demande de licence. Il doit attester l’aptitude au sport automobile, l’absence de contre-indication et une vision compatible avec la conduite sur circuit.

ARTICLE 3 — VISION
Les troubles visuels non corrigés pouvant mettre en danger les autres participants peuvent entraîner un refus de délivrance.

ARTICLE 4 — COMPORTEMENT
La licence peut être suspendue ou retirée en cas de comportement dangereux, non-respect du règlement, percussion volontaire, conduite agressive, refus d’obéir ou mise en danger.

ARTICLE 5 — VALIDITÉ
La licence est valable pour la saison. Le personnel peut la suspendre ou la retirer à tout moment.

ARTICLE 6 — OBLIGATIONS DU PILOTE
Respecter les installations, les autres pilotes, les commissaires, porter les équipements obligatoires et signaler tout problème mécanique.

ARTICLE 7 — SANCTIONS
🟡 Avertissement
🟠 Suspension temporaire
🔴 Retrait définitif
🚫 Interdiction de participer aux activités du circuit

Toute demande de licence vaut acceptation pleine et entière du présent règlement.` },
  "licence-tarifs": { title: "Tarifs des licences pilotes", content: `💳 TARIFS DES LICENCES PILOTES

🟢 LICENCE C — 300.000 €

INFORMATIONS
• Le certificat médical est obligatoire pour toute demande de licence.
• Le paiement est effectué lors de la délivrance de la licence.
• Une licence suspendue ou retirée n’est pas remboursée.
• La licence est personnelle et ne peut être cédée à un tiers.

🏁 NOSTRA CIRCUIT` },
  "homologation-vehicules": { title: "Homologation des véhicules", content: `Tout véhicule participant à une activité officielle du Nostra Circuit doit être homologué par le personnel du circuit.

Publie ici les conditions, contrôles techniques, catégories autorisées et décisions d’homologation. Le formulaire de demande reste disponible sous ce contenu.` },
  "homologation-ecuries": { title: "Homologation des écuries", content: `Toute écurie souhaitant participer officiellement doit être enregistrée et homologuée par l’administration sportive.

Publie ici les conditions de création, les obligations des responsables, les pilotes engagés et les véhicules déclarés. Le formulaire de demande reste disponible sous ce contenu.` },
  "journal-officiel": { title: "Journal officiel", content: `Vue d’ensemble des annonces, décisions sportives et résultats officiels du Nostra Circuit.

Chaque rubrique possède désormais sa propre page modifiable.` },
  "journal-communiques": { title: "Communiqués officiels", content: `Publie ici les annonces et communiqués officiels du Nostra Circuit.` },
  "journal-decisions": { title: "Décisions officielles", content: `Publie ici les décisions sportives, administratives, sanctions et décisions de la direction.` },
  "journal-resultats": { title: "Résultats homologués", content: `Publie ici les résultats officiellement validés après chaque épreuve.` },
  "reservations": { title: "Réservations", content: `Vue d’ensemble des réservations du Nostra Circuit.

Les demandes, réservations validées et conditions d’accès disposent chacune de leur propre page.` },
  "reservations-demande": { title: "Demande de créneau", content: `Publie ici la procédure à suivre pour demander un créneau, les informations à fournir et les délais de traitement.` },
  "reservations-validees": { title: "Réservations validées", content: `Publie ici les créneaux et réservations officiellement confirmés par l’équipe du circuit.` },
  "reservations-conditions": { title: "Conditions d’accès", content: `Publie ici les conditions à respecter avant toute réservation ou venue au Nostra Circuit.` },
  "circuit-reglement": { title: "Règlement du Nostra Circuit", content: `Toute personne entrant sur le site du Nostra Circuit accepte le présent règlement. Le non-respect de celui-ci pourra entraîner une exclusion immédiate du circuit, sans remboursement.

ARTICLE 1 — ACCÈS AU CIRCUIT
• L’accès est réservé aux personnes autorisées.
• Toute session doit être réservée et validée par les membres du circuit.
• Les visiteurs doivent respecter les zones autorisées.
• Le personnel du circuit est habilité à contrôler les accès à tout moment.

ARTICLE 2 — ÉQUIPEMENTS OBLIGATOIRES
✅ Casque homologué obligatoire.
✅ Tenue de conduite adaptée.
✅ Chaussures fermées.
✅ Gants de conduite fortement recommandés.

ARTICLE 3 — SÉCURITÉ
❌ Fumer sur la piste.
❌ Vapoter dans les stands.
❌ Utiliser des produits inflammables sans autorisation.
❌ Consommer de l’alcool ou des stupéfiants avant ou pendant une session.
❌ Entrer sur la piste à pied.

ARTICLE 4 — COMPORTEMENT EN PISTE
❌ Rouler à contre-sens.
❌ Bloquer volontairement un concurrent.
❌ Percuter volontairement un autre véhicule.
❌ Faire demi-tour ou stationner sur le circuit.
❌ Sortir volontairement des limites.
❌ Effectuer des burnouts ou donuts hors des zones prévues.

ARTICLE 5 — STANDS
Chaque équipe dispose d’un stand attribué. Il est interdit d’utiliser le stand d’une autre équipe, de déplacer son matériel, d’encombrer les voies ou de laisser des déchets.

ARTICLE 6 — LIMITATION DE VITESSE
🚧 Vitesse limitée à 30 km/h dans les stands.

ARTICLE 7 — SIGNALISATION
🟢 Vert : piste libre.
🟡 Jaune : danger, ralentissement et dépassements interdits.
🔴 Rouge : arrêt immédiat de la session.
🔵 Bleu : fin de session, terminer le tour et regagner les stands.

ARTICLE 8 — RESPECT
Respect obligatoire des commissaires, organisateurs, pilotes et spectateurs.

ARTICLE 9 — VÉHICULES
Les véhicules doivent être en bon état. Le staff peut refuser tout véhicule dangereux.

ARTICLE 10 — MÉDIAS
Photos et vidéos autorisées. Toute utilisation visant à nuire pourra être sanctionnée.

ARTICLE 11 — RECORDS
Records validés uniquement pendant une session officielle, avec un véhicule autorisé, sans assistance extérieure et après validation du staff.

ARTICLE 12 — SANCTIONS
🟡 Avertissement
🟠 Pénalité
🔴 Exclusion de la session
⛔ Suspension temporaire
🚫 Bannissement définitif du circuit

Les décisions de l’équipe sont sans appel.` },
  "circuit-reglement-piste": { title: "Règlement en piste", content: `Le présent règlement s’applique à tous les pilotes participant à un événement officiel organisé par le Nostra Circuit.

AVANT LA COURSE
Tous les pilotes doivent se présenter au contrôle technique : identité, licence, véhicule et briefing obligatoire.

MISE EN GRILLE
Chaque pilote rejoint la position indiquée par la Direction de Course. Aucun changement sans autorisation.

TOUR DE RECONNAISSANCE
Le tour est effectué derrière la Safety Car. Aucun dépassement, départ d’essai ou comportement dangereux.

DÉPART DE LA COURSE
Les dépassements restent interdits jusqu’à l’accélération du pilote de tête ou son passage sur la ligne de départ.

PENDANT LA COURSE
Respect des concurrents, de la signalisation et des commissaires. Il est interdit de couper volontairement un virage, gagner un avantage hors piste, percuter volontairement ou conduire dangereusement.

ARRÊT AUX STANDS
Un arrêt obligatoire aux stands doit être effectué pendant la course.

DERNIER TOUR
Une annonce radio et la signalisation du circuit indiquent le dernier tour.

TOUR DE REFROIDISSEMENT
Après l’arrivée, tour de décélération obligatoire. Dépassements et comportements dangereux interdits.

RETOUR AUX STANDS
Les véhicules sont stationnés dans l’ordre d’arrivée et aux emplacements indiqués.

FIN DE COURSE
Il est interdit de quitter le véhicule avant le retour et l’arrêt complet de tous les concurrents, sauf autorisation de la Direction de Course.

Le respect de ce règlement garantit la sécurité, l’équité et le bon déroulement des compétitions.` },
  "championnat-f1": { title: "Championnat F1", content: `Vue d’ensemble du championnat F1 organisé sur le Nostra Circuit.

Le calendrier, les pilotes et écuries, ainsi que les résultats disposent chacun de leur propre page.` },
  "f1-calendrier": { title: "Calendrier F1", content: `Publie ici les dates, horaires, circuits, séances et manches officielles du championnat F1.` },
  "f1-participants": { title: "Pilotes & écuries F1", content: `Publie ici la liste officielle des pilotes, numéros, véhicules et écuries engagés.` },
  "f1-resultats": { title: "Résultats F1", content: `Publie ici les résultats homologués, pénalités et classements de chaque manche F1.` },
  "championnat-gt3rs": { title: "Championnat Porsche GT3 RS", content: `Vue d’ensemble du championnat Porsche GT3 RS organisé sur le Nostra Circuit.

Le calendrier, les pilotes et les résultats disposent chacun de leur propre page.` },
  "gt3-calendrier": { title: "Calendrier GT3 RS", content: `Publie ici les dates, horaires et manches officielles du championnat Porsche GT3 RS.` },
  "gt3-participants": { title: "Pilotes GT3 RS", content: `Publie ici la liste officielle des pilotes et véhicules engagés.` },
  "gt3-resultats": { title: "Résultats GT3 RS", content: `Publie ici les résultats homologués, pénalités et classements de chaque manche GT3 RS.` },
  "classements": { title: "Classements", content: `Vue d’ensemble des classements officiels du Nostra Circuit.

Le classement F1, le classement des écuries et le classement GT3 RS sont maintenant indépendants.` },
  "classement-f1": { title: "Classement F1", content: `Publie ici le classement général officiel des pilotes du championnat F1.` },
  "classement-ecuries": { title: "Classement des écuries", content: `Publie ici le classement général officiel des écuries.` },
  "classement-gt3rs": { title: "Classement GT3 RS", content: `Publie ici le classement général officiel du championnat Porsche GT3 RS.` },
};
