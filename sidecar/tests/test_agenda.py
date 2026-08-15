# Tests de l'agenda chronologique du jour (T032b/M147) — logique PURE, sans DB ni OR-Tools. Le micro-OP jour n'est PAS
# un sac d'activités : il respecte la CHRONOLOGIE (matin→soir) et les HEURES D'OUVERTURE. Compose horaires.py.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from horaires import HeuresPoi, hhmm_en_minutes  # noqa: E402
from agenda import ActiviteJour, composer_agenda_jour  # noqa: E402


def test_agenda_enchaine_dans_l_ordre_avec_trajets():
    acts = [
        ActiviteJour(poi_id=1, duree_min=60),
        ActiviteJour(poi_id=2, duree_min=90, trajet_avant_min=30),
    ]
    agenda, faisable, _ = composer_agenda_jour(acts, debut_min=hhmm_en_minutes("09:00"))
    assert faisable is True
    assert (agenda[0].poi_id, agenda[0].debut_min, agenda[0].fin_min) == (1, 540, 600)
    assert (agenda[1].poi_id, agenda[1].debut_min, agenda[1].fin_min) == (2, 630, 720)  # 600 + 30 trajet
    assert [c.debut_min for c in agenda] == sorted(c.debut_min for c in agenda)  # chronologie croissante


def test_agenda_attend_l_ouverture_si_on_arrive_trop_tot():
    acts = [ActiviteJour(poi_id=7, duree_min=60, heures=HeuresPoi(7, ouverture_min=hhmm_en_minutes("10:00")))]
    agenda, faisable, _ = composer_agenda_jour(acts, debut_min=hhmm_en_minutes("08:30"))
    assert faisable is True
    assert (agenda[0].debut_min, agenda[0].fin_min) == (600, 660)  # attend l'ouverture 10:00


def test_agenda_infaisable_si_une_visite_deborde_la_fermeture():
    acts = [ActiviteJour(poi_id=9, duree_min=90, heures=HeuresPoi(9, fermeture_min=hhmm_en_minutes("18:00")))]
    agenda, faisable, raison = composer_agenda_jour(acts, debut_min=hhmm_en_minutes("17:00"))
    assert faisable is False
    assert "9" in raison  # nomme le POI qui déborde
