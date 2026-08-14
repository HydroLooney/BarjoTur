# Tests du modèle d'horaires (M120/M124, A25) — logique PURE, sans DB ni OR-Tools. Deux contraintes de réalisme
# temporel : la FENÊTRE des ferries intérieurs (dernier départ à ne pas rater) et les HEURES D'OUVERTURE des POI. Les
# horaires réels viennent d'A (flip) ; ici, synthétiques. Nourrit le CP-SAT (contraintes) ET la planification jour A* live.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from horaires import (  # noqa: E402
    hhmm_en_minutes,
    FenetreFerry,
    HeuresPoi,
    ferry_atteignable,
    visite_dans_ouverture,
    sequence_ferries_faisable,
)


def test_hhmm_en_minutes():
    assert hhmm_en_minutes("08:30") == 510
    assert hhmm_en_minutes("19:00") == 1140
    assert hhmm_en_minutes("00:00") == 0


def test_ferry_atteignable_avant_le_dernier_depart():
    f = FenetreFerry(de=1, vers=2, dernier_depart_min=hhmm_en_minutes("19:00"), duree_min=40)
    assert ferry_atteignable(hhmm_en_minutes("18:20"), f) is True   # arrive à temps
    assert ferry_atteignable(hhmm_en_minutes("19:00"), f) is True   # pile au départ
    assert ferry_atteignable(hhmm_en_minutes("19:10"), f) is False  # raté


def test_visite_dans_les_heures_d_ouverture():
    h = HeuresPoi(poi_id=7, ouverture_min=hhmm_en_minutes("09:00"), fermeture_min=hhmm_en_minutes("18:00"))
    assert visite_dans_ouverture(hhmm_en_minutes("10:00"), 90, h) is True
    assert visite_dans_ouverture(hhmm_en_minutes("08:30"), 90, h) is False   # avant ouverture
    assert visite_dans_ouverture(hhmm_en_minutes("17:00"), 90, h) is False   # dépasse la fermeture
    # POI sans heures (ouvert en permanence) : toujours OK
    assert visite_dans_ouverture(0, 90, HeuresPoi(poi_id=8)) is True


def test_sequence_ferries_faisable_signale_le_premier_rate():
    ferries = [
        FenetreFerry(de=1, vers=2, dernier_depart_min=hhmm_en_minutes("12:00"), duree_min=30),
        FenetreFerry(de=3, vers=4, dernier_depart_min=hhmm_en_minutes("16:00"), duree_min=30),
    ]
    # arrivées aux quais : 11:30 (ok) puis 16:30 (raté)
    ok, raison = sequence_ferries_faisable([hhmm_en_minutes("11:30"), hhmm_en_minutes("16:30")], ferries)
    assert ok is False and "3" in raison  # le 2e ferry (de=3) est manqué
    ok2, _ = sequence_ferries_faisable([hhmm_en_minutes("11:30"), hhmm_en_minutes("15:30")], ferries)
    assert ok2 is True
