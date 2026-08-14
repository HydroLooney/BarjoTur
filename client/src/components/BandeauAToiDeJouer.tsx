import { Link } from 'react-router-dom';
import { usePeut } from '@/hooks/usePeut';
import { signalBoucleDemo } from '@/lib/fixtures/signal-boucle-demo';

// Bandeau « à toi de jouer » (A26 / M112) : l'action que le voyage attend de MOI, en clair, avec un tap pour y
// aller. Ne s'affiche qu'à qui peut voter et quand il y a vraiment quelque chose à faire. Fixture hors live ;
// l'état réel (combien de lieux attendent mon avis) vient du serveur au flip.
export function BandeauAToiDeJouer() {
  const peutVoter = usePeut('voter');
  const n = signalBoucleDemo.avis_attendus;
  if (!peutVoter || n <= 0) return null;

  return (
    <Link
      to="/explorer"
      className="flex items-center justify-between gap-2 rounded-lg border border-primary bg-card p-3 hover:bg-muted"
    >
      <span className="text-sm">
        <span className="font-medium">À toi de jouer.</span> {n} lieu{n === 1 ? '' : 'x'} attend
        {n === 1 ? '' : 'ent'} ton avis.
      </span>
      <span aria-hidden className="text-muted-foreground">
        →
      </span>
    </Link>
  );
}
