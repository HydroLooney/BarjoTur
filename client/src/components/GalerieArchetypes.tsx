import { useArchetypes } from '@/lib/queries/composeur';

// Galerie des archétypes de voyage (comparer les signatures : contemplatif, sportif, familial...).
// Se tait proprement si indisponible. Lancer une composition depuis un archétype = étape suivante
// (nécessite la sélection des bases + le sidecar OR-Tools en ligne).
export function GalerieArchetypes() {
  const { data } = useArchetypes();
  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Ambiances de voyage</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((a, i) => (
          <div key={a.archetype_key ?? a.key ?? i} className="rounded-lg border border-border bg-card p-3">
            <p className="font-serif">{a.label ?? a.nom ?? a.archetype_key ?? `Ambiance ${i + 1}`}</p>
            {a.description ? <p className="mt-1 text-xs text-muted-foreground">{a.description}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              {a.nuits != null ? <span>{a.nuits} nuits</span> : null}
              {a.km != null ? <span>{a.km} km</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
