# Classification des scories DB1 — plan de drop (Guillaume 18/08)

> But (Guillaume) : classifier les scories **maintenant** pour les **droper au prochain passage**. Source de vérité machine =
> `meta.scorie_classif` (584 relations : schema, relation, octets, categorie, drop_candidat). Ce doc = le plan de drop par lots.
>
> **GARDE-FOUS (non négociables)** : `drop_candidat=true` NE se drop PAS seul. Ordre : (1) **BACKUP** (pg_dump horodaté hors base) →
> (2) **crible M lot-par-lot** → (3) DROP. **DB1 = A pilote ; DB2 = M** (jamais toucher le live). `a_verifier` = check référence
> calc-script / composeur / FK AVANT drop (le heuristique ne voit que les vues). Rien de `canonique`/`canonique_v31` n'est touché.

## Récap (potentiel de drop = 59 Go / 165 relations)
| catégorie | n | taille | drop |
|---|--:|--:|:--:|
| **scorie_graphe_orphelin** | 32 | **54 Go** | ✅ |
| scorie_v2 (mcda2) | 13 | 3,4 Go | ✅ |
| scorie_intermediaire (mcda2 `_*`) | 98 | 1,6 Go | ✅ |
| backup (`_backup`/`bak_`) | 22 | 90 Mo | ✅ (après gel) |
| a_verifier | 231 | 7,2 Go | ⚠️ vérifier réf d'abord |
| staging_intermediaire | 96 | 2,8 Go | ⚠️ garder pdt v3.1, droper après gel |
| canonique + canonique_v31 | 92 | 3,2 Go | ❌ KEEP |

## Plan de drop par LOTS (du plus sûr/gros au plus fin)
- **LOT S1 — graphes routables orphelins (~54 Go, le gros gain)** : schémas **`routing_cont` (27 Go), `routing_car` (17 Go),
  `routing` (4,9 Go), `routing_pied` (1,5 Go)** — **0 référence de vue** (vérifié pg_depend), vieilles expériences pgRouting.
  Canonique van = `staging.ways_ruteplan` ; pied = `mcda2.ways_pieton` (à confirmer). Drop = `DROP SCHEMA ... CASCADE` après backup +
  vérif qu'aucun calc-script/composeur ne les lit. **Le plus gros gain, le plus sûr.**
- **LOT S2 — routage osm orphelin** : `osm.corridor_routing_ways*` (garder `osm.services` + `osm.v_poi_*` lus par diffusion).
- **LOT S3 — scories v2 mcda2 (3,4 Go)** : `ways_van`, `ways_van_contracte`, `ways_pieton_osm_secours`, `graph`, `_car_nodes_big`,
  `_car_comp`, `*_v2`, `*_a0x`. NB : `ways_van` = superseded par ways_ruteplan ; vérifier que 82_base_base (baseline) ne bloque pas.
- **LOT S4 — intermédiaires `_*` mcda2 (98 tables, 1,6 Go)** : curés après gel des calculs (convention Q11 : DROP en bloc après recette).
- **LOT S5 — backups (90 Mo)** : `*_backup_pre_v3`, `bak_*` → archive dump puis drop après gel v3.1.
- **a_verifier (231)** : transit/guide/variantes/public/sentiers/naturbase/osm-utilisé — check réf (diffusion en lit une partie) avant tout drop.
- **staging_intermediaire (96)** : mes tables de travail v3.1 (floc/greedy/bb intermédiaires) — garder tant que v3.1 en cours, droper après gel.

## Requêtes utiles
- Liste d'un lot : `SELECT schema,relation,pg_size_pretty(octets) FROM meta.scorie_classif WHERE categorie='scorie_graphe_orphelin' ORDER BY octets DESC;`
- Total drop : `SELECT pg_size_pretty(sum(octets)) FROM meta.scorie_classif WHERE drop_candidat;` → **59 Go**.

## DB2 (M)
Le nettoyage scories **DB2** est le domaine de M (prod live) : même méthode (backup + crible lot-par-lot), jamais toucher le servi.
