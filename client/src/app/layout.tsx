import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bouton } from '@/ui/primitives/button';
import { LimiteErreur } from './LimiteErreur';
import { BandeauParcours } from '@/components/BandeauParcours';
import { cn } from '@/lib/utils';
import { ESPACES } from '@/lib/libelles';
import { useUi } from '@/stores/ui';
import { useSyncMemoire } from '@/hooks/useSyncMemoire';
import { useEnLigne } from '@/hooks/useEnLigne';
import { signalBoucleDemo } from '@/lib/fixtures/signal-boucle-demo';

// Libellé de nav avec pastille discrète « du nouveau ici » (M112) quand la route porte des nouveautés. Fixture
// hors live ; au flip, l'état vient du serveur (ce qui a bougé depuis mon dernier passage).
function LabelNav({ to, libelle }: { to: string; libelle: string }) {
  const nouveaute = (signalBoucleDemo.nouveautes[to] ?? 0) > 0;
  return (
    <span className="inline-flex items-center gap-1">
      {libelle}
      {nouveaute ? (
        <>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="sr-only">du nouveau</span>
        </>
      ) : null}
    </span>
  );
}

// Socle d'app A20 : titres explicites pour un enfant (zéro jargon), nav mobile au pouce (barre du bas),
// bandeau parcours persistant en tête de chaque vue (anti-« perdu »), squelette commun. Responsive-first,
// petit écran d'abord : la nav primaire passe en barre basse sur mobile, inline en tête sur desktop.
// Libellés depuis le tableau central (miroir du glossaire figé, M067).
const PRIMAIRES = [
  { to: '/', libelle: ESPACES.voyage, exact: true },
  { to: '/mon-voyage', libelle: ESPACES.monVoyage, exact: false },
  { to: '/explorer', libelle: ESPACES.explorer, exact: false },
  { to: '/le-trajet', libelle: ESPACES.trajet, exact: false },
  { to: '/carte', libelle: ESPACES.carte, exact: false },
  { to: '/preparatifs', libelle: ESPACES.preparatifs, exact: false },
] as const;

const SECONDAIRES = [
  { to: '/mes-envies', libelle: ESPACES.envies, exact: false },
  { to: '/reglages', libelle: ESPACES.reglages, exact: false },
] as const;

export function Coquille() {
  const basculerTheme = useUi((s) => s.basculerTheme);
  const location = useLocation();
  const enLigne = useEnLigne();
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
                  'inline-flex min-h-tactile items-center rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              <LabelNav to={l.to} libelle={l.libelle} />
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
                  'inline-flex min-h-tactile items-center rounded-md px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              <LabelNav to={l.to} libelle={l.libelle} />
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

      {!enLigne ? (
        <div role="status" className="border-b border-border bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
          Hors ligne. Vous consultez la dernière version enregistrée du voyage.
        </div>
      ) : null}

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
            <LabelNav to={l.to} libelle={l.libelle} />
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
