import { Link } from 'react-router-dom';
import { parcoursDemo } from '@/lib/fixtures/parcours-demo';
import { CRANS } from '@/lib/libelles';
import { cn } from '@/lib/utils';

// Bandeau parcours persistant (A20 §10) : rappel compact des crans en tête de CHAQUE vue, l'anti-« perdu ».
// Montre l'étape en cours, permet de sauter au fil du parcours (« Le voyage »). Lit la fixture pour l'instant
// (flip-ready : se branchera sur le parcours live quand la stack montera, comme CransParcours).
export function BandeauParcours() {
  const crans = [...parcoursDemo.crans].sort((a, b) => a.ordre - b.ordre);
  const courant = crans.find((c) => c.id === parcoursDemo.cran_courant);

  return (
    <Link
      to="/"
      aria-label="Aller au fil du parcours"
      className="block border-b border-border bg-card hover:bg-muted"
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-4 py-1.5 text-xs">
        <span className="shrink-0 text-muted-foreground">Parcours</span>
        {crans.map((c) => (
          <span
            key={c.id}
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5',
              c.id === parcoursDemo.cran_courant
                ? 'bg-primary text-primary-foreground'
                : c.etat === 'brouillon'
                  ? 'text-muted-foreground'
                  : 'text-foreground',
            )}
          >
            {CRANS[c.id] ?? c.libelle}
          </span>
        ))}
        {courant ? (
          <span className="ml-auto hidden shrink-0 text-muted-foreground sm:inline">
            en cours : {courant.libelle}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
