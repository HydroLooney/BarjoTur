"""Modèle d'horaires du composeur (M120/M124, A25) — le RÉALISME temporel : les ferries intérieurs ont un DERNIER
DÉPART (une liaison ratée casse l'enchaînement), et les POI ont des HEURES D'OUVERTURE (une visite hors créneau est
infaisable). PUR, sans OR-Tools ni DB (convention sidecar).

Nourrit deux moitiés :
  * le **CP-SAT couplé** (déploiement) en TIME WINDOWS sur les liaisons ferry et en contrainte de créneau au niveau jour ;
  * la **planification jour A* live** (runtime) pour ordonner les visites dans les créneaux.

Les horaires RÉELS (grilles ferry AutoPASS/Ruteplan, heures d'ouverture POI) viennent d'A au flip ; ici, tout est passé
en paramètre (synthétique en test, R1). Les heures sont en MINUTES depuis minuit (0..1439).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


def hhmm_en_minutes(s: str) -> int:
    """« HH:MM » → minutes depuis minuit. Pure."""
    h, m = s.split(":")
    return int(h) * 60 + int(m)


@dataclass
class FenetreFerry:
    """Liaison ferry intérieure sous fenêtre : il faut être au quai `de` AU PLUS TARD à `dernier_depart_min`. `duree_min`
    = temps de traversée (pour caler la suite de la journée)."""

    de: int
    vers: int
    dernier_depart_min: int
    duree_min: int = 0


@dataclass
class HeuresPoi:
    """Créneau d'ouverture d'un POI (minutes). `None` = ouvert en permanence (pas de contrainte)."""

    poi_id: int
    ouverture_min: Optional[int] = None
    fermeture_min: Optional[int] = None


def ferry_atteignable(heure_arrivee_quai_min: int, fenetre: FenetreFerry) -> bool:
    """Vrai si on arrive au quai `de` à temps pour le dernier départ (≤ dernier_depart_min). Pure."""
    return heure_arrivee_quai_min <= fenetre.dernier_depart_min


def visite_dans_ouverture(debut_min: int, duree_min: int, heures: HeuresPoi) -> bool:
    """Vrai si une visite [debut, debut+duree] tient dans le créneau d'ouverture du POI (ouvert en permanence si les
    bornes sont absentes). Pure."""
    if heures.ouverture_min is not None and debut_min < heures.ouverture_min:
        return False
    if heures.fermeture_min is not None and debut_min + duree_min > heures.fermeture_min:
        return False
    return True


def sequence_ferries_faisable(
    heures_arrivee_quai_min: list[int], ferries: list[FenetreFerry]
) -> tuple[bool, str]:
    """Vérifie qu'une séquence de liaisons ferry est réalisable : pour chaque ferry, on arrive au quai à temps. Rend
    (faisable, raison) — `raison` nomme le PREMIER ferry raté (« ferry de=<quai> manqué »). Pure."""
    for arrivee, f in zip(heures_arrivee_quai_min, ferries):
        if not ferry_atteignable(arrivee, f):
            return False, f"ferry de={f.de} vers={f.vers} manqué (dernier départ {f.dernier_depart_min} min, arrivée {arrivee} min)"
    return True, ""


@dataclass
class AncreObligatoire:
    """Étape OBLIGATOIRE à date fixe (M303) : ferry A/R Fjord Line, transit Allemagne imposé, restitution du van. Le
    composeur route AUTOUR d'elle mais ne peut ni la DÉPLACER (jour figé), ni la RATER (arrivée au quai ≤
    `heure_limite_min` pour un ferry), ni DÉPASSER son budget de route pour l'atteindre. `heure_limite_min` = None si
    l'ancre n'impose pas d'heure (ex. restitution). Heures en minutes depuis minuit."""

    id: str
    jour: int
    heure_limite_min: Optional[int]
    budget_roulage_min: int


def violations_ancres(
    jour_planifie: dict[str, int],
    arrivee_quai_min: dict[str, int],
    roulage_reel_min: dict[str, int],
    ancres: list[AncreObligatoire],
) -> list[str]:
    """Garde DURE des ancres obligatoires (M303 §4) : rend la liste des violations d'un plan de composeur (vide = le
    plan RESPECTE toutes les ancres). Trois façons de violer, par ancre : la DÉPLACER (jour ≠ jour figé), RATER son
    ferry (arrivée quai > heure limite), DÉPASSER son budget de route. Les entrées absentes d'un dict ne sont pas
    contraintes (on ne juge que ce qui est fourni, R1). Pure."""
    v: list[str] = []
    for a in ancres:
        jp = jour_planifie.get(a.id)
        if jp is not None and jp != a.jour:
            v.append(f"ancre {a.id} DÉPLACÉE : jour {jp} au lieu de {a.jour} (obligatoire, non déplaçable)")
        if a.heure_limite_min is not None:
            arr = arrivee_quai_min.get(a.id)
            if arr is not None and arr > a.heure_limite_min:
                v.append(f"ancre {a.id} RATÉE : arrivée quai {arr} min > limite {a.heure_limite_min} min")
        r = roulage_reel_min.get(a.id)
        if r is not None and r > a.budget_roulage_min:
            v.append(f"ancre {a.id} BUDGET dépassé : roulage {r} min > budget {a.budget_roulage_min} min")
    return v


def plan_respecte_ancres(
    jour_planifie: dict[str, int],
    arrivee_quai_min: dict[str, int],
    roulage_reel_min: dict[str, int],
    ancres: list[AncreObligatoire],
) -> bool:
    """Vrai si le plan respecte TOUTES les ancres (aucune violation). Garde dure du composeur avant fige. Pure."""
    return not violations_ancres(jour_planifie, arrivee_quai_min, roulage_reel_min, ancres)


@dataclass
class JalonHoraire:
    """Jalon logistique OBLIGATOIRE horodaté (M326) : une opération du transit (enlèvement/chargement/embarquement 2 h
    avant/traversée/halte-nuit/arrivée/nettoyage/déchargement/restitution) à un instant fixe, avec le `roulage_min` pour
    l'atteindre depuis le jalon précédent et sa `marge_securite_min` dure (ex. embarquement ferry = 120 min avant le
    départ ; restitution = nettoyage+déchargement avant l'heure). Heures en minutes sur un axe commun."""

    id: str
    operation: str
    heure_min: int
    roulage_min: int
    marge_securite_min: int


def violations_marges(jalons: list[JalonHoraire]) -> list[str]:
    """Garde des MARGES logistiques (M326) : entre deux jalons consécutifs, `roulage_min` + `marge_securite_min` doivent
    tenir dans le temps disponible (heure du suivant − heure du précédent). Rend les violations (vide = faisable). Un
    dépassement est NOMMÉ, jamais masqué (R1). Complète `FenetreFerry`/`AncreObligatoire` : ici c'est la faisabilité
    temporelle des opérations obligatoires (pas seulement le dernier départ ferry). Pure."""
    v: list[str] = []
    for i in range(1, len(jalons)):
        dispo = jalons[i].heure_min - jalons[i - 1].heure_min
        besoin = jalons[i].roulage_min + jalons[i].marge_securite_min
        if besoin > dispo:
            j = jalons[i]
            v.append(
                f"jalon {j.id} ({j.operation}) INFAISABLE : besoin {besoin} min "
                f"(roulage {j.roulage_min} + marge {j.marge_securite_min}) > dispo {dispo} min"
            )
    return v


def sequence_logistique_faisable(jalons: list[JalonHoraire]) -> bool:
    """Vrai si la séquence de jalons logistiques respecte toutes ses marges (aucune violation). Pure."""
    return not violations_marges(jalons)
