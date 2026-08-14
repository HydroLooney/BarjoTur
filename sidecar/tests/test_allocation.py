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
    entree_depuis_json,
    resultat_vers_json,
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


def test_mapping_json_contrat_partage_round_trip():
    # Entrée au format shared/allocation.ts : couts_trajet est une LISTE de {de,vers,cout}.
    payload = {
        "lieux": [
            {"lieu_id": 1, "marginaux": [10, 9, 8], "min_nuits": 1, "max_nuits": 3},
            {"lieu_id": 2, "marginaux": [2], "min_nuits": 1, "max_nuits": 1},
        ],
        "couts_trajet": [{"de": 0, "vers": 1, "cout": 5}, {"de": 1, "vers": 9, "cout": 7}],
        "cadre": {"total_nuits": 3, "depart": 0, "arrivee": 9},
        "mode": "full_auto",
    }
    entree = entree_depuis_json(payload)
    assert entree.couts_trajet[(0, 1)] == 5  # liste -> dict interne
    out = resultat_vers_json(resoudre_allocation(entree))
    assert set(out.keys()) == {"selection", "nuits", "ordre", "valeur_captee", "cout_trajet", "gardes", "laisses", "faisable"}
    assert out["selection"] == [1]  # domination -> drop
    assert out["cout_trajet"] == 5 + 7  # route 0->1->9 (Held-Karp)


def test_ordonner_route_held_karp_est_exact_la_ou_le_glouton_echoue():
    # Cas piège : le plus-proche-voisin depuis 0 prend 1 (coût 11) ; l'optimal est 0-2-3-1-9 (coût 4).
    from allocation import ordonner_route
    couts = {
        (0, 1): 1, (0, 2): 1, (0, 3): 8,
        (1, 2): 8, (1, 3): 1, (2, 3): 1,
        (1, 9): 1, (2, 9): 8, (3, 9): 1,
    }
    ordre, cout, faisable = ordonner_route([1, 2, 3], couts, depart=0, arrivee=9)
    assert faisable is True
    assert cout == 4
    assert ordre == [2, 3, 1]


def test_ordonner_route_cout_manquant_est_infini_et_flag_infaisable():
    from allocation import ordonner_route
    ordre, cout, faisable = ordonner_route([1, 2], {(0, 1): 1}, depart=0, arrivee=9)  # aucun chemin complet
    assert faisable is False
    assert cout == float("inf")


def test_ideal_voyageur_alloue_a_ses_seuls_poids():
    from allocation import ideal_voyageur, CourbeLieu, Cadre
    ideal = ideal_voyageur(7, [CourbeLieu(1, [10, 9]), CourbeLieu(2, [3])], {}, Cadre(2, 0, 9))
    assert ideal["membre_id"] == 7
    assert ideal["resultat"]["nuits"] == {1: 2}  # à ses poids, il concentre sur le lieu 1


def test_ecart_ideal_dit_ce_qui_est_gagne_et_cede():
    from allocation import ecart_ideal
    e = ecart_ideal(7, nuits_collectif={1: 1, 2: 1}, nuits_ideal={1: 2}, total_nuits=2)
    assert e["membre_id"] == 7
    assert e["gagne"] == ["2"] and e["cede"] == ["1"]
    assert e["ecart"] == 0.5  # (|1-2| + |1-0|) / (2*2)


def test_leximin_cle_et_comparaison_soignent_le_moins_bien_servi():
    from allocation import leximin_cle, leximin_compare
    assert leximin_cle([5, 3, 8]) == (3, 5, 8)  # trié croissant
    assert leximin_compare([3, 5], [2, 9]) == 1  # min 3 > 2 : meilleur leximin
    assert leximin_compare([3, 5], [3, 4]) == 1  # égalité au 1er, 5 > 4
    assert leximin_compare([3, 5], [3, 5]) == 0
