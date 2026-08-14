import { useEffect, useMemo, useState } from 'react';
import type { MultiLineString } from 'geojson';
import { Link } from 'react-router-dom';
import { CarteItineraire } from '@/components/CarteItineraire';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { etapesDepuisFige } from '@/lib/fige-adapt';
import type { EtapeEntree } from '@/lib/anim-trajet';

// Espace « Carte » (A20 §10) : l'itinéraire retenu, animé (rendu strict fige.geom). Un des trois espaces
// issus de l'ancien Voyager. `?demo` (DEV) charge une géométrie de dev hors BFF ; jamais en production.
export default function Carte() {
  const { data: scenario } = useScenarioDefaut();
  const figeId = scenario?.fige_id ?? null;
  const { data: fige } = useFigeDetail(figeId);
  const etapes = useMemo<EtapeEntree[]>(() => (fige ? etapesDepuisFige(fige) : []), [fige]);

  const [demoGeom, setDemoGeom] = useState<MultiLineString | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (demo && !fige) void import('@/lib/fixtures/fige-demo').then((m) => setDemoGeom(m.figeGeomDemo));
  }, [fige]);

  const geom = fige?.geom ?? demoGeom ?? null;

  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Carte</h1>
      <p className="max-w-prose text-muted-foreground">
        L'itinéraire retenu, joué du départ au retour. Traversées d'eau en tireté, aucune ligne droite
        terrestre : le tracé suit la géométrie continue du voyage.
      </p>
      <CarteItineraire geom={geom} etapes={etapes} />
      <div>
        <Link to="/atlas" className="text-sm text-accent hover:underline">
          Voir l'atlas imprimable du voyage →
        </Link>
      </div>
    </section>
  );
}
