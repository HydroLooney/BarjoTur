import type { EtapeFige } from '@barjotur/shared';
import { campDeBase, libelleNuit } from '@/lib/atlas';

// Fil d'itinéraire (A32 / M151) : le voyage en perles. HYBRIDE séjour/jour (tranché par Guillaume) — les
// journées passées au même camp de base forment une perle de SÉJOUR, qu'on déplie en ses JOURNÉES (sous-perles).
// Chaque perle porte son état par rapport au jour courant (visitée / courante / à venir) et si la nuit est en
// autonomie (couleur nuit `--fil-nuit` vs jour `--fil-jour`, appliquée par le composant). Pur et testable ;
// alimenté par les étapes du figé (fixture puis vrai figé au flip). Ce module est la PLOMBERIE ; le rendu
// (vue plein-fil, overlay carte, agenda fisheye) vient ensuite, avec aperçu pour l'œil de Guillaume.
export type EtatPerle = 'visitee' | 'courante' | 'a_venir';

export interface PerleJour {
  jour: number;
  date: string | null;
  etat: EtatPerle;
  /** Nuit en autonomie (aire/bivouac) : rendue en couleur nuit. */
  nuitAutonomie: boolean;
  nuitLibelle: string | null;
}

export interface PerleSejour {
  base: string | null;
  base_id: number | null;
  jourDebut: number;
  jourFin: number;
  etat: EtatPerle;
  journees: PerleJour[];
}

/** État d'un jour par rapport au jour courant : passé = visité, égal = courant, futur = à venir. */
export function etatDe(jour: number, jourCourant: number): EtatPerle {
  if (jour < jourCourant) return 'visitee';
  if (jour === jourCourant) return 'courante';
  return 'a_venir';
}

/** Une nuit est « en autonomie » si son type le dit (aire, bivouac) — sinon hébergement payant. */
function estAutonomie(nuiteeType: string | null): boolean {
  return libelleNuit(nuiteeType) === 'Nuit en autonomie';
}

/**
 * Construit le fil en perles de séjour depuis les étapes du figé. Les journées CONSÉCUTIVES au même `base_id`
 * sont regroupées en un séjour. L'état d'un séjour est « courant » si le jour courant tombe dedans, sinon dérivé
 * de sa position (tout avant = visité, tout après = à venir). `jourCourant` par défaut 0 (rien de courant).
 */
export function filDepuisEtapes(etapes: EtapeFige[], jourCourant = 0): PerleSejour[] {
  const tri = [...etapes].sort((a, b) => a.jour - b.jour);
  const sejours: PerleSejour[] = [];

  for (const e of tri) {
    const jour: PerleJour = {
      jour: e.jour,
      date: e.date_jour,
      etat: etatDe(e.jour, jourCourant),
      nuitAutonomie: estAutonomie(e.nuitee_type),
      nuitLibelle: libelleNuit(e.nuitee_type),
    };
    const dernier = sejours[sejours.length - 1];
    // Même camp de base que le séjour en cours (et base non nulle) → on prolonge le séjour.
    if (dernier && dernier.base_id != null && dernier.base_id === e.base_id) {
      dernier.journees.push(jour);
      dernier.jourFin = e.jour;
    } else {
      sejours.push({
        base: campDeBase(e),
        base_id: e.base_id,
        jourDebut: e.jour,
        jourFin: e.jour,
        etat: 'a_venir',
        journees: [jour],
      });
    }
  }

  // État du séjour : courant si le jour courant est dans [debut, fin], sinon visité (avant) ou à venir (après).
  for (const s of sejours) {
    if (jourCourant >= s.jourDebut && jourCourant <= s.jourFin) s.etat = 'courante';
    else if (s.jourFin < jourCourant) s.etat = 'visitee';
    else s.etat = 'a_venir';
  }

  return sejours;
}
