# Interface A↔B du composeur v3.1 (figée par M, 19/08)

> Le joint des surfaces disjointes. **A** implémente les corps des modules du modèle (`allocation.py`, `enveloppe.py`,
> `reward.py`). **B** écrit `composeur.py` (l'orchestration `/compose`) qui les **appelle** via ces signatures. Tant qu'un
> module n'est pas livré, **B mocke** (stub neutre ci-dessous) ; le **live signature-unique reste** en prod jusqu'à bascule (à
> mon feu). Les **corps de formule** de `reward.py` attendent le pré-design #2 orness / #4 conduite / #6 V_poi (M+Guillaume) —
> mais les **signatures ci-dessous sont stables** : A peut scaffolder et coder tout ce qui ne dépend pas de ces arbitrages.
> Contrat de fer : ces signatures ne changent pas sous l'autre. Un besoin d'évolution = on me le signale, je réédite ici.

## Types partagés (dataclasses sidecar, A pose dans `modele_types.py`, importées des deux côtés)
```
Signature      = dict[str, float]     # sortie de profilVersSignature (B) : w_nat/w_gra/w_tra/w_ran/w_biv/w_inc/anti_foule/
                                      #   autonomie/cadence/cap_conduite_h/biais_nord/themes{paysage,rando,nautique,culturel}
CoutTrajet     = { conduite_s:int, ferry_s:int, peage_eur:float, ferry_eur:float, carburant_eur:float }
Courbe         = list[float]          # valeurs marginales par nuit sur une base, NON croissantes (satiété). len = offre_max.
Allocation     = { par_base: dict[base_id,int], nuits_placees:int, deficit:int,
                   satisfaction: dict[voyageur_id,float] }        # leximin : le min est maximisé d'abord
Activite       = { poi_id:int, cout_eur:float|None, payant:bool, voyageurs:list[voyageur_id] }
ReglageOrg     = { budget_soft_eur:float, budget_hard_eur:float }  # posé par les organisateurs (regler_composition)
Enveloppe      = { total_eur:float, par_voyageur: dict[voyageur_id,float], statut: 'souple'|'serre'|'depasse',
                   marge_soft_eur:float, marge_hard_eur:float, ajustements: list[dict] }   # leviers +/- entre soft et hard
```

## `reward.py` (A) — récompense + coût multimodal
```
def reward_base(base_id: int, signature: Signature) -> float
    # Récompense d'une base pour une signature (f1-f6 pondérés + envies th_* + incontournables - foule, geo_pref nord, prix).
    # CORPS = pré-design #2 orness / #6 V_poi (attend M+Guillaume). Signature STABLE.
def cout_multimodal(src_base: int, tgt_base: int) -> CoutTrajet
    # Depuis diffusion.base_base_multimodal_v31 (conduite_s/ferry_s/peage_eur/ferry_eur ; carburant = length_m * param).
```

## `allocation.py` (A) — leximin + courbe valeur-par-nuit  (modules DORMANTS à réveiller, B160)
```
def courbe_valeur_nuit(base_id: int, signature: Signature, offre_max: int) -> Courbe
    # Valeurs marginales décroissantes des nuits 1..offre_max sur une base (satiété), selon la signature. NON croissante.
def resoudre_allocation(signatures: list[Signature],
                        courbes: dict[int, list[Courbe]],        # base_id -> [Courbe par voyageur]
                        budget_nuits: int, bases_ouvertes: list[int]) -> Allocation
    # Alloue budget_nuits aux bases en LEXIMIN entre voyageurs (maximise le moins satisfait d'abord, puis le suivant…).
def satisfaction_par_voyageur(alloc: Allocation, signatures, courbes) -> dict[int, float]
```

## `enveloppe.py` (A) — enveloppe d'activités payantes PAR VOYAGEUR (à CONSTRUIRE, gis-mcda/16)
```
def calculer_enveloppe(activites_retenues: list[Activite], voyageurs: list[int], reglage: ReglageOrg) -> Enveloppe
    # Somme les coûts des activités PAYANTES par voyageur, agrège, confronte à budget_soft/hard → statut + marges.
def ajuster_pour_budget(env: Enveloppe, activites_candidates: list[Activite], reglage: ReglageOrg) -> Enveloppe
    # Levier de SOUPLESSE (ajoute/retire des activités payantes pour tenir entre soft et hard) + SERRAGE au dépassement.
```

## Ordre du pipeline `composeur.py` (B) — appelle les modules d'A
```
1. signatures = [profilVersSignature(p) for p in famille]                 # B (existe déjà, live)
2. courbes    = {b: [allocation.courbe_valeur_nuit(b, s, offre[b]) for s in signatures] for b in bases_ouvertes}   # A
3. alloc      = allocation.resoudre_allocation(signatures, courbes, budget_nuits, bases_ouvertes)                  # A (leximin)
4. couts      = {(i,j): reward.cout_multimodal(i,j) for i,j in aretes}    # A (multimodal temps+€)
5. env        = enveloppe.calculer_enveloppe(activites, voyageurs, reglage_org)                                     # A
6. env        = enveloppe.ajuster_pour_budget(env, activites_candidates, reglage_org)  # souplesse/serrage           # A
7. B assemble : orienteering/route sur `couts`, build_agenda (garde ferry+21n, ancres Kristiansand aller/boucle/retour),
   transit selon conducteurs (cap_conduite_h), comblement par défauts si déficit ; G4 dirty/file/worker enrobe le tout.
```

## MOCKS (B, en attendant les modules d'A — neutres, non-régressifs)
```
reward.reward_base       -> le reward_base scalaire actuel (signature-unique, live B153/B157)
reward.cout_multimodal   -> couple depuis diffusion.base_base_multimodal_v31 (déjà en DB2, A172) — utilisable DÈS MAINTENANT
allocation.resoudre_allocation -> distribuer_nuits() actuel (1-3 nuits borné offre, PAS leximin) ; leximin = quand A livre
allocation.courbe_valeur_nuit  -> [reward_base]*offre (plat, pas de satiété) ; courbe réelle = quand A livre
enveloppe.*              -> Enveloppe{total:0, statut:'souple'} ; enveloppe réelle = quand A livre
```

## Non-simplification (rappel) : ces signatures PORTENT les 13 promesses
leximin (resoudre_allocation) · courbe valeur-nuit (courbe_valeur_nuit) · enveloppe PAR VOYAGEUR soft/hard+serrage (enveloppe.py) ·
multimodal temps+€ (cout_multimodal) · budget vivant (env confrontée budget) · infra journalière + transit + comblement + aller/
boucle/retour ferry Kristiansand + dynamique live G4 (composeur.py, B). Rien n'est coupé ; c'est réparti, pas simplifié.
