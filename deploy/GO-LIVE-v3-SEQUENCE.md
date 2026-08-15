# GO-LIVE v3.0 — séquence de bascule DB2 (B, seul écrivain)

> **GATE ABSOLU** : rien de cette séquence ne s'exécute avant le **go bascule de Guillaume relayé par M** (M444). Le `--apply`
> du harnais est gaté « ACCORD DIRECT Guillaume ». Tout est dry-run-prouvé (B134). R2 : aucun secret affiché. Réversible.
> Ordre exact (M444) : backup précieux → migrations 012-019 → re-sync v3-final + merge_map_v3 → recompose figés → gates parité
> → stack (config.yaml+smoke) → flip Martin. Chaque étape VÉRIFIÉE avant la suivante ; toute assertion ratée = STOP + rollback.

## 0. Pré-vol (lecture seule, DÉJÀ vert — B134)
- Dumps `db/sync/{canonique,diffusion}-v3-final-20260817.sql` présents ; `merge_map_v3` = 11 fusions ; contrôle précieux-safe OK.
- Dry-run re-sync : votes 34→34, 0 précieux touché, ROLLBACK propre. Empreintes gelées (manifeste).

## 1. BACKUP précieux (réversibilité)
`ssh bomp4rd "docker exec norvege-db pg_dump -U norvege -d norvege_v2 -Fc -n decision -n membre -n fige -n parcours -n voyage > ~/barjotur-backups/precious-<stamp>.dump"`
+ backup `poi.poi/photo/poi_circuit/poi_app`. **Vérif** : fichiers présents, taille > 0.

## 2. Migrations 012-019 (ordre)
`for m in 012 013 014 015 016 017 018 019; do cat db/migrations/${m}_*.sql | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"; done`
**Vérif** : chaque COMMIT ; `api.whoami` a conducteur ; `budget.parametre_meta` a ecran ; RPC vote/carto/poi_detail présents.
(013/014/016/018/019 dry-run verts ; 012/015/017 = RPC carto lisant diffusion — appliqués APRÈS l'étape 3 qui pose les vues.)
→ ordre réel : 013,014,016,018,019 d'abord ; **012,015,017 après l'étape 3** (dépendent de diffusion.v_web_*).

## 3. RE-SYNC owner-safe --apply (canonique + diffusion v3-final)
- Charger `diffusion-v3-final` en schéma `diffusion` (rename diffusion_dump→diffusion, typmod geom 4326 — cf build-dev-db.sh).
- `sync-recompute-v3.sh --dump canonique-v3-final.sql.gz --empreintes <manifeste.tsv> --apply` : staging → swap mcda2
  (reward_poi/base_reward/bases_ideales/base_node_van) + poi.poi merge-by-osm_id (overlay 4 colonnes owner, relink poi.photo)
  + **merge_map_v3 relink votes** (perdant→gagnant) → **assertions 0-perte** (votes 34/16/8, membres, poi_app) sinon ROLLBACK+restore.
- **Vérif** : empreintes bases_ideales `1fae7665` / base_reward `7661b1d5` / reward_poi `1c544690` == manifeste ; votes AVANT==APRÈS.
- Puis appliquer **012, 015, 017** (RPC carto qui lisent diffusion.v_web_*).

## 4. RECOMPOSE figés
Re-solve les figés existants (consensus + membres + archétypes) sur le composeur actuel (105, non bridé) → `api.fige_enregistrer_systeme`.
Purge cache A* (`TRUNCATE mcda2.leg_astar_cache`). **Vérif** : `/api/budget/comparatif` rend les scénarios recomposés.

## 5. GATES parité (no-regression)
`deploy/smoke-e2e.sh` (4 santés + /api/carto/* + /api/fige/:id + tuile Martin) → **PASS**. Parité fonctionnelle close (B122).

## 6. STACK v3 (config.yaml + smoke) — push-button
`cd deploy && docker compose -f docker-compose.v3.yml up -d` (bff+sidecar+martin config.yaml+client, health gating).
**Vérif** : 4 santés vertes (`/api/sante` db2:ok, sidecar /health, martin :8003 /health, client /).

## 7. FLIP Martin / proxy (strangler-fig)
Router `/tiles`→martin:8003, `/api`→bff, `/`→client (NPM), proto en filet. Purger cache NPM/CDN. **Vérif** : voyage.barjot.net sert la v3.

## Rollback (à toute assertion ratée)
Re-router NPM→proto (instantané) ; restaurer `~/barjotur-backups/precious-<stamp>.dump` + poi ; `docker compose down`. DB2 revient à l'état AVANT.
