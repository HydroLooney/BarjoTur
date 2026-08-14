import { signalBoucleDemo } from '@/lib/fixtures/signal-boucle-demo';

// Fil « depuis ta dernière visite » (A26 / M112) : un résumé calme de ce qui a bougé dans la décision collective
// (qui a proposé, combien de votes, la compo qui a bougé). Pas d'alerte, pas de push : on se remet dans la boucle
// à son rythme. Fixture hors live ; au flip, le serveur fournit le vrai delta depuis mon dernier passage.
export function FilDepuisDerniereVisite() {
  const lignes = signalBoucleDemo.depuis_derniere_visite;
  if (lignes.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <p className="text-sm font-medium">Depuis ta dernière visite</p>
      <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
        {lignes.map((l) => (
          <li key={l}>· {l}</li>
        ))}
      </ul>
    </div>
  );
}
