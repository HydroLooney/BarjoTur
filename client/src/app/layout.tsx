import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bouton } from '@/ui/primitives/button';
import { LimiteErreur } from './LimiteErreur';
import { BandeauParcours } from '@/components/BandeauParcours';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';
import { useSyncMemoire } from '@/hooks/useSyncMemoire';

// Socle d'app A20 : titres explicites pour un enfant (zéro jargon), nav mobile au pouce (barre du bas),
// bandeau parcours persistant en tête de chaque vue (anti-« perdu »), squelette commun. Responsive-first,
// petit écran d'abord : la nav primaire passe en barre basse sur mobile, inline en tête sur desktop.
const PRIMAIRES = [
  { to: '/', libelle: 'Le voyage', exact: true },
  { to: '/explorer', libelle: 'Explorer', exact: false },
  { to: '/le-trajet', libelle: 'Le trajet', exact: false },
  { to: '/carte', libelle: 'Carte', exact: false },
  { to: '/preparatifs', libelle: 'Préparatifs', exact: false },
] as const;

const SECONDAIRES = [
  { to: '/mes-envies', libelle: 'Mes envies', exact: false },
  { to: '/reglages', libelle: 'Réglages', exact: false },
] as const;

export function Coquille() {
  const basculerTheme = useUi((s) => s.basculerTheme);
  const location = useLocation();
  // Sync mémoire perso (C-16/C-18/C-17) : inerte tant que le drapeau live est off (pré-bascule).
  useSyncMemoire();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="font-serif text-lg">Barjøtur</span>
        <nav aria-label="Navigation principale" className="hidden flex-wrap gap-1 md:flex">
          {PRIMAIRES.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              {l.libelle}
            </NavLink>
          ))}
        </nav>
        <nav aria-label="Accès secondaire" className="ml-auto flex flex-wrap gap-1">
          {SECONDAIRES.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              {l.libelle}
            </NavLink>
          ))}
        </nav>
        <Bouton
          variant="ghost"
          size="sm"
          onClick={basculerTheme}
          aria-label="Basculer le thème clair ou sombre"
        >
          Thème
        </Bouton>
      </header>

      <BandeauParcours />

      <main id="contenu" className="mx-auto w-full max-w-6xl p-4 pb-24 md:pb-4">
        <LimiteErreur key={location.pathname}>
          <Suspense fallback={<p className="text-muted-foreground">Chargement en cours.</p>}>
            <Outlet />
          </Suspense>
        </LimiteErreur>
      </main>

      {/* Nav mobile au pouce : barre basse fixe, cibles larges, masquée sur desktop (nav inline en tête). */}
      <nav
        aria-label="Navigation (bas d'écran)"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden"
      >
        {PRIMAIRES.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.exact}
            className={({ isActive }) =>
              cn(
                'flex min-h-tactile flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors',
                isActive ? 'font-medium text-primary' : 'text-muted-foreground',
              )
            }
          >
            {l.libelle}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
