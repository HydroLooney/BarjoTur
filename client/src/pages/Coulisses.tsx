import { useMemo } from 'react';
import { useParametres, type Parametre } from '@/lib/queries/parametres';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';

// Coulisses (C09 / A08) : le registre single-source des paramètres (valeur active + recommandée +
// justification en clair), groupé par domaine. Anti-cadrage : la méthode et les chiffres vivent ICI,
// pas devant la famille pendant le vote. Aucune constante en dur : tout vient de `budget.parametre`.
function grouperParDomaine(params: Parametre[]): Map<string, Parametre[]> {
  const m = new Map<string, Parametre[]>();
  for (const p of params) {
    const liste = m.get(p.domaine) ?? [];
    liste.push(p);
    m.set(p.domaine, liste);
  }
  return m;
}

export default function Coulisses() {
  const { data, isLoading, isError } = useParametres();
  const groupes = useMemo(() => grouperParDomaine(data ?? []), [data]);
  const domaines = useMemo(() => [...groupes.keys()].sort((a, b) => a.localeCompare(b, 'fr')), [groupes]);
  const vide = (data ?? []).length === 0;

  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Coulisses</h1>
      <p className="max-w-prose text-muted-foreground">
        La mécanique du choix : les paramètres du registre single-source, leur valeur active et la valeur
        recommandée par le moteur, avec la justification en clair. Ce qui explique, sans cadrer.
      </p>

      {isLoading && vide ? <Chargement libelle="Chargement des paramètres." /> : null}
      {isError && vide ? (
        <MessageErreur>Paramètres indisponibles pour l'instant (le service n'est pas branché).</MessageErreur>
      ) : null}
      {!isLoading && !isError && vide ? (
        <MessageVide>Aucun paramètre dans le registre pour l'instant.</MessageVide>
      ) : null}

      {domaines.map((domaine) => (
        <div key={domaine} className="space-y-2">
          <h2 className="text-sm font-medium">{domaine}</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Paramètre</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Valeur</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Recommandée</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Source</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Justification</th>
                </tr>
              </thead>
              <tbody>
                {(groupes.get(domaine) ?? []).map((p) => (
                  <tr key={p.cle} className="border-t border-border align-top">
                    <td className="px-3 py-2 font-mono text-xs">{p.cle}</td>
                    <td className="px-3 py-2">{String(p.valeur)}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.valeur_recommandee != null ? String(p.valeur_recommandee) : '·'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
