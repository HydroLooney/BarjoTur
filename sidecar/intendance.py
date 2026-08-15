"""Intendance du composeur (M353). PUR, sans DB ni OR-Tools ; le positionnement réel et l'insertion OR-Tools = G4/Bomp4rd.

(1) RAVITAILLEMENT : le composeur positionne des courses à cadence réglable ; la durée dérive de l'intervalle
(intervalle/2 h, arrondie à la demi-heure : 6 j → 3 h, 2 j → 1 h) et consomme le budget temps du jour. Paramètres rangés
en `budget.parametre`, gatés `peut(role,'regler_composition')` (organisateurs — intendance, pas conduite). Data commerces
= A (v_web).

(2) COUCHE PRÉFÉRENCES CONFORT DOUCES : une préférence de voyageur est TOUJOURS CLAMPÉE dans les bornes fixées par les
organisateurs avant agrégation leximin (comme votes/appétit : équité DANS le cadre). Défaut organisateur là où personne
n'exprime.
"""

from __future__ import annotations

from typing import Optional


def duree_ravitaillement_h(intervalle_j: float) -> float:
    """Durée d'un ravitaillement = intervalle/2 heures, ARRONDIE à la demi-heure (ancres M353 : 6 j → 3 h, 2 j → 1 h).
    Ajustable (l'appelant peut passer un intervalle réglé). Pure."""
    return round((intervalle_j / 2) * 2) / 2


def positions_ravitaillement(nb_jours: int, intervalle_j: int) -> list[int]:
    """Jours (1..nb_jours) où positionner un ravitaillement, à la cadence `intervalle_j` (jours `intervalle`, `2*intervalle`,
    …). Boucle trop courte → aucun. Le positionnement fin (près d'un commerce, dans le budget-temps) = OR-Tools au flip. Pure."""
    if intervalle_j <= 0:
        return []
    return list(range(intervalle_j, nb_jours + 1, intervalle_j))


def clamp_preference(
    pref: Optional[float],
    borne_min: float,
    borne_max: float,
    defaut: Optional[float] = None,
) -> Optional[float]:
    """Ramène une préférence de confort DOUCE dans les bornes organisateur [borne_min, borne_max] (jamais hors cadre,
    M353 §2). `None` → `defaut` organisateur (puis clampé). Rend None si ni préférence ni défaut. Pure. C'est l'étape
    AVANT l'agrégation leximin (équité entre voyageurs, comme votes/appétit)."""
    if pref is None:
        pref = defaut
    if pref is None:
        return None
    return max(borne_min, min(pref, borne_max))


def agreger_confort_leximin(prefs: list[Optional[float]], defaut: Optional[float] = None) -> Optional[float]:
    """Agrège les préférences confort DOUCES (déjà clampées) d'une dimension en une valeur de groupe LEXIMIN /
    égalitariste : MAXIMISE la satisfaction du MOINS SERVI (M361 §3, PARAMETRES-ARCHITECTURE-v3). Pour une satisfaction
    = −|valeur − préférence|, l'optimum max-min est le CENTRE de Chebyshev (min+max)/2 (minimise l'écart maximal → le
    voyageur le plus mal servi l'est le moins possible ; symétrique = équitable). Ignore les non-exprimés ; `defaut`
    (organisateur) si personne n'exprime. Pure."""
    vals = [p for p in prefs if p is not None]
    if not vals:
        return defaut
    return (min(vals) + max(vals)) / 2
