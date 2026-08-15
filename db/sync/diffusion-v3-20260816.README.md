# Dump diffusion v3 matérialisé — 2026-08-16 (M373)

Fichier : `diffusion-v3-20260816.sql` (~36 Mo, `pg_dump --no-owner --no-privileges`, schéma `diffusion_dump`).

## Contenu (5 tables AUTOPORTANTES, SRID 4326, index GiST)
| Table | n | Champs v3 clés |
|---|---|---|
| `diffusion_dump.v_web_poi` | 767 | poi_id, nom, categorie, region_id, zone_id, **sous_zone_id**, **tier** (T-C v3), v_poi, q, **tres_frequente**, **votable**, **confiance**, **categorie_calque**, geom |
| `diffusion_dump.v_web_decoupage` | 173 | niveau (region 4/zone 22/**sous_zone 147**), id, parent_id, **nom_affichage**, **couverte_par**, geom |
| `diffusion_dump.v_web_poi_services_van` | 1206 | amenite_id, categorie, nom, **type_nuit**, **cout_nuit**, **devise**, plein_eau, vidange_grises, electricite, laverie, geom |
| `diffusion_dump.v_web_routes_sceniques` | 18 | id, nom, nom_no, region, longueur_km, sur_roadtrip, interet, score_interet, geom |
| `diffusion_dump.v_web_sentiers` | 139241 | objid, nom, difficulte, surface, saison, length_m, geom |

## Chargement owner-safe DB2 (B)
- Pré-requis : PostGIS actif en DB2.
- Charger dans un schéma DB2 (renommer `diffusion_dump` → le schéma servi par les endpoints si besoin : `sed` ou `SET search_path`).
- **Owner-safe** : denylist des tables précieuses, backup préalable, 0-perte (ce sont des tables neuves, aucun écrasement de
  données DB2 existantes hors les 5 `v_web_*` de diffusion). Le gate « go bascule » reste tenu côté canonique.
- POI-level. **Refait à chaque vague** (au dump final : + `v_web_bases_ideales` v3 + archétypes).

## Provenance
Généré depuis DB1 `norvege_routing` (recompute v3 committé : 90_/91_, v_web v3 M358). Empreintes reward_poi 80b6ee34.
