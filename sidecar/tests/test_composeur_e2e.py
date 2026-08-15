# Jalon M154 §1 : le composeur DE BOUT EN BOUT sur synthétique. On enchaîne les briques déjà livrées — agrégation
# consensus → allocation (DP amorce) → idéal/écart PAR PERSONNE (leximin) → agenda chronologique du jour — et on prouve
# qu'un voyage synthétique se compose intégralement, avec un agenda daté faisable et l'équité mesurée. PUR, sans OR-Tools.
# Au dump d'A (vrai reward + matrice + durées modulées appétit), ça se branche sans refonte.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from allocation import (  # noqa: E402
    CourbeLieu,
    Cadre,
    EntreeAllocation,
    agreger_egalitariste,
    resoudre_allocation,
    ideal_voyageur,
    ecart_ideal,
    satisfaction_par_voyageur,
    leximin_cle,
)
from horaires import HeuresPoi, hhmm_en_minutes  # noqa: E402
from agenda import ActiviteJour, composer_agenda_jour  # noqa: E402


def test_composeur_bout_en_bout_voyage_synthetique():
    # 2 voyageurs (A, B), 3 lieux. Courbes marginales PAR VOYAGEUR (le vrai reward viendra d'A).
    courbes = {
        1: {"A": [10, 8], "B": [9, 7]},  # lieu fort pour les deux
        2: {"A": [6], "B": [2]},         # A aime, B non
        3: {"A": [1], "B": [8]},         # B aime, A non
    }
    couts = {(0, 1): 5, (1, 2): 8, (2, 9): 6, (1, 9): 4}
    cadre = Cadre(total_nuits=3, depart=0, arrivee=9)

    # 1) CONSENSUS égalitariste (min par cran) → courbe par lieu, puis ALLOCATION (DP amorce).
    lieux_consensus = [
        CourbeLieu(lieu_id=lid, marginaux=agreger_egalitariste(list(v.values())))
        for lid, v in courbes.items()
    ]
    res = resoudre_allocation(EntreeAllocation(lieux=lieux_consensus, couts_trajet=couts, cadre=cadre, mode="full_auto"))
    assert res.selection == [1, 2]           # lieu 3 tombe (consensus faible)
    assert res.nuits == {1: 2, 2: 1}
    assert res.faisable is True and res.ordre  # route trouvée (Held-Karp)

    # 2) IDÉAL PAR PERSONNE + ÉCART (leximin) : chacun a son idéal, on mesure qui est lésé.
    ideal_A = ideal_voyageur("A", [CourbeLieu(l, c["A"]) for l, c in courbes.items()], couts, cadre)
    ideal_B = ideal_voyageur("B", [CourbeLieu(l, c["B"]) for l, c in courbes.items()], couts, cadre)
    assert ideal_A["resultat"]["nuits"] == {1: 2, 2: 1}   # A : le commun EST son idéal
    assert ideal_B["resultat"]["nuits"] == {1: 2, 3: 1}   # B rêvait du lieu 3

    ec_A = ecart_ideal("A", res.nuits, ideal_A["resultat"]["nuits"], cadre.total_nuits)
    ec_B = ecart_ideal("B", res.nuits, ideal_B["resultat"]["nuits"], cadre.total_nuits)
    assert ec_A["ecart"] == 0.0                      # A parfaitement servi
    assert ec_B["ecart"] > 0 and ec_B["cede"] == ["3"]  # B cède le lieu 3

    # satisfaction FINALE par personne + clé leximin (on soigne d'abord le moins bien servi).
    sat = satisfaction_par_voyageur(res.nuits, courbes)
    assert sat == {"A": 24.0, "B": 18.0}             # B est le moins bien servi
    assert leximin_cle(sat.values()) == (18.0, 24.0)

    # 3) AGENDA CHRONOLOGIQUE d'un jour au lieu 1 (matin→soir, heures d'ouverture respectées).
    activites = [
        ActiviteJour(poi_id=101, duree_min=90, heures=HeuresPoi(101, ouverture_min=hhmm_en_minutes("09:00"))),
        ActiviteJour(poi_id=102, duree_min=60, trajet_avant_min=20,
                     heures=HeuresPoi(102, fermeture_min=hhmm_en_minutes("18:00"))),
    ]
    agenda, faisable, _ = composer_agenda_jour(activites, debut_min=hhmm_en_minutes("08:30"))
    assert faisable is True
    assert agenda[0].debut_min == hhmm_en_minutes("09:00")   # a attendu l'ouverture
    assert [c.debut_min for c in agenda] == sorted(c.debut_min for c in agenda)  # chronologie
