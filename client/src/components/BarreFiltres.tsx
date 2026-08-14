import type { CataloguePoi, Tier } from '@barjotur/shared';
import { Champ } from '@/ui/primitives/input';
import { useExplorer } from '@/stores/explorer';
import { categoriesDisponibles } from '@/lib/filtrer-catalogue';
import { AVIS } from '@/lib/libelles';

const TIERS: Tier[] = ['T', 'S', 'A', 'B'];
const CLASSE_SELECT =
  'h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// Facettes de l'Explorer, liées au store (partagées liste <-> carte). Les catégories sont dérivées
// du catalogue reçu (pas de liste en dur). Recherche plein-nom insensible aux accents.
export function BarreFiltres({ pois }: { pois: CataloguePoi[] }) {
  const filtres = useExplorer((s) => s.filtres);
  const setFiltres = useExplorer((s) => s.setFiltres);
  const categories = categoriesDisponibles(pois);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Champ
        placeholder="Rechercher un lieu"
        value={filtres.recherche}
        onChange={(e) => setFiltres({ recherche: e.target.value })}
        className="w-full sm:w-56"
        aria-label="Rechercher un lieu"
      />
      <select
        className={CLASSE_SELECT}
        value={filtres.categorie ?? ''}
        onChange={(e) => setFiltres({ categorie: e.target.value || null })}
        aria-label="Filtrer par catégorie"
      >
        <option value="">Toutes catégories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
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
    </div>
  );
}
