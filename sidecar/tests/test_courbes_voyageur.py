# TDD (M255) : miroir Python du contrat shared `CourbesVoyageurLieu` + `EntreeAllocation.courbes_par_voyageur` (option a,
# A25 leximin par voyageur). On teste ici la PARTIE EXECUTABLE : la dataclass et la desérialisation depuis le JSON du
# contrat (clés voyageur en string cote JSON -> int). Le solveur CP-SAT leximin qui CONSOMME ce champ est gate ortools
# (test_cpsat_equiv). Pur, sans OR-Tools ni DB.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from allocation import CourbesVoyageurLieu, entree_depuis_json  # noqa: E402


def test_courbes_voyageur_lieu_dataclass():
    c = CourbesVoyageurLieu(lieu_id=7, par_voyageur={1: [10.0, 6.0], 2: [3.0]})
    assert c.lieu_id == 7
    assert c.par_voyageur[1] == [10.0, 6.0]
    assert c.par_voyageur[2] == [3.0]


def test_entree_depuis_json_parse_courbes_par_voyageur():
    payload = {
        "lieux": [
            {"lieu_id": 1, "marginaux": [10, 6]},
            {"lieu_id": 2, "marginaux": [9, 5]},
        ],
        "couts_trajet": [],
        "cadre": {"total_nuits": 2, "depart": 0, "arrivee": 0},
        # clés voyageur en STRING (JSON), a ramener en int
        "courbes_par_voyageur": [
            {"lieu_id": 1, "par_voyageur": {"1": [10, 6], "2": [1, 0]}},
            {"lieu_id": 2, "par_voyageur": {"1": [1, 0], "2": [9, 5]}},
        ],
    }
    entree = entree_depuis_json(payload)
    assert entree.courbes_par_voyageur is not None
    assert len(entree.courbes_par_voyageur) == 2
    c0 = entree.courbes_par_voyageur[0]
    assert c0.lieu_id == 1
    assert set(c0.par_voyageur.keys()) == {1, 2}  # int, pas "1"/"2"
    assert c0.par_voyageur[1] == [10.0, 6.0]
    assert all(isinstance(x, float) for x in c0.par_voyageur[2])


def test_entree_depuis_json_courbes_absentes_donne_none():
    payload = {
        "lieux": [{"lieu_id": 1, "marginaux": [10, 6]}],
        "couts_trajet": [],
        "cadre": {"total_nuits": 1, "depart": 0, "arrivee": 0},
    }
    entree = entree_depuis_json(payload)
    assert entree.courbes_par_voyageur is None
