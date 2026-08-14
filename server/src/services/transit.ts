// Service transit (A19 §8, M055) : la logique NON-routable du transit — épinglage des arrêts réservés (jalons imposés)
// et le point d'entrée de l'optimisation transit (2e mode du sidecar), GATÉE par le corridor routable d'A.
// La partie routable (choix du faisceau, minimisation temps/coût) n'est câblée que quand A livre le corridor.

import { Erreurs } from '../http/erreurs.js';
import type { ArretTransit, EtapeTransit } from '../domain/voyage.js';

/**
 * Applique la règle « réservation ⇒ jalon imposé » (A18/A19 §8.1, cohérent avec les crans irréversibles) : un arrêt
 * réservé est TOUJOURS épinglé (l'optimisation devra le retenir). Pure, idempotente, ne mute pas l'entrée.
 * Ne DÉ-épingle jamais un arrêt épinglé à la main (epingle reste vrai s'il l'était déjà).
 */
export function epinglerReserves(faisceau: ArretTransit[]): ArretTransit[] {
  return faisceau.map((a) => ({ ...a, epingle: a.epingle || a.reserve }));
}

/** Applique l'épinglage des réservations à toutes les étapes d'un faisceau (pure). */
export function normaliserEtapesTransit(etapes: EtapeTransit[]): EtapeTransit[] {
  return etapes.map((e) => ({ ...e, faisceau: epinglerReserves(e.faisceau) }));
}

/**
 * Les arrêts que l'optimisation DOIT retenir (épinglés : imposés utilisateur ou réservés). Pure.
 * Sert de contrainte dure passée au sidecar quand le corridor est routable.
 */
export function arretsImposes(faisceau: ArretTransit[]): ArretTransit[] {
  return epinglerReserves(faisceau).filter((a) => a.epingle);
}

/**
 * Optimisation transit (2e mode du sidecar : minimiser temps/coût, choisir le faisceau, nuits en autonomie par défaut).
 * GATÉE par le corridor routable d'A (M055) : tant que le corridor n'est pas livré, on ne route pas — on refuse
 * proprement (503 métier) plutôt que d'inventer un tracé. Les arrêts imposés sont déjà calculés (contrainte dure).
 * Câblage réel : POST vers le sidecar avec les arrêts imposés + le corridor, à la livraison d'A.
 */
export function optimiserTransit(_etape: EtapeTransit): never {
  throw Erreurs.requeteInvalide(
    'Optimisation transit indisponible : le corridor routable (A) n’est pas encore livré. Arrêts imposés déjà calculés.',
  );
}
