import { Link } from 'react-router-dom';
import { RoutesSceniques } from '@/components/RoutesSceniques';

// C19 (M424/M434) : page des routes scéniques + points de chute, ouverte depuis la Carte. Aider à composer le
// voyage en voyant les grands itinéraires panoramiques et où dormir, sans rien décider à la place.
export default function RoutesSceniquesPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl">Routes scéniques et points de chute</h1>
        <p className="max-w-prose text-muted-foreground">
          Les grands itinéraires panoramiques du pays, et les points de chute pour la nuit. Choisissez une route
          pour la voir en entier : sa longueur, sa région, ce qu'elle traverse.
        </p>
      </div>
      <RoutesSceniques />
      <Link to="/carte" className="inline-block text-sm text-accent hover:underline">
        ← Retour à la carte
      </Link>
    </section>
  );
}
