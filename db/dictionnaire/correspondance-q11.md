# Correspondance de renommage Q11 : `nom_actuel → nom_metier`

> **FIGÉ C02 le 2026-08-13 (rulings M010 + M012).** Référence de renommage. Worker A a proposé, le Maître a validé et figé. **B applique en miroir sur DB2** (script B006). Grammaire dans `convention-nommage-q11.md`. Les noms cibles s'appliquent à la SORTIE des recalculs (calcul par calcul, derrière `diffusion.v_web_*`), jamais en masse.

## Règle de renommage physique (M010)

- **Tables d'identité et de votes : PAS de renommage physique.** `membre.membre`, `decision.esprit`, `decision.vote_*` (+ `_hist`), `decision.archetype*` restent stables (le `code_lien`, le `pin_hash`, les FK souples et les triggers `trg_mark_dirty` / `vote_*_hist_trg` en dépendent). Le terme de domaine `voyageur` (Q01/A03) vit au **contrat** : type `shared` `Voyageur`, exposé `voyageur_*` dans `api.*`/`diffusion`.
- **Objets de calcul : renommage physique vers `nom_metier`** (sans suffixe de version), **derrière les vues** `api.*` (DB2) / `diffusion.v_web_*` (DB1). Intermédiaires en `staging`, backups hors base.
- Colonne « Renommage physique » ci-dessous : **NON** = insularité contrat ; **OUI** = renommé derrière les vues ; **SUPPR** = archivé/trashé après gel.

## 1. Identité, esprit, votes, archétypes (DB2, surface de B) — pas de renommage physique

| nom_actuel (DB2) | terme canonique (contrat) | Renommage physique | Note |
|---|---|:--:|---|
| `membre.membre` | `voyageur` (type `Voyageur`, `api.voyageur_whoami`, champs `voyageur_*`) | **NON** | Table d'identité : `code_lien`, `pin_hash`, FK votes. Jamais renommée (M010). |
| `decision.esprit` | `esprit` (curseurs philosophie, `axe`/`valeur`) | **NON** | 8 axes par voyageur. Insularité votes. |
| `decision.vote_lieu` | `vote_lieu` | **NON** | Vote tier-list POI (`poi_osm_id`, `tier`). Triggers `_hist` préservés (B006). |
| `decision.vote_circuit` | `vote_circuit` | **NON** | Vote tier-list circuit (`circuit_id`, `tier`). |
| `decision.vote_variante` | `vote_variante` | **NON** | Vote variante (relevé B001 : 8 votes). À confirmer schéma exact avec B. |
| `decision.*_hist` | idem `_hist` | **NON** | Historique de votes, préservé. |
| `decision.archetype` / `archetype_jour` | `archetype` / `archetype_jour` | **NON** | Recalculés par le moteur refondu (T013), noms conservés. |

> Vocabulaire de contrat à exposer côté `api.*` : `voyageur_*` (pas `membre_*`) dans les nouvelles fonctions/vues. Les tables physiques ne bougent pas.

## 2. Objets de CALCUL (DB1, surface de A) — renommage physique vers `nom_metier`

> Cible = une seule version vivante, sans `_v2`/`_a0x`/`_gis`, derrière `diffusion.v_web_*`. À appliquer calcul par calcul, au fil du recalcul canonique (pas en masse).

### Matrices base-à-base
| nom_actuel (mcda2) | nom_metier cible | Renommage | Note |
|---|---|:--:|---|
| `base_base_routes_v2` | `matrice_base_base` | **OUI** | Cible = A\* complète, symétrique (Option B). Colonnes coût intégrées. |
| `base_base_cost_temps` | (absorbé dans `matrice_base_base`) | **SUPPR** | Coûts APSP KNN, remplacés par A\*. |
| `base_base_cost`, `base_base_path`, `base_base_routes` | (consolidés dans `matrice_base_base`) | **SUPPR** | Anciennes versions / APSP KNN. |

### Facteurs et champ de qualité
| nom_actuel | nom_metier cible | Renommage | Note |
|---|---|:--:|---|
| `poi_f_v2` | `poi_facteurs` (grain POI) | **OUI** | F1-F8 par POI. `poi_f` (ancienne) → SUPPR. Distinct des grains réseau/base (M012). |
| `facteurs_v2`, `facteurs_reseau` | `facteurs_reseau` (grain réseau/krigeage) | **OUI** | Reste **distinct** de `poi_facteurs` (séparation par grain, A09/M012). Consolidation seulement à l'intérieur d'un grain. |
| `facteurs_base` | `base_facteurs` (grain base) | **OUI** | Facteurs au niveau base ; vivent avec `bases`/`base_*`. |
| `facteurs_densifies` | `krigeage_arete` | **OUI** | Support krigeage réseau (~35 m). Gros volume : garder ou matérialiser à la demande. |
| `aptitude_reseau`, `aptitude_params`, `aptitude_params_v2` | `qualite_poi` + `qualite_params` | **OUI** | Passes 10→30→43 consolidées en une table d'aptitude (OWA), dans le grain POI. Dédoublonner params. |
| `owa_audit`, `f1f7_audit`, ... (vues audit) | (audits de recette) | **SUPPR** | Vues éphémères de contrôle. |

### Bases et reward
| nom_actuel | nom_metier cible | Renommage | Note |
|---|---|:--:|---|
| `bases_v2` | `bases` | **OUI** | Table fondatrice bases van-ok. |
| `bases_vanok_candidats` | `bases_candidates` | **OUI** | Génération par couverture (indépendante des votes). |
| `base_reward_inputs` | `reward_inputs` | **OUI** | Entrées reward (recalculé par le moteur refondu). |
| `base_rayonnement`, `base_value`, `base_services`, `base_activite_supply` | `base_*` (conservés) | **OUI** | Noms déjà métier, dépréfixer si besoin. |

### Réseaux et ferry
| nom_actuel | nom_metier cible | Renommage | Note |
|---|---|:--:|---|
| `ways_van` | `ways_van` | **NON** | Graphe pgRouting standard, **read-only**. Nom conservé (convention pgRouting). |
| `pied_cost_tobler` | `reseau_pied` | **OUI** | Coût marche Tobler/DTM10. |
| `transit_edges`/`transit_node`/`transit_seg`/`transit_transfer` | `reseau_transit_*` | **OUI** | Graphe transit. |
| `ferry_leg` | `ferry_leg` (conservé) | **NON** | Nom déjà métier (entité = tronçon ferry). Le coût = COLONNES (M012) : ajouter `cout_nok`, `cout_eur` (dérivé au taux registre), `source`, `annee` ; retirer le forfait `cout_eur_estime=35`. 6↔74 = 198 NOK/sens (M009). |

### Découpage
| nom_actuel | nom_metier cible | Renommage | Note |
|---|---|:--:|---|
| `decoupage.regions`/`zones`/`zones_membres`, `mcda2.sous_zone` | `decoupage.region`/`zone`/`sous_zone` | **OUI** | Hiérarchie régions/zones/sous-zones. |
| `poi_souszone` | `poi_decoupage` | **OUI** | Appartenance POI→sous-zone (rejeu à chaque changement de découpage). |

## 3. Intermédiaires et legacy

| Cible | Action | Note |
|---|---|---|
| 99 tables `mcda2._*` + 4 backups | → `staging.*` puis trash, ou dumps hors base | **Après gel** du dictionnaire (M001/M008). Jamais avant. |
| `public.params_budget` (61 lignes) | **SUPPR** (archive) | Legacy, doublon single-source DB2 `budget.parametre`. |
| `sources.waypoints_csv_backup_*` (×3) | dumps hors base | Backups datés, hors base (Q11). |

## 4. Rulings C02 (M012, résolus)

1. **`decision.vote_variante`** : NON renommé (comme les autres votes). Schéma exact non bloquant : **B documente les colonnes réelles** (accès DB2) dans son script de migration et son test de contrat.
2. **`ferry_leg`** : conservé (PAS `ferry_cout`) : on nomme par l'entité, le coût est une colonne. Ajouter `cout_nok`/`cout_eur`/`source`/`annee`, retirer le forfait `cout_eur_estime=35`.
3. **`facteurs_*`** : séparation **par grain** (A09) : `poi_facteurs` (POI), `facteurs_reseau` (réseau/krigeage), `base_facteurs`/`bases` (base) restent **distincts**. Consolidation autorisée seulement à l'intérieur d'un grain. Liste exacte figée au recalcul (T005/T013).

> Conséquence structurante (M012) : **côté DB2 aucun rename physique** (votes/esprit/identité/archétypes = NON) ; la migration votes de B se réduit à exposer `voyageur_*` au contrat `api.*` + tenir les triggers + jouer le test avant/après (bas risque). Les renames physiques (OUI) sont **tous** des objets de calcul DB1, appliqués calcul par calcul derrière `diffusion.v_web_*`.
>
> Le détail colonne par colonne s'ajoute au fil du recalcul canonique (provenance + confiance, A14).
