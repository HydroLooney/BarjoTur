import type { VoteTier } from '@barjotur/shared';
import { cn } from '@/lib/utils';
import { AVIS } from '@/lib/libelles';

// Echelle de vote cote FAMILLE : T/S/A/B (les niveaux C/D existent en base mais ne sont pas proposes
// au vote famille). Libelles en clair (tableau central `libelles.AVIS`, miroir du glossaire), sans score
// brut (anti-cadrage A11).
const TIERS: VoteTier[] = ['T', 'S', 'A', 'B'];
const CLASSE_TIER: Record<string, string> = {
  T: 'bg-tier-T',
  S: 'bg-tier-S',
  A: 'bg-tier-A',
  B: 'bg-tier-B',
};

interface Props {
  /** Mon vote actuel (null = pas encore voté). */
  monTier: VoteTier | null;
  /** Tier par défaut du lieu, affiché DISTINCTEMENT et jamais écrasé (A11). */
  tierDefaut: string | null;
  onChoisir: (tier: VoteTier | null) => void;
  disabled?: boolean;
  className?: string;
}

// Sélecteur de tier (vote), reposable partout (liste, carte, fiche). A11 : MON vote très visible
// (pastille pleine colorée + lettre), le défaut reste affiché à côté, « pas encore voté » explicite.
// Recliquer sur mon tier actuel = dévoter.
export function SelecteurTier({ monTier, tierDefaut, onChoisir, disabled, className }: Props) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Mon vote">
        {TIERS.map((t) => {
          const actif = monTier === t;
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              aria-pressed={actif}
              aria-label={AVIS[t as keyof typeof AVIS] ?? t}
              title={AVIS[t as keyof typeof AVIS] ?? t}
              onClick={() => onChoisir(actif ? null : t)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors disabled:opacity-50',
                actif
                  ? cn(CLASSE_TIER[t], 'border-transparent text-primary-foreground')
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {t}
            </button>
          );
        })}
        {/* 5e « bouton » DÉFAUT (M388) : NON ACTIONNABLE, sur la MÊME LIGNE, visuellement distinct (contour tireté,
            inerte) → rappelle le tier CALCULÉ (« proposé par défaut ») sans être cliquable. */}
        {tierDefaut ? (
          <span
            aria-label={`Proposé par défaut : ${AVIS[tierDefaut as keyof typeof AVIS] ?? tierDefaut}`}
            title={`Proposé par défaut : ${AVIS[tierDefaut as keyof typeof AVIS] ?? tierDefaut}`}
            className="flex h-10 min-w-[2.5rem] cursor-default select-none flex-col items-center justify-center rounded-full border border-dashed border-border px-2 leading-none text-muted-foreground"
          >
            <span className="text-[0.5rem] uppercase tracking-wide">défaut</span>
            <span className="mt-0.5 text-sm font-semibold">{tierDefaut}</span>
          </span>
        ) : null}
      </div>
      {!monTier ? (
        <p className="text-xs text-muted-foreground">Proposé par défaut ; touchez un cran pour ajuster.</p>
      ) : null}
    </div>
  );
}
