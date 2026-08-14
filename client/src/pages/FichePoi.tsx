import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { VoteTier } from '@barjotur/shared';
import { useCatalogue } from '@/lib/queries/catalogue';
import { useIdentite } from '@/stores/identite';
import { usePeut } from '@/hooks/usePeut';
import { useMemoireExploration } from '@/stores/memoire-exploration';
import { useMesVotes, useVoteUnitaire } from '@/lib/queries/votes';
import { SelecteurTier } from '@/ui/blocs/SelecteurTier';
import { MiniCarteRando } from '@/components/MiniCarteRando';
import { CollectionsPoi } from '@/components/CollectionsPoi';
import { EtiquetteMiseEnAvant } from '@/components/EtiquetteMiseEnAvant';
import { Chargement, MessageVide } from '@/ui/blocs/EtatVue';

// Fiche POI pleine page (/explorer/:osm). Le POI est retrouvé dans le catalogue par osm_id (pas d'appel
// dédié). A11 : vote EN HAUT avec défaut affiché, et pour un circuit rando, le TRACÉ visible AVANT de voter.
export default function FichePoi() {
  const { osm } = useParams<{ osm: string }>();
  const { data: catalogue, isLoading } = useCatalogue();
  const poi = useMemo(() => catalogue?.find((p) => p.id === osm) ?? null, [catalogue, osm]);

  const code = useIdentite((s) => s.code);
  const peutVoter = usePeut('voter');
  const { data: mesVotes } = useMesVotes(code);
  const voter = useVoteUnitaire(code);

  // Mémoire d'exploration (A11) : ouvrir la fiche marque le POI « exploré » (déjà vu).
  const marquerExplore = useMemoireExploration((s) => s.marquerExplore);
  useEffect(() => {
    if (poi) marquerExplore(poi.id);
  }, [poi, marquerExplore]);

  if (!poi) {
    return (
      <section className="space-y-3">
        {isLoading ? <Chargement libelle="Chargement du lieu." /> : <MessageVide>Lieu introuvable dans le catalogue.</MessageVide>}
        <Link to="/explorer" className="text-sm underline">
          Retour à l'Explorer
        </Link>
      </section>
    );
  }

  const monTier: VoteTier | null = mesVotes?.tiers[`p:${poi.id}`] ?? null;
  const geom = poi.geometrie;
  const estCircuit = geom !== null && (geom.type === 'LineString' || geom.type === 'MultiLineString');

  return (
    <section className="space-y-4">
      <Link to="/explorer" className="text-sm text-muted-foreground hover:text-foreground">
        ← Explorer
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-serif text-2xl">{poi.nom}</h1>
        <EtiquetteMiseEnAvant score={poi.score_mcda} />
      </div>
      <div className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
        {poi.categorie ? <span>{poi.categorie}</span> : null}
        {poi.region ? <span>· {poi.region}</span> : null}
        {poi.payant ? <span>· payant{poi.tarif ? ` (${poi.tarif})` : ''}</span> : null}
        {poi.saison ? <span>· {poi.saison}</span> : null}
      </div>

      {poi.votable ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="mb-2 text-sm font-medium">Mon vote</p>
          <SelecteurTier
            monTier={monTier}
            tierDefaut={poi.tier_defaut}
            disabled={!peutVoter}
            onChoisir={(t) => voter.mutate({ ref: `p:${poi.id}`, tier: t ?? undefined })}
          />
          {!peutVoter ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {code ? 'Ce lien ne permet pas de voter.' : 'Ouvrez votre lien perso pour voter.'}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Repère non votable (service, information).</p>
      )}

      <CollectionsPoi osmId={poi.id} />

      {estCircuit && geom ? (
        <div className="space-y-1">
          <MiniCarteRando geom={geom} />
          <p className="text-xs text-muted-foreground">
            Tracé du circuit{poi.temps_visite ? `, environ ${poi.temps_visite} min` : ''}.
          </p>
        </div>
      ) : null}

      {poi.presentation ? <p className="max-w-prose text-muted-foreground">{poi.presentation}</p> : null}
    </section>
  );
}
