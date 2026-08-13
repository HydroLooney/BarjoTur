# Test de non-régression d'écart DB1 ↔ DB2 (livrable n°1)

> Chantier C17 / tâche T004. Propriété : Worker A. Gate arbitré par le Maître.

## Ce qu'il garantit

Le calcul canonique vit en **DB1** (à cru, worker). Le runtime sert depuis **DB2** (autonome, backend + sidecar OR-Tools). Aujourd'hui, deux copies indépendantes du même modèle coexistent et dérivent en silence :

- côté DB1 : `a_op_archetypes.py` + `a_microop_jour.py` (référence à cru) ;
- côté DB2 : `backend/sidecar/app.py` (reward_base, apsp, plan_jour, ré-implémentés).

Ce test **casse à la moindre divergence** reward / plan_jour entre les deux. C'est la condition du gate C17.

## Deux niveaux

### Niveau (a) : écart de données (gate rapide)
Pour chaque **table canonique** poussée DB1 → DB2 (matrice base-base, `qualite_poi`, `reward_inputs`, facteurs, défauts...), on calcule une **empreinte** : nombre de lignes + bornes par colonne numérique + `md5` de l'ensemble des lignes triées. DB1 à cru vs DB2 servi. Rouge dès qu'un octet de dérivé diverge (hors colonnes d'état DB2 autoritaires : votes, fige, statut, jamais écrasées par le merge).

### Niveau (b) : parité de modèle (profond)
Un jeu de **fixtures figées** (archétypes, curseurs, votes, snapshot du registre `budget.parametre`) est passé dans les DEUX implémentations reward/plan_jour. On assert l'égalité :
- **reward par nœud** (base et POI) ;
- **séquence de bases** de l'itinéraire ;
- **timeline `plan_jour`** (repas resto XOR picnic, circuit nommé, TSAB, dépôt encadré A/R).

Tolérance stricte : **exact** sur les coûts entiers (secondes, mètres), **epsilon 1e-9** sur les flottants. Diff lisible à l'échec (quelle base, quel champ, DB1 vs DB2).

## Cause racine supprimée par construction

La dérive vient d'avoir **deux copies** du modèle. La cible : extraire APSP + `reward_base` + `plan_jour` dans un **module partagé** `calc/lib/` (Python), importé par le calcul à cru **et** référencé par le sidecar (portage B). Le test devient alors une garantie de portage fidèle, plus un rattrapage manuel.

## Usage

```bash
# Niveau (a) : empreinte DB1 seule (toujours possible sur ce terminal)
python calc/tests/ecart/run_ecart.py --db1 --empreinte

# Niveau (a) : comparaison DB1 vs DB2 (nécessite le DSN DB2, via B)
DB2_DSN="postgresql://..." python calc/tests/ecart/run_ecart.py --compare

# Niveau (b) : parité de modèle sur fixtures (quand calc/lib est câblé)
python calc/tests/ecart/run_ecart.py --modele --fixtures calc/tests/ecart/fixtures/
```

Sortie : `0` si tout concorde, `!= 0` si divergence (le gate casse). Le Maître câble ensuite `npm run test:ecart` sur cette commande.

## État

- [x] Design + squelette de harnais.
- [x] Niveau (a) empreinte DB1 (fonctionnel).
- [ ] Niveau (a) comparaison DB2 (attend le DSN DB2 / le pont `db/sync`).
- [ ] Niveau (b) parité de modèle (attend `calc/lib/` factorisé + fixtures).
- [ ] Preuve que le test casse (perturber un reward, vérifier le rouge).
