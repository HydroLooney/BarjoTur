import type { Parametre } from '@/lib/queries/parametres';
import type { ModeDeplacement } from '@/lib/libelles';

// Profils de déplacement (T038, décision M076) : PAS de nouvel endpoint. On lit les `routing_params` à travers
// l'atome `Parametre` existant, filtrés sur le domaine « Profil * » (van / à pied / en rando / en transports),
// et on les REGROUPE par mode côté front. Pur et testable ; zéro contrat inventé, zéro surface B nouvelle.

/** Un mode de déplacement et ses paramètres de routage (vue front, regroupe des `Parametre`). */
export interface ProfilModeVue {
  mode: ModeDeplacement;
  /** Le profil est-il gelé par un fait extérieur (van réservé au cran « Le van », A18) ? */
  gele: boolean;
  /** Ce qui gèle le profil, en clair. */
  gelePar?: string;
  params: Parametre[];
}

const ORDRE: ModeDeplacement[] = ['van', 'pieton', 'rando', 'tc'];

/** Rapproche un domaine « Profil * » d'un mode de déplacement. `null` si le domaine n'est pas un profil. */
function modeDeDomaine(domaine: string): ModeDeplacement | null {
  const d = domaine.toLowerCase();
  if (!d.includes('profil')) return null;
  if (d.includes('van')) return 'van';
  if (d.includes('pied') || d.includes('piéton') || d.includes('pieton')) return 'pieton';
  if (d.includes('rando')) return 'rando';
  if (d.includes('transport') || d.includes('tc')) return 'tc';
  return null;
}

/**
 * Regroupe les paramètres du registre en profils par mode, dans l'ordre van → à pied → rando → transports.
 * Le van est marqué gelé (profil figé une fois le van réservé, cran « Le van », A18). Les paramètres hors
 * domaine « Profil * » sont ignorés. Renvoie une liste vide si le registre n'expose encore aucun profil.
 */
export function profilsDepuisParametres(params: Parametre[]): ProfilModeVue[] {
  const groupes = new Map<ModeDeplacement, Parametre[]>();
  for (const p of params) {
    const mode = modeDeDomaine(p.domaine);
    if (!mode) continue;
    const liste = groupes.get(mode) ?? [];
    liste.push(p);
    groupes.set(mode, liste);
  }
  return ORDRE.filter((m) => groupes.has(m)).map((mode) => ({
    mode,
    gele: mode === 'van',
    gelePar: mode === 'van' ? 'réservation du van, cran « Le van »' : undefined,
    params: groupes.get(mode) ?? [],
  }));
}
