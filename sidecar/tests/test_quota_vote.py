# TDD (M386) : le vote est CONTRAINT par un budget QUOTA par tier (rareté au sommet : T rare). Modèle PUR : quota plein,
# résultat d'un vote (ok | tier_plein + liste pour l'overlay d'échange de C), échange ATOMIQUE (retirer un ancien du tier
# ET poser le nouveau au MÊME tier, jamais d'état incohérent). Pur, sans DB. L'enforcement réel + budget/recos = BFF/RPC.

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from quota_vote import quota_plein, resultat_vote, echanger_vote  # noqa: E402


def test_quota_plein():
    assert quota_plein([10, 11], quota=2) is True
    assert quota_plein([10], quota=2) is False
    assert quota_plein([], quota=0) is True   # tier non voté (C) : quota 0 → toujours plein


def test_resultat_vote_quota_libre_pose_le_vote():
    r = resultat_vote({"T": [10]}, {"T": 2}, "T", 11)
    assert r["ok"] is True and r["tier_plein"] is False
    assert r["votes_par_tier"]["T"] == [10, 11]


def test_resultat_vote_quota_plein_renvoie_l_etat_pour_echange():
    r = resultat_vote({"T": [10, 11]}, {"T": 2}, "T", 12)  # 3e T, quota 2
    assert r["ok"] is False and r["tier_plein"] is True
    assert r["tier"] == "T"
    assert r["votes_actuels"] == [10, 11]   # C montre l'overlay d'échange sur ces votes


def test_echanger_vote_atomique_meme_tier():
    # retire 10 (T), pose 12 (T) : longueur inchangée, quota respecté, jamais d'état transitoire incohérent.
    out = echanger_vote({"T": [10, 11]}, "T", retirer_lieu=10, poser_lieu=12)
    assert sorted(out["T"]) == [11, 12]
    assert len(out["T"]) == 2


def test_echanger_vote_refuse_retirer_absent():
    with pytest.raises(ValueError):
        echanger_vote({"T": [10, 11]}, "T", retirer_lieu=99, poser_lieu=12)


# --- M393/M396 : deux voies quand un déclassement tombe sur un tier plein ---
# Contrat POSÉ en shared (M396) : EtapeCascade { tier, vers, candidats[] } ; EtatPaniers { paniers: PanierTier[],
# budget_a_resoudre } ; PanierTier { tier, quota|null, dans_budget[], hors_budget[], a_reequilibrer }. B = plancher illimité.
from quota_vote import cascade_declassement, poser_hors_budget, etat_paniers  # noqa: E402

ORDRE = ["T", "S", "A", "B"]  # B = plancher illimité (quota None)


def _panier(etat, tier):
    return next(p for p in etat["paniers"] if p["tier"] == tier)


def test_cascade_room_au_depart_aucune_etape():
    # T a de la place → poser directement, pas de cascade.
    etapes = cascade_declassement({"T": []}, {"T": 1, "S": 1, "A": 1}, ORDRE, "T")
    assert etapes == []


def test_cascade_chaine_complete_jusqu_au_plancher():
    votes = {"T": [1], "S": [2], "A": [3]}       # T,S,A pleins (quota 1)
    quotas = {"T": 1, "S": 1, "A": 1}            # B = plancher, pas de quota
    etapes = cascade_declassement(votes, quotas, ORDRE, "T")
    # chaque étape porte les candidats (les votes du tier) que C proposera de déclasser.
    assert etapes == [
        {"tier": "T", "vers": "S", "candidats": [1]},
        {"tier": "S", "vers": "A", "candidats": [2]},
        {"tier": "A", "vers": "B", "candidats": [3]},
    ]


def test_cascade_s_arrete_au_premier_tier_avec_place():
    votes = {"T": [1], "S": []}                  # T plein, S a de la place
    quotas = {"T": 1, "S": 1, "A": 1}
    assert cascade_declassement(votes, quotas, ORDRE, "T") == [
        {"tier": "T", "vers": "S", "candidats": [1]},
    ]


def test_panier_hors_budget_flag_et_non_compte():
    hb = poser_hors_budget({}, "T", 12)
    assert hb == {"T": [12]}


def test_etat_paniers_expose_dans_hors_budget_et_flag_global():
    votes = {"T": [1], "S": [2]}
    hors = {"T": [12]}                            # un surplus en T
    quotas = {"T": 1, "S": 1}                     # B absent → plancher illimité (quota None)
    etat = etat_paniers(votes, hors, quotas, ORDRE)
    assert etat["budget_a_resoudre"] is True
    assert _panier(etat, "T") == {
        "tier": "T", "quota": 1, "dans_budget": [1], "hors_budget": [12], "a_reequilibrer": True,
    }
    assert _panier(etat, "S")["a_reequilibrer"] is False
    assert _panier(etat, "B")["quota"] is None   # plancher illimité
