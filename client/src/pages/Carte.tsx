import { useEffect, useMemo, useState } from 'react';
import type { MultiLineString } from 'geojson';
import { Link } from 'react-router-dom';
import { CarteMapLibre, type CibleCamera } from '@/components/CarteMapLibre';
import { FilItineraire } from '@/components/FilItineraire';
import { BarreAnimationJours } from '@/components/BarreAnimationJours';
import { CarteDuJour } from '@/components/CarteDuJour';
import { AgendaDuJour } from '@/components/AgendaDuJour';
import { AffordanceExpert } from '@/components/coulisses/OverlayExpert';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { useAgenda, jourDeAgenda } from '@/lib/queries/agenda';
import { useIdentite } from '@/stores/identite';
import { etapesDepuisFige } from '@/lib/fige-adapt';
import type { EtapeEntree } from '@/lib/anim-trajet';
import type { AgendaVoyage } from '@barjotur/shared';

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

  // Barre d'animation (M499/M502 §1) : les jours du fige, cliquables. Sélection → recadrage PROPRE de la carte sur
  // l'étape via le contrôle caméra (M511, prop `centrer` sur CarteMapLibre). Les champs riches (heure/durée) = DTO B v3.1.
  const etapesFige = useMemo(() => [...(fige?.etapes ?? [])], [fige]);
  const [jourSel, setJourSel] = useState<number | null>(null);
  const [centrer, setCentrer] = useState<CibleCamera | null>(null);
  const recadrer = (jour: number) => {
    setJourSel(jour);
    const e = etapesFige.find((x) => x.jour === jour);
    if (e && e.aire_lon != null && e.aire_lat != null) {
      setCentrer({ lon: e.aire_lon, lat: e.aire_lat, zoom: 9 });
    }
  };

  // Agenda du jour (M499/M502 §1-2, DTO cafb053 ; endpoint B172 GET /api/agenda/:code, clé = lien voyageur). Se
  // remplit dès le bff redéployé ; en DEV `?agenda` charge un APERÇU de structure (jamais en production, R1).
  const codeVoyageur = useIdentite((s) => s.code);
  const agendaQuery = useAgenda(codeVoyageur);
  const [apercuAgenda, setApercuAgenda] = useState<AgendaVoyage | null>(null);
  useEffect(() => {
    const veut = import.meta.env.DEV && new URLSearchParams(window.location.search).has('agenda');
    if (veut && !agendaQuery.data) void import('@/lib/fixtures/agenda-demo').then((m) => setApercuAgenda(m.agendaDemo));
  }, [agendaQuery.data]);
  const agenda = agendaQuery.data ?? apercuAgenda;
  const jourAgenda = jourDeAgenda(agenda, jourSel);
  // À l'arrivée de l'agenda, on ouvre le 1er jour si rien n'est encore sélectionné (la carte du jour a du contenu d'emblée).
  useEffect(() => {
    if (agenda && jourSel == null && agenda.jours[0]) recadrer(agenda.jours[0].jour);
    // recadrer/jourSel volontairement hors deps : on ne réagit qu'à l'arrivée de l'agenda.
  }, [agenda]);

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
      <CarteMapLibre mode="lecture-ideal" geom={geom} etapes={etapes} centrer={centrer} />
      {/* Barre d'animation : le voyage jour par jour, puces cliquables + marqueur nuit + ancres ferry (M499/M502 §1). */}
      <BarreAnimationJours etapes={etapesFige} jourSelectionne={jourSel} onSelect={recadrer} />

      {/* Carte du jour + agenda du jour sélectionné (M499/M502 §1-2). Présents dès que l'agenda est disponible
          (endpoint B live, ou aperçu DEV `?agenda`) ; sinon la barre seule pilote le recadrage, sans rien inventer. */}
      {jourAgenda ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CarteDuJour jour={jourAgenda} />
          <AgendaDuJour jour={jourAgenda} />
        </div>
      ) : null}

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
