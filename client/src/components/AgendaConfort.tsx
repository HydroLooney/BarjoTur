import { useMemo } from 'react';
import type { EtapeFige } from '@barjotur/shared';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { useReglages, nombreReglage } from '@/lib/queries/reglages';
import { libelleNuit, campDeBase } from '@/lib/atlas';
import { AffordanceExpert } from '@/components/coulisses/OverlayExpert';
import { cn } from '@/lib/utils';

// AGENDA CONFORT (M343 A) : le confort VÉCU jour après jour. Trois lectures que M343 demande :
//  - le TYPE DE NUIT (autonomie = van seul / confort = aire ou camping avec électricité) ;
//  - le STREAK d'autonomie (nuits d'affilée sans borne) — lié à la PPC de Guillaume (besoin d'électricité la nuit) :
//    alerte douce quand la série approche la cadence de nuit confort ;
//  - la CADENCE laverie (repère « au moins une fois par semaine »).
// Ce sont des AFFICHAGES (M343) : les seuils viennent du registre (cadence_confort_j / cadence_laverie_j, écran
// « agenda ») ; la présence réelle d'une laverie par étape est une donnée à venir du composeur (A/B), dite honnêtement
// tant qu'elle n'est pas là (R1). Un jour = une ligne, l'alerte est douce (jamais bloquante).

interface JourAgenda {
  jour: number;
  date: string | null;
  camp: string | null;
  /** Nuit en autonomie (van seul) vs confort (électricité disponible). */
  autonomie: boolean;
  libelleNuit: string;
  roulageMin: number | null;
}

// Jeu de DÉMO (R1, DEV only, ?demo) : une série réaliste avec des enchaînements d'autonomie, pour montrer le streak +
// l'alerte PPC. Remplacé par la vraie donnée du composeur (nuitee_type par jour) au flip. Jamais en production.
const AGENDA_DEMO: { date: string; camp: string; nuit: 'autonomie' | 'camping'; roulage: number | null }[] = [
  { date: '2027-08-05', camp: 'Kristiansand', nuit: 'camping', roulage: null },
  { date: '2027-08-06', camp: 'Setesdal', nuit: 'autonomie', roulage: 180 },
  { date: '2027-08-07', camp: 'Hovden', nuit: 'autonomie', roulage: 150 },
  { date: '2027-08-08', camp: 'Røldal', nuit: 'autonomie', roulage: 130 },
  { date: '2027-08-09', camp: 'Odda', nuit: 'autonomie', roulage: 90 },
  { date: '2027-08-10', camp: 'Sauda', nuit: 'autonomie', roulage: 120 },
  { date: '2027-08-11', camp: 'Suldal', nuit: 'autonomie', roulage: 110 },
  { date: '2027-08-12', camp: 'Sand', nuit: 'autonomie', roulage: 80 },
  { date: '2027-08-13', camp: 'Bergen', nuit: 'camping', roulage: 165 },
  { date: '2027-08-14', camp: 'Gudvangen', nuit: 'autonomie', roulage: 140 },
  { date: '2027-08-15', camp: 'Flåm', nuit: 'camping', roulage: 60 },
];

function jourDepuisEtape(e: EtapeFige): JourAgenda {
  const lib = libelleNuit(e.nuitee_type) ?? 'Nuit à préciser';
  return {
    jour: e.jour,
    date: e.date_jour,
    camp: campDeBase(e),
    autonomie: lib === 'Nuit en autonomie',
    libelleNuit: lib,
    roulageMin: e.roulage_min,
  };
}

function formatH(min: number | null): string | null {
  if (min == null) return null;
  if (min === 0) return 'sur place';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`;
}

export function AgendaConfort() {
  const demo = typeof window !== 'undefined' && import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
  const { data: scenario } = useScenarioDefaut();
  const figeId = scenario?.fige_id ?? null;
  const { data: fige, isLoading } = useFigeDetail(demo ? null : figeId);
  const reglages = useReglages('composition');

  const cadenceConfort = useMemo(() => {
    const r = reglages.data?.find((x) => x.cle === 'cadence_confort_j');
    return r ? nombreReglage(r.valeur) : 7;
  }, [reglages.data]);
  const cadenceLaverie = useMemo(() => {
    const r = reglages.data?.find((x) => x.cle === 'cadence_laverie_j');
    return r ? nombreReglage(r.valeur) : 7;
  }, [reglages.data]);

  const jours = useMemo<JourAgenda[]>(() => {
    if (demo) {
      return AGENDA_DEMO.map((d, i) => ({
        jour: i + 1,
        date: d.date,
        camp: d.camp,
        autonomie: d.nuit === 'autonomie',
        libelleNuit: d.nuit === 'autonomie' ? 'Nuit en autonomie' : 'Nuit confort',
        roulageMin: d.roulage,
      }));
    }
    const es = [...(fige?.etapes ?? [])].sort((a, b) => a.jour - b.jour);
    return es.map(jourDepuisEtape);
  }, [demo, fige]);

  // Streak d'autonomie CUMULÉ par jour (nuits d'affilée sans électricité). Remis à zéro par une nuit confort.
  const avecStreak = useMemo(() => {
    let streak = 0;
    return jours.map((j) => {
      streak = j.autonomie ? streak + 1 : 0;
      // Alerte PPC douce : la série d'autonomie atteint la cadence de nuit confort → électricité conseillée bientôt.
      const alertePpc = j.autonomie && streak >= cadenceConfort;
      return { ...j, streak, alertePpc };
    });
  }, [jours, cadenceConfort]);

  const streakMax = useMemo(() => avecStreak.reduce((m, j) => Math.max(m, j.streak), 0), [avecStreak]);
  const vide = jours.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-muted-foreground">
          Le confort au fil des jours : où l'on dort, quand recharger (la PPC a besoin d'électricité la nuit), et le
          repère laverie. Rien de bloquant, juste de quoi garder un rythme tenable.
        </p>
        {/* Overlay expert de l'écran agenda (cadences, fenêtres de roulage) — gaté mode expert + capacité. */}
        <AffordanceExpert ecran="agenda" />
      </div>

      {/* Repères de cadence, lus du registre (écran agenda). */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
          Nuit confort au moins tous les <span className="chiffres text-foreground">{cadenceConfort}</span> jours
        </span>
        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
          Laverie au moins tous les <span className="chiffres text-foreground">{cadenceLaverie}</span> jours
        </span>
        {streakMax > 0 ? (
          <span className="rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground">
            Plus longue série en autonomie : <span className="chiffres text-foreground">{streakMax}</span> nuit
            {streakMax > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {isLoading && vide ? <p className="text-sm text-muted-foreground">Chargement de l'agenda…</p> : null}
      {!isLoading && vide ? (
        <p className="text-sm text-muted-foreground">
          L'agenda s'affiche dès qu'un itinéraire est composé. En attendant, réglez vos cadences dans Coulisses.
        </p>
      ) : null}

      <ol className="space-y-1.5">
        {avecStreak.map((j) => (
          <li
            key={j.jour}
            className={cn(
              'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm shadow-posee',
              j.alertePpc ? 'border-ocre/50 bg-ocre/5' : 'border-border bg-card',
            )}
          >
            <span className="w-14 shrink-0 text-xs text-muted-foreground">
              Jour <span className="chiffres text-foreground">{j.jour}</span>
            </span>
            {j.date ? <span className="chiffres w-24 shrink-0 text-xs text-muted-foreground">{j.date}</span> : null}
            <span className="min-w-24 flex-1 font-medium">{j.camp ?? '—'}</span>

            {/* Type de nuit : autonomie (van seul, ocre) vs confort (électricité, glacier). */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs',
                j.autonomie ? 'bg-ocre/10 text-foreground' : 'bg-glacier/10 text-foreground',
              )}
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: j.autonomie ? 'var(--ocre)' : 'var(--glacier)' }}
              />
              {j.libelleNuit}
              {j.autonomie && j.streak > 1 ? (
                <span className="chiffres text-muted-foreground">· {j.streak}ᵉ nuit</span>
              ) : null}
            </span>

            {formatH(j.roulageMin) ? (
              <span className="chiffres w-20 shrink-0 text-right text-xs text-muted-foreground">
                {formatH(j.roulageMin)}
              </span>
            ) : null}

            {j.alertePpc ? (
              <span className="w-full text-xs text-foreground" role="status">
                Électricité conseillée bientôt : la série d'autonomie atteint {j.streak} nuits (PPC).
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <p className="max-w-prose text-xs text-muted-foreground">
        La présence d'une laverie à chaque étape viendra du composeur ; ici on montre la cadence conseillée et les
        nuits en autonomie déjà lisibles depuis l'itinéraire.
      </p>
    </div>
  );
}
