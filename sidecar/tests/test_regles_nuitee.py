# TDD (M341 §1+§2) : règles de nuitée du composeur en contraintes DURES PARAMÉTRÉES, faisabilité exposée (comme les
# marges transit B100). Bloc 1 : PPC/CPAP (max nuits autonomie CONSÉCUTIVES = faisabilité médicale, électricité la nuit)
# + séquence (jamais 2 autonomies de suite) + ≤ N nuits/spot. Pur, sans DB ni OR-Tools. Défauts = valeurs v2 (audit).

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from regles_nuitee import ParamsNuitee, a_electricite, violations_nuitee, plan_nuitee_faisable  # noqa: E402


def nuit(jour, spot, type_nuit):
    return {"jour": jour, "spot": spot, "type": type_nuit}


def test_a_electricite_selon_type_de_nuit():
    assert a_electricite("autonomie") is False
    assert a_electricite("aire_equipee") is True
    assert a_electricite("camping_confort") is True


def test_plan_confortable_sans_violation():
    p = ParamsNuitee()  # défauts v2 : PPC max 2, jamais 2 autonomies, ≤3/spot
    nuits = [
        nuit(1, "kristiansand", "camping_confort"),
        nuit(2, "setesdal", "autonomie"),
        nuit(3, "hovden", "aire_equipee"),
        nuit(4, "rjukan", "autonomie"),
    ]
    assert violations_nuitee(nuits, p) == []
    assert plan_nuitee_faisable(nuits, p) is True


def test_ppc_streak_autonomie_au_dela_du_max_est_infaisable_medical():
    p = ParamsNuitee(max_nuits_autonomie_consecutives=2, jamais_deux_autonomies=False)
    nuits = [nuit(1, "a", "autonomie"), nuit(2, "a", "autonomie"), nuit(3, "b", "autonomie")]  # 3 d'affilée
    v = violations_nuitee(nuits, p)
    assert any("PPC" in x and "3" in x for x in v)  # médical, non négociable, nommé
    assert plan_nuitee_faisable(nuits, p) is False


def test_jamais_deux_autonomies_de_suite_confort():
    p = ParamsNuitee(max_nuits_autonomie_consecutives=5, jamais_deux_autonomies=True)
    nuits = [nuit(1, "a", "autonomie"), nuit(2, "b", "autonomie")]  # 2 d'affilée
    v = violations_nuitee(nuits, p)
    assert any("autonomie" in x.lower() and "suite" in x.lower() for x in v)


def test_max_nuits_par_spot():
    p = ParamsNuitee(max_nuits_par_spot=3)
    nuits = [nuit(i, "hovden", "aire_equipee") for i in range(1, 5)]  # 4 nuits même spot
    v = violations_nuitee(nuits, p)
    assert any("hovden" in x and "spot" in x.lower() for x in v)


def test_parametre_change_replie_la_faisabilite():
    nuits = [nuit(1, "a", "autonomie"), nuit(2, "b", "autonomie"), nuit(3, "c", "autonomie")]
    # PPC max 2 → infaisable ; PPC max 3 → faisable (le paramètre re-plie ; spots distincts pour isoler la PPC)
    assert plan_nuitee_faisable(nuits, ParamsNuitee(max_nuits_autonomie_consecutives=2, jamais_deux_autonomies=False)) is False
    assert plan_nuitee_faisable(nuits, ParamsNuitee(max_nuits_autonomie_consecutives=3, jamais_deux_autonomies=False)) is True


# --- Bloc 2 (M341 §1) : cadences glissantes laverie/confort + stop ⇒ confort ---
from regles_nuitee import violations_cadence  # noqa: E402


def nl(jour, spot, type_nuit, laverie=False):
    return {"jour": jour, "spot": spot, "type": type_nuit, "laverie": laverie}


def test_cadence_laverie_respectee_et_depassee():
    p = ParamsNuitee(cadence_laverie_j=7)
    # 8 nuits sans laverie → dépassement (run de 8 ≥ 7)
    sans = [nl(i, f"s{i}", "aire_equipee") for i in range(1, 9)]
    assert any("laverie" in x.lower() for x in violations_cadence(sans, p))
    # une laverie au jour 4 → aucun run ≥ 7
    avec = [nl(i, f"s{i}", "aire_equipee", laverie=(i == 4)) for i in range(1, 9)]
    assert not any("laverie" in x.lower() for x in violations_cadence(avec, p))


def test_cadence_confort_hebdo():
    p = ParamsNuitee(cadence_confort_j=7)
    sans = [nl(i, f"s{i}", "autonomie") for i in range(1, 9)]  # 8 nuits sans confort
    assert any("confort" in x.lower() and "semaine" in x.lower() for x in violations_cadence(sans, p))
    avec = [nl(i, f"s{i}", "camping_confort" if i == 5 else "aire_equipee") for i in range(1, 9)]
    assert not any("confort" in x.lower() and "semaine" in x.lower() for x in violations_cadence(avec, p))


def test_stop_de_2_nuits_exige_confort():
    p = ParamsNuitee(stop_min_pour_confort=2)
    # 2 nuits au même spot sans confort → violation
    stop_sans = [nl(1, "hovden", "aire_equipee"), nl(2, "hovden", "aire_equipee")]
    assert any("stop" in x.lower() and "confort" in x.lower() for x in violations_cadence(stop_sans, p))
    # 2 nuits avec une camping_confort → OK
    stop_avec = [nl(1, "hovden", "camping_confort"), nl(2, "hovden", "aire_equipee")]
    assert not any("stop" in x.lower() for x in violations_cadence(stop_avec, p))


def test_cadence_integree_a_plan_nuitee_faisable():
    p = ParamsNuitee(cadence_laverie_j=7, cadence_confort_j=7)
    sans = [nl(i, f"s{i}", "autonomie") for i in range(1, 9)]
    assert plan_nuitee_faisable(sans, p) is False  # cadence intégrée au verdict global


# --- Bloc 3 (M341 §1) : cap de roulage journalier + fenêtre horaire (jamais le soir, roulage le matin) ---
from regles_nuitee import violations_roulage  # noqa: E402


def jr(jour, debut, fin, total):
    return {"jour": jour, "debut_min": debut, "fin_min": fin, "total_min": total}


def test_roulage_dans_le_cap_et_la_fenetre():
    p = ParamsNuitee()  # cap 240 (4h), fenêtre 07:00-17:00
    jours = [jr(1, 8 * 60, 12 * 60, 240), jr(2, 9 * 60, 11 * 60, 120)]
    assert violations_roulage(jours, p) == []


def test_cap_roulage_depasse():
    p = ParamsNuitee(cap_roulage_min=240)
    jours = [jr(1, 8 * 60, 14 * 60, 300)]  # 5h > 4h
    assert any("cap" in x.lower() for x in violations_roulage(jours, p))


def test_roulage_le_soir_interdit():
    p = ParamsNuitee(roulage_fin_min=17 * 60)
    jours = [jr(1, 15 * 60, 19 * 60, 200)]  # finit à 19h > 17h
    assert any("soir" in x.lower() for x in violations_roulage(jours, p))


def test_roulage_trop_tot_interdit():
    p = ParamsNuitee(roulage_debut_min=7 * 60)
    jours = [jr(1, 5 * 60, 8 * 60, 180)]  # démarre à 5h < 7h
    assert any("tôt" in x.lower() or "matin" in x.lower() for x in violations_roulage(jours, p))


# --- Bloc 4 (M341 §1) : barème coût-nuit (camping > aire > autonomie), override par la donnée d'A ---
from regles_nuitee import cout_nuit, cout_total_nuits  # noqa: E402


def test_bareme_cout_nuit_ordonne():
    p = ParamsNuitee()
    assert cout_nuit("autonomie", p) == 0
    assert cout_nuit("camping_confort", p) > cout_nuit("aire_equipee", p) > cout_nuit("autonomie", p)


def test_cout_total_somme_le_bareme():
    p = ParamsNuitee()
    nuits = [nuit(1, "a", "autonomie"), nuit(2, "b", "aire_equipee"), nuit(3, "c", "camping_confort")]
    assert cout_total_nuits(nuits, p) == cout_nuit("aire_equipee", p) + cout_nuit("camping_confort", p)


def test_cout_override_par_donnee_reelle_du_spot():
    p = ParamsNuitee()
    # une nuit peut porter son coût réel (aménités A) qui prime sur le barème
    nuits = [dict(nuit(1, "a", "camping_confort"), cout_nuit_eur=42.0)]
    assert cout_total_nuits(nuits, p) == 42.0


# --- Crible §7 (M341) : honeypots (lieux bondés) visités HORS 10h-16h (évitement de foule) ---
from regles_nuitee import violations_honeypot  # noqa: E402


def vis(poi, honeypot, debut, fin):
    return {"poi": poi, "honeypot": honeypot, "debut_min": debut, "fin_min": fin}


def test_honeypot_hors_fenetre_foule_ok():
    p = ParamsNuitee()  # foule 10:00-16:00
    assert violations_honeypot([vis("preikestolen", True, 8 * 60, 9 * 60 + 30)], p) == []   # avant 10h
    assert violations_honeypot([vis("preikestolen", True, 16 * 60 + 30, 18 * 60)], p) == []  # après 16h


def test_honeypot_dans_la_fenetre_foule_viole():
    p = ParamsNuitee()
    v = violations_honeypot([vis("trolltunga", True, 12 * 60, 13 * 60)], p)
    assert any("trolltunga" in x and "foule" in x.lower() for x in v)


def test_non_honeypot_dans_la_fenetre_ok():
    p = ParamsNuitee()
    assert violations_honeypot([vis("petit-lac", False, 12 * 60, 13 * 60)], p) == []


# --- M347 : grande étape de roulage intra-boucle (profil de fenêtre propre qui override le socle sur son span) ---
from regles_nuitee import ProfilRoulage  # noqa: E402


def test_grande_etape_deroge_au_socle_roulage():
    p = ParamsNuitee()  # socle 07-17 cap 240 ; profil_ger = conduite le soir, cap relevé
    normal = [{"jour": 1, "debut_min": 15 * 60, "fin_min": 22 * 60, "total_min": 300}]
    assert any("soir" in x.lower() for x in violations_roulage(normal, p))  # socle : le soir interdit
    ger = [{"jour": 1, "debut_min": 15 * 60, "fin_min": 22 * 60, "total_min": 300, "grande_etape": True}]
    assert violations_roulage(ger, p) == []  # grande étape : le soir OK, cap relevé (profil_ger)


def test_grande_etape_respecte_son_propre_cap():
    p = ParamsNuitee(profil_ger=ProfilRoulage(debut_min=12 * 60, fin_min=23 * 60, cap_min=480))
    ger = [{"jour": 1, "debut_min": 12 * 60, "fin_min": 23 * 60, "total_min": 600, "grande_etape": True}]  # 10h > 8h
    assert any("cap" in x.lower() for x in violations_roulage(ger, p))


def test_nb_grandes_etapes_borne():
    p = ParamsNuitee(nb_grandes_etapes_max=1)
    jours = [
        {"jour": 1, "debut_min": 13 * 60, "fin_min": 22 * 60, "total_min": 300, "grande_etape": True},
        {"jour": 2, "debut_min": 9 * 60, "fin_min": 11 * 60, "total_min": 120},  # rupture
        {"jour": 3, "debut_min": 13 * 60, "fin_min": 22 * 60, "total_min": 300, "grande_etape": True},  # 2e span
    ]
    assert any("grande" in x.lower() for x in violations_roulage(jours, p))


def test_ppc_toujours_respectee_meme_en_grande_etape():
    # une nuit autonomie de la poussée COMPTE dans le streak PPC (pas de dérogation médicale)
    p = ParamsNuitee(max_nuits_autonomie_consecutives=1, jamais_deux_autonomies=False)
    nuits = [nuit(1, "a", "autonomie"), nuit(2, "b", "autonomie")]  # 2 autonomies (dont poussée) > 1
    assert any("PPC" in x for x in violations_nuitee(nuits, p))


# --- M349 §2 : la borne autonomie vient de l'AGRÉGATION des contraintes médicales par voyageur (MIN), pas d'un défaut ---
from regles_nuitee import borne_autonomie_agregee, params_avec_borne_medicale  # noqa: E402


def voy(actif=True, contraintes=None):
    return {"actif": actif, "contraintes": contraintes or []}


def cm(maxn, type_="electricite_nuit"):
    return {"type": type_, "max_nuits_autonomie_consecutives": maxn}


def test_aucune_contrainte_pas_de_borne_medicale():
    assert borne_autonomie_agregee([voy(), voy()]) is None


def test_ppc_de_guillaume_seul_lie():
    voyageurs = [voy(contraintes=[cm(2)]), voy(), voy()]
    assert borne_autonomie_agregee(voyageurs) == 2


def test_agregation_prend_le_min_sur_voyageurs():
    voyageurs = [voy(contraintes=[cm(3)]), voy(contraintes=[cm(2)])]  # MIN = 2
    assert borne_autonomie_agregee(voyageurs) == 2


def test_voyageur_inactif_ignore():
    voyageurs = [voy(actif=False, contraintes=[cm(1)]), voy(contraintes=[cm(2)])]
    assert borne_autonomie_agregee(voyageurs) == 2  # le max 1 de l'inactif n'entre pas


def test_params_avec_borne_medicale_applique_l_agregat():
    base = ParamsNuitee(max_nuits_autonomie_consecutives=99)  # défaut ignoré
    p = params_avec_borne_medicale(base, [voy(contraintes=[cm(2)])])
    assert p.max_nuits_autonomie_consecutives == 2
    # sans contrainte → pas de borne médicale (grand nombre, non contraignant)
    p2 = params_avec_borne_medicale(base, [voy(), voy()])
    assert p2.max_nuits_autonomie_consecutives >= 99
