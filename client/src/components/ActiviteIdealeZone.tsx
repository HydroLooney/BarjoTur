import { useBudgetTemps } from '@/stores/budget-temps';
import { zonesActivitesDemo } from '@/lib/fixtures/zones-activites-demo';
import { enviePourZone, libelleTheme, trierZonesParEnvie } from '@/lib/zones';
import { cn } from '@/lib/utils';

// Activité idéale par zone (M108) : ce que les guides conseillent selon l'endroit (kayak ici, rando là), sourcé.
// Relié aux envies par thème : un voyageur qui pousse le nautique voit remonter, et marqués, les coins où le guide
// conseille le kayak. Informational, ouvert à tous ; le rapprochement n'apparaît que si des envies sont réglées.
// Fixture hors live ; données réelles d'A au flip, la forme ne bouge pas.
export function ActiviteIdealeZone() {
  const appetits = useBudgetTemps((s) => s.appetits);
  const zones = trierZonesParEnvie(zonesActivitesDemo, appetits);

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium">L'activité idéale par coin</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Ce que les guides conseillent selon l'endroit. Réglez vos envies par thème pour voir remonter les coins qui
          vous parlent.
        </p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {zones.map((z) => {
          const envie = enviePourZone(z, appetits);
          return (
            <li key={z.zone} className={cn('rounded-md border p-3', envie > 0 ? 'border-primary' : 'border-border')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{z.zone}</span>
                {envie > 0 ? <span className="text-xs text-primary">correspond à vos envies</span> : null}
              </div>
              <p className="text-sm">Le guide conseille : {libelleTheme(z.theme)}.</p>
              {z.note ? <p className="text-xs text-muted-foreground">{z.note}</p> : null}
              <p className="mt-1 text-xs text-muted-foreground">
                D'après {z.source.guide}
                {z.source.page ? `, ${z.source.page}` : ''}.
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
