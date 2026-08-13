# Dictionnaire de données BarjoTur (DB1 et DB2)

> Chantier C02 / tâche T003. Propriété : Worker A. Le Maître câble la migration Q11 derrière les vues stables.

Ce dossier est la source de vérité du **schéma de données** du projet. Il fige les noms cibles (convention Q11) et documente chaque objet canonique : entrées, méthode, sortie, provenance, confiance. C'est le pré-requis de tout recalcul (A14, doctrine des calculs canoniques).

## Contenu

| Fichier | Rôle |
|---|---|
| `convention-nommage-q11.md` | La grammaire de nommage figée (Option B, schéma `staging` pour les intermédiaires). Contrat pour la migration. |
| `catalogue.sql` | Générateur : introspecte `pg_catalog` et sort l'inventaire par schéma, relation, colonne, commentaire. Rejouable. |
| `DB1-inventaire.md` | Inventaire vivant de DB1 (`norvege_routing`), généré puis annoté. Le canonique vs l'éphémère. |
| `DB2-inventaire.md` | Inventaire de DB2 (`norvege_v2`), vu depuis A02 et l'audit B (à compléter avec B). |

## Principe

- **On documente d'abord, on renomme ensuite.** Rien n'est renommé en masse maintenant (casse API, votes, tuiles). On gèle la cible ; le Maître migre par lots, un calcul à la fois, derrière les vues `api.*` (DB2) et `diffusion.v_web_*` (DB1).
- **Une seule version vivante par calcul.** Les 99 tables `_*` de `mcda2` et les 4 backups sont des intermédiaires : à baliser (COMMENT + convention), puis déplacer, jamais avant le gel du dictionnaire (consigne M001).
- Chaque objet canonique porte à terme un COMMENT en base (méthode, entrées, version) et une ligne ici.

## Régénérer l'inventaire

```bash
psql -h localhost -p 5433 -d norvege_routing -f db/dictionnaire/catalogue.sql
```
