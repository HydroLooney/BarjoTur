import { CurseurValeur } from '@/ui/primitives/curseur';
import { EtiquetteMiseEnAvant } from '@/components/EtiquetteMiseEnAvant';
import { useDetour } from '@/stores/detour';
import { auPassageDemo } from '@/lib/fixtures/au-passage-demo';
import { estGlisse } from '@/lib/au-passage';
import { formatDuree } from '@/lib/budget-temps';

// Suggestions « au passage » (A24 / M110) : sur la route, les beaux lieux proches du tracé, avec leur étiquette et
// le petit coût de détour. Les forts à faible détour sont « glissés dans la journée » (le composeur les insère) ;
// les autres restent une suggestion « à vous de vous arrêter ». Le curseur règle à quel point on s'écarte
// volontiers. Fixture hors live ; l'insertion réelle et la vraie liste viennent de B/A au flip (gaté DSN).
export function SuggestionsAuPassage() {
  const sensibilite = useDetour((s) => s.sensibilite);
  const setSensibilite = useDetour((s) => s.setSensibilite);

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-medium">Sur la route, à voir</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Le beau attrapé en chemin, sans grand détour. Les plus forts, tout près de la route, sont glissés dans la
          journée ; les autres, à vous de vous arrêter. (Exemple ; la vraie liste viendra du calcul d'itinéraire.)
        </p>
      </div>

      <CurseurValeur
        label="On reste efficace ↔ on s'écarte volontiers"
        valeur={sensibilite}
        min={0}
        max={90}
        step={5}
        suffixe="min de détour"
        onChange={setSensibilite}
      />

      <ul className="space-y-2">
        {auPassageDemo.map((s) => {
          const glisse = estGlisse(s, sensibilite);
          return (
            <li key={s.nom} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{s.nom}</span>
                <EtiquetteMiseEnAvant niveau={s.niveau} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>
                  détour {formatDuree(s.cout_detour_min)} · {s.cout_detour_km} km
                </span>
                {glisse ? (
                  <span className="text-primary">glissé dans la journée</span>
                ) : (
                  <span>à vous de vous arrêter</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
