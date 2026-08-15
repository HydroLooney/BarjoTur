"""enveloppe.py (A, modèle v3.1) — enveloppe des activités PAYANTES par voyageur. Contrat = sidecar/INTERFACES.md ; doctrine
gis-mcda/16 (enveloppe activité bidirectionnelle : envie↔plan↔budget, soft/hard cap, serrage au dépassement, réglée organisateurs).

Surface disjointe de B : A code le corps ; composeur.py (B) l'appelle dans le pipeline (étapes 5-6). Pur (pas de DB).
"""
from __future__ import annotations

from modele_types import Activite, Enveloppe, ReglageOrg


def calculer_enveloppe(activites_retenues: list[Activite], voyageurs: list[int], reglage: ReglageOrg) -> Enveloppe:
    """Somme les coûts des activités PAYANTES par voyageur (coût = par personne × qui la fait), agrège, confronte au
    budget soft/hard des organisateurs → statut (souple/serre/depasse) + marges. gis-mcda/16. Pure."""
    par_voyageur: dict[int, float] = {int(v): 0.0 for v in voyageurs}
    total = 0.0
    for a in activites_retenues:
        if not a.payant or a.cout_eur is None:
            continue
        cout = float(a.cout_eur)
        for v in a.voyageurs:
            par_voyageur[int(v)] = par_voyageur.get(int(v), 0.0) + cout
            total += cout
    soft = float(reglage.budget_soft_eur)
    hard = float(reglage.budget_hard_eur)
    if total <= soft:
        statut = "souple"
    elif total <= hard:
        statut = "serre"
    else:
        statut = "depasse"
    return Enveloppe(
        total_eur=round(total, 2),
        par_voyageur={v: round(c, 2) for v, c in par_voyageur.items()},
        statut=statut,
        marge_soft_eur=round(soft - total, 2),   # >0 = marge sous le soft ; <0 = au-delà du soft
        marge_hard_eur=round(hard - total, 2),   # <0 = DÉPASSEMENT hard (serrage requis)
        ajustements=[],
    )


def ajuster_pour_budget(env: Enveloppe, activites_candidates: list[Activite], reglage: ReglageOrg) -> Enveloppe:
    """Levier de SOUPLESSE + SERRAGE (gis-mcda/16). Rend une enveloppe ajustée + la liste des ajustements proposés.
    - `souple` (sous soft) : PROPOSE d'AJOUTER des activités payantes candidates (les moins chères d'abord) jusqu'au soft.
    - `serre` (entre soft et hard) : rien (zone acceptable).
    - `depasse` (au-delà du hard) : SERRAGE — signale le montant à RETIRER (total − hard) ; le retrait effectif des activités
      est fait par le composeur (qui tient la liste retenue), l'enveloppe pose la CONTRAINTE. Pure."""
    soft = float(reglage.budget_soft_eur)
    hard = float(reglage.budget_hard_eur)
    total = float(env.total_eur)
    ajustements: list[dict] = list(env.ajustements)
    par_voyageur = dict(env.par_voyageur)

    if env.statut == "souple":
        payantes = sorted(
            (a for a in activites_candidates if a.payant and a.cout_eur is not None),
            key=lambda a: float(a.cout_eur),
        )
        for a in payantes:
            cout_total = float(a.cout_eur) * len(a.voyageurs)
            if total + cout_total > soft:
                break
            total += cout_total
            for v in a.voyageurs:
                par_voyageur[int(v)] = par_voyageur.get(int(v), 0.0) + float(a.cout_eur)
            ajustements.append({"type": "ajout", "poi_id": a.poi_id, "cout_eur": float(a.cout_eur), "voyageurs": a.voyageurs})
    elif env.statut == "depasse":
        ajustements.append({"type": "serrage", "montant_a_retirer_eur": round(total - hard, 2),
                            "note": "retirer des activités payantes (plus chères d'abord) jusqu'au hard cap"})

    if total <= soft:
        statut = "souple"
    elif total <= hard:
        statut = "serre"
    else:
        statut = "depasse"
    return Enveloppe(
        total_eur=round(total, 2),
        par_voyageur={v: round(c, 2) for v, c in par_voyageur.items()},
        statut=statut,
        marge_soft_eur=round(soft - total, 2),
        marge_hard_eur=round(hard - total, 2),
        ajustements=ajustements,
    )
