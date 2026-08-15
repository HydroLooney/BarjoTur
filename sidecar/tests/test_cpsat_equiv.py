# Harnais de VALIDATION au deploiement du solveur CP-SAT (prep, M240/M254). Ces tests sont SAUTES tant qu'ortools
# est absent (env Py3.14/PEP668) ; ils s'activeront le jour ou ortools sera installe sur Bomp4rd (C06), et servent de
# GATE : le CP-SAT ne remplace le solveur pur en production que s'il reproduit son resultat.
#
# Deux niveaux :
#  1. OBJECTIF ACTUEL (utilitaire sur la courbe consensus) : resoudre_allocation_cpsat doit capter la MEME valeur
#     totale que le solveur pur exact resoudre_allocation. C'est ce qui est reellement code aujourd'hui.
#  2. OBJECTIF LEXIMIN (extension flip, pas encore codee) : quand le CP-SAT portera le max-min par voyageur, il devra
#     coincider avec l'oracle exact leximin_optimal (leximin_ref). Marque xfail en attendant que l'objectif soit code.

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

pytest.importorskip("ortools.sat.python.cp_model")  # saute tout le module si le CP-SAT n'est pas installe

from allocation import (  # noqa: E402
    CourbeLieu,
    Cadre,
    EntreeAllocation,
    resoudre_allocation,
    resoudre_allocation_cpsat,
)


def _entree_synthetique() -> EntreeAllocation:
    lieux = [
        CourbeLieu(lieu_id=1, marginaux=[10, 6, 3]),
        CourbeLieu(lieu_id=2, marginaux=[9, 5, 2]),
        CourbeLieu(lieu_id=3, marginaux=[8, 4, 1]),
    ]
    couts = {(0, 1): 1.0, (1, 2): 1.0, (2, 3): 1.0, (0, 2): 2.0, (0, 3): 3.0, (1, 3): 2.0}
    return EntreeAllocation(lieux=lieux, couts_trajet=couts, cadre=Cadre(total_nuits=4, depart=0, arrivee=0))


def test_cpsat_capte_la_meme_valeur_que_le_solveur_pur():
    entree = _entree_synthetique()
    pur = resoudre_allocation(entree)
    cpsat = resoudre_allocation_cpsat(entree)
    # objectif identique (utilitaire exact) : meme valeur captee, meme nombre de nuits allouees.
    assert abs(cpsat.valeur_captee - pur.valeur_captee) < 1e-6
    assert sum(cpsat.nuits.values()) == sum(pur.nuits.values()) == entree.cadre.total_nuits


def test_cpsat_atteint_le_leximin_de_l_oracle():
    # Objectif leximin CODE (M255) : quand `courbes_par_voyageur` est fourni, le CP-SAT vise le max-min par voyageur ;
    # il doit atteindre l'allocation leximin-optimale de l'oracle. Reference = leximin_ref (enumeration exacte).
    from leximin_ref import leximin_optimal
    from allocation import CourbesVoyageurLieu

    lieux = [CourbeLieu(lieu_id=1, marginaux=[100, 90]), CourbeLieu(lieu_id=2, marginaux=[5, 4])]
    # X ne valorise que le lieu 1, Y que le lieu 2 : l'utilitaire donnerait tout au lieu 1 (laisse Y a 0), le leximin
    # equilibre. Cf test_leximin_ref.test_leximin_optimal_diverge_de_l_utilitaire.
    courbes = {1: {"X": [100, 90], "Y": [0, 0]}, 2: {"X": [0, 0], "Y": [5, 4]}}
    nuits_oracle, _ = leximin_optimal(lieux, 2, courbes)
    couts = {(0, 1): 1.0, (0, 2): 1.0, (1, 2): 1.0}
    entree = EntreeAllocation(
        lieux=lieux,
        couts_trajet=couts,
        cadre=Cadre(total_nuits=2, depart=0, arrivee=0),
        courbes_par_voyageur=[
            CourbesVoyageurLieu(lieu_id=1, par_voyageur={1: [100, 90], 2: [0, 0]}),
            CourbesVoyageurLieu(lieu_id=2, par_voyageur={1: [0, 0], 2: [5, 4]}),
        ],
    )
    cpsat = resoudre_allocation_cpsat(entree)
    assert cpsat.nuits == nuits_oracle  # {1:1, 2:1} : le partage max-min
