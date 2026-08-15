import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useNavigation } from '@/stores/navigation';

// SOUS-ONGLETS (M506/M543) : le segmented control « à la v2 » posé EN TÊTE d'un espace multi-vues. Thin layer de
// navigation par-dessus les pages v3 existantes (elles deviennent les enfants d'un <Outlet/>, inchangées). Chaque
// onglet = une sous-route (deep-link). Responsive « jamais perdu » : pastilles visibles au desktop, bande défilante
// au pouce (jamais un menu déroulant, tout reste à l'écran). L'onglet actif est mémorisé pour rouvrir l'espace là où
// on l'a laissé. Cible tactile ~40px (M520), texte inchangé (M516).

export interface OngletItem {
  cle: string;
  libelle: string;
  to: string;
}

export function SousOnglets({ espace, items }: { espace: string; items: OngletItem[] }) {
  const { pathname } = useLocation();
  const setDernier = useNavigation((s) => s.setDernier);

  // Mémorise l'onglet actif pour cet espace (revenir = rouvrir ici).
  useEffect(() => {
    const actif = items.find((it) => pathname === it.to || pathname.startsWith(`${it.to}/`));
    if (actif) setDernier(espace, actif.cle);
  }, [pathname, items, espace, setDernier]);

  return (
    <nav aria-label="Sous-sections" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((it) => (
        <NavLink
          key={it.cle}
          to={it.to}
          end
          className={({ isActive }) =>
            cn(
              'inline-flex min-h-tactile shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              isActive
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-foreground hover:bg-muted',
            )
          }
        >
          {it.libelle}
        </NavLink>
      ))}
    </nav>
  );
}
