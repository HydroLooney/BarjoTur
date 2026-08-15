"""Oracle leximin de reference (prep CP-SAT, M240/M254).

Le solveur pur `resoudre_allocation_entree` (allocation.py) maximise la valeur totale captee sur la courbe CONSENSUS : c'est
un choix UTILITAIRE (somme), pas un max-min par voyageur. Le solveur de deploiement `resoudre_allocation_cpsat` (OR-Tools,
gate ortools) vise, lui, le LEXIMIN par voyageur (soigner d'abord le moins bien servi, puis le suivant). Pour pouvoir
FAIRE CONFIANCE a ce CP-SAT quand ortools sera installe sur Bomp4rd, il faut une reference exacte a laquelle le comparer.

Ce module fournit cette reference par ENUMERATION EXHAUSTIVE des allocations faisables (exact, borne aux petites
instances) et selection du vecteur de satisfaction leximin-optimal. PUR : ni OR-Tools, ni DB. Sert de socle de test,
jamais de solveur de production (l'enumeration explose au-dela de quelques lieux).
"""

from __future__ import annotations

from allocation import CourbeLieu, leximin_cle, _satisfaction_nuits


def allocations_faisables(lieux: list[CourbeLieu], total: int) -> list[dict[int, int]]:
    """Toutes les repartitions de `total` nuits ou chaque lieu recoit 0 nuit (non retenu) OU un nombre de nuits dans
    [min_nuits, borne_max], la somme valant EXACTEMENT `total`. Rend une liste de {lieu_id: nuits} (lieux a 0 exclus).
    Exact et pur ; a reserver aux petites instances (enumeration)."""
    resultats: list[dict[int, int]] = []
    acc: dict[int, int] = {}

    def parcourir(i: int, reste: int) -> None:
        if i == len(lieux):
            if reste == 0:
                resultats.append(dict(acc))
            return
        lieu = lieux[i]
        # Option A : lieu non retenu (0 nuit).
        parcourir(i + 1, reste)
        # Option B : lieu retenu, [min_nuits, borne_max], sans depasser le reste.
        for n in range(lieu.min_nuits, lieu.borne_max() + 1):
            if n > reste:
                break
            acc[lieu.lieu_id] = n
            parcourir(i + 1, reste - n)
            del acc[lieu.lieu_id]

    parcourir(0, total)
    return resultats


def _tous_voyageurs(courbes: dict[int, dict[str, list[float]]]) -> list[str]:
    """Union ordonnee (deterministe) des voyageurs presents dans les courbes, tous lieux confondus."""
    vus: dict[str, None] = {}
    for par_voyageur in courbes.values():
        for voyageur in par_voyageur:
            vus.setdefault(voyageur, None)
    return list(vus)


def leximin_optimal(
    lieux: list[CourbeLieu],
    total: int,
    courbes: dict[int, dict[str, list[float]]],
) -> tuple[dict[int, int], dict[str, float]]:
    """Parmi toutes les allocations faisables, celle dont le vecteur de satisfaction PAR VOYAGEUR est leximin-optimal
    (max-min, puis 2e plus faible, etc.). `courbes[lieu][voyageur]` = courbe marginale de ce voyageur pour ce lieu.
    Un voyageur qu'AUCUN lieu retenu ne sert compte pour 0 dans le vecteur (sinon le leximin serait fausse). Rend
    (nuits, satisfaction). Pur. Precondition : au moins une allocation faisable."""
    voyageurs = _tous_voyageurs(courbes)
    meilleure_nuits: dict[int, int] | None = None
    meilleure_sat: dict[str, float] | None = None
    meilleure_cle: tuple | None = None

    for nuits in allocations_faisables(lieux, total):
        partielle = _satisfaction_nuits(nuits, courbes)
        sat = {v: partielle.get(v, 0.0) for v in voyageurs}
        cle = leximin_cle([sat[v] for v in voyageurs])
        if meilleure_cle is None or cle > meilleure_cle:
            meilleure_cle = cle
            meilleure_nuits = nuits
            meilleure_sat = sat

    if meilleure_nuits is None or meilleure_sat is None:
        raise ValueError("leximin_optimal : aucune allocation faisable pour ce total.")
    return meilleure_nuits, meilleure_sat
