# Architecture

La vue d'ensemble de Barjøtur, au niveau qui ne bouge pas. Le détail d'implémentation vit dans le code et le
dictionnaire de données ; cette page fixe les principes et les surfaces. Elle sert de carte à l'équipe et au lecteur
extérieur.

## Le principe qui commande tout

Deux bases, deux rôles. Une base maître porte tout et calcule le lourd, par intermittence. Une base de service,
toujours en ligne et autonome, sert l'application et compose en direct. La règle d'or : le service ne dépend jamais
de la base maître. L'application tourne même quand la machine de calcul est éteinte.

Ce partage tient toute la conception. Le calcul est canonique et rejouable d'un côté, le service est stable et
rapide de l'autre, et un contrôle d'écart garantit que le service reflète bien le dernier calcul.

## Les couches et les surfaces

Le dépôt est un monorepo en TypeScript strict, plus un sidecar Python. Chaque surface a une seule main.

- `shared/` porte les contrats d'API, source de vérité des types partagés entre le calcul, le serveur et le front.
  C'est la seule surface que l'orchestrateur tient ; les autres surfaces la consomment sans la redéfinir.
- `server/` est le BFF, un serveur Node et Express en couches strictes, routes puis services puis accès aux données.
  Aucun SQL dans les routes, aucun Express dans les services. L'accès à Postgres se fait en SQL brut.
- `client/` est le front React, qui ne parle qu'au BFF. L'état d'interface vit localement, le cache réseau est tenu
  par une couche unique, et la carte s'affiche par des tuiles vectorielles.
- `sidecar/` est le service Python qui résout la composition d'itinéraire, appelé par le serveur.
- `calc/` est le worker de calcul, qui régénère le dérivé depuis la source, de façon canonique.
- `db/` porte le schéma, les migrations et le dictionnaire de données. `tiles/` la configuration du serveur de tuiles.

## Le flux des données

La donnée part de la source (guides, communauté, réseaux bruts, votes déjà posés) et remonte par étapes. Le worker
la recalcule dans la base maître, une version par calcul, tracée jusqu'à son origine. Un pont pousse les dérivées
vers la base de service, sans jamais toucher l'état propre au voyage (votes, itinéraires figés, identités), qui reste
autoritaire côté service. Le serveur lit et écrit par un jeu de fonctions exposées, le front les consomme.

## Les rôles et l'accès

Une personne du voyage est un voyageur, qualifié adulte ou enfant. Un voyageur peut être organisateur ; l'un d'eux,
l'organisateur principal, détient le code maître. Les gestes sensibles, comme corriger un lieu, régénérer un lien ou
verrouiller une étape, sont protégés par un code. L'autorité réelle est côté serveur, le code d'interface n'est
qu'une garde. Chaque voyageur a un lien personnel stable, jamais régénéré à la légère.

## La mise en ligne

La v3 se construit à côté de la v2 qui fonctionne, et la remplace module par module. Chaque module bascule avec une
parité vérifiée, les votes préservés et un retour arrière prêt, sans jamais couper le service. Le détail des étapes
est dans `deploy/RUNBOOK.md`.

## Les garanties

Trois exigences se tiennent d'un bout à l'autre. Les calculs sont canoniques, donc fiables et rejouables. Les votes
et les liens personnels sont préservés à chaque étape, avec double lecture et réversibilité. Et rien ne se fait de
destructif : on déplace vers une corbeille datée plutôt que de supprimer. Le moteur qui note les lieux et agrège les
préférences est décrit dans `gis-mcda.md`, le vocabulaire dans `glossaire.md`.
