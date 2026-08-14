import { Link } from 'react-router-dom';
import { useIdentite } from '@/stores/identite';
import { useOnboarding } from '@/stores/onboarding';
import { Bouton } from '@/ui/primitives/button';
import { ESPACES } from '@/lib/libelles';

// Premiers pas (T042 onboarding « on démarre ici ») : le point d'entrée guidé que la revue réclame (grand-mère,
// enfant, utilisateur lambda). Trois gestes simples, le vote rendu évident, sobre et responsive (esprit A20).
// Dismissible et persisté par appareil ; réaffichable depuis les Réglages.
const ETAPES = [
  { to: '/explorer', titre: `1. ${ESPACES.explorer}`, texte: 'Regardez les lieux du voyage, un par un.' },
  {
    to: '/explorer',
    titre: '2. Dire ce qu’on aime',
    texte: 'Sur chaque lieu, un bouton : coup de cœur, vraiment envie, bien, ou pourquoi pas.',
  },
  { to: '/le-trajet', titre: `3. ${ESPACES.trajet}`, texte: 'Quand chacun a voté, on compose le voyage ensemble.' },
];

export function PremiersPas() {
  const vu = useOnboarding((s) => s.vu);
  const marquerVu = useOnboarding((s) => s.marquerVu);
  const prenom = useIdentite((s) => s.prenom);
  if (vu) return null;

  return (
    <section aria-label="Premiers pas" className="space-y-3 rounded-lg border border-primary bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg">On démarre ici{prenom ? `, ${prenom}` : ''}</h2>
        <button
          type="button"
          onClick={marquerVu}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Masquer
        </button>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Bienvenue. Ce carnet aide toute la famille à choisir le voyage ensemble, en trois gestes simples.
      </p>
      <ol className="grid gap-2 sm:grid-cols-3">
        {ETAPES.map((e) => (
          <li key={e.titre}>
            <Link to={e.to} className="block h-full rounded-md border border-border p-3 hover:bg-muted">
              <p className="text-sm font-medium">{e.titre}</p>
              <p className="mt-1 text-xs text-muted-foreground">{e.texte}</p>
            </Link>
          </li>
        ))}
      </ol>
      <Bouton size="sm" asChild>
        <Link to="/explorer">Commencer par explorer</Link>
      </Bouton>
    </section>
  );
}
