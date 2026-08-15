"""Budget QUOTA de vote par tier (M386). PUR, sans DB. Le vote est contraint : on ne peut pas tout aimer — rareté au
sommet (T rare, puis S, A, B ; C = plancher non voté, quota 0). Ce module modélise le QUOTA, le résultat d'un vote
(ok, ou « tier plein » + l'état pour l'overlay d'échange de C), et l'ÉCHANGE atomique (retirer un ancien du tier + poser
le nouveau au MÊME tier). L'enforcement réel (RPC set_vote gaté portée/votesComptent) + le budget/recos live = BFF/flip ;
la calibration des quotas suit M384 (normalisé capacité, équitable).
"""

from __future__ import annotations


def quota_plein(votes_du_tier: list, quota: int) -> bool:
    """Vrai si le tier a atteint (ou dépassé) son quota. Pure."""
    return len(votes_du_tier) >= quota


def resultat_vote(votes_par_tier: dict[str, list], quotas: dict[str, int], tier: str, lieu) -> dict:
    """Résultat de la tentative de voter `lieu` au `tier`. Si le quota du tier est LIBRE → pose le vote (`ok:True`,
    `votes_par_tier` mis à jour). Si PLEIN → ne bloque pas sec : rend `tier_plein:True` + `votes_actuels` (la liste des
    votes du tier) pour que C propose l'ÉCHANGE (M385). Pure (ne mute pas l'entrée)."""
    du_tier = votes_par_tier.get(tier, [])
    if quota_plein(du_tier, quotas.get(tier, 0)):
        return {"ok": False, "tier_plein": True, "tier": tier, "votes_actuels": list(du_tier)}
    nouveau = {**votes_par_tier, tier: du_tier + [lieu]}
    return {"ok": True, "tier_plein": False, "votes_par_tier": nouveau}


def echanger_vote(votes_par_tier: dict[str, list], tier: str, retirer_lieu, poser_lieu) -> dict[str, list]:
    """Échange ATOMIQUE au sein d'un tier plein : retire `retirer_lieu` ET pose `poser_lieu`, au MÊME tier, d'un seul
    tenant (jamais d'état incohérent : ni deux retirés, ni quota dépassé transitoirement). Rend le nouveau `votes_par_tier`.
    Lève ValueError si `retirer_lieu` n'est pas dans le tier (on n'échange pas contre un vote inexistant). Pure."""
    du_tier = votes_par_tier.get(tier, [])
    if retirer_lieu not in du_tier:
        raise ValueError(f"échange impossible : {retirer_lieu} n'est pas voté au tier {tier}")
    nouveau_tier = [x for x in du_tier if x != retirer_lieu] + [poser_lieu]
    return {**votes_par_tier, tier: nouveau_tier}


# --- M393/M396 : les DEUX voies quand un déclassement tombe sur un tier lui aussi plein ---
# Le cas limite (Guillaume) : poser un T force à déclasser un T vers S, mais S est plein, donc un S vers A, etc.
# Voie (a) CASCADE : la suite finie de déclassements jusqu'au plancher (dernier tier de `ordre_tiers`, SANS quota,
# illimité) → termine TOUJOURS. Voie (b) HORS-BUDGET : on accepte le surplus dans un panier « hors budget » du tier,
# NON COMPTÉ (R1) tant qu'il n'est pas rééquilibré. `etat_paniers` expose les deux, pour la notification et l'écran.


def cascade_declassement(
    votes_par_tier: dict[str, list], quotas: dict[str, int], ordre_tiers: list[str], tier_depart: str
) -> list[dict]:
    """Voie (a). Suite FINIE de déclassements nécessaires pour faire de la place au `tier_depart`. Chaque étape porte
    `{tier, vers, candidats}` : `tier` doit céder un lieu vers `vers` (le tier juste en dessous), et `candidats` liste les
    votes actuels du tier (les choix que C proposera). On s'arrête dès qu'un tier a de la place, ou au PLANCHER (dernier de
    `ordre_tiers`, illimité) → jamais infini. Rend `[]` si le tier de départ a déjà de la place. Pure (ne mute rien)."""
    etapes: list[dict] = []
    i = ordre_tiers.index(tier_depart)
    while i < len(ordre_tiers) - 1:  # le dernier tier est le plancher illimité : toujours de la place, on s'arrête avant
        tier = ordre_tiers[i]
        if not quota_plein(votes_par_tier.get(tier, []), quotas.get(tier, 0)):
            break  # place ici → inutile de déclasser plus bas
        etapes.append({"tier": tier, "vers": ordre_tiers[i + 1], "candidats": list(votes_par_tier.get(tier, []))})
        i += 1
    return etapes


def poser_hors_budget(hors_budget: dict[str, list], tier: str, lieu) -> dict[str, list]:
    """Voie (b). Ajoute `lieu` au panier HORS-BUDGET du `tier` (surplus accepté mais NON compté, R1). Rend le nouveau
    `hors_budget`. Pure (ne mute pas l'entrée)."""
    du_tier = hors_budget.get(tier, [])
    return {**hors_budget, tier: du_tier + [lieu]}


def etat_paniers(
    votes_par_tier: dict[str, list],
    hors_budget: dict[str, list],
    quotas: dict[str, int],
    ordre_tiers: list[str],
) -> dict:
    """État des paniers pour l'UI et la notification (contrat shared M396). Par tier : `dans_budget` (comptés), `hors_budget`
    (surplus NON compté), `quota` (None au plancher = dernier de `ordre_tiers`, illimité), `a_reequilibrer` (le tier déborde,
    du hors-budget en attente). `budget_a_resoudre` global = au moins un tier déborde. Ordre = `ordre_tiers`. Pure."""
    paniers: list[dict] = []
    a_resoudre = False
    for pos, tier in enumerate(ordre_tiers):
        hors = list(hors_budget.get(tier, []))
        deborde = len(hors) > 0
        if deborde:
            a_resoudre = True
        quota = None if pos == len(ordre_tiers) - 1 else quotas.get(tier)
        paniers.append(
            {
                "tier": tier,
                "quota": quota,
                "dans_budget": list(votes_par_tier.get(tier, [])),
                "hors_budget": hors,
                "a_reequilibrer": deborde,
            }
        )
    return {"paniers": paniers, "budget_a_resoudre": a_resoudre}
