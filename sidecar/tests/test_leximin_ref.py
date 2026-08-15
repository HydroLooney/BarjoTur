# Tests de l'ORACLE leximin de reference (prep CP-SAT, M240/M254) : enumeration exhaustive des allocations faisables
# + choix leximin-optimal par voyageur. PUR, sans OR-Tools ni DB. C'est la reference contre laquelle le solveur CP-SAT
# de deploiement (resoudre_allocation_cpsat) sera valide : le jour ou ortools est installe sur Bomp4rd, son max-min
# leximin doit coincider avec cet oracle sur les petites instances enumerables. Courbes SYNTHETIQUES marquees R1.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from allocation import CourbeLieu, satisfaction_par_voyageur  # noqa: E402
from leximin_ref import allocations_faisables, leximin_optimal  # noqa: E402


def _lieu(lieu_id, marginaux, min_nuits=1, max_nuits=None):
    return CourbeLieu(lieu_id=lieu_id, marginaux=marginaux, min_nuits=min_nuits, max_nuits=max_nuits)


def test_allocations_faisables_enumere_zero_ou_intervalle():
    # 2 lieux, chacun 0 nuit OU [1,2], total = 2 -> {1:2}, {2:2}, {1:1,2:1}
    lieux = [_lieu(1, [10, 6]), _lieu(2, [10, 6])]
    allocs = allocations_faisables(lieux, 2)
    normal = sorted(tuple(sorted(a.items())) for a in allocs)
    assert normal == sorted([((1, 2),), ((2, 2),), ((1, 1), (2, 1))])


def test_allocations_faisables_respecte_min_nuits():
    # min_nuits = 2 : un lieu retenu compte au moins 2 nuits ; total = 3 -> {1:3},{2:3} (pas de 1+2, ni 2+1 car min2 des deux -> 4)
    lieux = [_lieu(1, [5, 4, 3], min_nuits=2), _lieu(2, [5, 4, 3], min_nuits=2)]
    allocs = allocations_faisables(lieux, 3)
    normal = sorted(tuple(sorted(a.items())) for a in allocs)
    assert normal == sorted([((1, 3),), ((2, 3),)])


def test_allocations_faisables_somme_exacte_totale():
    lieux = [_lieu(1, [9, 8, 7, 6]), _lieu(2, [9, 8, 7, 6])]
    for a in allocations_faisables(lieux, 4):
        assert sum(a.values()) == 4


def test_leximin_optimal_repartit_pour_le_moins_bien_servi():
    # X ne valorise que le lieu 1, Y ne valorise que le lieu 2. total = 2, chacun [1,2].
    # {1:2} -> X=16, Y=0 (min 0) ; {2:2} -> min 0 ; {1:1,2:1} -> X=10, Y=10 (min 10) => leximin choisit le partage.
    lieux = [_lieu(1, [10, 6]), _lieu(2, [10, 6])]
    courbes = {1: {"X": [10, 6]}, 2: {"Y": [10, 6]}}
    nuits, sat = leximin_optimal(lieux, 2, courbes)
    assert nuits == {1: 1, 2: 1}
    assert sat == {"X": 10.0, "Y": 10.0}


def test_leximin_optimal_compte_le_voyageur_servi_zero():
    # Un voyageur Z ne valorise aucun lieu retenu : sa satisfaction 0 DOIT compter dans le min (sinon faux leximin).
    lieux = [_lieu(1, [10, 6]), _lieu(2, [10, 6])]
    courbes = {1: {"X": [10, 6], "Z": [0, 0]}, 2: {"Y": [10, 6]}}
    nuits, sat = leximin_optimal(lieux, 2, courbes)
    # le partage {1:1,2:1} donne X=10, Y=10, Z=0 ; tout autre laisse un des trois a 0 aussi, mais le partage
    # maximise le 2e plus faible -> reste optimal. Z reste a 0 (aucun lieu ne le sert).
    assert sat.get("Z", 0.0) == 0.0
    assert min(sat.values()) == 0.0  # Z est le moins servi
    assert sorted(sat.values()) == [0.0, 10.0, 10.0]


def test_leximin_optimal_diverge_de_l_utilitaire():
    # Cas ou maximiser la somme (utilitaire) donnerait tout au lieu 1 (marginaux plus hauts pour X),
    # mais le leximin equilibre pour ne pas laisser Y a 0. Documente POURQUOI le CP-SAT leximin est necessaire.
    lieux = [_lieu(1, [100, 90]), _lieu(2, [5, 4])]
    courbes = {1: {"X": [100, 90]}, 2: {"Y": [5, 4]}}
    # utilitaire pur : {1:2} = 190 > {1:1,2:1} = 105. Mais leximin : {1:2} laisse Y a 0 -> min 0 ;
    # {1:1,2:1} -> X=100, Y=5 -> min 5 > 0 -> leximin choisit le partage.
    nuits, sat = leximin_optimal(lieux, 2, courbes)
    assert nuits == {1: 1, 2: 1}
    assert min(sat.values()) == 5.0


def test_leximin_optimal_coherent_avec_satisfaction_par_voyageur():
    # L'oracle doit rendre exactement la satisfaction que calcule satisfaction_par_voyageur pour son allocation.
    lieux = [_lieu(1, [8, 5]), _lieu(2, [8, 5])]
    courbes = {1: {"X": [8, 5], "Y": [2, 1]}, 2: {"X": [2, 1], "Y": [8, 5]}}
    nuits, sat = leximin_optimal(lieux, 2, courbes)
    recompute = satisfaction_par_voyageur(nuits, courbes)
    for v in sat:
        assert abs(sat[v] - recompute.get(v, 0.0)) < 1e-9
