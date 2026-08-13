#!/usr/bin/env python3
"""calc/gis_mcda/f_vif_critic.py — orthogonalité (VIF) + poids objectifs (CRITIC) des critères F.

Étape fondatrice de la couche QUALITÉ du moteur GIS-MCDA (T013 / A-08). Avant d'agréger les critères
en champ de qualité par OWA, on vérifie qu'ils sont INDÉPENDANTS (sinon on compte deux fois la même
information) et on en dérive des poids OBJECTIFS, data-driven, non arbitraires.

- VIF (Variance Inflation Factor) = diag(inv(matrice de corrélation)). VIF ~ 1 = orthogonal ;
  VIF > ~2,3 = redondance à traiter (fusion, orthogonalisation, ou justification).
- CRITIC (CRiteria Importance Through Intercriteria Correlation) : w_j proportionnel à
  sigma_j * somme_k (1 - r_jk). Récompense un critère qui DISCRIMINE (sigma haut) et qui est UNIQUE
  (faible corrélation aux autres). Poids objectifs, à confronter aux poids d'esprit (philosophie).

Sans dépendance BDD : lit via psql. Sortie = rapport lisible (aucune écriture en base à ce stade).
Réf. méthode : documentation/gis-mcda.md, docs/gis-mcda/07 (indépendance) et 12 (agrégation).
"""

from __future__ import annotations

import subprocess
import sys

import numpy as np

# Critères F candidats (poi_f_v2). hors_foule = anti-foule (f3 a une version _final séparée).
CRITERES = ["f1_naturalite", "f2_grandeur", "f3_tranquillite", "f4_rando",
            "f5_bivouac", "f6_vanacces", "f7_services", "hors_foule"]


def charge() -> tuple[np.ndarray, list[str]]:
    """Charge les critères F (lignes complètes, sans NULL) depuis DB1 via psql."""
    cols = ", ".join(CRITERES)
    where = " AND ".join(f"{c} IS NOT NULL" for c in CRITERES)
    sql = f"SELECT {cols} FROM mcda2.poi_f_v2 WHERE {where};"
    out = subprocess.run(
        ["psql", "-h", "localhost", "-p", "5433", "-d", "norvege_routing", "-At", "-F", "\t", "-c", sql],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr.strip())
    rows = [[float(x) for x in line.split("\t")] for line in out.stdout.splitlines() if line]
    return np.array(rows), CRITERES


def vif(x: np.ndarray) -> np.ndarray:
    """VIF par colonne = diagonale de l'inverse de la matrice de corrélation."""
    r = np.corrcoef(x, rowvar=False)
    # colonnes à variance nulle -> corrélation NaN : on les neutralise (VIF = 1).
    r = np.nan_to_num(r, nan=0.0)
    np.fill_diagonal(r, 1.0)
    try:
        return np.diag(np.linalg.inv(r))
    except np.linalg.LinAlgError:
        return np.diag(np.linalg.pinv(r))


def critic(x: np.ndarray) -> np.ndarray:
    """Poids CRITIC : w_j ∝ sigma_j * somme_k (1 - r_jk), normalisés à 1."""
    r = np.nan_to_num(np.corrcoef(x, rowvar=False), nan=0.0)
    sigma = x.std(axis=0, ddof=1)
    conflit = (1.0 - r).sum(axis=1)          # somme sur k de (1 - r_jk)
    c = sigma * conflit
    return c / c.sum() if c.sum() else np.full(len(c), 1.0 / len(c))


def main() -> int:
    x, noms = charge()
    n, p = x.shape
    v = vif(x)
    w = critic(x)
    r = np.nan_to_num(np.corrcoef(x, rowvar=False), nan=0.0)

    print(f"== VIF + CRITIC sur {n} POI, {p} critères F ==\n")
    print(f"{'critère':16s} {'écart-type':>10s} {'VIF':>7s} {'poids CRITIC':>13s}  {'verdict'}")
    for j, nom in enumerate(noms):
        drapeau = "OK" if v[j] < 2.3 else ("redondant" if v[j] < 5 else "COLINÉAIRE")
        print(f"{nom:16s} {x[:, j].std():>10.3f} {v[j]:>7.2f} {w[j]:>13.3f}  {drapeau}")

    print(f"\nVIF max = {v.max():.2f} (cible < 2,3). Somme poids CRITIC = {w.sum():.3f}.")
    # Paires les plus corrélées (diagnostic de redondance).
    print("\nPaires de critères les plus corrélées :")
    paires = sorted(
        ((abs(r[i, j]), noms[i], noms[j], r[i, j]) for i in range(p) for j in range(i + 1, p)),
        reverse=True,
    )[:3]
    for _, a, b, rr in paires:
        print(f"  {a} / {b} : r = {rr:+.2f}")
    print("\nInterprétation : VIF<2,3 partout = critères indépendants, l'OWA peut agréger sans double compte.")
    print("Les poids CRITIC sont OBJECTIFS (data-driven) ; ils se confrontent aux poids d'esprit (philosophie) à l'agrégation.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
