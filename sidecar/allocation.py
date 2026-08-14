"""Modèle d'allocation A25 (M113) — le CŒUR du composeur : orienteering sélectif + ordonnancement sous cadre fixe.

Décide QUELS camps de base retenir, COMBIEN de nuits chacun, dans quel ORDRE, pour maximiser la valeur captée sous
RENDEMENT DÉCROISSANT par lieu, cadre de jours FIXE (21 nuits, ferry figé), min/max de nuits par lieu. Conséquence
assumée (A25) : prolonger un lieu fort peut faire TOMBER une destination — c'est le rôle de l'optimiseur, pas un bug.

Deux implémentations à MÊME interface (EntreeAllocation → Resultat) :
  * `resoudre_allocation` — solveur PUR (DP exact du knapsack à rendement décroissant + routage plus-proche-voisin).
    Testable SANS OR-Tools (convention sidecar), amorce sur données SYNTHÉTIQUES. C'est ce qui tourne dans les tests.
  * `resoudre_allocation_cpsat` — modèle OR-Tools CP-SAT (booléens de cran ordonnés, cadre en contrainte). Solveur de
    référence pour le flip ; le max-min ÉGALITARISTE exact + le circuit de routage s'y branchent (notes ci-dessous).
    Requiert `ortools` (absent de cet env Py3.14, PEP 668) : ÉCRIT, non exécuté ici — même interface que le pur.

Reward (courbes de valeur) et coûts de trajet = fournis par A au flip. Ici, STUBS SYNTHÉTIQUES (R1).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CourbeLieu:
    """Courbe de valeur (rendement décroissant) d'un lieu : marginaux[k] = valeur du (k+1)e nuit. NON croissante."""

    lieu_id: int
    marginaux: list[float]
    min_nuits: int = 1
    max_nuits: Optional[int] = None

    def borne_max(self) -> int:
        return len(self.marginaux) if self.max_nuits is None else min(self.max_nuits, len(self.marginaux))


@dataclass
class Cadre:
    total_nuits: int
    depart: int
    arrivee: int


@dataclass
class EntreeAllocation:
    # `lieux` porte la courbe CONSENSUS par lieu (déjà agrégée, cf `agreger_egalitariste`).
    lieux: list[CourbeLieu]
    couts_trajet: dict[tuple[int, int], float]
    cadre: Cadre
    mode: str = "full_auto"  # "manuel" | "assiste" | "full_auto"
    nuits_imposees: dict[int, int] = field(default_factory=dict)


@dataclass
class Resultat:
    selection: list[int]
    nuits: dict[int, int]
    ordre: list[int]
    valeur_captee: float
    cout_trajet: float
    gardes: list[dict]  # [{lieu, nuits, marginal_suivant, marginal_dernier}] — « un jour de plus/de moins ici vaut … »
    laisses: list[dict]  # [{lieu, marginal_premier}] — « laissé de côté : … »
    faisable: bool = True


# --- briques pures -----------------------------------------------------------------------------------

def valeur_captee(marginaux: list[float], n: int) -> float:
    """Valeur d'un lieu pour n nuits = somme des n premiers marginaux (bornée à la longueur). Pure."""
    return float(sum(marginaux[: max(0, n)]))


def valider_decroissance(marginaux: list[float]) -> bool:
    """Vrai si les marginaux sont non croissants (rendement décroissant, A25). Pure."""
    return all(marginaux[i] >= marginaux[i + 1] for i in range(len(marginaux) - 1))


def agreger_egalitariste(courbes_par_voyageur: list[list[float]]) -> list[float]:
    """Agrège les courbes marginales de plusieurs voyageurs en une courbe CONSENSUS, cran par cran, en soignant le
    MOINS BIEN SERVI (min par cran). Amorce R1 du « consensus égalitariste » ; le CP-SAT fera le max-min exact. Pure."""
    if not courbes_par_voyageur:
        return []
    longueur = min(len(c) for c in courbes_par_voyageur)
    return [min(c[k] for c in courbes_par_voyageur) for k in range(longueur)]


def satisfaction_par_voyageur(nuits: dict[int, int], courbes: dict[int, dict[str, list[float]]]) -> dict[str, float]:
    """Valeur captée PAR VOYAGEUR pour une allocation (compteur d'ÉQUITÉ A25 : de combien chacun est servi ; le min =
    la personne la moins bien servie). `courbes[lieu][voyageur]` = courbe marginale de ce voyageur pour ce lieu. Pure."""
    sat: dict[str, float] = {}
    for lieu, n in nuits.items():
        for voyageur, courbe in courbes.get(lieu, {}).items():
            sat[voyageur] = sat.get(voyageur, 0.0) + valeur_captee(courbe, n)
    return sat


# --- solveur pur (amorce, DP exact) ------------------------------------------------------------------

def _allouer_dp(lieux: list[CourbeLieu], total: int) -> dict[int, int]:
    """Alloue `total` nuits pour maximiser la valeur captée, chaque lieu à 0 OU [min, max] nuits, sous rendement
    décroissant. DP EXACT (borné : total ≤ 21, lieux ≤ ~60). Rend {lieu_id: nuits} (lieux à 0 exclus). Pure."""
    NEG = float("-inf")
    dp: list[tuple[float, dict[int, int]]] = [(NEG, {}) for _ in range(total + 1)]
    dp[0] = (0.0, {})
    for lieu in lieux:
        options = [0] + list(range(max(1, lieu.min_nuits), lieu.borne_max() + 1))
        ndp: list[tuple[float, dict[int, int]]] = [(NEG, {}) for _ in range(total + 1)]
        for j in range(total + 1):
            val, choix = dp[j]
            if val == NEG:
                continue
            for n in options:
                if j + n > total:
                    continue
                v2 = val + valeur_captee(lieu.marginaux, n)
                if v2 > ndp[j + n][0]:
                    nchoix = dict(choix)
                    if n > 0:
                        nchoix[lieu.lieu_id] = n
                    ndp[j + n] = (v2, nchoix)
        dp = ndp
    if dp[total][0] != NEG:
        return dp[total][1]
    # garde-fou infaisable (min trop contraignants pour un remplissage exact) : meilleur remplissage ≤ total.
    best = max(range(total + 1), key=lambda j: dp[j][0])
    return dp[best][1]


def ordonner_route(
    selection: list[int], couts: dict[tuple[int, int], float], depart: int, arrivee: int
) -> tuple[list[int], float]:
    """Ordonne les lieux retenus en un chemin OUVERT depart→…→arrivee minimisant le trajet (heuristique plus-proche-
    voisin, amorce ; le circuit exact = CP-SAT au flip). Coût manquant = 0 (matrice synthétique incomplète, R1). Pure."""

    def c(a: int, b: int) -> float:
        return couts.get((a, b), couts.get((b, a), 0.0))

    restants = list(selection)
    ordre: list[int] = []
    courant = depart
    total = 0.0
    while restants:
        prochain = min(restants, key=lambda x: c(courant, x))
        total += c(courant, prochain)
        ordre.append(prochain)
        restants.remove(prochain)
        courant = prochain
    total += c(courant, arrivee)
    return ordre, total


def resoudre_allocation(entree: EntreeAllocation) -> Resultat:
    """Résout l'allocation (amorce PURE, DP exact). Modes : `manuel` (nuits imposées en contrainte), `assiste`/
    `full_auto` (optimise). Rend sélection + nuits + ordre + valeur + arbitrage lisible (gardés/laissés + marginaux,
    de quoi dire « un jour de plus ici vaut X », « un de moins ici (Y) vaut un de plus là (Z) »). Pure."""
    lieux_par_id = {l.lieu_id: l for l in entree.lieux}
    if entree.mode == "manuel":
        nuits = {lid: n for lid, n in entree.nuits_imposees.items() if n > 0}
    else:  # assiste | full_auto : même optimisation ; l'assisté n'ajoute que la présentation des marginaux (côté C).
        nuits = _allouer_dp(entree.lieux, entree.cadre.total_nuits)

    selection = sorted(nuits.keys())
    valeur = sum(valeur_captee(lieux_par_id[lid].marginaux, n) for lid, n in nuits.items())
    ordre, cout = ordonner_route(selection, entree.couts_trajet, entree.cadre.depart, entree.cadre.arrivee)

    gardes = []
    for lid in selection:
        courbe = lieux_par_id[lid].marginaux
        n = nuits[lid]
        gardes.append(
            {
                "lieu": lid,
                "nuits": n,
                "marginal_suivant": courbe[n] if n < len(courbe) else 0.0,  # un jour de PLUS ici vaut …
                "marginal_dernier": courbe[n - 1] if 0 < n <= len(courbe) else 0.0,  # un jour de MOINS ici coûte …
            }
        )
    laisses = [
        {"lieu": l.lieu_id, "marginal_premier": (l.marginaux[0] if l.marginaux else 0.0)}
        for l in entree.lieux
        if l.lieu_id not in nuits
    ]
    return Resultat(
        selection, nuits, ordre, valeur, cout, gardes, laisses,
        faisable=bool(nuits) or entree.cadre.total_nuits == 0,
    )


# --- mapping sur le contrat partagé shared/allocation.ts (M117) --------------------------------------

def entree_depuis_json(payload: dict) -> EntreeAllocation:
    """Construit une EntreeAllocation depuis le JSON du contrat partagé (M117). `couts_trajet` y est une LISTE de
    {de, vers, cout} (CoutTrajet[]) ; on la ramène au dict interne {(de, vers): cout}. Pure."""
    lieux = [
        CourbeLieu(
            lieu_id=int(l["lieu_id"]),
            marginaux=[float(v) for v in l["marginaux"]],
            min_nuits=int(l.get("min_nuits", 1)),
            max_nuits=(int(l["max_nuits"]) if l.get("max_nuits") is not None else None),
        )
        for l in payload["lieux"]
    ]
    couts = {(int(c["de"]), int(c["vers"])): float(c["cout"]) for c in payload.get("couts_trajet", [])}
    cad = payload["cadre"]
    cadre = Cadre(total_nuits=int(cad["total_nuits"]), depart=int(cad["depart"]), arrivee=int(cad["arrivee"]))
    nuits_imposees = {int(k): int(v) for k, v in (payload.get("nuits_imposees") or {}).items()}
    return EntreeAllocation(
        lieux=lieux, couts_trajet=couts, cadre=cadre,
        mode=payload.get("mode", "full_auto"), nuits_imposees=nuits_imposees,
    )


def resultat_vers_json(r: Resultat) -> dict:
    """Sérialise un Resultat au format EXACT du contrat partagé ResultatAllocation (M117) : selection / nuits / ordre /
    valeur_captee / cout_trajet / gardes / laisses (le champ interne `faisable` n'est pas exposé). Pure."""
    return {
        "selection": r.selection,
        "nuits": r.nuits,  # dict int→int ; JSON stringifie les clés (Record<number,number>)
        "ordre": r.ordre,
        "valeur_captee": r.valeur_captee,
        "cout_trajet": r.cout_trajet,
        "gardes": r.gardes,
        "laisses": r.laisses,
    }


# --- solveur OR-Tools CP-SAT (référence flip ; requiert ortools, non exécuté ici) --------------------

def resoudre_allocation_cpsat(entree: EntreeAllocation) -> Resultat:
    """Modèle CP-SAT équivalent (allocation consensus exacte). MÊME interface que `resoudre_allocation`.

    Formulation : par lieu, des booléens de CRAN `x[l][k]` (« au moins k+1 nuits »), ordonnés `x[k] >= x[k+1]` ; le
    rendement décroissant est capté sans non-linéarité (maximiser prend d'abord les meilleurs crans). Contraintes :
    somme des crans = total_nuits ; min via `x[k] >= x[0]` pour k < min. Objectif : somme des marginaux pris.

    EXTENSIONS FLIP (notées, non codées ici pour ne pas livrer d'inexécutable) :
      * max-min ÉGALITARISTE : une valeur par voyageur `V_t = Σ marginaux_t[k]·x[l][k]`, variable `m ≤ V_t ∀t`,
        maximiser `m` (+ tie-break somme) — soigne d'abord la personne la moins bien servie (A25).
      * ROUTAGE : circuit sur les lieux retenus (`AddCircuit`), coût de trajet réel (matrice A), faisabilité van.
    Requiert `ortools` (absent ici) ; lève une erreur claire si indisponible."""
    try:
        from ortools.sat.python import cp_model  # import tardif : le pur n'en dépend pas
    except ImportError as exc:  # pragma: no cover - dépend de l'env
        raise RuntimeError("resoudre_allocation_cpsat requiert `ortools` (cf sidecar/requirements.txt).") from exc

    total = entree.cadre.total_nuits
    model = cp_model.CpModel()
    x: dict[int, list] = {}
    for lieu in entree.lieux:
        kb = lieu.borne_max()
        x[lieu.lieu_id] = [model.NewBoolVar(f"x_{lieu.lieu_id}_{k}") for k in range(kb)]
        for k in range(kb - 1):
            model.Add(x[lieu.lieu_id][k] >= x[lieu.lieu_id][k + 1])  # cran k+1 ⇒ cran k
        for k in range(1, min(lieu.min_nuits, kb)):
            model.Add(x[lieu.lieu_id][k] >= x[lieu.lieu_id][0])  # sélectionné ⇒ au moins min nuits

    model.Add(sum(x[l.lieu_id][k] for l in entree.lieux for k in range(l.borne_max())) == total)
    # marginaux mis à l'échelle entière (CP-SAT est entier).
    model.Maximize(
        sum(
            int(round(l.marginaux[k] * 1000)) * x[l.lieu_id][k]
            for l in entree.lieux
            for k in range(l.borne_max())
        )
    )

    solver = cp_model.CpSolver()
    solver.Solve(model)
    lieux_par_id = {l.lieu_id: l for l in entree.lieux}
    nuits = {
        l.lieu_id: sum(int(solver.Value(x[l.lieu_id][k])) for k in range(l.borne_max()))
        for l in entree.lieux
    }
    nuits = {lid: n for lid, n in nuits.items() if n > 0}
    selection = sorted(nuits.keys())
    valeur = sum(valeur_captee(lieux_par_id[lid].marginaux, n) for lid, n in nuits.items())
    ordre, cout = ordonner_route(selection, entree.couts_trajet, entree.cadre.depart, entree.cadre.arrivee)
    return Resultat(selection, nuits, ordre, valeur, cout, gardes=[], laisses=[], faisable=bool(nuits))
