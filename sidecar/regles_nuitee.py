"""Règles de nuitée du composeur (M341 §1+§2), en contraintes DURES PARAMÉTRÉES — faisabilité exposée, jamais masquée
(comme les marges transit, B100). Bloc 1 : PPC/CPAP + séquence des types de nuit + nuits par spot. PUR, sans DB ni
OR-Tools : ce module DÉCIDE la faisabilité d'un plan de nuits ; le solveur OP OR-Tools (G4/Bomp4rd) l'intègre en
contrainte, et l'agenda (C) affiche le streak/cadence. Défauts = valeurs v2 (audit AUDIT-v2-FONCTIONS-NON-PORTEES.md) ;
en prod les seuils viennent du registre `budget.parametre` (un changement RE-PLIE la faisabilité).

Type de nuit : 'autonomie' (pas d'électricité) | 'aire_equipee' | 'camping_confort' (électricité disponible).
La PPC (apnée) de Guillaume EXIGE l'électricité la nuit → borne dure sur les nuits autonomes CONSÉCUTIVES = faisabilité
MÉDICALE, pas confort.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace


@dataclass
class ProfilRoulage:
    """Profil de fenêtre de roulage NOMMÉ, ajustable (M347). Un profil = fenêtre horaire + cap journalier. Le socle est
    un profil ; la « grande étape de roulage » en a un PROPRE qui l'override sur son span (ex. conduite le soir, cap
    relevé). Minutes depuis minuit."""

    debut_min: int
    fin_min: int
    cap_min: int


@dataclass
class ParamsNuitee:
    """Seuils paramétrables (registre `budget.parametre`). Défauts = valeurs v2."""

    # §2 PPC/CPAP : nuits en AUTONOMIE consécutives maximum autorisées par l'autonomie électrique réelle du van.
    # Contrainte MÉDICALE dure (défaut prudent, ajustable selon batterie/solaire).
    max_nuits_autonomie_consecutives: int = 2
    # §1 confort : interdire deux nuits autonomes de suite (≈ 1 nuit sur 2 max en autonomie). Peut être plus/moins strict
    # que la borne PPC selon l'installation.
    jamais_deux_autonomies: bool = True
    # §1 : nombre maximum de nuits sur un même spot.
    max_nuits_par_spot: int = 3
    # §1 cadences glissantes : pas plus de N nuits consécutives sans une laverie / sans une nuit confort.
    cadence_laverie_j: int = 7
    cadence_confort_j: int = 7
    # §1 : un stop de >= N nuits sur un spot EXIGE au moins une nuit confort (camping_confort) sur ce stop.
    stop_min_pour_confort: int = 2
    # §1 cap de roulage journalier (minutes) + fenêtre horaire du roulage (minutes depuis minuit) : « jamais le soir,
    # roulage le matin ». Défauts v2 : ~4 h/j, 07:00–17:00.
    cap_roulage_min: int = 240
    roulage_debut_min: int = 7 * 60
    roulage_fin_min: int = 17 * 60
    # §1 barème coût-nuit (€) : camping confort > aire équipée > autonomie (gratuite). Défauts indicatifs ; le coût RÉEL
    # d'un spot (donnée aménités A) prime via `nuit['cout_nuit_eur']`.
    cout_nuit_autonomie_eur: float = 0.0
    cout_nuit_aire_eur: float = 15.0
    cout_nuit_camping_eur: float = 35.0
    # Crible §7 : fenêtre de foule à ÉVITER pour les honeypots (lieux bondés). Défaut 10:00–16:00.
    foule_debut_min: int = 10 * 60
    foule_fin_min: int = 16 * 60
    # M347 : grande étape de roulage intra-boucle. Nombre max de grandes étapes, durée (jours), et PROFIL de fenêtre propre
    # (override du socle sur le span). Défaut ger = conduite le soir (12:00–23:00), cap relevé 8 h.
    nb_grandes_etapes_max: int = 2
    duree_grande_etape_j: int = 2
    profil_ger: ProfilRoulage = field(default_factory=lambda: ProfilRoulage(12 * 60, 23 * 60, 480))


def a_electricite(type_nuit: str) -> bool:
    """Vrai si le type de nuit fournit l'électricité (tout sauf l'autonomie). Pure."""
    return type_nuit != "autonomie"


def _plus_long_streak_autonomie(nuits: list[dict]) -> int:
    """Plus longue suite de nuits autonomes consécutives (par ordre des jours donné). Pure."""
    plus_long = courant = 0
    for n in nuits:
        if n["type"] == "autonomie":
            courant += 1
            plus_long = max(plus_long, courant)
        else:
            courant = 0
    return plus_long


def violations_nuitee(nuits: list[dict], params: ParamsNuitee) -> list[str]:
    """Rend la liste des violations d'un plan de nuits (vide = faisable). Chaque nuit = {jour, spot, type}. Trois
    familles, chacune NOMMÉE (R1, jamais masquée) : PPC (médical), séquence autonomie (confort), nuits par spot. Pure."""
    v: list[str] = []

    # §2 PPC : toute suite d'autonomie > max = INFAISABLE médical.
    streak = _plus_long_streak_autonomie(nuits)
    if streak > params.max_nuits_autonomie_consecutives:
        v.append(
            f"PPC/électricité INFAISABLE : {streak} nuits autonomes consécutives > "
            f"{params.max_nuits_autonomie_consecutives} (borne médicale, électricité la nuit exigée)"
        )

    # §1 confort : jamais deux autonomies de suite.
    if params.jamais_deux_autonomies:
        for i in range(1, len(nuits)):
            if nuits[i]["type"] == "autonomie" and nuits[i - 1]["type"] == "autonomie":
                v.append(
                    f"confort : deux nuits autonomes de suite (jours {nuits[i-1]['jour']} et {nuits[i]['jour']}) "
                    f"— jamais 2 autonomies de suite"
                )
                break

    # §1 : nuits consécutives sur un même spot.
    courant_spot = None
    compte = 0
    for n in nuits:
        if n["spot"] == courant_spot:
            compte += 1
        else:
            courant_spot, compte = n["spot"], 1
        if compte > params.max_nuits_par_spot:
            v.append(
                f"spot {n['spot']} : {compte} nuits consécutives > {params.max_nuits_par_spot} (max nuits/spot)"
            )
            break

    return v


def _plus_long_run_sans(nuits: list[dict], a_la_qualite) -> int:
    """Plus longue suite de nuits consécutives NE VÉRIFIANT PAS `a_la_qualite(nuit)`. Pure."""
    plus_long = courant = 0
    for n in nuits:
        if a_la_qualite(n):
            courant = 0
        else:
            courant += 1
            plus_long = max(plus_long, courant)
    return plus_long


def _est_confort(nuit: dict) -> bool:
    return nuit["type"] == "camping_confort"


def violations_cadence(nuits: list[dict], params: ParamsNuitee) -> list[str]:
    """Cadences glissantes (M341 §1) : jamais `cadence_laverie_j` nuits d'affilée sans laverie, ni `cadence_confort_j`
    sans nuit confort ; un stop de >= `stop_min_pour_confort` nuits sur un spot exige une nuit confort. Violations
    NOMMÉES (R1). Pure. `nuit['laverie']` = laverie disponible ce soir (donnée aménités A, défaut faux)."""
    v: list[str] = []

    run_laverie = _plus_long_run_sans(nuits, lambda n: n.get("laverie", False))
    if run_laverie >= params.cadence_laverie_j:
        v.append(f"laverie : {run_laverie} nuits consécutives sans laverie >= cadence {params.cadence_laverie_j} j (>= 1 laverie / semaine)")

    run_confort = _plus_long_run_sans(nuits, _est_confort)
    if run_confort >= params.cadence_confort_j:
        v.append(f"confort : {run_confort} nuits sans nuit confort >= cadence {params.cadence_confort_j} j (>= 1 nuit confort / semaine)")

    # stop >= N nuits sur un spot ⇒ au moins une nuit confort sur ce stop.
    i = 0
    while i < len(nuits):
        j = i
        while j + 1 < len(nuits) and nuits[j + 1]["spot"] == nuits[i]["spot"]:
            j += 1
        longueur = j - i + 1
        if longueur >= params.stop_min_pour_confort and not any(_est_confort(n) for n in nuits[i : j + 1]):
            v.append(f"stop {nuits[i]['spot']} : {longueur} nuits sans confort — un stop de >= {params.stop_min_pour_confort} nuits exige une nuit confort")
        i = j + 1

    return v


def violations_roulage(jours: list[dict], params: ParamsNuitee) -> list[str]:
    """Cap de roulage journalier + fenêtre horaire (M341 §1) : chaque jour, roulage total <= cap, et roulage dans la
    fenêtre. Un jour marqué `grande_etape` (M347) utilise le PROFIL PROPRE `profil_ger` (override du socle sur son span :
    conduite le soir OK, cap relevé) ; les autres jours = socle. En plus, le NOMBRE de grandes étapes (spans contigus de
    jours `grande_etape`) est borné par `nb_grandes_etapes_max`. Chaque jour = {jour, debut_min, fin_min, total_min,
    grande_etape?}. Violations NOMMÉES (R1). Pure. (La PPC reste jugée globalement par violations_nuitee : une nuit
    autonomie de la poussée compte dans le streak.)"""
    v: list[str] = []
    for j in jours:
        ger = j.get("grande_etape", False)
        cap = params.profil_ger.cap_min if ger else params.cap_roulage_min
        debut = params.profil_ger.debut_min if ger else params.roulage_debut_min
        fin = params.profil_ger.fin_min if ger else params.roulage_fin_min
        etiq = "grande étape" if ger else "socle"
        if j.get("total_min", 0) > cap:
            v.append(f"jour {j['jour']} ({etiq}) : cap de roulage dépassé ({j['total_min']} min > {cap})")
        if j.get("fin_min") is not None and j["fin_min"] > fin:
            v.append(f"jour {j['jour']} ({etiq}) : roulage le soir / hors fenêtre (fin {j['fin_min']} min > {fin})")
        if j.get("debut_min") is not None and j["debut_min"] < debut:
            v.append(f"jour {j['jour']} ({etiq}) : roulage trop tôt le matin / hors fenêtre (début {j['debut_min']} min < {debut})")

    # Nombre de grandes étapes = spans contigus de jours `grande_etape`.
    spans = 0
    dans = False
    for j in jours:
        if j.get("grande_etape", False):
            if not dans:
                spans += 1
                dans = True
        else:
            dans = False
    if spans > params.nb_grandes_etapes_max:
        v.append(f"trop de grandes étapes de roulage : {spans} > max {params.nb_grandes_etapes_max}")
    return v


def cout_nuit(type_nuit: str, params: ParamsNuitee) -> float:
    """Coût-nuit du barème selon le type (M341 §1) : camping > aire > autonomie. Pure."""
    return {
        "autonomie": params.cout_nuit_autonomie_eur,
        "aire_equipee": params.cout_nuit_aire_eur,
        "camping_confort": params.cout_nuit_camping_eur,
    }.get(type_nuit, 0.0)


def cout_total_nuits(nuits: list[dict], params: ParamsNuitee) -> float:
    """Coût total des nuits : le coût RÉEL du spot (`nuit['cout_nuit_eur']`, donnée aménités A) prime, sinon le barème
    par type. Pure."""
    return float(sum(n.get("cout_nuit_eur", cout_nuit(n["type"], params)) for n in nuits))


# Borne « non contraignante » quand personne n'a de contrainte médicale (pas de limite d'autonomie médicale).
_SANS_BORNE_MEDICALE = 10 ** 6


def borne_autonomie_agregee(voyageurs: list[dict]) -> int | None:
    """M349 §2 : borne EFFECTIVE de nuits autonomes consécutives = MIN, sur les voyageurs ACTIFS, de leur contrainte
    médicale la plus stricte (`max_nuits_autonomie_consecutives`). None si aucun voyageur actif n'a de contrainte (pas de
    borne médicale). SENSIBLE : on n'agrège que la valeur, jamais le détail nominatif. Pure. Aujourd'hui seul Guillaume
    (PPC electricite_nuit) → il lie."""
    bornes: list[int] = []
    for v in voyageurs:
        if not v.get("actif", True):
            continue
        for c in v.get("contraintes", []):
            m = c.get("max_nuits_autonomie_consecutives")
            if m is not None:
                bornes.append(m)
    return min(bornes) if bornes else None


def params_avec_borne_medicale(params: ParamsNuitee, voyageurs: list[dict]) -> ParamsNuitee:
    """Rend une copie de `params` dont `max_nuits_autonomie_consecutives` = l'AGRÉGAT des contraintes médicales (M349 §2 :
    la PPC n'est plus un défaut fixe). Sans contrainte → borne non contraignante. Pure."""
    borne = borne_autonomie_agregee(voyageurs)
    return replace(
        params,
        max_nuits_autonomie_consecutives=(borne if borne is not None else _SANS_BORNE_MEDICALE),
    )


def violations_honeypot(visites: list[dict], params: ParamsNuitee) -> list[str]:
    """Crible §7 (M341) : un honeypot (lieu bondé) ne se visite PAS dans la fenêtre de foule [foule_debut, foule_fin]
    (10-16h par défaut). Chaque visite = {poi, honeypot: bool, debut_min, fin_min}. Chevauchement d'un honeypot avec la
    fenêtre = violation NOMMÉE (contrainte molle : le composeur préfère hors-foule, sinon signale). Pure."""
    v: list[str] = []
    for x in visites:
        if not x.get("honeypot"):
            continue
        if x["debut_min"] < params.foule_fin_min and x["fin_min"] > params.foule_debut_min:
            v.append(
                f"honeypot {x['poi']} visité dans la fenêtre de foule "
                f"[{params.foule_debut_min}-{params.foule_fin_min}] min (préférer hors 10-16h)"
            )
    return v


def plan_nuitee_faisable(nuits: list[dict], params: ParamsNuitee) -> bool:
    """Vrai si le plan de nuits respecte toutes les règles (séquence + cadences ; aucune violation). Le roulage
    (violations_roulage) se juge sur les JOURS, pas les nuits : appelé séparément par le composeur. Pure."""
    return not violations_nuitee(nuits, params) and not violations_cadence(nuits, params)
