"""Types partagés du modèle composeur v3.1 (A pose, importés des deux côtés). Contrat = sidecar/INTERFACES.md (figé M, 7f2075b).

Surfaces disjointes : A implémente les corps (reward/allocation/enveloppe) contre CES types ; B (composeur.py) les appelle.
Contrat de fer : ces types ne changent pas sous l'autre ; besoin d'évolution → signaler à M (réédite INTERFACES.md).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# Signature = sortie de profilVersSignature (B) : poids w_* + envies th_* + réglages géo/conduite.
# Clés : w_nat/w_gra/w_tra/w_ran/w_biv/w_inc, anti_foule, autonomie, cadence, cap_conduite_h, biais_nord,
#        et themes = {paysage, rando, nautique, culturel}. Représentée par un dict plat (themes préfixés th_).
Signature = dict[str, float]

# Courbe = valeurs marginales par nuit sur une base, NON croissantes (satiété). len = offre_max.
Courbe = list[float]


@dataclass
class CoutTrajet:
    """Coût multimodal d'une arête base→base : temps (route/ferry séparés) + € (péage/ferry/carburant). Cf INTERFACES.md."""

    conduite_s: int
    ferry_s: int
    peage_eur: float
    ferry_eur: float
    carburant_eur: float

    @property
    def temps_total_s(self) -> int:
        return int(self.conduite_s) + int(self.ferry_s)

    @property
    def cout_total_eur(self) -> float:
        return float(self.peage_eur) + float(self.ferry_eur) + float(self.carburant_eur)


@dataclass
class OptionTrajet:
    """Une variante multimodale src→tgt (chaînage van+marche+TC, A177/M545) : liste de modes + temps + € + segments.
    `cout_multimodal` (van-only) reste inchangé (contrat de fer) ; `cout_multimodal_options` rend ces variantes (additif)."""

    modes: list[str]  # sous-ensemble de {'van','marche','ferry','tc'}
    temps_s: int
    euros: float
    segments: list[dict] = field(default_factory=list)


@dataclass
class Allocation:
    """Résultat d'allocation leximin : nuits par base + satisfaction par voyageur (le min est maximisé d'abord)."""

    par_base: dict[int, int]
    nuits_placees: int
    deficit: int
    satisfaction: dict[int, float] = field(default_factory=dict)


@dataclass
class Activite:
    """Une activité candidate/retenue. `payant` → compte dans l'enveloppe ; `voyageurs` = qui la fait."""

    poi_id: int
    cout_eur: Optional[float]
    payant: bool
    voyageurs: list[int]


@dataclass
class ReglageOrg:
    """Réglage posé par les ORGANISATEURS (regler_composition, gaté capacité) : bornes budget de l'enveloppe activités."""

    budget_soft_eur: float
    budget_hard_eur: float


@dataclass
class Enveloppe:
    """Enveloppe des activités payantes PAR VOYAGEUR (gis-mcda/16) : total + par voyageur + statut + marges + ajustements.
    statut : 'souple' (sous soft), 'serre' (entre soft et hard), 'depasse' (au-delà hard = infeasible sans serrage)."""

    total_eur: float
    par_voyageur: dict[int, float]
    statut: str  # 'souple' | 'serre' | 'depasse'
    marge_soft_eur: float
    marge_hard_eur: float
    ajustements: list[dict] = field(default_factory=list)
