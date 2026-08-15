import type { GroupeMoment, DensiteJour, TypeNuit } from '@barjotur/shared';

// Libellés humains + formats de l'agenda du jour (M499/M502). Voix douce, famille. Aucune couleur en dur : les
// jauges/pastilles utilisent des variables de charte (var(--token)) posées côté composant.

export const LIBELLE_MOMENT: Record<GroupeMoment, string> = {
  matin: 'Matin',
  midi: 'Midi',
  apres_midi: 'Après-midi',
  soir: 'Soir',
};

/** Densité ressentie : libellé + jeton de couleur (souple → soutenue → dépassé, R1 : le dépassement est dit). */
export const DENSITE_INFO: Record<DensiteJour, { libelle: string; token: string }> = {
  souple: { libelle: 'Journée souple', token: '--glacier' },
  modere: { libelle: 'Journée équilibrée', token: '--ocre' },
  soutenue: { libelle: 'Journée soutenue', token: '--accent' },
  depasse: { libelle: 'Journée trop chargée', token: '--destructive' },
};

/** Part de remplissage (0..1) d'une jauge de densité, pour un repère visuel. */
export const DENSITE_PART: Record<DensiteJour, number> = {
  souple: 0.35,
  modere: 0.6,
  soutenue: 0.85,
  depasse: 1,
};

export const LIBELLE_TYPE_NUIT: Record<TypeNuit, string> = {
  autonomie: 'Nuit en autonomie',
  aire: 'Aire aménagée',
  camping: 'Camping',
  confort: 'Nuit tout confort',
};

/** Minutes → « 1 h 30 » / « 45 min » / « 2 h ». Null/0 → chaîne vide. */
export function formatDuree(min?: number | null): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}
