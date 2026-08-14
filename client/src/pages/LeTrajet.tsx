import { GalerieArchetypes } from '@/components/GalerieArchetypes';
import { ComposeurItineraire } from '@/components/ComposeurItineraire';
import { ReglageBudgetTemps } from '@/components/ReglageBudgetTemps';
import { ArbitrageLiaison } from '@/components/ArbitrageLiaison';
import { Comparateur } from '@/components/Comparateur';

// Espace « Le trajet » (A20 §10, ex-Composer) : composer l'itinéraire (ambiances, bases), gérer les étapes
// de transit, et comparer les propositions (consensus égalitariste). Un des trois espaces issus de Voyager.
export default function LeTrajet() {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Le trajet</h1>
      <p className="max-w-prose text-muted-foreground">
        Composez l'itinéraire du voyage : choisissez une ambiance et des bases, gérez les étapes de transit,
        et comparez les propositions pour trouver ce qui convient à toute la famille.
      </p>
      <GalerieArchetypes />
      <ComposeurItineraire />
      <ReglageBudgetTemps />
      <ArbitrageLiaison />
      <Comparateur />
    </section>
  );
}
