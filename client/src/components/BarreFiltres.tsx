import { useState } from 'react';
import type { CataloguePoi, Tier } from '@barjotur/shared';
import { Champ } from '@/ui/primitives/input';
import { useExplorer } from '@/stores/explorer';
import { useGrandEcran } from '@/hooks/useMediaQuery';
import { bucketsDisponibles } from '@/lib/filtrer-catalogue';
import { SelecteurCategorie } from '@/components/SelecteurCategorie';
import { AVIS } from '@/lib/libelles';

const TIERS: Tier[] = ['T', 'S', 'A', 'B'];
const CLASSE_SELECT =
  'h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Facettes de l'Explorer, liées au store (partagées liste <-> carte). Les catégories sont dérivées du catalogue
// reçu (pas de liste en dur). Recherche plein-nom insensible aux accents. Multi-format (SPEC-CONSOLIDEE §A) :
// tablette/PC = facettes visibles en ligne ; mobile = bouton « Filtres » (avec compteur) qui ouvre une FEUILLE
// DU BAS (accès pouce), refermable (clic dehors / Échap).
export function BarreFiltres({ pois }: { pois: CataloguePoi[] }) {
  const filtres = useExplorer((s) => s.filtres);
  const setFiltres = useExplorer((s) => s.setFiltres);
  const categories = bucketsDisponibles(pois);
  const grandEcran = useGrandEcran();
  const [ouvert, setOuvert] = useState(false);

  const nbActifs =
    (filtres.recherche ? 1 : 0) +
    (filtres.categorie ? 1 : 0) +
    (filtres.tier ? 1 : 0) +
    (filtres.votableSeul ? 1 : 0);

  const facettes = (
    <>
      <Champ
        placeholder="Rechercher un lieu"
        value={filtres.recherche}
        onChange={(e) => setFiltres({ recherche: e.target.value })}
        className="w-full sm:w-56"
        aria-label="Rechercher un lieu"
      />
      <SelecteurCategorie
        value={filtres.categorie}
        onChange={(c) => setFiltres({ categorie: c })}
        options={categories}
        className="w-full sm:w-56"
      />
      <select
        className={CLASSE_SELECT}
        value={filtres.tier ?? ''}
        onChange={(e) => setFiltres({ tier: (e.target.value || null) as Tier | null })}
        aria-label="Filtrer par avis par défaut"
      >
        <option value="">Tous les avis</option>
        {TIERS.map((t) => (
          <option key={t} value={t}>
            {AVIS[t as keyof typeof AVIS] ?? t}
          </option>
        ))}
      </select>
      <label className="flex min-h-tactile items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={filtres.votableSeul}
          onChange={(e) => setFiltres({ votableSeul: e.target.checked })}
        />
        Votables seulement
      </label>
    </>
  );

  // Tablette / PC : facettes en ligne, toujours visibles.
  if (grandEcran) {
    return <div className="flex flex-wrap items-center gap-2">{facettes}</div>;
  }

  // Mobile : déclencheur + feuille du bas.
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        data-guide="filtres"
        className="flex min-h-tactile items-center gap-2 rounded-md border border-border px-3 text-sm"
        aria-haspopup="dialog"
        aria-expanded={ouvert}
      >
        Filtres
        {nbActifs > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
            {nbActifs}
          </span>
        ) : null}
      </button>

      {ouvert ? (
        <>
          <div className="fixed inset-0 z-40 bg-background/80" onClick={() => setOuvert(false)} aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtres"
            onKeyDown={(e) => e.key === 'Escape' && setOuvert(false)}
            className="fixed inset-x-0 bottom-0 z-50 space-y-3 rounded-t-lg border-t border-border bg-card p-4 shadow-flottante"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Filtres</p>
              <button
                type="button"
                onClick={() => setOuvert(false)}
                className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
                aria-label="Fermer les filtres"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col gap-3">{facettes}</div>
            {nbActifs > 0 ? (
              <button
                type="button"
                onClick={() => setFiltres({ recherche: '', categorie: null, tier: null, votableSeul: false })}
                className="min-h-tactile text-sm text-muted-foreground underline"
              >
                Tout effacer
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
