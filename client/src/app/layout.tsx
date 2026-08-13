import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bouton } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';
import { useUi } from '@/stores/ui';

const LIENS = [
  { to: '/', libelle: 'Accueil', exact: true },
  { to: '/explorer', libelle: 'Explorer', exact: false },
  { to: '/voyager', libelle: 'Voyager', exact: false },
  { to: '/mes-lieux', libelle: 'Mes lieux', exact: false },
  { to: '/coulisses', libelle: 'Coulisses', exact: false },
] as const;

// Coquille de l'app : en-tete de navigation + zone de vue lazy. Responsive des le depart
// (barre qui se replie, cibles tactiles). Le contenu lourd (cartes) se charge sous Suspense.
export function Coquille() {
  const basculerTheme = useUi((s) => s.basculerTheme);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="font-serif text-lg">Barjøtur</span>
        <nav className="flex flex-wrap gap-1">
          {LIENS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              {l.libelle}
            </NavLink>
          ))}
        </nav>
        <Bouton variant="ghost" size="sm" className="ml-auto" onClick={basculerTheme}>
          Thème
        </Bouton>
      </header>
      <main className="mx-auto w-full max-w-6xl p-4">
        <Suspense fallback={<p className="text-muted-foreground">Chargement en cours.</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
