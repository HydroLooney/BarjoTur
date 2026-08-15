import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useIdentite } from '@/stores/identite';
import { useOnboarding } from '@/stores/onboarding';
import { ESPACES } from '@/lib/libelles';
import { jetonEspace } from '@/lib/espaces-couleur';
import { cn } from '@/lib/utils';

// Menu perso derrière l'avatar (A33 / M158) : « Mon voyage » et « Mes envies » (et « Réglages ») s'atteignent ici,
// en haut à droite, pas par un onglet de la barre principale. L'avatar montre l'initiale du prénom (identité de
// session). Menu simple, refermable (clic dehors / Échap), cibles au pouce.
const LIENS = [
  { to: '/mon-voyage', libelle: ESPACES.monVoyage },
  { to: '/mes-envies', libelle: ESPACES.envies },
  { to: '/conseils', libelle: 'Les conseils' },
  { to: '/reglages', libelle: ESPACES.reglages },
] as const;

export function MenuAvatar() {
  const prenom = useIdentite((s) => s.prenom);
  const reafficherTour = useOnboarding((s) => s.reafficher);
  const naviguer = useNavigate();
  const [ouvert, setOuvert] = useState(false);
  const initiale = prenom ? prenom.trim().charAt(0).toUpperCase() : '·';

  // « Refaire le tour » (M160) : relance l'onboarding depuis n'importe où et ramène à l'accueil où il s'affiche.
  function refaireLeTour() {
    reafficherTour();
    setOuvert(false);
    naviguer('/');
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-haspopup="menu"
        aria-label="Mon espace"
        className="flex min-h-tactile items-center rounded-full p-1"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-sm font-medium">
          {initiale}
        </span>
      </button>

      {ouvert ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOuvert(false)}
            aria-hidden
          />
          <div
            role="menu"
            aria-label="Mon espace"
            onKeyDown={(e) => e.key === 'Escape' && setOuvert(false)}
            className="absolute right-0 z-50 mt-1 min-w-44 rounded-md border border-border bg-card p-1 shadow-flottante"
          >
            {prenom ? <p className="px-3 py-1 text-xs text-muted-foreground">{prenom}</p> : null}
            {LIENS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                role="menuitem"
                onClick={() => setOuvert(false)}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-tactile items-center gap-2 rounded px-3 text-sm',
                    isActive ? 'bg-muted font-medium text-foreground' : 'text-foreground hover:bg-muted',
                  )
                }
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: jetonEspace(l.to) }}
                />
                {l.libelle}
              </NavLink>
            ))}
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              role="menuitem"
              onClick={refaireLeTour}
              className="flex min-h-tactile w-full items-center rounded px-3 text-sm text-foreground hover:bg-muted"
            >
              Refaire le tour
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
