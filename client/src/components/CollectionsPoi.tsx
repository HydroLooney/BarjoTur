import { useCollections } from '@/stores/collections';
import { cn } from '@/lib/utils';

// Chips pour ranger un POI dans mes collections perso (bascule). Léger, local, privé (A11).
export function CollectionsPoi({ osmId }: { osmId: string }) {
  const collections = useCollections((s) => s.collections);
  const basculer = useCollections((s) => s.basculer);
  const noms = Object.keys(collections);

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Mes collections</p>
      <div className="flex flex-wrap gap-1">
        {noms.map((nom) => {
          const dedans = (collections[nom] ?? []).includes(osmId);
          return (
            <button
              key={nom}
              type="button"
              aria-pressed={dedans}
              onClick={() => basculer(nom, osmId)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                dedans
                  ? 'border-transparent bg-accent text-accent-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {nom}
            </button>
          );
        })}
      </div>
    </div>
  );
}
