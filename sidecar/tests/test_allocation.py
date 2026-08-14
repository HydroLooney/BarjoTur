# Tests du modèle d'allocation (A25/M113) — logique PURE, sans OR-Tools ni DB (convention sidecar). Le reward et la
# matrice réels viennent d'A (flip) ; ici, courbes et coûts SYNTHÉTIQUES marqués R1. On teste le cœur : rendement
# décroissant, drop d'une destination quand un lieu domine, agrégation égalitariste, équité par voyageur, 3 modes.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from allocation import (  # noqa: E402
    CourbeLieu,
    Cadre,
    EntreeAllocation,
    valeur_captee,
    valider_decroissance,
    agreger_egalitariste,
    satisfaction_par_voyageur,
    resoudre_allocation,
)


def test_valeur_captee_somme_les_marginaux():
    assert valeur_captee([10, 9, 8], 0) == 0
    assert valeur_captee([10, 9, 8], 1) == 10
    assert valeur_captee([10, 9, 8], 3) == 27
    assert valeur_captee([10, 9, 8], 5) == 27  # borné à la longueur


def test_valider_decroissance():
    assert valider_decroissance([10, 9, 9, 8]) is True
    assert valider_decroissance([10, 11]) is False  # croissant interdit (rendement décroissant)


def test_agregation_egalitariste_prend_le_moins_bien_servi_au_margin():
    # voyageur A = [10,5], voyageur B = [2,8] -> consensus égalitariste (min par cran) = [2,5]
    assert agreger_egalitariste([[10, 5], [2, 8]]) == [2, 5]


def test_full_auto_un_lieu_qui_domine_fait_TOMBER_les_autres():
    e = EntreeAllocation(
        lieux=[
            CourbeLieu(lieu_id=1, marginaux=[10, 9, 8]),  # fort, prolongeable
            CourbeLieu(lieu_id=2, marginaux=[2]),
            CourbeLieu(lieu_id=3, marginaux=[1]),
        ],
        couts_trajet={(0, 1): 1, (1, 9): 1, (0, 9): 1},
        cadre=Cadre(total_nuits=3, depart=0, arrivee=9),
        mode="full_auto",
    )
    r = resoudre_allocation(e)
    assert r.selection == [1]  # 2 et 3 TOMBENT
    assert r.nuits == {1: 3}
    assert r.valeur_captee == 27
    assert any(l["lieu"] in (2, 3) for l in r.laisses)  # arbitrage lisible : ce qu'on a laissé


def test_full_auto_rendement_decroissant_fait_repartir_le_temps():
    # lieu 1 chute vite (10,1) : au 2e cran il vaut moins que le 1er cran du lieu 2 (8) -> on répartit.
    e = EntreeAllocation(
        lieux=[CourbeLieu(1, [10, 1]), CourbeLieu(2, [8])],
        couts_trajet={},
        cadre=Cadre(total_nuits=2, depart=0, arrivee=9),
        mode="full_auto",
    )
    r = resoudre_allocation(e)
    assert r.nuits == {1: 1, 2: 1}
    assert r.valeur_captee == 18


def test_mode_manuel_respecte_les_nuits_imposees():
    e = EntreeAllocation(
        lieux=[CourbeLieu(1, [10, 9, 8]), CourbeLieu(2, [5, 4])],
        couts_trajet={},
        cadre=Cadre(total_nuits=3, depart=0, arrivee=9),
        mode="manuel",
        nuits_imposees={1: 1, 2: 2},
    )
    r = resoudre_allocation(e)
    assert r.nuits == {1: 1, 2: 2}
    assert r.valeur_captee == 10 + (5 + 4)


def test_equite_par_voyageur_expose_le_moins_bien_servi():
    # allocation {1:1, 2:1} ; A adore le 1 (10) peu le 2 (1), B l'inverse -> min = celui qu'on soigne.
    courbes = {1: {"A": [10], "B": [1]}, 2: {"A": [1], "B": [10]}}
    sat = satisfaction_par_voyageur({1: 1, 2: 1}, courbes)
    assert sat["A"] == 11 and sat["B"] == 11  # ici équilibré
    sat2 = satisfaction_par_voyageur({1: 1}, courbes)
    assert min(sat2.values()) == 1  # B est le moins bien servi
