import { useVoyageContexte } from '@/stores/voyage';
import { useVoyage } from '@/lib/queries/voyage';
import { voyageDemo } from '@/lib/fixtures/voyage-demo';

// Instance voyage (A19 / M055) : origine et destination du voyage courant. Flip-ready (drapeau `live`,
// `?voyage` en DEV). L'app est un composeur de voyages rejouable ; ici on affiche l'instance courante.
const VOYAGE_LIVE_ENV = import.meta.env.VITE_VOYAGE_LIVE === '1';

export function InstanceVoyage() {
  const forceLive = import.meta.env.DEV && new URLSearchParams(window.location.search).has('voyage');
  const live = VOYAGE_LIVE_ENV || forceLive;
  const voyageId = useVoyageContexte((s) => s.voyageId);
  const serveur = useVoyage(voyageId, live);
  const voyage = (live ? serveur.data : null) ?? voyageDemo;
  const boucle = voyage.point_depart.label === voyage.point_arrivee.label;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <h2 className="text-sm font-medium">{voyage.titre}</h2>
      <dl className="mt-1 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Départ</dt>
          <dd>{voyage.point_depart.label}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Arrivée{boucle ? ' (boucle)' : ''}</dt>
          <dd>{boucle ? 'Retour au point de départ' : voyage.point_arrivee.label}</dd>
        </div>
      </dl>
    </div>
  );
}
