// Service agenda du jour (#4, M527) : compose « Mon voyage » et mappe la sortie build_agenda du sidecar vers le contrat
// shared AgendaVoyage (carte du jour + barre d'animation). Ne connaît pas Express. Les champs pas encore calculés
// (thème, payant/coût, laverie, streak PPC…) = null/absent (R1) ; C rend le présent et branche le riche au fil.
// L'enveloppe d'activités payantes + le confort PPC riche = v3.1 (modules d'A) ; ici on expose le SENS structurel.

import { composerAvecProfil } from './composeur.js';
import type {
  AgendaVoyage,
  JourAgenda,
  ActiviteAgenda,
  GroupeMoment,
  ContrainteHoraire,
  TypeNuit,
  DensiteJour,
  EtapeAgendaBrute,
  SegmentBrut,
} from '../domain/agenda.js';

/** « HH:MM » → minutes depuis minuit, ou null si absent/mal formé. Pure. */
export function hhmmVersMin(s: string | undefined | null): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Regroupe une activité par moment de la journée depuis son heure (défaut matin si inconnue). Pure. */
export function groupeMoment(heure: string | undefined | null): GroupeMoment {
  const min = hhmmVersMin(heure);
  if (min === null) return 'matin';
  if (min < 12 * 60) return 'matin';
  if (min < 14 * 60) return 'midi';
  if (min < 18 * 60) return 'apres_midi';
  return 'soir';
}

/** Densité ressentie depuis temps consommé / budget-temps. Pure. null si non calculable. */
export function densiteDe(consomme: number | null, budget: number | null): DensiteJour | undefined {
  if (consomme === null || budget === null || budget <= 0) return undefined;
  const r = consomme / budget;
  if (r > 1) return 'depasse';
  if (r >= 0.75) return 'soutenue';
  if (r >= 0.45) return 'modere';
  return 'souple';
}

/** Type de nuit depuis le nuitee_type du sidecar (défaut camping). Pure. */
export function typeNuitDe(n: string | undefined): TypeNuit {
  switch (n) {
    case 'autonomie': return 'autonomie';
    case 'aire': return 'aire';
    case 'confort': return 'confort';
    default: return 'camping';
  }
}

/** Nature de contrainte horaire d'un segment : transit/ferry = ancre dure ; repas = heure ; sinon souple. Pure. */
function contrainteDe(seg: SegmentBrut): ContrainteHoraire {
  if (seg.mode === 'ferry' || seg.type === 'transit') return 'dure';
  if (seg.type === 'repas') return 'heure';
  return 'souple';
}

/** Mappe un segment brut → activité d'agenda. payant/coût/poi_id = null (enveloppe v3.1). Pure. */
function versActivite(seg: SegmentBrut): ActiviteAgenda {
  return {
    heure: seg.heure_debut ?? null,
    duree_min: typeof seg.duree_min === 'number' ? seg.duree_min : null,
    titre: seg.note ?? seg.type ?? 'Étape',
    sous_titre: null,
    groupe_moment: groupeMoment(seg.heure_debut),
    contrainte: contrainteDe(seg),
    poi_id: typeof seg.ref === 'number' ? seg.ref : null,
    payant: undefined,
    cout_eur: null,
  };
}

/**
 * Mappe la sortie build_agenda (étapes brutes) → AgendaVoyage. Pure, testable. Dérive groupe_moment / budget-temps /
 * densité ; laisse à null ce qui n'est pas encore calculé (thème, enveloppe payante, laverie/PPC riche).
 */
export function construireAgenda(etapes: EtapeAgendaBrute[]): AgendaVoyage {
  const jours: JourAgenda[] = etapes.map((e) => {
    const segs = e.circuit?.segments ?? [];
    const activites = segs.map(versActivite);
    const consomme = segs.reduce((s, seg) => s + (typeof seg.duree_min === 'number' ? seg.duree_min : 0), 0) || null;
    const lever = hhmmVersMin(e.lever);
    const coucher = hhmmVersMin(e.coucher);
    const budget = lever !== null && coucher !== null && coucher > lever ? coucher - lever : null;
    return {
      jour: typeof e.jour === 'number' ? e.jour : 0,
      date: e.date ?? null,
      base_id: typeof e.base_id === 'number' ? e.base_id : null,
      lieu: e.circuit?.nom ?? e.resume_jour?.circuit_nom ?? null,
      theme: null,
      perle: e.resume_jour?.climax ?? false,
      lever: e.lever ?? null,
      coucher: e.coucher ?? null,
      budget_temps_min: budget,
      temps_consomme_min: consomme,
      densite: densiteDe(consomme, budget),
      activites,
      confort: {
        type_nuit: typeNuitDe(e.nuitee_type),
        laverie: undefined,
        laverie_jours_depuis: null,
        laverie_jours_avant: null,
        streak_autonomie: null,
        alerte_ppc: undefined,
        cout_nuit_eur: null,
      },
    };
  });

  const budgetTotal = jours.reduce<number | null>((tot, j) => {
    if (j.budget_temps_min === null || j.budget_temps_min === undefined) return tot;
    return (tot ?? 0) + j.budget_temps_min;
  }, null);

  return {
    jours,
    ancre_depart: etapes[0]?.circuit?.nom ?? null,
    ancre_retour: etapes.length > 0 ? (etapes[etapes.length - 1]?.circuit?.nom ?? null) : null,
    budget_temps_total_min: budgetTotal,
  };
}

/**
 * L'agenda de « Mon voyage » pour le porteur du lien : compose (pondéré par son profil philosophie) avec agenda, puis mappe.
 * Sans lien, compose neutre. Lève si le sidecar échoue (INFEASIBLE, etc. → le message remonte).
 */
export async function lireAgenda(code: string | null): Promise<AgendaVoyage> {
  const reponse = await composerAvecProfil(
    { bases: [], archetype_key: null, avec_agenda: true, persister: false },
    code,
  );
  const etapes = (reponse.etapes ?? []) as unknown as EtapeAgendaBrute[];
  return construireAgenda(etapes);
}
