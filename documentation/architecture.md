# Architecture

La vue d'ensemble de Barjøtur, au niveau qui ne bouge pas, et à jour de la conception. Le détail d'implémentation vit
dans le code et le dictionnaire de données ; cette page fixe les principes et les surfaces, et sert de carte à
l'équipe comme au lecteur extérieur. Le détail des choix est dans les notes de conception (`docs/architecture/`).

## Ce qu'est Barjøtur

Un **composeur de voyages** en van, pensé pour une famille, auto-hébergé et libre. Le roadtrip en Norvège d'août 2027
n'en est qu'une **instance** : une origine, une destination, une zone d'expérience, des profils. Le même moteur se
rejoue pour un autre véhicule, un autre trajet, un autre voyage. Cette rejouabilité n'est pas un bonus lointain : elle
commande l'architecture dès la v3 (rien ne suppose qu'il n'existe qu'un voyage), même si l'app n'en expose qu'un à la
mise en ligne.

## Le principe qui commande tout

Deux bases, deux rôles. Une base **maître** porte tout et calcule le lourd, par intermittence. Une base de **service**,
toujours en ligne et autonome, sert l'application et compose en direct. La règle d'or : le service ne dépend jamais de
la base maître. L'application tourne même quand la machine de calcul est éteinte. Le calcul est canonique et rejouable
d'un côté, le service stable et rapide de l'autre, et un contrôle d'écart garantit que le service reflète le dernier
calcul, à l'octet.

## Les couches et les surfaces

Un monorepo en TypeScript strict, plus un sidecar Python. Chaque surface a une seule main.

- `shared/` porte les contrats d'API, source de vérité des types partagés. Seule surface tenue par l'orchestrateur.
- `server/` est le BFF Node et Express, en couches strictes (routes, services, accès données), SQL brut, aucun SQL
  dans les routes.
- `client/` est le front React, qui ne parle qu'au BFF. État d'interface local, cache réseau unifié, cartes en tuiles
  vectorielles.
- `sidecar/` résout la composition d'itinéraire (orienteering d'expérience et optimisation de transit), appelé par le serveur.
- `calc/` régénère le dérivé depuis la source, de façon canonique. `db/` porte schéma, migrations, dictionnaire.
  `tiles/` la configuration des tuiles.

## Le voyage, une instance paramétrée

Un voyage porte une **origine** et une **destination** (ici le domicile en Alsace, aller/retour bouclé), des
**profils** de déplacement, un budget, et une suite d'étapes. Origine et destination sont posées au démarrage ; le
transit les relie à la zone d'expérience. Tout est scopé par un identifiant de voyage : ajouter un autre voyage est
additif, pas une refonte. C'est le socle de la rejouabilité.

Les **profils de déplacement** (van, piéton d'accès, randonnée, transports en commun) sont des **paramètres réglables
en un seul endroit**, que le calcul lit et que les réglages éditent. Le profil du van se **fige** au moment de la
réservation : un fait extérieur devient une contrainte, et aucun recalcul ne le déplace ensuite.

## L'avancement par crans

Le voyage progresse par **crans successifs** (cadrage, réservation du van, exploration, composition, logistique,
départ). Chaque cran porte un état visible : brouillon, validé mais encore modifiable, ou validé et verrouillé. Ce
qui est décidé se verrouille et libère la suite ; on revient en arrière tant qu'un cran aval n'a pas figé une
dépendance. Certains verrouillages sont **définitifs** (un paiement, une réservation confirmée, le ferry, les dates,
le trajet aller/retour) et ne se rouvrent jamais. Valider ou rouvrir un cran modifiable demande le code de
l'organisateur ; le vote, lui, n'est jamais protégé par un code. C'est le fil d'Ariane du voyage, et la garantie
qu'un recalcul ne dérive jamais sous un fait figé.

## Deux natures d'étapes : expérience et transit

Une étape est soit d'**expérience** (on maximise le beau sous budget de temps, l'orienteering, les lieux comptent),
soit de **transit** (on rejoint un point à un autre en minimisant temps et coût, van seul). Une étape de transit est
un **corridor** avec un **faisceau d'arrêts probables** que sa propre optimisation choisit, en privilégiant les nuits
en autonomie ; une réservation impose un arrêt (jalon figé). L'aller/retour est le transit canonique (domicile vers le
port du ferry, avec sa propre optimisation puis figé) ; l'organisateur peut aussi insérer un transit au milieu du
voyage pour élargir la boucle. Le composeur applique à chaque étape le mode d'optimisation de sa nature.

## Le flux des données

La donnée part de la **source** et remonte par étapes canoniques. Les réseaux routables se recomposent depuis la
donnée brute autoritative, pas depuis l'existant : van (OpenStreetMap plus les données officielles NVDB pour ferries,
tunnels et péages), piéton et randonnée (le réseau de routage national norvégien et la base des sentiers), transports
en commun (les horaires nationaux). Le moteur standardise, interpole la qualité le long du réseau réellement
empruntable, note les lieux et prépare la récompense du composeur. Un **pont** pousse les seules **dérivées** vers la
base de service, sans jamais toucher l'état propre au voyage (votes, itinéraires figés, identités, mémoire perso,
avancement des crans), qui reste autoritaire côté service. Une empreinte avant/après garantit zéro perte de vote.

## Le moteur de décision

Le cœur note les lieux et agrège les préférences en séparant quatre couches qu'il ne mélange jamais (qualité,
philosophie du voyage, envies chiffrées, votes), calcule la faisabilité à part, et compose l'itinéraire par un
orienteering routé, avec un consensus égalitariste qui soigne d'abord la personne la moins bien servie. Le détail, avec
ses méthodes et ses sources, est dans `gis-mcda.md`.

## L'organisation de l'app

Le principe : **personne n'est jamais perdu**. Sept espaces, chacun une intention claire, cousus par le fil du parcours
persistant : Le voyage (l'avancement), Explorer (les lieux), Mes envies (l'esprit et les votes), Le trajet (la
composition), Carte (l'itinéraire animé), Préparatifs (budget, repas, matériel, réservations), Réglages (les
paramètres et l'aide). Les titres se veulent clairs pour un enfant comme pour tout voyageur.

La navigation est **pensée pour le petit écran d'abord** (l'app se vit au téléphone, dans le van) : une barre au pouce
pour les cinq gestes du quotidien, des cibles larges, aucune dépendance au survol, une carte lisible en petit. La
**carte est double** : intégrée là où elle répond à une question (explorer les lieux, composer l'itinéraire) et comme
espace à part pour l'itinéraire animé, avec un même composant, une même légende. Explorer ne se réduit pas à la carte :
liste, fiches, recherche et filtres à facettes, et surtout des **recommandations** curées par le moteur (les
incontournables, pour chacun selon ses envies, ce que la famille aime, ce qui est sur la route, les pépites), en disant
toujours pourquoi. Un design system unique et un squelette de vue commun tiennent la cohérence d'un espace à l'autre.

## Les rôles et l'accès

Une personne du voyage est un **voyageur**, adulte ou enfant. L'un est l'**organisateur** (plusieurs organisateurs sont
prévus structurellement, pour le jour où l'app portera plusieurs voyages). Le vocabulaire d'accès est normalisé à un
seul endroit, l'identité physique restant intacte. Les gestes de verrouillage sont protégés par un code ; l'autorité
réelle est côté serveur, le code d'interface n'est qu'une garde. Chaque voyageur a un lien personnel stable.

## La mise en ligne

La v3 se construit à côté de la v2 qui fonctionne et la remplace module par module, chaque bascule avec parité
vérifiée, votes préservés et retour arrière prêt, sans jamais couper le service. La règle : **on ne met en ligne
qu'après les recalculs**, jamais sur un état dérivé intermédiaire. Le détail est dans `deploy/RUNBOOK.md`.

## Les garanties

Les calculs sont canoniques, donc fiables et rejouables. Les votes et les liens personnels sont préservés à chaque
étape, avec double lecture et réversibilité. Rien de destructif : on déplace vers une corbeille datée plutôt que de
supprimer. Et l'honnêteté prime : aucune donnée, source ou valeur inventée, un état toujours dit (chargement, vide,
erreur, service non branché), jamais d'écran blanc.
