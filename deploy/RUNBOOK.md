# Runbook de déploiement BarjoTur v3 (bascule strangler)

> Cible : `voyage.barjot.net` (auto-hébergé Bomp4rd). Principe : la v2 reste live tant que chaque module v3 n'est
> pas poussé à sa place avec **parité vérifiée + votes préservés + rollback prêt**. Aucun geste destructif. Guillaume
> lance ; le Maître prépare et vérifie. Secrets hors repo (`~/.config/…`), jamais commités.

## Stack cible (runtime, DB2 autonome)

| Composant | Rôle | Port interne | Source |
|---|---|---|---|
| PostgreSQL/PostGIS/pgRouting (`norvege-db`) | DB2 `norvege_v2`, sert + compose | 5432 | Docker Bomp4rd (existant) |
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
