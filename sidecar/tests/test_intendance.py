# TDD (M353) : intendance du composeur. (1) RAVITAILLEMENT : cadence réglable + durée dérivée (intervalle/2 arrondie
# 0,5 h ; ancres 6j→3h, 2j→1h), positionné dans la boucle, consomme le budget temps. (2) Couche PRÉFÉRENCES CONFORT
# douces : une préférence voyageur est CLAMPÉE dans les bornes organisateur (jamais hors cadre) avant agrégation leximin.
# Pur, sans DB ni OR-Tools. Params = budget.parametre (défauts ici).

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from intendance import (  # noqa: E402
    duree_ravitaillement_h,
    positions_ravitaillement,
    clamp_preference,
)


def test_duree_ravitaillement_ancres_et_arrondi():
    assert duree_ravitaillement_h(6) == 3.0   # ancre
    assert duree_ravitaillement_h(2) == 1.0   # ancre
    assert duree_ravitaillement_h(4) == 2.0
    assert duree_ravitaillement_h(5) == 2.5   # 2.5 arrondi 0,5
    assert duree_ravitaillement_h(3) == 1.5


def test_positions_ravitaillement_a_la_cadence():
    assert positions_ravitaillement(21, 6) == [6, 12, 18]
    assert positions_ravitaillement(21, 4) == [4, 8, 12, 16, 20]
    assert positions_ravitaillement(5, 6) == []  # boucle trop courte : aucun


def test_clamp_preference_reste_dans_les_bornes_organisateur():
    # un voyageur ne peut pas exprimer hors des bornes fixées par les responsables
    assert clamp_preference(2, borne_min=1, borne_max=3) == 2   # dedans
    assert clamp_preference(5, borne_min=1, borne_max=3) == 3   # écrêté au max
    assert clamp_preference(0, borne_min=1, borne_max=3) == 1   # relevé au min


def test_clamp_preference_defaut_si_non_exprimee():
    assert clamp_preference(None, borne_min=1, borne_max=3, defaut=2) == 2  # défaut organisateur


# --- M361 §3 : agrégation LEXIMIN des préférences confort douces (maximiser la satisfaction du moins servi) ---
from intendance import agreger_confort_leximin  # noqa: E402


def test_agreger_confort_unanime():
    assert agreger_confort_leximin([3, 3, 3]) == 3


def test_agreger_confort_maximise_le_moins_servi():
    # centre de Chebyshev = (min+max)/2 : minimise l'écart max → maximise la satisfaction du moins servi (leximin).
    assert agreger_confort_leximin([2, 4]) == 3
    assert agreger_confort_leximin([1, 2, 5]) == 3   # extrêmes 1 et 5 → 3


def test_agreger_confort_ignore_non_exprimes_et_vide():
    assert agreger_confort_leximin([None, 2, None, 4]) == 3
    assert agreger_confort_leximin([]) is None
    assert agreger_confort_leximin([None, None], defaut=2) == 2
