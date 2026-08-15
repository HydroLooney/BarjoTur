"""reward.py (A, modèle v3.1) — récompense de base + coût multimodal. Contrat = sidecar/INTERFACES.md (figé M).

`cout_multimodal` : UTILISABLE DÈS MAINTENANT (données en DB2, diffusion.base_base_multimodal_v31, A172).
`reward_base` : signature STABLE ; le CORPS de formule (combinaison f1-f6 / orness / V_poi) attend le pré-design
#2 orness / #4 conduite / #6 V_poi (M+Guillaume) → laissé en TODO borné, tout le reste est codé.

Surface disjointe de B : A code ces corps ; composeur.py (B) les appelle. Data = domaine exclusif A.
"""
from __future__ import annotations

import os
from typing import Optional

import psycopg

from modele_types import CoutTrajet, OptionTrajet, Signature

DSN = os.environ.get("DATABASE_URL", "")

# #2 ORNESS (FORMULES-COMPOSEUR-v3.1.md) — convention YAGER : 1=OR/disjonctif (le meilleur critère domine = SPÉCIALISTE),
#   0=AND/conjonctif (un point faible pèse = POLYVALENT), 0.5=moyenne. Via RIM Q(x)=x^r, orness = 1/(r+1).
# ⚠️ R1 (A178→M548) : l'INTENTION Guillaume = « polyvalent, un point faible pèse » = AND-leaning = orness < 0.5.
#   Le « 0.6 » de la doc, en convention Yager, donnerait l'INVERSE (spécialiste). M a dit « l'intention prime sur le chiffre »
#   → défaut réglé à 0.4 (tient la polyvalence). SIGNALÉ M pour confirmation du chiffre. Réglable expert (curseur Coulisses).
ORNESS_DEFAUT = 0.4

# Paramètres carburant (van diesel Norvège) — À CONFIRMER avec routing_params (source de vérité) ; défauts prudents.
CONSO_L_PAR_100KM = 10.0
PRIX_DIESEL_EUR_PAR_L = 1.85
_EUR_PAR_KM = CONSO_L_PAR_100KM / 100.0 * PRIX_DIESEL_EUR_PAR_L  # ≈ 0,185 €/km

# Cache chargé UNE FOIS (la matrice base-à-base est petite, 27060 lignes) → O(1) par arête ensuite.
_MULTIMODAL: Optional[dict[tuple[int, int], CoutTrajet]] = None


def _charger_multimodal(dsn: str = "") -> dict[tuple[int, int], CoutTrajet]:
    """Charge diffusion.base_base_multimodal_v31 en cache {(src,tgt): CoutTrajet}. carburant_eur = length_m * €/km."""
    q = """
        SELECT src_base, tgt_base, conduite_s, ferry_s, length_m, peage_eur, ferry_eur
        FROM diffusion.base_base_multimodal_v31
    """
    out: dict[tuple[int, int], CoutTrajet] = {}
    with psycopg.connect(dsn or DSN) as c, c.cursor() as cur:
        cur.execute(q)
        for src, tgt, conduite_s, ferry_s, length_m, peage_eur, ferry_eur in cur.fetchall():
            carburant = float(length_m or 0) / 1000.0 * _EUR_PAR_KM
            out[(int(src), int(tgt))] = CoutTrajet(
                conduite_s=int(conduite_s or 0),
                ferry_s=int(ferry_s or 0),
                peage_eur=float(peage_eur or 0.0),
                ferry_eur=float(ferry_eur or 0.0),
                carburant_eur=round(carburant, 2),
            )
    return out


def precharger(dsn: str = "") -> int:
    """Charge (ou recharge) le cache multimodal. Rend le nombre d'arêtes. À appeler une fois au démarrage du sidecar."""
    global _MULTIMODAL
    _MULTIMODAL = _charger_multimodal(dsn)
    return len(_MULTIMODAL)


def cout_multimodal(src_base: int, tgt_base: int) -> CoutTrajet:
    """Coût multimodal de src_base→tgt_base (temps route/ferry séparés + € péage/ferry/carburant). Depuis le cache DB2.
    Arête absente (paire non routée) → CoutTrajet neutre à +inf de temps (l'orienteering la traitera comme non prise)."""
    global _MULTIMODAL
    if _MULTIMODAL is None:
        precharger()
    ct = _MULTIMODAL.get((int(src_base), int(tgt_base)))  # type: ignore[union-attr]
    if ct is None:
        # symétrie de secours (le routage v3.1 est quasi symétrique hors sens uniques) puis fallback neutre.
        ct = _MULTIMODAL.get((int(tgt_base), int(src_base)))  # type: ignore[union-attr]
    return ct if ct is not None else CoutTrajet(10**9, 0, 0.0, 0.0, 0.0)


# ---------------------------------------------------------------------------------------------------------
# reward_base — CORPS de formule en attente du pré-design #2 orness / #4 conduite / #6 V_poi (M+Guillaume).
# ---------------------------------------------------------------------------------------------------------

def _charger_facteurs_base(base_id: int, dsn: str = "") -> dict[str, float]:
    """Charge les facteurs bruts d'une base (mcda2.base_reward_inputs) : f1-f6, reward_top8, hors_foule, lat_norm,
    cout_moy, th_*. Facteurs canoniques (doc db/dictionnaire/facteurs-mcda-v3.md). Read-only."""
    q = """
        SELECT f1,f2,f3,f4,f5,f6, reward_top8, hors_foule, lat_norm, cout_moy,
               th_paysage, th_rando, th_nautique, th_culturel
        FROM mcda2.base_reward_inputs WHERE base_id = %s
    """
    with psycopg.connect(dsn or DSN) as c, c.cursor() as cur:
        cur.execute(q, (int(base_id),))
        row = cur.fetchone()
    keys = ["f1", "f2", "f3", "f4", "f5", "f6", "reward_top8", "hors_foule", "lat_norm", "cout_moy",
            "th_paysage", "th_rando", "th_nautique", "th_culturel"]
    if row is None:
        return {k: 0.0 for k in keys}
    return {k: float(v or 0.0) for k, v in zip(keys, row)}


def _owa_poids(n: int, orness: float) -> list[float]:
    """Poids OWA (pour valeurs triées DÉCROISSANT) depuis l'orness, via RIM Q(x)=x^r, orness=1/(r+1) (Yager)."""
    if n <= 0:
        return []
    if orness <= 0.0:
        return [0.0] * (n - 1) + [1.0]   # AND pur (min) = polyvalent extrême
    if orness >= 1.0:
        return [1.0] + [0.0] * (n - 1)   # OR pur (max) = spécialiste extrême
    r = (1.0 - orness) / orness
    return [(i / n) ** r - ((i - 1) / n) ** r for i in range(1, n + 1)]


def _wowa(valeurs: list[float], importances: list[float], orness: float) -> float:
    """WOWA (Torra) : combine les IMPORTANCES (quels critères comptent, poids signature) et l'ORNESS (polyvalence). Pure."""
    n = len(valeurs)
    if n == 0:
        return 0.0
    sp = sum(importances) or float(n)
    p = [pi / sp for pi in importances]
    cum = [0.0]
    for w in _owa_poids(n, orness):
        cum.append(cum[-1] + w)

    def wstar(x: float) -> float:  # interpolation linéaire par morceaux des OWA cumulés aux points i/n
        pos = x * n
        lo = int(pos)
        if lo >= n:
            return 1.0
        return cum[lo] + (pos - lo) * (cum[lo + 1] - cum[lo])

    idx = sorted(range(n), key=lambda i: -valeurs[i])
    res, cp = 0.0, 0.0
    for i in idx:
        prev = cp
        cp += p[i]
        res += (wstar(cp) - wstar(prev)) * valeurs[i]
    return res


def reward_base(base_id: int, signature: Signature) -> float:
    """Récompense d'une base pour une signature. Corps CANONIQUE v3.1 (FORMULES-COMPOSEUR-v3.1.md, M548) :
    #2 qualité = WOWA(f1-f5 ; importances = poids signature ; orness = polyvalence) + F3 anti-saturation (concave) ;
    #6 incontournables = reward_top8 (V_poi intrinsèque×envies, précalculé) pondéré w_inc ; − anti-foule ; × geo_pref nord ;
    × (1+envies thématiques) ; − prix. NB #4 : le soft-cap CONDUITE est LEG-level (dépend du trajet vers la base) → appliqué au
    routage/allocation, PAS dans ce reward base-intrinsèque (signalé M A178). `cap_hard_h` (hard) = contrainte, dans la Signature."""
    f = _charger_facteurs_base(base_id)
    s = signature

    def f3(x: float) -> float:  # F3 anti-saturation : rendement décroissant par critère (concave) → un critère saturé n'écrase pas.
        return max(0.0, x) ** 0.7

    criteres = [f3(f["f1"]), f3(f["f2"]), f3(f["f3"]), f3(f["f4"]), f3(f["f5"])]
    importances = [s.get("w_nat", 0.0), s.get("w_gra", 0.0), s.get("w_tra", 0.0), s.get("w_ran", 0.0), s.get("w_biv", 0.0)]
    if sum(importances) <= 0.0:
        importances = [1.0] * 5  # signature sans poids → équipondéré
    orness = float(s.get("orness", ORNESS_DEFAUT))
    qual = _wowa(criteres, importances, orness)
    qual += s.get("w_inc", 0.0) * f["reward_top8"]                      # #6 incontournables
    qual -= s.get("anti_foule", 0.0) * (1.0 - f["hors_foule"])          # anti-foule
    biais = s.get("biais_nord", 0.5)
    geo = biais * f["lat_norm"] + (1.0 - biais) * (1.0 - f["lat_norm"])  # geo_pref nord
    r = max(0.05, qual) * (0.4 + 1.6 * geo)
    theme = (s.get("th_paysage", 0.0) * f["th_paysage"] + s.get("th_rando", 0.0) * f["th_rando"]
             + s.get("th_nautique", 0.0) * f["th_nautique"] + s.get("th_culturel", 0.0) * f["th_culturel"])
    r *= 1.0 + theme                                                    # envies thématiques (couche 2a)
    r -= s.get("sens_prix", 0.0) * f["cout_moy"]                        # #4 prix (échelle réglable)
    return float(max(0.05, r))


def cout_multimodal_options(src_base: int, tgt_base: int) -> list[OptionTrajet]:
    """Variantes multimodales src→tgt (ADDITIF, A177/M545). Tant que le PIED Turrutebasen + le TRANSIT Entur ne sont pas wirés
    dans base_base_multimodal_v31 (branchement M545), rend la seule option VAN (depuis cout_multimodal). Les options van+marche /
    van+TC+marche s'ajouteront après le branchement réseau + recalc. `cout_multimodal` van-only reste inchangé (contrat de fer)."""
    ct = cout_multimodal(src_base, tgt_base)
    modes = ["van"] + (["ferry"] if ct.ferry_s > 0 else [])
    van = OptionTrajet(
        modes=modes, temps_s=ct.temps_total_s, euros=round(ct.cout_total_eur, 2),
        segments=[{"mode": "van", "conduite_s": ct.conduite_s, "ferry_s": ct.ferry_s,
                   "peage_eur": ct.peage_eur, "ferry_eur": ct.ferry_eur, "carburant_eur": ct.carburant_eur}],
    )
    return [van]
