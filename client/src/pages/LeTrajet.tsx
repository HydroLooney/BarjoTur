import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePeut } from '@/hooks/usePeut';
import { FilItineraire } from '@/components/FilItineraire';
import { BibliothequeCircuits } from '@/components/BibliothequeCircuits';
import { GalerieArchetypes } from '@/components/GalerieArchetypes';
import { ComposeurItineraire } from '@/components/ComposeurItineraire';
import { ReglageBudgetTemps } from '@/components/ReglageBudgetTemps';
import { ArbitrageLiaison } from '@/components/ArbitrageLiaison';
import { SuggestionsAuPassage } from '@/components/SuggestionsAuPassage';
import { ComparateurVoyages } from '@/components/ComparateurVoyages';
import { CarteMapLibre } from '@/components/CarteMapLibre';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { etapesDepuisFige } from '@/lib/fige-adapt';
import type { EtapeEntree } from '@/lib/anim-trajet';

// Espace « Notre Voyage » (A20 §10 / A33 / SPEC-CONSOLIDEE M161). Ordre VOYAGE-FIRST tranché : le voyage commun
// en vedette (fil collectif + description) → mon écart au commun → comparateur (accordéon fermé) → réservations
// (accordéon fermé) → outils de recomposition. Composer full-auto d'abord. Fork #2 : RECOMPOSER la composition
// commune = ORGANISATEUR SEUL (capacité `valider_composition`, organisateur+) ; le voyageur vote et règle Mon
// voyage, la compo commune ne bouge pas sous ses pieds. L'autorité reste serveur (B refuse la mutation interdite).

// Accordéon natif <details> (accessible, fermé par défaut), en attendant un bloc partagé de design-system.
function Accordeon({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <details className="rounded-lg border border-border">
      <summary className="flex min-h-tactile cursor-pointer items-center px-3 text-sm font-medium">{titre}</summary>
      <div className="border-t border-border p-3">{children}</div>
    </details>
  );
}

export default function LeTrajet() {
  const peutRecomposer = usePeut('valider_composition');
  // Carte CENTRALE (M468/M473) : l'itinéraire composé, joué sur la carte, en tête de l'espace Composer. On garde le
  // fil (perles) et le composeur v3 en dessous. Même géométrie réelle que « Notre voyage » (fige.geom).
  const { data: scenario } = useScenarioDefaut();
  const figeId = scenario?.fige_id ?? null;
  const { data: fige } = useFigeDetail(figeId);
  const etapes = useMemo<EtapeEntree[]>(() => (fige ? etapesDepuisFige(fige) : []), [fige]);
  const geom = fige?.geom ?? null;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl">Composer</h1>
        <p className="max-w-prose text-muted-foreground">
          Le voyage de toute la famille prend forme ici : la carte de l'itinéraire d'abord, puis les outils pour le
          bâtir, l'écart de chacun et la comparaison des alternatives.
        </p>
      </header>

      {/* 1. VEDETTE : LA CARTE de l'itinéraire (central, M468). Puis le fil (perles) + le composeur v3. */}
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <CarteMapLibre mode="lecture-ideal" geom={geom} etapes={etapes} hauteur="48vh" />
        <FilItineraire variant="collectif" />
        <ComposeurItineraire />
      </div>

      {/* 2. Mon écart au voyage commun. La vue détaillée (fil individuel superposé, par voyageur) arrive avec le
          contrat d'écart ; règle M163 à appliquer alors : écarts par voyageur REPLIABLES, le MIEN d'abord, les
          autres dépliés à la demande. Ici, l'entrée vers Mon voyage (R1 : pas de faux chiffre). */}
      <section className="space-y-1 rounded-lg border border-border p-3">
        <h2 className="text-sm font-medium">Mon écart au voyage commun</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Ce qui, dans le voyage commun, colle ou non à vos envies. La comparaison détaillée arrive bientôt ; en
          attendant, réglez votre idéal et votre cadence dans{' '}
          <Link to="/mon-voyage" className="underline">
            Mon voyage
          </Link>
          .
        </p>
      </section>

      {/* 3. Comparer les voyages (M478) — archétype en carte animée, moi vs nous, deux voyages, écarts. */}
      <Accordeon titre="Comparer les voyages">
        <ComparateurVoyages />
      </Accordeon>

      {/* Réservations : elles se SAISISSENT dans Préparatifs (M163, supersede A33). Notre Voyage n'en crée
          aucune, il en REFLÈTE le gel sur le fil (perle cercle vide → plein → cadenas), à venir avec le contrat. */}
      <p className="max-w-prose text-sm text-muted-foreground">
        Les réservations (camping, ferry, visite datée) se saisissent dans{' '}
        <Link to="/preparatifs" className="underline">
          Préparatifs
        </Link>
        . Une fois posées, elles figent l'étape et le fil ci-dessus le montre.
      </p>

      {/* Recomposer le voyage commun — ORGANISATEUR SEUL (fork #2). Les outils qui retapent la compo commune. */}
      {peutRecomposer ? (
        <section className="space-y-4 rounded-lg border border-border p-3">
          <div>
            <h2 className="text-sm font-medium">Recomposer le voyage commun</h2>
            <p className="max-w-prose text-xs text-muted-foreground">
              Réservé aux organisateurs : ces réglages changent le voyage de tout le monde.
            </p>
          </div>
          <BibliothequeCircuits />
          <GalerieArchetypes />
          <ReglageBudgetTemps />
          <ArbitrageLiaison />
          <SuggestionsAuPassage />
        </section>
      ) : (
        <p className="max-w-prose text-sm text-muted-foreground">
          La composition commune est réglée par les organisateurs, pour qu'elle ne bouge pas sous les pieds de tous.
          Vous, votez sur les lieux et ajustez{' '}
          <Link to="/mon-voyage" className="underline">
            Mon voyage
          </Link>
          .
        </p>
      )}
    </section>
  );
}
