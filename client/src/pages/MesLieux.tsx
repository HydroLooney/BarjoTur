import { useIdentite } from '@/stores/identite';
import { useMesPropositions } from '@/lib/queries/carnet';
import { FormAjoutLieu } from '@/components/FormAjoutLieu';

// Mes lieux (C15 / A11) : le « papier ». 1re couche = carnet de lieux perso (ajout + mes propositions).
// Les votes groupés par tier et les collections perso viendront (mémoire d'exploration serveur).
export default function MesLieux() {
  const code = useIdentite((s) => s.code);
  const { data: propositions } = useMesPropositions(code);

  if (!code) {
    return (
      <section className="space-y-3">
        <h1 className="font-serif text-2xl">Mes lieux</h1>
        <p className="max-w-prose text-muted-foreground">
          Ouvrez votre lien perso pour accéder à votre carnet, vos votes et vos propositions.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Mes lieux</h1>
      <FormAjoutLieu code={code} />
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Mes propositions</h2>
        {propositions && propositions.length > 0 ? (
          <ul className="space-y-1">
            {propositions.map((p, i) => (
              <li key={p.osm_id ?? i} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{p.nom}</span>
                {p.categorie ? <span className="text-muted-foreground"> · {p.categorie}</span> : null}
                {p.statut ? <span className="text-muted-foreground"> · {p.statut}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune proposition pour l'instant.</p>
        )}
      </div>
    </section>
  );
}
