import { useIdentite } from '@/stores/identite';
import { useMesPropositions } from '@/lib/queries/carnet';
import { useCollections } from '@/stores/collections';
import { FormAjoutLieu } from '@/components/FormAjoutLieu';
import { QuizzEnvies } from '@/components/QuizzEnvies';
import { PhilosophieVoyage } from '@/components/PhilosophieVoyage';

// Voter (ossature V2, ex « Mes envies ») : dire ce qu'on aime. Le CŒUR = « Ta façon de voyager » (8 axes de
// philosophie, AUDIT-FRONT P0 #1) qui pondèrent le composeur (MCDA v3). Puis le quizz raccourci, le carnet perso
// (ajout + propositions) et les collections. Le vote par lieu se pose depuis la fiche (Explorer).
export default function MesEnvies() {
  const code = useIdentite((s) => s.code);
  const { data: propositions } = useMesPropositions(code);
  const collections = useCollections((s) => s.collections);

  if (!code) {
    return (
      <section className="space-y-3">
        <h1 className="font-serif text-2xl">Voter</h1>
        <p className="max-w-prose text-muted-foreground">
          Ouvrez votre lien perso pour dire votre façon de voyager, voter et proposer des lieux.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl">Voter</h1>
        <p className="max-w-prose text-muted-foreground">
          Dites ce que vous aimez, sans classer personne. D'abord votre façon de voyager, puis vos envies et vos
          lieux.
        </p>
      </div>

      {/* CŒUR de Voter (P0 #1) : les 8 axes de philosophie qui orientent les propositions. */}
      <PhilosophieVoyage />

      {/* Quizz sur invitation (M181 §B6) : un raccourci pour pre-remplir ses envies sans regler chaque curseur. */}
      <QuizzEnvies />

      <FormAjoutLieu code={code} />
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Mes propositions</h2>
        {propositions && propositions.length > 0 ? (
          <ul className="space-y-1">
            {propositions.map((p) => (
              <li key={p.osm_id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{p.nom}</span>
                {p.categorie ? <span className="text-muted-foreground"> · {p.categorie}</span> : null}
                {p.source ? <span className="text-muted-foreground"> · {p.source}</span> : null}
                {p.flag_pepite ? <span className="text-accent"> · pépite</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune proposition pour l'instant.</p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Mes collections</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(collections).map(([nom, refs]) => (
            <span key={nom} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
              {nom} <span className="text-muted-foreground">({refs.length})</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Regroupements perso (privés, locaux). Rangez un lieu depuis sa fiche.
        </p>
      </div>
    </section>
  );
}
