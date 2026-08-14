import { PremiersPas } from '@/components/PremiersPas';
import { BandeauAToiDeJouer } from '@/components/BandeauAToiDeJouer';
import { FilDepuisDerniereVisite } from '@/components/FilDepuisDerniereVisite';
import { InstanceVoyage } from '@/components/InstanceVoyage';
import { FilDuParcours } from '@/components/FilDuParcours';
import { CransParcours } from '@/components/CransParcours';

// Accueil : le fil conducteur du parcours (C19 / A15 / A18). Ce qu'il reste à décider, où en est le voyage,
// et la machine à crans avec ses états de validation (M046). On ne se perd jamais : « quoi faire maintenant »
// est en tête, la machine à crans (successeur contractuel du stepper local) juste après.
export default function Accueil() {
  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h1 className="font-serif text-3xl">Barjøtur</h1>
        <p className="max-w-prose text-muted-foreground">
          Le voyage qui vous ressemble. Voici où en est le parcours et ce qu'il reste à décider.
        </p>
      </div>
      <PremiersPas />
      <BandeauAToiDeJouer />
      <FilDepuisDerniereVisite />
      <InstanceVoyage />
      <FilDuParcours />
      <CransParcours />
    </section>
  );
}
