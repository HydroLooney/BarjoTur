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
    <div className={cn('flex items-center justify-between gap-2', className)}>
      <div className="flex gap-1" role="group" aria-label="Mon vote">
        {TIERS.map((t) => {
          const actif = monTier === t;
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              aria-pressed={actif}
              title={AVIS[t as keyof typeof AVIS] ?? t}
              onClick={() => onChoisir(actif ? null : t)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors disabled:opacity-50',
                actif
                  ? cn(CLASSE_TIER[t], 'border-transparent text-primary-foreground')
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col items-end text-xs leading-tight">
        {tierDefaut ? (
          <span className="text-muted-foreground">
            défaut <span className="font-medium text-foreground">{tierDefaut}</span>
          </span>
        ) : null}
        {!monTier ? <span className="text-muted-foreground">pas encore voté</span> : null}
      </div>
    </div>
  );
}
