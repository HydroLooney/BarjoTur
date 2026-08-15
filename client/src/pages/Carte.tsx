import { useEffect, useMemo, useState } from 'react';
import type { MultiLineString } from 'geojson';
import { Link } from 'react-router-dom';
import { CarteMapLibre } from '@/components/CarteMapLibre';
import { FilItineraire } from '@/components/FilItineraire';
import { AffordanceExpert } from '@/components/coulisses/OverlayExpert';
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-serif text-2xl">Carte</h1>
        {/* Overlay expert (M343) : reglages ecran='carte', gate mode expert + capacite. Invisible sinon. */}
        <AffordanceExpert ecran="carte" />
      </div>
      <p className="max-w-prose text-muted-foreground">
        Le voyage jour après jour : l'itinéraire retenu joué du départ au retour, puis la frise des 21 jours
        (prévu et, au fil du voyage, vécu). Les ancres du ferry, début et fin, sont visibles.
      </p>
      <CarteMapLibre mode="lecture-ideal" geom={geom} etapes={etapes} />
      <FilItineraire />
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link to="/carte/routes-sceniques" className="text-sm text-accent hover:underline">
          Routes scéniques et points de chute →
        </Link>
        <Link to="/atlas" className="text-sm text-accent hover:underline">
          Voir l'atlas imprimable du voyage →
        </Link>
      </div>
    </section>
  );
}
