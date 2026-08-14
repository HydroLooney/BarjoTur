import { useIdentite } from '@/stores/identite';
import { useCadence } from '@/stores/cadence';
import { useCatalogue } from '@/lib/queries/catalogue';
import { useMesVotes } from '@/lib/queries/votes';
import { AVIS } from '@/lib/libelles';
import { Badge } from '@/ui/primitives/badge';
import { cn } from '@/lib/utils';

// Mes incontournables (A26 / M112) : mes coups de cœur (votes forts, T/S) et les lieux où je veux vraiment du
// temps (épinglés). L'épingle est un signal personnel qui pèsera sur le budget-temps au flip (gaté DSN). Hors
// identité résolue, on invite à ouvrir son lien. Lecture des votes + noms depuis le catalogue.
export function MesIncontournables() {
  const code = useIdentite((s) => s.code);
  const { data: mesVotes } = useMesVotes(code);
  const { data: catalogue } = useCatalogue();
  const incontournables = useCadence((s) => s.incontournables);
  const epingler = useCadence((s) => s.epingler);

  const forts = Object.entries(mesVotes?.tiers ?? {})
    .filter(([, t]) => t === 'T' || t === 'S')
    .map(([ref, t]) => ({ osmId: ref.replace(/^p:/, ''), tier: t }));

  const nom = (osmId: string) => catalogue?.find((p) => p.id === osmId)?.nom ?? osmId;

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">Mes incontournables</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Vos coups de cœur, et les lieux où vous voulez vraiment prendre le temps. L'épingle demande au voyage de leur
          garder de la place.
        </p>
      </div>

      {code === null ? (
        <p className="text-sm text-muted-foreground">Ouvrez votre lien perso pour retrouver vos coups de cœur.</p>
      ) : forts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Pas encore de coup de cœur. Dans Explorer, mettez « coup de cœur » ou « vraiment envie » sur les lieux qui
          vous font envie.
        </p>
      ) : (
        <ul className="space-y-2">
          {forts.map((f) => {
            const epingle = incontournables.includes(f.osmId);
            return (
              <li key={f.osmId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{nom(f.osmId)}</span>
                  <Badge variant="contour">{AVIS[f.tier as keyof typeof AVIS] ?? f.tier}</Badge>
                </span>
                <button
                  type="button"
                  onClick={() => epingler(f.osmId)}
                  aria-pressed={epingle}
                  className={cn(
                    'flex min-h-tactile items-center rounded-md border px-3 text-sm transition-colors',
                    epingle ? 'border-primary bg-muted text-foreground' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {epingle ? 'Temps réservé ✓' : 'Je veux du temps ici'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
