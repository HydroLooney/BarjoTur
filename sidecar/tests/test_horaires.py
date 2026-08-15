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


# --- Garde DURE des ancres obligatoires (M303 §4) : ferry A/R + transit Allemagne + restitution ---
from horaires import AncreObligatoire, violations_ancres, plan_respecte_ancres  # noqa: E402


def _ancres_norvege():
    # 4 ancres réelles (M303). heure_limite en minutes depuis minuit ; jour = index figé attendu.
    return [
        AncreObligatoire(id="ferry_aller", jour=1, heure_limite_min=hhmm_en_minutes("18:40"), budget_roulage_min=120),
        AncreObligatoire(id="ferry_retour", jour=22, heure_limite_min=hhmm_en_minutes("09:00"), budget_roulage_min=60),
        AncreObligatoire(id="restitution", jour=23, heure_limite_min=None, budget_roulage_min=600),
    ]


def test_plan_respecte_les_ancres_quand_tout_va_bien():
    ancres = _ancres_norvege()
    jour = {"ferry_aller": 1, "ferry_retour": 22, "restitution": 23}
    arrivee = {"ferry_aller": hhmm_en_minutes("17:30"), "ferry_retour": hhmm_en_minutes("08:20")}
    roulage = {"ferry_aller": 100, "ferry_retour": 50, "restitution": 480}
    assert violations_ancres(jour, arrivee, roulage, ancres) == []
    assert plan_respecte_ancres(jour, arrivee, roulage, ancres) is True


def test_ancre_deplacee_est_une_violation():
    ancres = _ancres_norvege()
    jour = {"ferry_aller": 2, "ferry_retour": 22, "restitution": 23}  # ferry aller déplacé au jour 2
    v = violations_ancres(jour, {}, {}, ancres)
    assert any("ferry_aller" in x and "DÉPLACÉE" in x for x in v)
    assert plan_respecte_ancres(jour, {}, {}, ancres) is False


def test_ferry_rate_est_une_violation():
    ancres = _ancres_norvege()
    jour = {"ferry_aller": 1, "ferry_retour": 22}
    arrivee = {"ferry_aller": hhmm_en_minutes("18:55"), "ferry_retour": hhmm_en_minutes("08:20")}  # 18h55 > 18h40
    v = violations_ancres(jour, arrivee, {}, ancres)
    assert any("ferry_aller" in x and "RATÉE" in x for x in v)


def test_budget_roulage_depasse_est_une_violation():
    ancres = _ancres_norvege()
    jour = {"ferry_aller": 1}
    roulage = {"ferry_aller": 200}  # > budget 120
    v = violations_ancres(jour, {}, roulage, ancres)
    assert any("ferry_aller" in x and "BUDGET" in x for x in v)


def test_restitution_sans_heure_limite_ne_rate_jamais_sur_l_heure():
    ancres = _ancres_norvege()
    jour = {"restitution": 23}
    # pas d'heure limite → aucune violation d'heure même avec une arrivée tardive
    assert violations_ancres(jour, {"restitution": hhmm_en_minutes("23:00")}, {"restitution": 480}, ancres) == []


# --- Marges de sécurité logistiques (M326) : chaque jalon obligatoire (embarquement 2h avant, restitution, ...) doit
#     tenir roulage + marge dans le temps dispo avant le jalon suivant ---
from horaires import JalonHoraire, violations_marges, sequence_logistique_faisable  # noqa: E402


def test_sequence_logistique_faisable_quand_marges_tiennent():
    # dep 13:00(780) → halte 21:00(1260) roulage 420 marge 30 : dispo 480 ≥ 450 OK
    # → embarquement 07:00 J+1 (780+... on reste sur un axe simple : 1740) roulage 400 marge 120(2h) : dispo 480 ≥ 520 ? non.
    jalons = [
        JalonHoraire(id="depart", operation="chargement", heure_min=780, roulage_min=0, marge_securite_min=0),
        JalonHoraire(id="halte", operation="halte_nuit", heure_min=1260, roulage_min=420, marge_securite_min=30),
    ]
    assert violations_marges(jalons) == []
    assert sequence_logistique_faisable(jalons) is True


def test_embarquement_marge_2h_dure_respectee():
    # halte 07:00(420) → embarquement 14:15(855) : dispo 435 ; roulage 300 + marge 120 (2h avant ferry) = 420 ≤ 435 OK
    jalons = [
        JalonHoraire(id="halte", operation="halte_nuit", heure_min=420, roulage_min=0, marge_securite_min=0),
        JalonHoraire(id="embarquement", operation="embarquement_ferry", heure_min=855, roulage_min=300, marge_securite_min=120),
    ]
    assert violations_marges(jalons) == []


def test_depassement_roulage_plus_marge_est_infaisable_et_signale():
    # dispo 435 ; roulage 350 + marge 120 = 470 > 435 → INFAISABLE, nommé (R1, pas masqué)
    jalons = [
        JalonHoraire(id="halte", operation="halte_nuit", heure_min=420, roulage_min=0, marge_securite_min=0),
        JalonHoraire(id="embarquement", operation="embarquement_ferry", heure_min=855, roulage_min=350, marge_securite_min=120),
    ]
    v = violations_marges(jalons)
    assert any("embarquement" in x and "INFAISABLE" in x for x in v)
    assert sequence_logistique_faisable(jalons) is False


def test_restitution_avant_20h_marge_nettoyage_dechargement():
    # arrivée domicile 17:00(1020) → restitution 20:00(1200) : dispo 180 ; roulage 30 + marge 120 (nettoyage+déchargement) = 150 ≤ 180 OK
    jalons = [
        JalonHoraire(id="arrivee", operation="arrivee", heure_min=1020, roulage_min=0, marge_securite_min=0),
        JalonHoraire(id="restitution", operation="restitution_van", heure_min=1200, roulage_min=30, marge_securite_min=120),
    ]
    assert violations_marges(jalons) == []
