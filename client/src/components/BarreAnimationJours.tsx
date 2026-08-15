import { useMemo } from 'react';
import type { EtapeFige } from '@barjotur/shared';
import { campDeBase, libelleNuit } from '@/lib/atlas';
import { cn } from '@/lib/utils';

// BARRE D'ANIMATION des jours (M499/M502 §1, doc AGENDA-JOUR-BARRE-ANIMATION-NAV-v3.md), bas de l'espace Carte.
// Timeline horizontale de l'ancre de départ à l'ancre d'arrivée : ligne à DÉGRADÉ de progression, une PUCE JOUR
// cliquable par étape (« J8 Geiranger »), la sélectionnée plus grande/contrastée, un MARQUEUR NUIT distinct pour
// les nuits en autonomie, et les ANCRES de bornes nommées aux extrémités (le ferry Kristiansand). Rendu sur la
// donnée présente (fige.etapes) ; les champs riches (heure/durée/densité) enrichiront la carte du jour ensuite.
// Grand texte, lisible enfant/grand-mère. Scrollable au pouce si beaucoup de jours.

interface JourBarre {
  jour: number;
  camp: string;
  date: string | null;
  autonomie: boolean;
}

function courtCamp(nom: string | null): string {
  if (!nom) return '—';
  // Coupe la parenthèse de qualificatif pour la puce (« Setesdal (…) » → « Setesdal »).
  return nom.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export function BarreAnimationJours({
  etapes,
  jourSelectionne,
  onSelect,
}: {
  etapes: EtapeFige[];
  jourSelectionne: number | null;
  onSelect: (jour: number) => void;
}) {
  const jours = useMemo<JourBarre[]>(
    () =>
      [...etapes]
        .sort((a, b) => a.jour - b.jour)
        .map((e) => ({
          jour: e.jour,
          camp: courtCamp(campDeBase(e)),
          date: e.date_jour,
          autonomie: libelleNuit(e.nuitee_type) === 'Nuit en autonomie',
        })),
    [etapes],
  );

  if (jours.length === 0) return null;
  const depart = jours[0]!;
  const arrivee = jours[jours.length - 1]!;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Le voyage jour par jour</span>
        <span className="text-xs text-muted-foreground">
          Touchez un jour pour le voir sur la carte.
        </span>
      </div>

      {/* Ancres de bornes nommées (ferry). */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden>⚓</span> Départ · {depart.camp}
        </span>
        <span className="inline-flex items-center gap-1">
          Retour · {arrivee.camp} <span aria-hidden>⚓</span>
        </span>
      </div>

      {/* Timeline : ligne à dégradé de progression + puces jour, scrollable. */}
      <div className="relative overflow-x-auto pb-2">
        <div
          aria-hidden
          className="absolute inset-x-0 top-4 h-1 rounded-full"
          style={{ background: 'linear-gradient(90deg, var(--fil-nuit), var(--fil-jour))' }}
        />
        <ol className="relative flex min-w-max items-start gap-1">
          {jours.map((j) => {
            const actif = j.jour === jourSelectionne;
            return (
              <li key={j.jour} className="flex w-16 shrink-0 flex-col items-center">
                <button
                  type="button"
                  onClick={() => onSelect(j.jour)}
                  aria-pressed={actif}
                  aria-label={`Jour ${j.jour}, ${j.camp}${j.autonomie ? ', nuit en autonomie' : ''}`}
                  className={cn(
                    'flex min-h-tactile flex-col items-center gap-1 rounded-lg px-1 py-1 transition-colors',
                    actif ? 'bg-muted' : 'hover:bg-muted/60',
                  )}
                >
                  {/* Pastille d'étape : plus grande/contrastée si sélectionnée ; grise « nuit » si autonomie. */}
                  <span
                    aria-hidden
                    className={cn(
                      'inline-block rounded-full border-2 transition-all',
                      actif ? 'h-5 w-5' : 'h-3.5 w-3.5',
                    )}
                    style={{
                      backgroundColor: j.autonomie ? 'var(--granite)' : 'var(--fil-jour)',
                      borderColor: actif ? 'var(--foreground)' : 'var(--papier)',
                    }}
                  />
                  <span className={cn('text-xs leading-tight', actif ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                    J{j.jour}
                  </span>
                  <span className="line-clamp-2 text-center text-[0.65rem] leading-tight text-muted-foreground">
                    {j.camp}
                  </span>
                  {j.autonomie ? (
                    <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">nuit</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
