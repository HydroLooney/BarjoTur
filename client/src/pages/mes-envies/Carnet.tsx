import { useIdentite } from '@/stores/identite';
import { useMesPropositions } from '@/lib/queries/carnet';
import { useCollections } from '@/stores/collections';
import { FormAjoutLieu } from '@/components/FormAjoutLieu';
import { libelleCategorie, humaniserCle } from '@/lib/libelles';

// Sous-onglet « Mon carnet » de Mes envies (M543/M546) : proposer un lieu, ses propositions, ses collections perso
// (privées, locales). Reprend le contenu carnet de l'ancienne page Mes envies, inchangé. Le vote se pose depuis la fiche.
export default function MesEnviesCarnet() {
  const code = useIdentite((s) => s.code);
  const { data: propositions } = useMesPropositions(code);
  const collections = useCollections((s) => s.collections);
  if (!code) return null;

  return (
    <div className="space-y-4">
      <FormAjoutLieu code={code} />

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Mes propositions</h2>
        {propositions && propositions.length > 0 ? (
          <ul className="space-y-1">
            {propositions.map((p) => (
              <li key={p.osm_id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{p.nom}</span>
                {libelleCategorie(p.categorie) ? (
                  <span className="text-muted-foreground"> · {libelleCategorie(p.categorie)}</span>
                ) : null}
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
              {humaniserCle(nom)} <span className="text-muted-foreground">({refs.length})</span>
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Regroupements perso (privés, locaux). Rangez un lieu depuis sa fiche.
        </p>
      </div>
    </div>
  );
}
