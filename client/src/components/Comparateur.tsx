import { useBudgetComparatif } from '@/lib/queries/budget';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';
import { Badge } from '@/ui/primitives/badge';
import {
  amplitudeEcart,
  classerProfils,
  ecartAuConsensus,
  type EcartConsensus,
  type ProfilCompare,
} from '@/lib/comparateur';

// Comparateur (C-20 / A12) : côte à côte les itinéraires comparés (consensus, archétypes, membres),
// puis la lecture ÉGALITARISTE du consensus, « ce que chacun cède » par rapport à son itinéraire idéal.
// Honnêteté R1 : on affiche l'écart MESURÉ au consensus (nuits, km, budget), jamais un jugement inventé.

function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

function signe(n: number, unite: string): string {
  if (n === 0) return `identique`;
  const val = unite === '€' ? Math.round(Math.abs(n)).toLocaleString('fr-FR') : String(Math.abs(n));
  return `${n > 0 ? '+' : '−'}${val} ${unite}`;
}

function LigneComparee({ p, estRepere }: { p: ProfilCompare; estRepere?: boolean }) {
  const b = p.ligne;
  return (
    <tr className={estRepere ? 'border-t border-border bg-muted font-medium' : 'border-t border-border'}>
      <th scope="row" className="px-3 py-2 text-left font-normal">
        {p.nom}
      </th>
      <td className="px-3 py-2">
        <Badge variant={p.nature === 'consensus' ? 'tierA' : p.nature === 'archetype' ? 'tierB' : 'tierS'}>
          {p.nature === 'consensus' ? 'consensus' : p.nature === 'archetype' ? 'archétype' : 'membre'}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{b.nuits}</td>
      <td className="px-3 py-2 text-right tabular-nums">{b.km.toLocaleString('fr-FR')}</td>
      <td className="px-3 py-2 text-right tabular-nums">{euro(b.total_prudent_eur)}</td>
    </tr>
  );
}

export function Comparateur() {
  const { data, isLoading, isError } = useBudgetComparatif();

  if (isLoading) return <Chargement libelle="Chargement du comparateur." />;
  if (isError)
    return <MessageErreur>Comparateur indisponible pour l'instant (le service n'est pas branché).</MessageErreur>;

  const lignes = data ?? [];
  if (lignes.length === 0) return <MessageVide>Aucun itinéraire à comparer pour l'instant.</MessageVide>;

  const { consensus, membres, archetypes } = classerProfils(lignes);

  // Écart de chaque membre au consensus, trié du plus grand au plus petit (qui cède le plus, A12).
  const ecarts: { p: ProfilCompare; e: EcartConsensus; amp: number }[] = consensus
    ? membres
        .map((p) => {
          const e = ecartAuConsensus(p.ligne, consensus.ligne);
          return { p, e, amp: amplitudeEcart(e) };
        })
        .sort((a, b) => b.amp - a.amp)
    : [];
  const cedeLePlus = ecarts.find((x) => x.amp > 0)?.p.nom ?? null;

  const rangees: ProfilCompare[] = [...(consensus ? [consensus] : []), ...archetypes, ...membres];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Comparer les itinéraires</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">Profil</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">Nature</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Nuits</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Km</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Budget prudent</th>
              </tr>
            </thead>
            <tbody>
              {rangees.map((p) => (
                <LigneComparee key={`${p.nature}:${p.nom}`} p={p} estRepere={p.nature === 'consensus'} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {consensus && ecarts.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Consensus égalitariste : ce que chacun cède</h2>
          <p className="max-w-prose text-xs text-muted-foreground">
            L'itinéraire retenu se tient entre les itinéraires proposés. Voici, pour chacun, l'écart mesuré à
            son idéal (durée, distance, budget). Ce n'est pas un jugement, c'est la distance au choix commun.
          </p>
          <ul className="space-y-1">
            {ecarts.map(({ p, e }) => (
              <li key={p.nom} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="font-medium">{p.nom}</span>
                {p.nom === cedeLePlus ? (
                  <span className="ml-2 text-xs text-accent">cède le plus</span>
                ) : null}
                <span className="ml-2 text-muted-foreground">
                  {signe(e.dNuits, 'nuits')} · {signe(e.dKm, 'km')} · {signe(e.dBudget, '€')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
