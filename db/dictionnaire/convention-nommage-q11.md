# Convention de nommage globale (Q11), cible figée

> Décision Guillaume 2026-08-13 : **Option B** (renommage physique progressif derrière des vues stables), intermédiaires dans un schéma **`staging`** dédié. Worker A pose la grammaire ; le Maître câble la migration par lots. Rien n'est renommé en masse maintenant.

## Pourquoi

Le nommage v2 mêle sans règle lisible : préfixes `_` (intermédiaires), suffixes de version (`_v2`), suffixes d'étape (`_a01`, `_a05`, `_a10`), `_backup` et noms finaux. Résultat : 190 relations dans `mcda2` dont 99 `_*` et 4 backups, plusieurs versions du même calcul, single-source violée. La convention fige une grammaire unique, condition des calculs canoniques (A14).

## La grammaire

### 1. Objets canoniques
Nom métier **sans préfixe ni suffixe de version** : `bases`, `poi_facteurs`, `matrice_base_base`, `qualite_poi`, `reward_inputs`. Une seule version vivante par calcul. **Pas de `_v2`, `_a0x`, `_gis` en cible.** Snake_case, français ou terme technique stable, jamais d'acronyme obscur.

### 2. Intermédiaires de calcul
Schéma dédié **`staging`** (et non plus le préfixe `_` dans `mcda2`). Nom `staging.<calcul>_<etape>` explicite. Objectif : les isoler du canonique et pouvoir `TRUNCATE`/`DROP` en bloc sans risque après recette. Un intermédiaire ne survit jamais au gel d'un calcul.

### 3. Backups
**Hors base** : dumps `pg_dump` horodatés dans `db/_pg_backups/` (gitignoré, hors repo public). Si un backup doit rester en base à titre transitoire : préfixe `bak_AAAAMMJJ_` dans `staging`, jamais dans un schéma canonique.

### 4. Étapes de pipeline
La numérotation vit dans le **NOM DE SCRIPT** (`10_reseaux.sql`, `30_matrices.sql`), **jamais dans le nom de table**. Une table est un résultat, pas une étape.

### 5. Contrat de service (le renommage passe DERRIÈRE)
Le front et le backend ne dépendent que des **vues** :
- DB2 : vues et fonctions `api.*` (contrat runtime, ~11 vues + ~50 RPC relevées par B).
- DB1 : vues `diffusion.v_web_*` (couche servie / tuiles).

Tout renommage physique se fait **derrière** ces vues : on renomme la table, on recâble la vue, le contrat ne bouge pas. Le renommage devient réversible et non régressif (votes, API, tuiles préservés).

### 6. Séquence de migration (Option B, câblée par le Maître)
1. Geler ce dictionnaire (cible figée).
2. Pour un calcul : créer l'objet canonique au nom cible, recâbler la vue `api.*` / `v_web_*` dessus, vérifier la parité (test d'écart), puis déplacer l'ancien vers `staging`/backup.
3. Un lot = un calcul. Jamais un renommage global d'un bloc (casse API/votes/tuiles, Option A rejetée).
4. Les 99 `_*` et 4 backups de `mcda2` : balisés (COMMENT), puis déplacés vers `staging` ou dumpés hors base **après** gel, jamais avant (consigne M001).

## Table de correspondance

La table complète `nom_actuel → nom_metier` (avec colonne « renommage physique OUI/NON » selon la règle M010 : identité/votes non renommés, objets de calcul renommés derrière les vues) vit dans **`correspondance-q11.md`**. C'est le contrat de renommage validé en C02 par le Maître ; B l'applique en miroir DB2.
