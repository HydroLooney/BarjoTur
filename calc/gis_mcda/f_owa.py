#!/usr/bin/env python3
"""calc/gis_mcda/f_owa.py — agrégation OWA des critères F en champ de qualité (T013 / A-08, étape 4).

Produit `mcda2.qualite_poi` : le score de qualité cardinal, stable, par POI. Méthode figée
(documentation/gis-mcda.md) : moyenne pondérée ORDONNÉE (OWA), qui généralise la somme pondérée et
règle la compensation entre critères par l'orness. Ni TOPSIS (rang qui se retourne), ni PROMETHEE
(pas de valeur cardinale) au scoring.

- Poids de RANG : OWA à entropie maximale calé sur orness = 0,65 (légèrement optimiste, on récompense
  un lieu qui excelle sur quelques critères sans exiger qu'il soit bon partout).
- Poids de CRITÈRE : CRITIC (objectifs, data-driven, étape 1). Combinés aux poids de rang par WOWA
  (Torra 1997) : l'agrégation tient compte à la fois de l'importance du critère ET de la compensation.

Sans dépendance BDD (psql). Écrit une table canonique (idempotent). Réf : docs/gis-mcda/12, 08.
"""

from __future__ import annotations

import subprocess
import sys

import numpy as np

CRITERES = ["f1_naturalite", "f2_grandeur", "f3_tranquillite", "f4_rando",
            "f5_bivouac", "f6_vanacces", "f7_services", "hors_foule"]
ORNESS = 0.65


def psql(sql: str, write: bool = False) -> str:
    out = subprocess.run(
        ["psql", "-h", "localhost", "-p", "5433", "-d", "norvege_routing",
         "-v", "ON_ERROR_STOP=1", "-At", "-F", "\t", "-c", sql],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip())
    return out.stdout.strip()


def charge():
    cols = ", ".join(CRITERES)
    where = " AND ".join(f"{c} IS NOT NULL" for c in CRITERES)
    rows = psql(f"SELECT poi_id, osm_id, {cols} FROM mcda2.poi_f_v2 WHERE {where};")
    ids, osm, x = [], [], []
    for line in rows.splitlines():
        p = line.split("\t")
        ids.append(int(p[0])); osm.append(p[1])
        x.append([float(v) for v in p[2:]])
    return np.array(ids), osm, np.array(x)


def critic_weights(x: np.ndarray) -> np.ndarray:
    r = np.nan_to_num(np.corrcoef(x, rowvar=False), nan=0.0)
    c = x.std(axis=0, ddof=1) * (1.0 - r).sum(axis=1)
    return c / c.sum()


def owa_weights(n: int, orness: float) -> np.ndarray:
    """Poids OWA à entropie maximale calés sur l'orness (bisection sur lambda).

    w_k ∝ exp(lambda*(n-k)), k=1..n (rang 1 = meilleure valeur). lambda=0 -> uniforme (orness 0,5).
    orness(w) = sum_k w_k*(n-k)/(n-1).
    """
    ranks = np.arange(n)                      # n-k pour k=1..n  ->  n-1 .. 0
    ranks = ranks[::-1]                       # (n-1), (n-2), ..., 0
    if abs(orness - 0.5) < 1e-9:
        return np.full(n, 1.0 / n)
    lo, hi = (0.0, 50.0) if orness > 0.5 else (-50.0, 0.0)
    for _ in range(100):
        lam = (lo + hi) / 2
        w = np.exp(lam * ranks); w /= w.sum()
        o = (w * ranks).sum() / (n - 1)
        if o > orness:
            hi = lam
        else:
            lo = lam
    return w


def wowa(x_row: np.ndarray, p: np.ndarray, w: np.ndarray) -> float:
    """WOWA (Torra) : combine poids de critère p et poids de rang OWA w.

    Trie les valeurs décroissant ; ω_k = w*(S_k) - w*(S_{k-1}) où S_k = somme cumulée des p triés
    et w* interpole linéairement la cumulée des poids OWA. Rend l'agrégat cardinal ∈ [0,1].
    """
    order = np.argsort(-x_row)                # rangs par valeur décroissante
    xs = x_row[order]
    ps = p[order]
    cum_w = np.concatenate(([0.0], np.cumsum(w[::-1])))  # cumulée OWA (rang 1 = poids w[0])
    # w* : interpolation linéaire de la cumulée OWA aux points de la cumulée des critères.
    grid = np.linspace(0.0, 1.0, len(w) + 1)
    cum_p = np.concatenate(([0.0], np.cumsum(ps)))
    wstar = np.interp(cum_p, grid, cum_w)
    omega = np.diff(wstar)
    return float((omega * xs).sum())


def main() -> int:
    ids, osm, x = charge()
    n, p = x.shape
    crit = critic_weights(x)
    w = owa_weights(p, ORNESS)
    orness_reel = (w * np.arange(p)[::-1]).sum() / (p - 1)

    qual = np.array([wowa(x[i], crit, w) for i in range(n)])

    print(f"== OWA -> qualite_poi : {n} POI, {p} critères, orness cible {ORNESS} (réel {orness_reel:.3f}) ==")
    print(f"poids OWA (rang 1..{p}) : {np.round(w, 3)}")
    print(f"qualité : min {qual.min():.3f}  moy {qual.mean():.3f}  méd {np.median(qual):.3f}  max {qual.max():.3f}")

    # Écriture canonique (idempotent).
    values = ",".join(f"({ids[i]},'{osm[i]}',{qual[i]:.6f})" for i in range(n))
    psql("DROP TABLE IF EXISTS mcda2.qualite_poi;")
    psql("CREATE TABLE mcda2.qualite_poi (poi_id bigint PRIMARY KEY, osm_id text, qualite double precision);")
    psql(f"INSERT INTO mcda2.qualite_poi (poi_id, osm_id, qualite) VALUES {values};")
    psql("COMMENT ON TABLE mcda2.qualite_poi IS "
         "'Champ de qualité GIS-MCDA (T013) : WOWA(CRITIC, OWA orness 0.65) sur F1-F8. "
         "Score cardinal stable. f_owa.py. Krigeage réseau = étape suivante (champ continu).';")
    print(f"écrit mcda2.qualite_poi ({n} lignes).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
