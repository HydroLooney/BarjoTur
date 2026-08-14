import { useEffect, useMemo, useState } from 'react';
import type { MultiLineString } from 'geojson';
import { Link } from 'react-router-dom';
import { CarteItineraire } from '@/components/CarteItineraire';
import { GalerieArchetypes } from '@/components/GalerieArchetypes';
import { Composeur } from '@/components/Composeur';
import { EtapesTransit } from '@/components/EtapesTransit';
import { Comparateur } from '@/components/Comparateur';
import { VueBudget } from '@/components/VueBudget';
import { Intendance } from '@/components/Intendance';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { etapesDepuisFige } from '@/lib/fige-adapt';
import type { EtapeEntree } from '@/lib/anim-trajet';

// Voyager (C16) : la carte itineraire animee (rendu strict fige.geom). On lit le scenario par defaut
// (consensus, fige_id 141) puis le fige riche, et on l'anime. `?demo` (DEV seulement) charge une geometrie
// de dev pour verifier le rendu hors BFF ; jamais en production.
export default function Voyager() {
  const { data: scenario } = useScenarioDefaut();
  const figeId = scenario?.fige_id ?? null;
  const { data: fige } = useFigeDetail(figeId);
  const etapes = useMemo<EtapeEntree[]>(() => (fige ? etapesDepuisFige(fige) : []), [fige]);

  // Fixture de dev, chargee dynamiquement (donc absente du chemin de prod) : verif visuelle du reveal.
  const [demoGeom, setDemoGeom] = useState<MultiLineString | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (demo && !fige) {
      void import('@/lib/fixtures/fige-demo').then((m) => setDemoGeom(m.figeGeomDemo));
    }
  }, [fige]);

  const geom = fige?.geom ?? demoGeom ?? null;

  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Voyager</h1>
      <p className="max-w-prose text-muted-foreground">
        L'itineraire retenu, joue du depart au retour. Traversees d'eau en tirete, aucune ligne droite
        terrestre : le trace suit la geometrie continue du voyage.
      </p>
      <div>
        <Link to="/atlas" className="text-sm text-accent hover:underline">
          Voir l'atlas imprimable du voyage →
        </Link>
      </div>
      <CarteItineraire geom={geom} etapes={etapes} />
      <GalerieArchetypes />
      <Composeur />
      <EtapesTransit />
      <Comparateur />
      <VueBudget />
      <Intendance />
    </section>
  );
}
