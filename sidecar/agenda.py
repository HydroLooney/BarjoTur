"""Agenda chronologique du jour (T032b/M147, A25) — le micro-OP jour n'est PAS un sac d'activités : il TIME une suite
d'activités en une journée crédible, matin→soir, en respectant les HEURES D'OUVERTURE. PUR, sans OR-Tools ni DB.

Prend une suite d'activités DÉJÀ ordonnée (la sélection/ordre viennent du composeur ; ici on la déroule dans le temps) et
rend l'agenda daté + la faisabilité. Compose `horaires.py` (heures d'ouverture). Contrat `with_agenda` : le composeur
appelle ceci pour vérifier qu'une journée tient dans le temps réel avant de la retenir. Le RÉORDONNANCEMENT optimal
(quel POI avant quel autre selon les fenêtres) est l'affaire du CP-SAT couplé au déploiement ; ici on déroule un ordre.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from horaires import HeuresPoi


@dataclass
class ActiviteJour:
    """Une activité à caser dans la journée : sa durée sur place, ses heures d'ouverture (None = permanent), et le
    trajet pour l'atteindre depuis l'étape précédente (matin→soir)."""

    poi_id: int
    duree_min: int
    heures: Optional[HeuresPoi] = None
    trajet_avant_min: int = 0


@dataclass
class CreneauAgenda:
    poi_id: int
    debut_min: int
    fin_min: int


def composer_agenda_jour(
    activites: list[ActiviteJour], debut_min: int
) -> tuple[list[CreneauAgenda], bool, str]:
    """Déroule les activités dans l'ordre donné à partir de `debut_min` : trajet pour atteindre l'activité, ATTENTE
    jusqu'à l'ouverture si on arrive trop tôt, puis durée sur place. Rend (agenda daté, faisable, raison). Infaisable
    dès qu'une visite déborde la fermeture de son POI (la raison nomme le POI). Chronologie croissante garantie. Pure."""
    agenda: list[CreneauAgenda] = []
    t = debut_min
    for a in activites:
        t += a.trajet_avant_min
        h = a.heures
        if h is not None and h.ouverture_min is not None and t < h.ouverture_min:
            t = h.ouverture_min  # on attend l'ouverture
        debut = t
        fin = debut + a.duree_min
        if h is not None and h.fermeture_min is not None and fin > h.fermeture_min:
            return agenda, False, f"POI {a.poi_id} : visite {debut}-{fin} min déborde la fermeture {h.fermeture_min} min"
        agenda.append(CreneauAgenda(a.poi_id, debut, fin))
        t = fin
    return agenda, True, ""
