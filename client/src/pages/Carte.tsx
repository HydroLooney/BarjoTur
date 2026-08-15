import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CarteMapLibre, type CibleCamera } from '@/components/CarteMapLibre';
import { FilItineraire } from '@/components/FilItineraire';
import { BarreAnimationJours } from '@/components/BarreAnimationJours';
import { BarreLectureAnimation } from '@/components/BarreLectureAnimation';
import { CarteDuJour } from '@/components/CarteDuJour';
import { AgendaDuJour } from '@/components/AgendaDuJour';
import { AffordanceExpert } from '@/components/coulisses/OverlayExpert';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { useAgenda, jourDeAgenda } from '@/lib/queries/agenda';
import { useIdentite } from '@/stores/identite';
import { etapesDepuisFige } from '@/lib/fige-adapt';
import { libelleNuit } from '@/lib/atlas';
import type { EtapeEntree } from '@/lib/anim-trajet';
import type { AgendaVoyage, EtapeFige, FigeDetail } from '@barjotur/shared';

// Cadence de base du déroulé (à vitesse 1), en ms par jour ; la vitesse divise, le dwell « nuit » multiplie un peu.
const CADENCE_MS = 1400;

/** Heuristique « jour de route » (pas de flag transit sur fige.etape) : gros roulage et aucun POI. À affiner si B pose un vrai marqueur. */
function estJourDeRoute(e: EtapeFige): boolean {
  const roulage = e.roulage_min ?? 0;
  const sansPoi = !e.poi_osm_ids || e.poi_osm_ids.length === 0;
  return roulage >= 240 && sansPoi;
}

// Espace « Carte » (A20 §10) : l'itinéraire retenu, animé (rendu strict fige.geom). Un des trois espaces
// issus de l'ancien Voyager. `?demo` (DEV) charge une géométrie de dev hors BFF ; jamais en production.
export default function Carte() {
  const { data: scenario } = useScenarioDefaut();
  const figeId = scenario?.fige_id ?? null;
  const { data: fige } = useFigeDetail(figeId);

  // `?demo` (DEV) : charge le figé de démo COMPLET (géométrie + étapes) hors BFF, pour la vérif visuelle du déroulé
  // animé et de ses réglages ; jamais en production (R1 : ce n'est pas le consensus réel).
  const [demoFige, setDemoFige] = useState<FigeDetail | null>(null);
  useEffect(() => {
    const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
    if (demo && !fige) void import('@/lib/fixtures/fige-demo').then((m) => setDemoFige(m.figeDetailDemo));
  }, [fige]);

  const figeEffectif = fige ?? demoFige;
  const etapes = useMemo<EtapeEntree[]>(() => (figeEffectif ? etapesDepuisFige(figeEffectif) : []), [figeEffectif]);
  const geom = figeEffectif?.geom ?? null;

  // Barre d'animation (M499/M502 §1) : les jours du fige, cliquables. Sélection → recadrage PROPRE de la carte sur
  // l'étape via le contrôle caméra (M511, prop `centrer` sur CarteMapLibre). Les champs riches (heure/durée) = DTO B v3.1.
  const etapesFige = useMemo(() => [...(figeEffectif?.etapes ?? [])], [figeEffectif]);
  const [jourSel, setJourSel] = useState<number | null>(null);
  const [centrer, setCentrer] = useState<CibleCamera | null>(null);

  // Contrôles d'animation (M552 §1a) : lecture jour par jour, vitesse, inclusion des jours de route.
  const [lecture, setLecture] = useState(false);
  const [vitesse, setVitesse] = useState(1);
  const [transit, setTransit] = useState(true);

  // Les jours JOUABLES, ordonnés (option : sans les jours de simple route). Le déroulé et le « rejouer » s'appuient dessus.
  const joursJouables = useMemo(() => {
    const tries = [...etapesFige].sort((a, b) => a.jour - b.jour);
    return transit ? tries : tries.filter((e) => !estJourDeRoute(e));
  }, [etapesFige, transit]);

  // Avance sur un jour : recadre la carte (le socle caméra suit, M511). `auto` distingue le déroulé automatique d'un
  // clic manuel — un clic manuel MET EN PAUSE (l'utilisateur garde la main).
  const avancer = (jour: number, auto = false) => {
    if (!auto) setLecture(false);
    setJourSel(jour);
    const e = etapesFige.find((x) => x.jour === jour);
    if (e && e.aire_lon != null && e.aire_lat != null) {
      setCentrer({ lon: e.aire_lon, lat: e.aire_lat, zoom: 9 });
    }
  };
  const recadrer = (jour: number) => avancer(jour, false);

  // Horloge du déroulé : quand on lit, on programme l'avancée vers le jour suivant. Le dwell suit la CADENCE / vitesse,
  // un peu allongé les nuits en autonomie (« les nuits comptent »). En bout de course, la lecture s'arrête.
  useEffect(() => {
    if (!lecture || joursJouables.length < 2) return;
    const idx = joursJouables.findIndex((e) => e.jour === jourSel);
    const cur = idx >= 0 ? idx : 0;
    const courant = joursJouables[cur];
    const nuit = courant && libelleNuit(courant.nuitee_type) === 'Nuit en autonomie';
    const delai = (CADENCE_MS / vitesse) * (nuit ? 1.4 : 1);
    const minuteur = window.setTimeout(() => {
      const suivant = joursJouables[cur + 1];
      if (!suivant) {
        setLecture(false);
        return;
      }
      avancer(suivant.jour, true);
    }, delai);
    return () => window.clearTimeout(minuteur);
    // avancer est stable pour un fige donné ; on réagit à l'avancée du jour et aux réglages de lecture.
  }, [lecture, jourSel, vitesse, joursJouables]);

  const rejouer = () => {
    const premier = joursJouables[0];
    if (premier) {
      avancer(premier.jour, true);
      setLecture(true);
    }
  };

  // Play : si on est en bout de course (ou hors séquence), on repart du début ; sinon on reprend là où on est.
  const basculerLecture = (v: boolean) => {
    if (v) {
      const idx = joursJouables.findIndex((e) => e.jour === jourSel);
      if (idx < 0 || idx >= joursJouables.length - 1) {
        rejouer();
        return;
      }
    }
    setLecture(v);
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

      {/* Contrôles d'animation (M552 §1a) : play / pause / rejouer + vitesse (curseur + saisie) + jours de route. */}
      <BarreLectureAnimation
        lecture={lecture}
        onLecture={basculerLecture}
        onRejouer={rejouer}
        vitesse={vitesse}
        onVitesse={setVitesse}
        transit={transit}
        onTransit={setTransit}
        actif={joursJouables.length >= 2}
      />

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
