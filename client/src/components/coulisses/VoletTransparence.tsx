import { useMemo } from 'react';
import type { CataloguePoi } from '@barjotur/shared';
import { useCatalogue } from '@/lib/queries/catalogue';
import { useDecoupageData } from '@/lib/decoupage';
import { useParametres, type Parametre } from '@/lib/queries/parametres';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';

// COULISSES › Transparence donnees (M391, tout public, R1). La version honnete de la sante de la base, cote voyageur :
// ce qui est reel, documente, verifie, et ce qui reste estime ou a confirmer. TOUS les chiffres sont calcules sur la
// donnee LIVE (catalogue + decoupage + registre), jamais ecrits en dur : si la base bouge, l'ecran dit la verite du
// moment. On ne cache pas les trous, on les montre.

interface Part {
  /** Combien satisfont le critere. */
  n: number;
  /** Sur combien au total. */
  total: number;
}

function compter(pois: CataloguePoi[], pred: (p: CataloguePoi) => boolean): Part {
  return { n: pois.filter(pred).length, total: pois.length };
}

function pourcent(part: Part): number {
  return part.total === 0 ? 0 : Math.round((part.n / part.total) * 100);
}

function CarteStat({ titre, part, phrase }: { titre: string; part: Part; phrase: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="flex items-baseline gap-2">
        <span className="chiffres text-hero font-serif">{part.n}</span>
        <span className="text-sm text-muted-foreground">
          / <span className="chiffres">{part.total}</span> ({pourcent(part)}%)
        </span>
      </div>
      <p className="text-sm font-medium">{titre}</p>
      <p className="max-w-prose text-xs text-muted-foreground">{phrase}</p>
    </div>
  );
}

export function VoletTransparence() {
  const catalogue = useCatalogue();
  const decoupage = useDecoupageData();
  const params = useParametres();
  const pois = catalogue.data ?? [];

  const stats = useMemo(
    () => ({
      scores: compter(pois, (p) => p.score_mcda != null),
      photos: compter(pois, (p) => p.image != null || (Array.isArray(p.photos) && p.photos.length > 0)),
      documentes: compter(pois, (p) => Boolean(p.presentation || p.description)),
      verifies: compter(pois, (p) => p.verifie === true),
      traces: compter(pois, (p) => p.trace_reelle === true),
    }),
    [pois],
  );

  // Registre : d'ou vient chaque valeur (calcul / manuel / defaut). C'est la source de verite des reglages.
  const registre = params.data ?? [];
  const parSource = useMemo(() => {
    const m = new Map<string, Parametre[]>();
    for (const p of registre) {
      const s = p.source || 'non précisé';
      const l = m.get(s) ?? [];
      l.push(p);
      m.set(s, l);
    }
    return m;
  }, [registre]);

  const chargeCat = catalogue.isLoading && pois.length === 0;

  return (
    <div className="space-y-5">
      <p className="max-w-prose text-muted-foreground">
        Ce que l'on sait, et ce que l'on suppose. Chaque chiffre est compté sur la base d'aujourd'hui. Un lieu
        peut être superbe et mal documenté : la beauté et la solidité de l'information sont deux choses
        différentes, on ne les mélange pas.
      </p>

      {chargeCat ? <Chargement libelle="Chargement de la couverture." /> : null}
      {catalogue.isError && pois.length === 0 ? (
        <MessageErreur>Couverture indisponible pour l'instant (le service n'est pas branché).</MessageErreur>
      ) : null}

      {pois.length > 0 ? (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="chiffres text-hero font-serif">{pois.length}</span>
            <span className="text-sm text-muted-foreground">lieux au catalogue</span>
            <span className="text-sm text-muted-foreground">
              · <span className="chiffres">{decoupage.regions.length}</span> régions,{' '}
              <span className="chiffres">{decoupage.zones.length}</span> districts,{' '}
              <span className="chiffres">{decoupage.sousZones.length}</span> paysages
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CarteStat
              titre="Notés par le moteur"
              part={stats.scores}
              phrase="Ont reçu une note d'intérêt. Les autres attendent d'être qualifiés."
            />
            <CarteStat
              titre="Avec une image au catalogue"
              part={stats.photos}
              phrase="Portent au moins une image au catalogue. Toutes ne sont pas des photos vérifiées : la galerie vérifiée (droits contrôlés) en compte moins. Le reste s'affiche avec une vignette de repli."
            />
            <CarteStat
              titre="Documentés"
              part={stats.documentes}
              phrase="Ont une présentation ou une description. Les autres sont à rédiger."
            />
            <CarteStat
              titre="Vérifiés"
              part={stats.verifies}
              phrase="Ont été relus et confirmés. Les autres restent à confirmer."
            />
            <CarteStat
              titre="Tracé réel"
              part={stats.traces}
              phrase="Ont une géométrie réelle (sentier, route). Les autres sont posés sur un point."
            />
          </div>
        </>
      ) : null}

      {/* Registre : d'ou vient chaque valeur reglee. */}
      <section className="space-y-2">
        <h3 className="text-section font-medium">D'où viennent les valeurs</h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          Chaque réglage a une origine : calculé par le moteur, saisi à la main, ou laissé au défaut. Rien
          n'est sorti d'un chapeau.
        </p>
        {params.isLoading && registre.length === 0 ? <Chargement libelle="Chargement du registre." /> : null}
        {!params.isLoading && registre.length === 0 ? (
          <MessageVide>Le registre des paramètres n'est pas exposé pour l'instant.</MessageVide>
        ) : null}
        {[...parSource.keys()].sort((a, b) => a.localeCompare(b, 'fr')).map((source) => (
          <details key={source} className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
              {source} <span className="chiffres text-muted-foreground">({parSource.get(source)?.length})</span>
            </summary>
            <ul className="space-y-1 px-4 pb-3 text-sm">
              {(parSource.get(source) ?? []).map((p) => (
                <li key={p.cle} className="flex flex-wrap justify-between gap-x-3 border-t border-border pt-1">
                  <span className="text-muted-foreground">{p.justification || p.cle}</span>
                  <span className="chiffres">{String(p.valeur)}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  );
}
