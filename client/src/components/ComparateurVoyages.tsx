import { useMemo, useState } from 'react';
import { useArchetypes } from '@/lib/queries/composeur';
import { useScenarioDefaut, useFigeDetail } from '@/lib/queries/fige';
import { etapesDepuisFige } from '@/lib/fige-adapt';
import { CarteMapLibre } from '@/components/CarteMapLibre';
import { Comparateur } from '@/components/Comparateur';
import type { EtapeEntree } from '@/lib/anim-trajet';
import { cn } from '@/lib/utils';

// COMPARATEUR DE VOYAGES (M478, spec Guillaume, logique v3). Les objets « voyage » comparables : Mon voyage, Notre
// voyage (figé consensus), Dernier calcul, les voyages des autres, les ARCHÉTYPES (fige_id → geom réelle). 4 modes :
//  (1) CONSULTER un archétype en carte ANIMÉE (+ sélecteur) — buildé ici, données live (fige_id des archétypes).
//  (2) MON voyage vs NOTRE voyage en swipe carto (rideau non animé) — brique swipe à venir + « mon voyage » (B).
//  (3) DEUX voyages QUELCONQUES en swipe vertical + menus A/B — idem.
//  (4) PAGE DES ÉCARTS (lieux/ordre/nuits/budget/temps, MCDA v3) — s'appuie sur le Comparateur v3 existant.
// On réutilise la carte animée (mode 1), la fiche, et le Comparateur v3 (mode 4). Un seul contexte WebGL (A05).

type Mode = 'archetype' | 'moi-nous' | 'deux' | 'ecarts';

const MODES: { cle: Mode; libelle: string }[] = [
  { cle: 'archetype', libelle: 'Consulter un archétype' },
  { cle: 'moi-nous', libelle: 'Moi vs nous' },
  { cle: 'deux', libelle: 'Deux voyages' },
  { cle: 'ecarts', libelle: 'Les écarts' },
];

function nomArchetype(a: Record<string, unknown>, i: number): string {
  return String(a.label ?? a.nom ?? a.archetype_key ?? `Ambiance ${i + 1}`);
}

// Mode 1 : consulter un archétype, joué sur la carte animée.
function ModeArchetype() {
  const { data: archetypes, isLoading, isError } = useArchetypes();
  const liste = useMemo(() => (archetypes ?? []) as Record<string, unknown>[], [archetypes]);
  const [choisi, setChoisi] = useState(0);
  const a = liste[choisi];
  const figeId = a && a['fige_id'] != null ? Number(a['fige_id']) : null;
  const { data: fige } = useFigeDetail(figeId);
  const etapes = useMemo<EtapeEntree[]>(() => (fige ? etapesDepuisFige(fige) : []), [fige]);
  const fiche = (a?.['fiche'] ?? {}) as Record<string, unknown>;

  if (isError) return <p className="text-sm text-muted-foreground">Archétypes indisponibles pour le moment.</p>;
  if (isLoading && liste.length === 0) return <p className="text-sm text-muted-foreground">Chargement des archétypes…</p>;
  if (liste.length === 0) return <p className="text-sm text-muted-foreground">Aucun archétype à consulter.</p>;

  const stat = (cle: string, suffixe = '') => (fiche[cle] != null ? `${fiche[cle]}${suffixe}` : '—');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="archetype-sel" className="text-sm text-muted-foreground">
          Voyage-philosophie :
        </label>
        <select
          id="archetype-sel"
          value={choisi}
          onChange={(e) => setChoisi(Number(e.target.value))}
          className="min-h-tactile rounded-md border border-border bg-card px-3 py-1.5 text-sm"
        >
          {liste.map((x, i) => (
            <option key={i} value={i}>
              {nomArchetype(x, i)}
            </option>
          ))}
        </select>
      </div>

      {/* La carte ANIMÉE joue l'archétype retenu (reveal du fige.geom). */}
      <CarteMapLibre mode="lecture-ideal" geom={fige?.geom ?? null} etapes={etapes} hauteur="46vh" />

      {/* La signature de l'archétype (fiche live), chiffres réels. */}
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[
          ['Distance', stat('km', ' km')],
          ['Nuits', stat('nuits')],
          ['Conduite', fiche['drive_h'] != null ? `${fiche['drive_h']} h` : '—'],
          ['Bases', stat('n_bases')],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="chiffres font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Modes 2-3 : swipe carto (rideau) entre deux voyages. Brique swipe à poser + « mon voyage / autres / dernier calcul »
// (contrats B). Honnête R1 : on annonce ce qui manque plutôt que de simuler.
function ModeSwipeAVenir({ intro }: { intro: string }) {
  const { data: scenario } = useScenarioDefaut();
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
      <p>{intro}</p>
      <p>
        Le rideau de comparaison carto arrive avec la brique swipe. Les voyages comparables « mon voyage », « les
        voyages des autres » et « dernier calcul » attendent leurs contrats côté données ; « Notre voyage »
        {scenario?.fige_id != null ? ' (figé consensus) est déjà là' : ' arrivera au montage'} et les archétypes aussi.
      </p>
    </div>
  );
}

export function ComparateurVoyages() {
  const [mode, setMode] = useState<Mode>('archetype');
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Modes de comparaison" className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
        {MODES.map((m) => (
          <button
            key={m.cle}
            role="tab"
            aria-selected={mode === m.cle}
            onClick={() => setMode(m.cle)}
            className={cn(
              'min-h-tactile flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              mode === m.cle ? 'bg-card text-foreground shadow-posee' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.libelle}
          </button>
        ))}
      </div>

      {mode === 'archetype' ? <ModeArchetype /> : null}
      {mode === 'moi-nous' ? <ModeSwipeAVenir intro="Comparer mon voyage au voyage commun, côte à côte (rideau)." /> : null}
      {mode === 'deux' ? <ModeSwipeAVenir intro="Comparer deux voyages au choix (le mien, un autre, le dernier calcul, un archétype)." /> : null}
      {mode === 'ecarts' ? <Comparateur /> : null}
    </div>
  );
}
