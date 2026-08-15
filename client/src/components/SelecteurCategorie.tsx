import { useEffect, useRef, useState } from 'react';
import { categorieDe, FAMILLES, type CategoriePoi } from '@/lib/categories-poi';
import { IconeCategorie } from '@/components/IconeCategorie';
import { cn } from '@/lib/utils';

// Sélecteur de catégorie de la LISTE Explorer (étape 3-5), aligné sur le contrat des 18 : chaque option porte la
// MÊME couleur (famille), MÊME icône et MÊME mot que la carte / la légende / le panneau de calques. Single-select
// (« Toutes catégories » + 1). Remplace le <select> natif (qui ne peut afficher ni couleur ni icône). Dark-safe.
export function SelecteurCategorie({
  value,
  onChange,
  options,
  className,
}: {
  value: string | null;
  onChange: (c: string | null) => void;
  options: CategoriePoi[];
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ouvert]);

  const sel = value ? categorieDe(value) : null;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label="Filtrer par catégorie"
        className="flex h-11 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {sel ? (
          <>
            <span style={{ color: `var(${FAMILLES[sel.famille].token})` }}>
              <IconeCategorie categorie={sel.cle} className="h-4 w-4" trait={2.2} />
            </span>
            {sel.libelle}
          </>
        ) : (
          <span className="text-muted-foreground">Toutes catégories</span>
        )}
        <span aria-hidden className="ml-auto text-muted-foreground">
          ▾
        </span>
      </button>
      {ouvert ? (
        <ul role="listbox" className="absolute z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-md border border-border bg-card p-1 text-sm shadow-flottante">
          <li>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOuvert(false);
              }}
              className={cn('flex min-h-9 w-full items-center gap-2 rounded px-2 hover:bg-muted', !value && 'font-medium')}
            >
              Toutes catégories
            </button>
          </li>
          {options.map((c) => (
            <li key={c.cle}>
              <button
                type="button"
                onClick={() => {
                  onChange(c.cle);
                  setOuvert(false);
                }}
                className={cn('flex min-h-9 w-full items-center gap-2 rounded px-2 hover:bg-muted', value === c.cle && 'font-medium')}
              >
                <span style={{ color: `var(${FAMILLES[c.famille].token})` }}>
                  <IconeCategorie categorie={c.cle} className="h-4 w-4" trait={2.2} />
                </span>
                {c.libelle}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
