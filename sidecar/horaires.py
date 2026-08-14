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
