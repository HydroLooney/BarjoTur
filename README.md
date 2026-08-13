# Barjøtur

> Le voyage qui vous ressemble.

Barjøtur est le compagnon d'un roadtrip familial en van en Norvège, en août 2027. Il accompagne tout le cycle,
de la première idée au retour : explorer les lieux, donner son avis, composer un itinéraire qui tient debout,
préparer l'intendance, vivre le voyage jour après jour. Il est auto-hébergé, libre, sans coût, pensé pour une
famille et non pour un marché.

## L'idée qui le distingue

La plupart des planificateurs traitent un seul problème, celui de la logistique. Barjøtur en résout deux à la fois,
et c'est leur couplage qui fait tout. D'un côté il faut **agréger les préférences** : reconstruire le voyage idéal
de chacun, puis en tirer un consensus honnête. De l'autre il faut **planifier le faisable** : un itinéraire vraiment
réalisable, routé pour de vrai, avec les temps de conduite, les ferries, les nuitées et le budget.

Le moteur qui relie les deux donne un **sens réel aux votes**. Un avis posé sur un lieu déplace l'itinéraire de façon
perceptible, il ne décore pas une carte. Et le consensus est **égalitariste** : il cherche le voyage qui va le mieux
possible à la personne la moins bien lotie, plutôt qu'une moyenne tiède qui ne réjouit personne.

## Ce que l'app fait

Un composeur d'itinéraire qui optimise sous contraintes réelles, une carte animée crédible qui rejoue le trajet
retenu, des votes sur l'esprit du voyage et sur les lieux, un agenda jour par jour, un budget, une intendance
(repas, matériel, réservations).

## Comment ça marche, dit simplement

Le moteur sépare quatre couches qu'il ne mélange jamais : la **qualité** mesurée d'un lieu, la **philosophie** du
voyage (les tensions qu'on veut vivre), les **envies** chiffrées et plafonnées (combien de randos, combien de
restos), et les **votes** de la famille. La faisabilité se calcule à part, par un routage réel.

Le parcours de l'utilisateur suit ce fil : une idée, l'exploration des lieux, les votes, la composition d'un
itinéraire, la logistique, puis le voyage. À chaque étape, ce qui est décidé se verrouille et le reste reste ouvert.
Le détail de la méthode est dans `documentation/gis-mcda.md`.

## Le socle technique

- **Front** React, Vite, TypeScript, Tailwind et shadcn/ui, carte MapLibre, état local zustand.
- **Backend** un BFF Node et Express en TypeScript, accès Postgres en SQL brut, un sidecar Python (OR-Tools) pour la
  composition, Martin pour les tuiles vectorielles.
- **Données** PostgreSQL, PostGIS et pgRouting. Une base maître calcule le lourd, une base de service, autonome, sert
  l'application au quotidien sans dépendre de la première.

## Structure du dépôt

`shared/` porte les contrats d'API, source de vérité des types. `server/` est le BFF. `client/` le front.
`sidecar/` le composeur Python. `calc/` le worker de calcul, qui régénère le dérivé depuis la source. `db/` le schéma,
les migrations et le dictionnaire de données. `tiles/` la configuration Martin. `deploy/` le runbook de mise en ligne.
`documentation/` la doc destinée à un lecteur extérieur.

## Documentation

La vue d'ensemble : `documentation/architecture.md`. Le moteur d'aide à la décision, expliqué pas à pas :
`documentation/gis-mcda.md`. Le vocabulaire, côté famille et côté coulisses : `documentation/glossaire.md`. Le
contenu des aides de l'application : `documentation/aide-en-ligne.md`. La mise en ligne : `deploy/RUNBOOK.md`.

## État

Le projet est en construction. La v3 se bâtit à partir d'un prototype qui fonctionne, module par module, et remplace
la version précédente au fur et à mesure, sans jamais couper le service ni perdre les votes déjà posés. Le cap et les
arbitrages figés sont dans `docs/00 - Plan v3 (arbitrages verrouillés).md`.

## Licence

Sous licence AGPL-3.0 (voir `LICENSE`). Auto-hébergé, libre, sans commercialisation.
