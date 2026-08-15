import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCatalogue } from '@/lib/queries/catalogue';
import { FichePOI } from '@/components/FichePOI';
import { Chargement, MessageVide } from '@/ui/blocs/EtatVue';

// Fiche POI pleine page (/explorer/:osm). Le POI est retrouvé dans le catalogue par osm_id (pas d'appel dédié).
// Le contenu vit dans le composant partagé `FichePOI` (mode plein) ; la même fiche sert en popover ailleurs.
export default function FichePoi() {
  const { osm } = useParams<{ osm: string }>();
  const { data: catalogue, isLoading } = useCatalogue();
  const poi = useMemo(() => catalogue?.find((p) => p.id === osm) ?? null, [catalogue, osm]);

  if (!poi) {
    return (
      <section className="space-y-3">
        {isLoading ? (
          <Chargement libelle="Chargement du lieu." />
        ) : (
          <MessageVide>Lieu introuvable dans le catalogue.</MessageVide>
        )}
        <Link to="/explorer" className="text-sm underline">
          Retour à l'Explorer
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Link to="/explorer" className="text-sm text-muted-foreground hover:text-foreground">
        ← Explorer
      </Link>
      <FichePOI poi={poi} mode="plein" />
    </section>
  );
}
