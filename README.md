# Barjøtur

> Le voyage qui vous ressemble.

Compagnon d'un roadtrip familial en van en Norvège (août 2027). L'app couvre tout le cycle : idée, exploration, vote, composition d'itinéraire, logistique, voyage. Auto-hébergée, libre, sans coût, pour la famille.

## En quoi c'est différent

Deux problèmes couplés au lieu d'un : **agréger les préférences** (le voyage idéal de chacun, puis un consensus honnête) ET **planifier le faisable** (un orienteering routé pour de vrai). Un moteur GIS-MCDA donne un **sens réel aux votes** (un vote déplace vraiment l'itinéraire), et le consensus est **égalitariste** (on soigne le moins bien loti), pas une moyenne tiède.

## Ce que l'app fait

Composeur intelligent, carte animée crédible, votes esprit de voyage et POI, agenda jour par jour, budget, intendance.

## Le socle technique, dit simplement

- **Front** React + Vite + TypeScript + Tailwind + shadcn/ui, carte MapLibre via react-map-gl, état zustand.
- **Backend** BFF Node + Express + TypeScript (accès Postgres en SQL brut via `pg`), sidecar Python (OR-Tools) pour la composition, Martin pour les tuiles.
- **Données** PostgreSQL + PostGIS + pgRouting. DB1 calcule (worker), DB2 sert (runtime, autonome).
- Auto-hébergé sur Bomp4rd. Libre et open source.

## Structure

`shared/` types d'API (source de vérité) · `server/` BFF Node · `client/` front React · `sidecar/` composeur Python OR-Tools · `calc/` worker de calcul DB1 (recalcul canonique depuis la source) · `db/` schéma, migrations, dictionnaire · `tiles/` config Martin · `docs/` conception vivante · `00_Echange/` protocole des 4 terminaux.

## Conception

Le plan et les arbitrages : `docs/00 - Plan v3 (arbitrages verrouillés).md`. Les audits : `docs/reviews/`. Le moteur : `docs/gis-mcda/`. L'orchestration : `docs/orchestration/`.

---

_README socle. Version engageante finale = chantier C14 (gate : repo propre, honnête, rejouable). Voix R7 (français, zéro tiret cadratin, anti-IA)._
