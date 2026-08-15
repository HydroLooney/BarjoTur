"""Expressions TSAB du composeur (M380). PUR, sans DB ni OR-Tools. Le tier d'un lieu (T/S/A/B/C…) vient d'A ; ici on
n'agrège que des comptes de tiers, en respectant l'ANTI-DOUBLE-COMPTE (un lieu compté une fois).

(1) budget_tsab_par_voyageur : ce que CHAQUE voyageur capte, exprimé en TIERS — équité lisible en qualité (« chacun a sa
    part d'incontournables ») et source des recos personnalisées (le haut du budget de chacun).
(2) synthese_tsab_du_jour : le profil de tiers d'une JOURNÉE (éventail), pour l'agenda (richesse d'un coup d'œil) et
    l'équilibrage/gradation entre jours.
"""

from __future__ import annotations


def _valorise(courbe_voyageur) -> bool:
    """Un voyageur CAPTE un lieu s'il a une courbe de valeur strictement positive dessus. Pure."""
    return bool(courbe_voyageur) and sum(courbe_voyageur) > 0


def budget_tsab_par_voyageur(
    selection: list[int],
    tiers_par_lieu: dict[int, str],
    courbes_par_voyageur: dict[int, dict[str, list[float]]],
) -> dict[str, dict[str, int]]:
    """Pour chaque voyageur, le compte des tiers qu'il CAPTE parmi les lieux retenus (`selection`) qu'il valorise. Rend
    {voyageur: {tier: n}}. Un lieu sans tier connu est ignoré. Pure."""
    out: dict[str, dict[str, int]] = {}
    for lieu in selection:
        tier = tiers_par_lieu.get(lieu)
        if tier is None:
            continue
        for voyageur, courbe in courbes_par_voyageur.get(lieu, {}).items():
            if not _valorise(courbe):
                continue
            d = out.setdefault(voyageur, {})
            d[tier] = d.get(tier, 0) + 1
    return out


def synthese_tsab_du_jour(lieux_du_jour: list[int], tiers_par_lieu: dict[int, str]) -> dict[str, int]:
    """Profil de tiers d'une journée = compte des tiers des lieux du jour, chaque lieu compté UNE fois (anti-double-compte,
    pas une somme brute). Lieu sans tier ignoré. Pure."""
    profil: dict[str, int] = {}
    for lieu in dict.fromkeys(lieux_du_jour):  # dédup en préservant l'ordre
        tier = tiers_par_lieu.get(lieu)
        if tier is None:
            continue
        profil[tier] = profil.get(tier, 0) + 1
    return profil


def budget_tsab_delta_vote(tier: str, vote_avant: float, vote_apres: float, seuil: float = 0.0) -> dict[str, int]:
    """Recalcul INCRÉMENTAL au vote (M384) : le delta LOCAL du budget TSAB d'un voyageur quand son vote sur un lieu change.
    Le lieu est « capté » si sa valeur dépasse `seuil`. Franchir le seuil vers le haut = +1 sur son tier (une part visible
    bouge : un incontournable rejoint ma part) ; vers le bas = −1 ; une simple variation d'intensité sans franchir le seuil
    ne change PAS le compte (effet sensé, jamais brutal). Rend `{}` si rien ne bouge. Pas de recompute complet. Pure."""
    capte_avant = vote_avant > seuil
    capte_apres = vote_apres > seuil
    if capte_apres and not capte_avant:
        return {tier: 1}
    if capte_avant and not capte_apres:
        return {tier: -1}
    return {}


def appliquer_delta_tsab(budget: dict[str, int], delta: dict[str, int]) -> dict[str, int]:
    """Applique un delta au budget TSAB d'un voyageur (les tiers retombant à 0 sont retirés). Rend un nouveau dict. Pure."""
    out = dict(budget)
    for tier, d in delta.items():
        out[tier] = out.get(tier, 0) + d
        if out[tier] == 0:
            del out[tier]
    return out
