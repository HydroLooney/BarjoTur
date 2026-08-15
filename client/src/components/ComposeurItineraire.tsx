import { Composeur } from '@/components/Composeur';
import { EtapesTransit } from '@/components/EtapesTransit';

// Composeur d'itinéraire mixte (A20 « Notre Voyage » / M059) : UNE seule surface qui présente le voyage comme
// une suite d'étapes typées — les étapes d'EXPÉRIENCE (la boucle, on maximise le beau) et les étapes de
// TRANSIT (repositionnement, on minimise) qui les relient. On compose l'expérience et on gère les transits
// au même endroit, pas deux vues séparées.
//
// NB (R1) : l'interleaving RÉEL (une séquence unique experience/transit routée par le composeur) attend
// l'extension du contrat `composeur.ts` par M (`ComposeInput.arretsImposes`, `ComposeReponse` avec étapes
// typées `NatureEtape`). Ici on unifie la surface avec les contrats existants ; le tracé transit réel arrive
// avec A (corridor) + B (optim transit).
export function ComposeurItineraire() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Composer le voyage</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Le voyage est une suite d'étapes : les <strong>transits</strong> repositionnent le van (aller, retour,
          ou pour élargir la boucle), et entre eux l'<strong>expérience</strong> maximise le beau. Composez
          l'expérience et réglez les transits ici, au même endroit.
        </p>
      </div>

      <div className="rounded-lg border border-border p-3">
        <Composeur />
      </div>

      <div className="rounded-lg border border-border p-3">
        <EtapesTransit />
      </div>
    </section>
  );
}
