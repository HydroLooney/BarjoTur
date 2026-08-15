# TDD (M380) : expressions TSAB manquantes. (1) budget TSAB PAR VOYAGEUR = ce que chacun capte en tiers T/S/A/B/C (équité
# lisible + source des recos perso) ; (2) synthèse TSAB PAR JOUR = le profil de tiers d'une journée (anti-double-compte,
# pas une somme brute). Pur, sans DB ni OR-Tools. Le tier des lieux vient d'A ; ici synthétique (R1).

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tsab import budget_tsab_par_voyageur, synthese_tsab_du_jour  # noqa: E402


def test_budget_tsab_par_voyageur():
    selection = [1, 2, 3]
    tiers = {1: "T", 2: "S", 3: "S"}
    # X valorise 1 (T) et 2 (S) ; Y valorise 2 (S) et 3 (S).
    courbes = {1: {"X": [10]}, 2: {"X": [5], "Y": [5]}, 3: {"Y": [5]}}
    out = budget_tsab_par_voyageur(selection, tiers, courbes)
    assert out["X"] == {"T": 1, "S": 1}
    assert out["Y"] == {"S": 2}


def test_budget_tsab_ignore_lieu_non_valorise():
    # marginal nul → le voyageur ne « capte » pas ce lieu.
    selection = [1]
    tiers = {1: "A"}
    courbes = {1: {"X": [0, 0], "Y": [3]}}
    out = budget_tsab_par_voyageur(selection, tiers, courbes)
    assert out.get("X", {}) == {}      # X ne capte rien (marginal nul)
    assert out["Y"] == {"A": 1}


def test_synthese_tsab_du_jour_profil():
    assert synthese_tsab_du_jour([1, 2, 3], {1: "T", 2: "S", 3: "S"}) == {"T": 1, "S": 2}


def test_synthese_tsab_anti_double_compte():
    # un même lieu compté UNE fois (dédup), pas une somme brute.
    assert synthese_tsab_du_jour([1, 1, 2], {1: "T", 2: "S"}) == {"T": 1, "S": 1}


def test_synthese_tsab_jour_vide():
    assert synthese_tsab_du_jour([], {}) == {}


# --- M384 : recalcul INCRÉMENTAL au vote (delta local, effet visible, pas de recompute complet) ---
from tsab import budget_tsab_delta_vote, appliquer_delta_tsab  # noqa: E402


def test_delta_vote_capte_un_nouveau_tier():
    # vote passe le lieu au-dessus du seuil de capture → +1 sur son tier (une part visible bouge)
    assert budget_tsab_delta_vote("S", vote_avant=0.0, vote_apres=5.0) == {"S": 1}


def test_delta_devote_retire_un_tier():
    assert budget_tsab_delta_vote("A", vote_avant=5.0, vote_apres=0.0) == {"A": -1}


def test_delta_changement_d_intensite_sans_franchir_le_seuil_ne_bouge_pas_le_compte():
    # déjà capté avant et après (juste plus fort) → pas de nouveau tier (effet sensé, pas brutal)
    assert budget_tsab_delta_vote("S", vote_avant=5.0, vote_apres=8.0) == {}


def test_appliquer_delta_tsab():
    assert appliquer_delta_tsab({"S": 2}, {"S": 1}) == {"S": 3}
    assert appliquer_delta_tsab({"S": 1}, {"S": -1}) == {}          # tombe à 0 → retiré
    assert appliquer_delta_tsab({"T": 1}, {"S": 1}) == {"T": 1, "S": 1}
