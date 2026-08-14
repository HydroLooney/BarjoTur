import type { ArretTransit, EtapeTransit, PointVoyage } from '@barjotur/shared';

// Logique pure du transit app-side (A19 / M055). L'optimisation réelle (choix du faisceau, minimisation
// temps/coût) vit côté sidecar (gatée corridor). Ici : lecture d'état et gestes d'édition (insertion,
// bascule autonomie), pour la coquille flip-ready.

/** Libellé d'état d'un arrêt candidat : réservé (jalon imposé) > épinglé > autonomie / payant. */
export function libelleArret(a: ArretTransit): string {
  if (a.reserve) return 'réservé';
  if (a.epingle) return 'épinglé';
  return a.autonomie ? 'autonomie' : 'payant';
}

/** Une nouvelle étape de transit vierge à insérer (A19 §8.2). Corridor et faisceau se précisent ensuite. */
export function nouvelleEtapeTransit(ordre: number, depuis: PointVoyage, vers: PointVoyage): EtapeTransit {
  return { id: `t-nouveau-${ordre}`, ordre, depuis, vers, jalon_date: null, faisceau: [] };
}

/** Bascule autonomie/payant d'un arrêt (immuable). Un arrêt RÉSERVÉ ne bascule pas (jalon extérieur imposé). */
export function basculerAutonomie(faisceau: ArretTransit[], id: string): ArretTransit[] {
  return faisceau.map((a) => (a.id === id && !a.reserve ? { ...a, autonomie: !a.autonomie } : a));
}
