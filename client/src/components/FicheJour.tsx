import type { EtapeFige } from '@barjotur/shared';

// FicheJour (C-21) : le corps d'une fiche jour, partagé par la page jour imprimable (une fiche) et
// l'atlas (toutes les fiches reliées). Rendu sobre, dark-safe (tokens), pensé pour l'impression.
// `niveau` règle le titre (h1 sur une page seule, h2 dans l'atlas) pour garder une hiérarchie correcte.
export function FicheJour({ etape, niveau = 2 }: { etape: EtapeFige; niveau?: 1 | 2 }) {
  const Titre = niveau === 1 ? 'h1' : 'h2';
  return (
    <article className="space-y-3">
      <header className="space-y-1">
        <Titre className="font-serif text-2xl">
          Jour {etape.jour}
          {etape.date_jour ? `, ${etape.date_jour}` : ''}
        </Titre>
        {etape.nuitee_type ? <p className="text-sm text-muted-foreground">Nuitée : {etape.nuitee_type}</p> : null}
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        {etape.roulage_min != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Roulage</dt>
            <dd>{etape.roulage_min} min</dd>
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
        {etape.tier_jour ? (
          <div>
            <dt className="text-xs text-muted-foreground">Tier du jour</dt>
            <dd>{etape.tier_jour}</dd>
          </div>
        ) : null}
        {etape.meteo_dependant != null ? (
          <div>
            <dt className="text-xs text-muted-foreground">Météo-dépendant</dt>
            <dd>{etape.meteo_dependant ? 'oui' : 'non'}</dd>
          </div>
        ) : null}
        {etape.poi_osm_ids && etape.poi_osm_ids.length > 0 ? (
          <div>
            <dt className="text-xs text-muted-foreground">Lieux du jour</dt>
            <dd>{etape.poi_osm_ids.length}</dd>
          </div>
        ) : null}
      </dl>

      {etape.note ? <p className="max-w-prose text-sm text-muted-foreground">{etape.note}</p> : null}
    </article>
  );
}
