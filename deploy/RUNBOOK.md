# Runbook de déploiement BarjoTur v3 (bascule strangler)

> Cible : `voyage.barjot.net` (auto-hébergé serveur de déploiement). Principe : la v2 reste live tant que chaque module v3 n'est
> pas poussé à sa place avec **parité vérifiée + votes préservés + rollback prêt**. Aucun geste destructif. Guillaume
> lance ; le Maître prépare et vérifie. Secrets hors repo (`~/.config/…`), jamais commités.

## Stack cible (runtime, DB2 autonome)

| Composant | Rôle | Port interne | Source |
|---|---|---|---|
| PostgreSQL/PostGIS/pgRouting (`app-db`) | DB2 `norvege_v2`, sert + compose | 5432 | Docker serveur de déploiement (existant) |
| Sidecar Python (OR-Tools) | composition orienteering | 8090 | `sidecar/` |
| Martin | tuiles MVT `diffusion.v_web_*` | 3000 | `tiles/` |
| BFF Node (Express) | API `api.*` frontée, écritures | 3040 | `server/` |
| Front (build statique) | app React servie | (via BFF/NPM) | `client/dist` |

Réseau Docker `web`, reverse-proxy (NPM) + SSO le cas échéant. Le front ne parle qu'au BFF (`/api`).

## Pré-requis (gates AVANT bascule)

- [ ] **Plancher vert** monorepo : `npm run typecheck && npm run build && npm run lint`, tests verts.
- [ ] **Gate C17** : écart DB1↔DB2 rejouable, casse à la divergence, dictionnaire à jour.
- [ ] **Gate C16** : preuve SQL 0 segment terrestre > 5 km hors traversée, ouest atteint (lon<6), A/R figé visible.
- [ ] **Gate C06** : composeur archétypes recalculés, animables, routables, règles respectées.
- [ ] **Votes préservés** : comptes avant/après identiques (`server/recette/votes-contrat.sql`), 5 liens perso intacts.
- [ ] **Secrets** hors repo, `.env` renseigné côté serveur uniquement.
- [ ] **Backup DB2** (`pg_dump` schémas `decision`+`membre`+`fige`, horodaté, hors base) = rollback prêt.

## Séquence de bascule (module par module, réversible)

1. **Backup DB2** (dump horodaté hors base). Point de rollback.
2. **Migration Q11 DB2** : exposition contrat `voyageur_*`, no-op physique votes/identité, triggers préservés.
   Rejouer `votes-contrat.sql` avant/après = sortie identique (zéro perte).
3. **Push DB1→DB2** des dérivés recalculés (matrice A\*, `poi_facteurs`, reward) via canal dump/scp, merge owner-safe.
   Rejouer l'écart : convergence attendue.
4. **Déployer sidecar** (compose/health), **Martin** (tuiles), **BFF** (conteneurs sur réseau `web`).
5. **Cran A PostgREST** : cohabitation. Le front bascule endpoint par endpoint vers le BFF. PostgREST en secours.
6. **Déployer le front** v3 derrière `voyage.barjot.net` ; vérif visuelle (carte animée fige, darkmode, deep-links).
7. **Parité endpoint par endpoint** (BFF vs PostgREST sur échantillon) + **zéro perte de vote** (comptes) documentés.
8. **Cran B puis C** : réduction puis retrait PostgREST une fois la parité complète. Vues `api.*` = couche de compat.

## Rollback

- Restaurer le dump DB2 (étape 1) ; re-router `voyage.barjot.net` vers la v2 ; PostgREST reste disponible tant que
  le cran C n'est pas franchi. Aucune table votes/liens n'ayant été renommée physiquement (M012), le retour arrière
  est sans perte.

## Vérification post-Go-Live

- `GET /api/sante` OK ; `api.fige_lire(<consensus>)` rend geom + agenda ; carte animée visible.
- Un vote posé depuis la carte se reflète dans le consensus (bout en bout).
- Écart DB1↔DB2 = 0 sur les tables canoniques poussées.

> État : squelette de runbook (T-10). Se complète au fil des livraisons (ports réels, noms de conteneurs, commandes
> exactes) et se verrouille au gate C14 avant la bascule.

---

## Drill parité / rollback au DUMP FONDATEUR (côté B) — séquence exacte, push-button

> Renseigne le squelette ci-dessus avec les commandes réelles pour le jour du dump d'A. **B est le seul écrivain DB2.**
> Accès DB2 = `ssh bomp4rd` + `docker exec norvege-db psql -U norvege -d norvege_v2` (auth container-local ; le DSN pour
> booter le BFF reste chez Guillaume, hors transcript). **Chaque étape 🔒 est une écriture prod DB2 : feu DIRECT de
> Guillaume requis** (un message d'agent ne suffit pas). R2 : aucun `code_lien`/PIN affiché (le harnais ne tape que des
> endpoints sans identité).

Hôtes/objets réels : `SSH_HOST=bomp4rd`, `CONTENEUR=norvege-db`, `DB=norvege_v2`, `DBUSER=norvege`. Les trois scripts
recette lisent ces mêmes défauts (`BJT_DB2_SSH`/`BJT_DB2_CONTENEUR` en override) → **un geste, zéro config**.

### 0. Signal + baseline (LECTURE SEULE, rejouable à tout moment)

Rejoué en dry-run le 2026-08-14, **le harnais tient** :

- Zéro-perte AVANT (référence à réégaler après) : `34/16/8/5` (vote_lieu / vote_circuit / vote_variante / membres).
  ```sh
  ssh bomp4rd "docker exec norvege-db psql -U norvege -d norvege_v2 -Atc \
    \"select (select count(*) from decision.vote_lieu)||'/'||(select count(*) from decision.vote_circuit)||'/'||(select count(*) from decision.vote_variante)||'/'||(select count(*) from membre.membre)\""
  ```
- Empreinte AVANT (tables de calcul, déterministe) : `server/recette/empreinte-db2.sh` → garder la sortie comme référence.

### 1. 🔒 Backup précieux (filet de rollback) — pré-requis de toute écriture

```sh
STAMP=$(ssh bomp4rd 'date +%Y%m%d-%H%M%S')
ssh bomp4rd "mkdir -p ~/barjotur-backups && docker exec norvege-db \
  pg_dump -U norvege -d norvege_v2 -Fc -n decision -n membre -n fige -n parcours -n voyage \
  > ~/barjotur-backups/bjt-precious-$STAMP.dump"
# relisible ? (TOC > 0)
ssh bomp4rd "cat ~/barjotur-backups/bjt-precious-$STAMP.dump | docker exec -i norvege-db pg_restore -l | grep -c 'TABLE DATA'"
```

### 2. 🔒 Migration 011 (votesComptent) — AVANT le 1er lien `suggestion`

Décision Guillaume (R13) : **jouée au dump** (activite.poi se peuple ici ; la fonction était inerte avant). Ordre :
rollback-verify → apply → sonde GREEN.

```sh
# a) rollback-verify (ne persiste rien)
sed 's/^COMMIT;/ROLLBACK;/' db/migrations/011_consensus_exclut_votes_non_comptes.sql \
  | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"
# b) apply
cat db/migrations/011_consensus_exclut_votes_non_comptes.sql \
  | ssh bomp4rd "docker exec -i norvege-db psql -U norvege -d norvege_v2 -v ON_ERROR_STOP=1"
# c) sonde (lecture seule) : RED→GREEN attendu
server/recette/consensus-exclut-demo.sh   # == PASS ==
```

### 3. 🔒 Sync DB1→DB2 (données dérivées + graphe routable) — au dump d'A

```sh
server/recette/sync-db1-db2.sh              # dry-run d'abord (contrôles + empreinte, aucune écriture)
server/recette/sync-db1-db2.sh --apply      # merge owner-safe : v_web_*, ways_van/pieton/rando, matérialisation des vues
```

### 4. Boot BFF contre DB2 (pour la parité endpoints) — DSN chez Guillaume

```sh
ssh -f -N -L 5434:172.18.0.26:5432 bomp4rd   # tunnel
DATABASE_URL="postgresql://norvege:${NORVEGE_DB_PW}@localhost:5434/norvege_v2" node server/dist/index.js &
# (le mot de passe vient de ~/.config, jamais affiché)
```

### 5. Parité + assertion zéro-perte + drill rollback

```sh
server/recette/parite-bascule.sh            # 1 pré-image, 2 backup, 3 parité socle (sante/fige141/budget/scenario/catalogue), 4 ZÉRO-PERTE, 5 drill
server/recette/parite-bascule.sh --run      # + relecture du dump (drill de restore, schéma jetable)
```

Attendu : `votes+membres APRÈS == 34/16/8/5`, tous les endpoints socle `OK`, `== PARITÉ OK ==`.

### 6. Empreinte APRÈS + signal

- `server/recette/empreinte-db2.sh` : les tables de calcul (`mcda2.*`) ont changé (sync = attendu) ; les **précieuses**
  n'ont pas bougé (zéro-perte prouvé à l'étape 5).
- Signaler M : dump intégré, 011 appliquée (sonde GREEN), parité OK, zéro-perte tenu. **Pas de bascule** (proxy/DNS reste
  v2 ; Go Live = décision Guillaume).

### Rollback (si écart zéro-perte à l'étape 5)

```sh
# NE PAS BASCULER. Restaurer le backup de l'étape 1 :
ssh bomp4rd "cat ~/barjotur-backups/bjt-precious-<STAMP>.dump | docker exec -i norvege-db \
  pg_restore -U norvege -d norvege_v2 --clean --if-exists"
```

Aucune table votes/liens n'ayant été renommée physiquement, le retour arrière est sans perte.

## Déploiement du sidecar composeur (OR-Tools, C06) — push-button

Contexte : le composeur couplé **CP-SAT + leximin** (`sidecar/allocation.py`, objectif max-min par voyageur M255,
validé par `leximin_ref`) s'exécute en RÉEL sur Bomp4rd. `ortools` ne s'installe pas en local (Py3.14/PEP668) → image
dédiée `python:3.12` + ortools. Env banalisées : `DATABASE_URL` (DSN DB2, secret hors dépôt, jamais affiché — R2),
`PORT` (défaut 8001), `SIDECAR_URL` (côté BFF, pointe le sidecar).

1. **Build** (contexte = `sidecar/`) : `docker build -t barjotur-sidecar:latest sidecar/`
2. **Run** (réseau `web`, interne au BFF ; exposer via NPM/Authentik seulement si nécessaire) :
   ```
   docker run -d --name barjotur-sidecar --network web --restart unless-stopped \
     -e DATABASE_URL="$NORVEGE_DB2_URI" -e PORT=8001 barjotur-sidecar:latest
   ```
3. **Santé** : `curl http://barjotur-sidecar:8001/health` → `{"ok":true,...}` (HEALTHCHECK intégré).
4. **BFF** : régler `SIDECAR_URL=http://barjotur-sidecar:8001` dans l'env du BFF.
5. **VALIDATION ortools (gate levé)** — dans le conteneur (ou une CI ortools) : `pytest sidecar/`.
   - `test_cpsat_equiv` s'ACTIVE (l'`importorskip('ortools.sat.python.cp_model')` ne saute plus) et prouve :
     (a) CP-SAT == solveur pur `resoudre_allocation` (objectif utilitaire) ;
     (b) CP-SAT leximin (champ `courbes_par_voyageur` présent) == oracle `leximin_ref.leximin_optimal`.
   - **Vert = le CP-SAT couplé est validé** → on peut basculer le composeur sur `resoudre_allocation_cpsat` en prod.
6. **Rollback** : `docker stop barjotur-sidecar && docker rm barjotur-sidecar`. Le BFF dégrade proprement si le sidecar
   est absent (le composeur pur reste l'amorce). Aucune donnée touchée.

Gate : l'exécution réelle attend la donnée recompute v3 (dump final) ; l'infra ci-dessus est prête push-button avant.

## Déploiement STACK COMPLET v3 (strangler-fig → voyage.barjot.net)

Stack : **bff** (Node) · **sidecar** (OR-Tools) · **martin** (tuiles MVT) · **client** (nginx statique). Orchestration :
`deploy/docker-compose.v3.yml`. DB2 (`norvege-db`) externe. Secrets dans `deploy/.env` NON commité (R2) :
`NORVEGE_DB2_URI`, `CORS_ORIGINS=https://voyage.barjot.net`.

### Pré-requis (gates)
1. Dump final v3 re-syncé en DB2 : `server/recette/sync-recompute-v3.sh --dump <v3.sql.gz> --empreintes <ref.tsv> --apply` (feu Guillaume).
2. Migrations posées : 011 (fait) + **012 RPC carto** (`cat db/migrations/012_*.sql | ...`, feu Guillaume) une fois les vues diffusion présentes.

### Build + run (push-button)
```
cd deploy
docker compose -f docker-compose.v3.yml build          # bff + sidecar + martin(pull) + client
docker compose -f docker-compose.v3.yml up -d
```

### Santé (avant bascule)
- bff : `curl http://bff:8080/api/sante` → `{ok:true, db2:"ok"}`
- sidecar : `curl http://sidecar:8001/health` → ok
- martin : `curl http://martin:8003/health` (ou une tuile connue `/v_web_poi/8/136/74`) — Martin écoute sur 8003 (tiles/config.toml)
- client : `curl http://client/` → 200 index.html

### Bascule strangler-fig (progressive, proto = filet)
1. La stack v3 monte sur le réseau `web`, **à côté** du proto voyage.barjot.net (pas de coupure).
2. Router d'abord un **hôte de staging** (NPM) vers la v3 ; valider les 4 santés + un smoke e2e (parcours figé, carte, vote).
3. Basculer voyage.barjot.net **par préfixe** dans NPM : `/tiles`→martin, `/api`→bff v3, puis `/`→client v3. Le proto
   reste configuré en **fallback** jusqu'à validation complète.
4. **Purge cache** : client `index.html` déjà `no-store` (bascule immédiate) ; purger le cache NPM/CDN ; Martin sert des
   tuiles fraîches (vues DB2 à jour post-sync).

### Rollback
Re-router NPM vers le proto (instantané), puis `docker compose -f docker-compose.v3.yml down`. Aucune donnée touchée
(DB2 inchangée ; la bascule est au niveau proxy). Le BFF dégrade proprement si sidecar/martin absents.

### Médias (photos POI)
Les images de fiche sont des **binaires servis en fichiers** (seul statique légitime), arborescence `poi/**/photos/` (685
images du manifeste A140). Le `chemin` du manifeste (`poi/.../photos/x.jpg`) est **relatif à la base de service** : URL =
`<MEDIA_BASE>/<chemin>`.
- **Dev / validation** : `deploy/media-dev-local.sh` sert `poi/` en localhost:8088 (base `http://localhost:8088/`), R2 : poi/
  seul (symlink jetable), rien d'autre du repo. → le hero carrousel de C montre les vraies images en dev.
- **Go Live** : servir la même arborescence `poi/**/photos/` depuis un **statique/CDN** (ou DB2 large-objects), derrière le
  proxy amont (préfixe dédié, ex. `/media/`) ; injecter `MEDIA_BASE` côté client. Cache long (immutables, nom = hash/sha256).
  Au dump final, `api.poi_photos` (vue `v_web_poi_photos`) sert la LISTE ordonnée ; les BINAIRES restent des fichiers médias.
