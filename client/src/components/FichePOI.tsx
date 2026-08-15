import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { CataloguePoi } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { usePeut } from '@/hooks/usePeut';
import { useMemoireExploration } from '@/stores/memoire-exploration';
import { BoutonVote } from '@/ui/blocs/BoutonVote';
import { CarteMapLibre } from '@/components/CarteMapLibre';
import { CollectionsPoi } from '@/components/CollectionsPoi';
import { EtiquetteMiseEnAvant } from '@/components/EtiquetteMiseEnAvant';
import { ProvenanceLieu } from '@/components/ProvenanceLieu';
import { HeroCarrousel } from '@/components/HeroCarrousel';
import { FilArianePoi } from '@/components/FilArianePoi';
import { enrichissementDemo } from '@/lib/fixtures/enrichissement-demo';
import { usePoiFiche } from '@/lib/queries/poi-fiche';
import { cn } from '@/lib/utils';

// Fiche POI PARTAGÉE (design-system unifié, SPEC-CONSOLIDEE §A) : un seul composant, deux modes.
//  - `plein`  : pleine page (/explorer/:osm), tout le détail (mini-carte du tracé, collections, provenance).
//  - `popover`: compact, DANS le contexte (clic sur la carte / arbitrage Notre Voyage) — pas de sortie de
//    contexte : le geste de vote et l'essentiel, plus un lien opt-in « voir la fiche complète ». En popover on
//    NE monte PAS de 2e carte (A05, un seul contexte WebGL) : le tracé est déjà sur la carte derrière.
// Audit adopté : pour un circuit rando, le TRACÉ (ou sa durée/D+) est montré AVANT le contrôle de vote.

export type ModeFiche = 'plein' | 'popover';

interface Props {
  poi: CataloguePoi;
  mode?: ModeFiche;
  className?: string;
}

export function FichePOI({ poi, mode = 'plein', className }: Props) {
  const code = useIdentite((s) => s.code);
  const peutVoter = usePeut('voter');
  const marquerExplore = useMemoireExploration((s) => s.marquerExplore);

  // Ouvrir la fiche (pleine ou popover) marque le POI « déjà vu » (A11).
  useEffect(() => {
    marquerExplore(poi.id);
  }, [poi.id, marquerExplore]);

  const popover = mode === 'popover';
  const geom = poi.geometrie;
  const estCircuit = geom !== null && (geom.type === 'LineString' || geom.type === 'MultiLineString');
  // Provenance (signaux communauté) : démo ; au flip par `poi_id`.
  const enr = enrichissementDemo(poi.id);
  // Détail + photos RÉELS (B125), lazy : hero carrousel + détail rédigé. Fallback charté si 0 photo / binaires au Go Live.
  const fiche = usePoiFiche(poi.id);
  const photos = fiche.data?.photos ?? [];
  const detail = fiche.data?.detail ?? null;
  const presentation = detail?.presentation ?? detail?.description ?? poi.presentation ?? null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* LAYOUT M388 (validé Guillaume) : 1) HERO → 2) titre + sous-titre fil d'ariane → 3) VOTE haut (juste sous le
          titre, 4 crans + 5e défaut) → 4) le reste (détail, actions). Le vote remonte : geste immédiat. */}

      {/* 1. HERO : carrousel photo réel (B125, fallback charté C12 si 0 photo / binaire non servi) pour un LIEU ; le
          TRACÉ pour un circuit (sa vedette). */}
      {!estCircuit ? (
        <HeroCarrousel
          photos={photos}
          categorie={poi.categorie}
          nom={poi.nom}
          className={popover ? 'w-full' : 'max-w-md'}
        />
      ) : geom && !popover ? (
        <div className="space-y-1">
          <CarteMapLibre mode="lecture" geom={geom} />
          <p className="text-xs text-muted-foreground">
            Tracé du circuit{poi.temps_visite ? `, environ ${poi.temps_visite} min` : ''}.
          </p>
        </div>
      ) : null}

      {/* 2. TITRE + sous-titre = fil d'ariane (Région › District › Paysage). Câblage sur la donnée découpage = étape 3 ;
          ici on montre le chemin connu (région) sans inventer (R1). */}
      <div className="space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cn('font-serif', popover ? 'text-lg' : 'text-2xl')}>{poi.nom}</h2>
          <EtiquetteMiseEnAvant score={poi.score_mcda} />
        </div>
        {/* Sous-titre = FIL D'ARIANE réel (M388/M419) : Région › District › Paysage via `sous_zone_id` du POI. */}
        <FilArianePoi sousZoneId={(poi as { sous_zone_id?: string | null }).sous_zone_id ?? null} />
      </div>

      {/* 3. VOTE HAUT (M388) : SelecteurTier = 4 crans + 5e défaut non actionnable, optimiste. */}
      {poi.votable ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <BoutonVote cible={`p:${poi.id}`} tierDefaut={poi.tier_defaut} nom={poi.nom} />
          {!peutVoter ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {code ? 'Ce lien ne permet pas de voter.' : 'Ouvrez votre lien perso pour voter.'}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Repère non votable (service, information).</p>
      )}

      {estCircuit && popover ? (
        <p className="text-xs text-muted-foreground">
          Circuit{poi.temps_visite ? `, environ ${poi.temps_visite} min` : ''} — tracé affiché sur la carte.
        </p>
      ) : null}

      {/* 4. LE RESTE : méta pratique + détail rédigé + actions. */}
      <div className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
        {poi.categorie ? <span>{poi.categorie}</span> : null}
        {poi.payant ? <span>· payant{poi.tarif ? ` (${poi.tarif})` : ''}</span> : null}
        {poi.saison ? <span>· {poi.saison}</span> : null}
      </div>

      {presentation ? (
        <p className={cn('text-muted-foreground', popover ? 'line-clamp-4 text-sm' : 'max-w-prose')}>
          {presentation}
        </p>
      ) : null}

      {popover ? (
        <Link to={`/explorer/${poi.id}`} className="inline-block min-h-tactile text-sm underline">
          Voir la fiche complète
        </Link>
      ) : (
        <>
          <CollectionsPoi osmId={poi.id} />
          <ProvenanceLieu enr={enr} />
        </>
      )}
    </div>
  );
}
