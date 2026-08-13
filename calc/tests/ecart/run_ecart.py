#!/usr/bin/env python3
"""Test de non-régression d'écart DB1 <-> DB2 (livrable n°1, C17 / T004).

Casse à la moindre divergence du dérivé canonique entre DB1 (à cru, worker) et
DB2 (servi, backend). Deux niveaux : (a) empreinte des tables canoniques,
(b) parité de modèle reward/plan_jour sur fixtures.

Sans dépendance : passe par `psql`. DB1 = local :5433 trust. DB2 = DSN via env.
Sortie 0 = concordance, != 0 = divergence ou run incomplet (le gate casse).

Déterminisme : chaque session psql fixe extra_float_digits/datestyle/timezone
pour que la sérialisation ::text des flottants et dates soit identique des deux
côtés (sinon faux ROUGE sur données pourtant égales). Rappel : les colonnes
numeric à échelle déclarée différente (numeric vs numeric(10,3)) restent
volontairement une divergence détectée (c'est un écart de schéma réel).
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

DB1 = {"host": "localhost", "port": "5433", "dbname": "norvege_routing"}
DB2_DSN = os.environ.get("DB2_DSN")  # fourni par B / le pont db/sync

# Déterminisme de session : posé à la CONNEXION via PGOPTIONS (pas d'instruction
# SET dans le SQL, qui émettrait un tag « SET » sur stdout et polluerait la sortie).
# extra_float_digits=3 = round-trip exact des float4/float8 ; datestyle/timezone
# figent la sérialisation ::text des dates. Identique des deux côtés (DB1, DB2).
PGOPTIONS = "-c extra_float_digits=3 -c datestyle=ISO -c timezone=UTC"

# Un identifiant SQL sûr : schema.relation ou colonne simple, minuscules/chiffres/_.
_IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


def _valider_relation(relation: str) -> tuple[str, str]:
    """Refuse tout ce qui n'est pas un `schema.table` simple (garde-fou injection)."""
    parts = relation.split(".")
    if len(parts) != 2 or not all(_IDENT.match(p) for p in parts):
        raise ValueError(f"relation non valide : {relation!r}")
    return parts[0], parts[1]


# Tables canoniques dont le dérivé DOIT concorder DB1 <-> DB2.
# Colonnes d'état autoritaires en DB2 (votes, fige, statut) EXCLUES de l'empreinte.
# La liste grandit avec le recalcul ; noms cibles Q11 au fur et à mesure.
TABLES_CANONIQUES = [
    # (schema.table, colonnes_a_ignorer)
    ("mcda2.base_base_routes_v2", []),      # -> matrice_base_base après T006
    ("mcda2.base_base_cost_temps", []),     # absorbé dans la matrice cible
    ("mcda2.poi_f_v2", []),                 # -> poi_facteurs
    ("mcda2.bases_v2", []),                 # -> bases
    ("mcda2.base_reward_inputs", []),
]


def psql(sql: str, dsn: dict | str) -> str:
    """Exécute un SQL en lecture seule et rend la sortie brute (tab-separated).

    Préfixe le prélude de session pour un ::text déterministe des deux côtés.
    """
    if isinstance(dsn, str):
        cmd = ["psql", dsn, "-At", "-F", "\t", "-c", sql]
    else:
        cmd = ["psql", "-h", dsn["host"], "-p", dsn["port"], "-d", dsn["dbname"],
               "-At", "-F", "\t", "-c", sql]
    env = {**os.environ, "PGOPTIONS": PGOPTIONS}
    out = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if out.returncode != 0:
        raise RuntimeError(f"psql a échoué : {out.stderr.strip()}")
    return out.stdout.strip()


def colonnes(relation: str, dsn) -> list[str]:
    """Colonnes de la relation, ordonnées par NOM (stable entre DB1 et DB2,
    indépendant de l'ordre physique / ordinal_position qui peut diverger)."""
    schema, table = _valider_relation(relation)
    sql = (
        "SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='{schema}' AND table_name='{table}' "
        "ORDER BY column_name;"
    )
    return [c for c in psql(sql, dsn).splitlines() if c]


def empreinte_table(relation: str, ignorer: list[str], dsn) -> dict:
    """Empreinte stable d'une table : nb lignes + md5 des lignes triées.

    L'ordre des lignes n'importe pas (on trie par le hash de ligne), pour rester
    robuste à un ORDER physique différent entre DB1 et DB2. Quand `ignorer` est
    fourni, on projette les colonnes retenues dans un ORDRE STABLE (par nom),
    identifiants quotés, pour aligner DB1 et DB2 quelles que soient leurs
    positions physiques.
    """
    _valider_relation(relation)
    if ignorer:
        retenues = [c for c in colonnes(relation, dsn) if c not in ignorer]
        if not retenues:
            raise RuntimeError(f"{relation} : toutes les colonnes ignorées")
        cols = ", ".join(f'x."{c}"' for c in retenues)
        projection = f"ROW({cols})"
    else:
        projection = "x"
    sql = (
        f"SELECT count(*), "
        f"COALESCE(md5(string_agg(rh, '' ORDER BY rh)), 'vide') "
        f"FROM (SELECT md5({projection}::text) AS rh FROM {relation} x) s;"
    )
    n, h = psql(sql, dsn).split("\t")
    return {"relation": relation, "lignes": int(n), "md5": h}


def cmd_empreinte(dsn, label: str) -> tuple[dict, int]:
    """Calcule les empreintes ; rend (résultats, nb_erreurs)."""
    print(f"== Empreinte {label} ==")
    res, erreurs = {}, 0
    for relation, ignorer in TABLES_CANONIQUES:
        try:
            e = empreinte_table(relation, ignorer, dsn)
            res[relation] = e
            print(f"  {relation:38s} {e['lignes']:>8} lignes  md5={e['md5'][:12]}")
        except (RuntimeError, ValueError) as err:
            res[relation] = {"relation": relation, "erreur": str(err)}
            erreurs += 1
            print(f"  {relation:38s} ERREUR {err}")
    return res, erreurs


def cmd_compare() -> int:
    if not DB2_DSN:
        print("DB2_DSN absent : comparaison impossible depuis ce terminal.", file=sys.stderr)
        print("Empreinte DB1 seule (référence à figer, à comparer côté B) :", file=sys.stderr)
        _, err = cmd_empreinte(DB1, "DB1")
        return 2 if err == 0 else 1  # ni vert ni rouge sauf si l'empreinte elle-même casse
    e1, err1 = cmd_empreinte(DB1, "DB1 (à cru)")
    e2, err2 = cmd_empreinte(DB2_DSN, "DB2 (servi)")
    divergences = []
    for relation, _ in TABLES_CANONIQUES:
        a, b = e1.get(relation, {}), e2.get(relation, {})
        # Une empreinte en erreur d'un côté ou de l'autre = divergence (jamais concordance).
        if "erreur" in a or "erreur" in b:
            divergences.append((relation, a, b))
            continue
        if a.get("md5") != b.get("md5") or a.get("lignes") != b.get("lignes"):
            divergences.append((relation, a, b))
    if divergences:
        print("\nDIVERGENCE (le gate casse) :", file=sys.stderr)
        for relation, a, b in divergences:
            va = a.get("erreur") or f"{a.get('lignes')}/{str(a.get('md5'))[:12]}"
            vb = b.get("erreur") or f"{b.get('lignes')}/{str(b.get('md5'))[:12]}"
            print(f"  {relation} : DB1={va} != DB2={vb}", file=sys.stderr)
        return 1
    print("\nConcordance DB1 == DB2 sur toutes les tables canoniques.")
    return 0


def cmd_modele(fixtures_dir: str) -> int:
    """Parité de modèle reward/plan_jour sur fixtures.

    Câblé quand `calc/lib/` factorise reward + apsp + plan_jour, et que les
    fixtures (archétypes, curseurs, votes, snapshot registre) sont figées.
    """
    fixtures = sorted(Path(fixtures_dir).glob("*.json"))
    if not fixtures:
        print(f"Aucune fixture dans {fixtures_dir} : niveau (b) non encore câblé.", file=sys.stderr)
        return 2
    try:
        from calc.lib import composeur  # noqa: F401  (à créer, factorisation R06.A)
    except ImportError:
        print("calc/lib non encore factorisé : niveau (b) en attente.", file=sys.stderr)
        return 2
    # TODO(A) : charger chaque fixture, calculer reward + plan_jour via calc/lib,
    # comparer au golden enregistré (exact entier, epsilon 1e-9 flottant),
    # rendre un diff lisible et sortir != 0 à la moindre divergence.
    print("Niveau (b) : à implémenter une fois calc/lib et les goldens en place.")
    return 2


def main() -> int:
    p = argparse.ArgumentParser(description="Test d'écart DB1 <-> DB2 (C17).")
    p.add_argument("--db1", action="store_true", help="empreinte DB1 seule")
    p.add_argument("--empreinte", action="store_true", help="calcule les empreintes")
    p.add_argument("--compare", action="store_true", help="compare DB1 vs DB2 (DB2_DSN requis)")
    p.add_argument("--modele", action="store_true", help="parité de modèle sur fixtures")
    p.add_argument("--fixtures", default="calc/tests/ecart/fixtures/", help="dossier des fixtures")
    args = p.parse_args()

    if args.compare:
        return cmd_compare()
    if args.modele:
        return cmd_modele(args.fixtures)
    if args.db1 or args.empreinte:
        _, err = cmd_empreinte(DB1, "DB1")
        return 1 if err else 0  # une empreinte de référence qui casse ne doit pas passer au vert
    p.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
