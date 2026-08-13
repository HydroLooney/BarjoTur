import { FilDuParcours } from '@/components/FilDuParcours';
import { PipelineStepper } from '@/components/PipelineStepper';

// Accueil : le fil conducteur du parcours (C19 / A15). Ce qu'il reste à décider, où en est le voyage,
// et la progression par crans (C08). On ne se perd jamais : « quoi faire maintenant » est en tête.
export default function Accueil() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Barjøtur</h1>
        <p className="max-w-prose text-muted-foreground">
          Le voyage qui vous ressemble. Voici où en est le parcours et ce qu'il reste à décider.
        </p>
      </div>
      <FilDuParcours />
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Le parcours</h2>
        <PipelineStepper />
      </div>
    </section>
  );
}
