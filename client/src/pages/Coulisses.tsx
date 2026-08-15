import { useSearchParams } from 'react-router-dom';
import { useExpert } from '@/stores/expert';
import { cn } from '@/lib/utils';
import { VoletComprendre } from '@/components/coulisses/VoletComprendre';
import { VoletRegler } from '@/components/coulisses/VoletRegler';
import { VoletTransparence } from '@/components/coulisses/VoletTransparence';

// Coulisses (M391) : le pole « Reglages » decoupe en 3 ecrans distincts, deux publics servis sans se marcher dessus.
//  - Comprendre : comment l'app decide (tout public, lecture) — la confiance par la transparence.
//  - Regler : les parametres tunables (expert, gate capacite) — registre unique, autorite serveur.
//  - Transparence : ce qui est reel vs estime (tout public, R1) — la sante de la base, honnete.
// Sous-nav par onglets (deep-linkable ?volet=), tactile, zero clutter. Le « mode expert » est un interrupteur
// d'affichage opt-in (M390) : il ne donne aucun droit, il surface juste l'affordance ⚙ sur les ecrans qui portent
// des reglages experts.

type Volet = 'comprendre' | 'regler' | 'transparence';

const VOLETS: { cle: Volet; libelle: string }[] = [
  { cle: 'comprendre', libelle: 'Comprendre' },
  { cle: 'regler', libelle: 'Régler' },
  { cle: 'transparence', libelle: 'Transparence' },
];

function estVolet(v: string | null): v is Volet {
  return v === 'comprendre' || v === 'regler' || v === 'transparence';
}

export default function Coulisses() {
  const [params, setParams] = useSearchParams();
  const brut = params.get('volet');
  const actif: Volet = estVolet(brut) ? brut : 'comprendre';
  const modeExpert = useExpert((s) => s.modeExpert);
  const basculer = useExpert((s) => s.basculerModeExpert);

  const choisir = (v: Volet) => setParams((p) => {
    p.set('volet', v);
    return p;
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl">Coulisses</h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Comprendre la mécanique, régler ce qui vous revient, voir ce qui est sûr. La méthode et les chiffres
            vivent ici, pas devant tout le monde pendant le vote.
          </p>
        </div>

        {/* Interrupteur mode expert : opt-in, ne donne aucun droit, surface l'affordance ⚙ sur les ecrans concernes. */}
        <button
          type="button"
          role="switch"
          aria-checked={modeExpert}
          onClick={basculer}
          className={cn(
            'inline-flex min-h-tactile items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
            modeExpert ? 'border-accent bg-accent/10 text-foreground' : 'border-border bg-card text-muted-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'inline-block h-4 w-4 rounded-full border',
              modeExpert ? 'border-accent bg-accent' : 'border-border bg-muted',
            )}
          />
          Mode expert
        </button>
      </div>

      {/* Sous-nav onglets, tactile, deep-linkable. */}
      <div role="tablist" aria-label="Volets des coulisses" className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {VOLETS.map((v) => (
          <button
            key={v.cle}
            role="tab"
            aria-selected={actif === v.cle}
            onClick={() => choisir(v.cle)}
            className={cn(
              'min-h-tactile flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              actif === v.cle ? 'bg-card text-foreground shadow-posee' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v.libelle}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {actif === 'comprendre' ? <VoletComprendre /> : null}
        {actif === 'regler' ? <VoletRegler /> : null}
        {actif === 'transparence' ? <VoletTransparence /> : null}
      </div>
    </section>
  );
}
