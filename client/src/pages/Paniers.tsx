import { EcranPaniers } from '@/components/EcranPaniers';

// Écran « mes paniers / mon budget TSAB » (M383/M394) : classement des votes par cran, surplus hors-budget signalé,
// rééquilibrage d'un geste. Cible de la notification `IndicateurPaniers`.
export default function Paniers() {
  return (
    <section className="space-y-4">
      <EcranPaniers />
    </section>
  );
}
