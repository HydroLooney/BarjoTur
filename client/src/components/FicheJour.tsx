import type { EtapeFige } from '@barjotur/shared';
import { campDeBase, libelleNuit, resumeDe } from '@/lib/atlas';
import { formatDuree } from '@/lib/budget-temps';

// FicheJour (C-21 / M103) : le corps d'une fiche jour, partagé par la page jour imprimable (une fiche) et
// l'atlas (toutes les fiches reliées). Une page par jour du voyage : date, camp de base, lieux et leur temps
// sur place, trajet, traversées ferry, nuit, budget du jour. Rendu sobre, lisible en noir et blanc, dark-safe
// (tokens), pensé pour l'impression. `niveau` règle le titre (h1 sur une page seule, h2 dans l'atlas). Rend
// seulement ce qui est présent (dégradé propre, R1) : hors live, la fixture le remplit ; au flip, les données
// viennent de la compo (étapes) et du budget-jour de B.
function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

export function FicheJour({ etape, niveau = 2 }: { etape: EtapeFige; niveau?: 1 | 2 }) {
  const Titre = niveau === 1 ? 'h1' : 'h2';
  const r = resumeDe(etape);
  const base = campDeBase(etape);
  const nuit = libelleNuit(etape.nuitee_type);

  return (
    <article className="space-y-3">
      <header className="space-y-1">
        <Titre className="font-serif text-2xl">
          Jour {etape.jour}
          {etape.date_jour ? `, ${etape.date_jour}` : ''}
        </Titre>
        {base ? <p className="text-sm text-muted-foreground">Camp de base : {base}</p> : null}
      </header>

      {r.lieux && r.lieux.length > 0 ? (
        <div className="space-y-1">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sur place</h3>
          <ul className="space-y-0.5 text-sm">
            {r.lieux.map((l) => (
              <li key={l.nom} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>{l.nom}</span>
                <span className="tabular-nums text-muted-foreground">{formatDuree(l.temps_min)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : etape.poi_osm_ids && etape.poi_osm_ids.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {etape.poi_osm_ids.length} lieu{etape.poi_osm_ids.length === 1 ? '' : 'x'} ce jour-là.
        </p>
      ) : null}

      <dl className="grid gap-3 sm:grid-cols-2">
        {etape.roulage_min != null || r.km != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Trajet</dt>
            <dd>
              {etape.roulage_min != null ? formatDuree(etape.roulage_min) : '·'}
              {r.km != null ? ` · ${r.km.toLocaleString('fr-FR')} km` : ''}
            </dd>
          </div>
        ) : null}
        {r.traversees || r.ferry_eur != null || r.ferry_min != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Ferry</dt>
            <dd>
              {r.traversees ? `${r.traversees} traversée${r.traversees === 1 ? '' : 's'}` : 'ferry'}
              {r.ferry_min != null ? ` · ${formatDuree(r.ferry_min)}` : ''}
              {r.ferry_eur != null ? ` · ${euro(r.ferry_eur)}` : ''}
            </dd>
          </div>
        ) : null}
        {nuit ? (
          <div>
            <dt className="text-xs text-muted-foreground">Nuit</dt>
            <dd>{nuit}</dd>
          </div>
        ) : null}
        {etape.lever || etape.coucher ? (
          <div>
            <dt className="text-xs text-muted-foreground">Lever / coucher</dt>
            <dd>
              {etape.lever ?? '·'} / {etape.coucher ?? '·'}
            </dd>
          </div>
        ) : null}
        {r.budget_eur != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Budget du jour</dt>
            <dd className="font-medium tabular-nums">{euro(r.budget_eur)}</dd>
          </div>
        ) : null}
      </dl>

      {etape.note ? <p className="max-w-prose text-sm text-muted-foreground">{etape.note}</p> : null}
    </article>
  );
}
