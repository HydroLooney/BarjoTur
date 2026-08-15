import { Bouton } from '@/ui/primitives/button';

// CONTRÔLES D'ANIMATION du déroulé jour par jour (M552 §1a, doc AGENDA-JOUR-BARRE-ANIMATION-NAV-v3 §3bis) :
// play / pause / rejouer + curseur de VITESSE (doublé d'une saisie liée, UI-slider transverse) + toggle des jours de
// transit. Composant de CONTRÔLES pur : l'horloge (avancée jour par jour, dwell ∝ temps/nuits, caméra qui suit) vit
// dans la page Carte, qui garde la main (un clic sur une puce jour met en pause). Gros boutons, famille.

export function BarreLectureAnimation({
  lecture,
  onLecture,
  onRejouer,
  vitesse,
  onVitesse,
  transit,
  onTransit,
  actif,
}: {
  lecture: boolean;
  onLecture: (v: boolean) => void;
  onRejouer: () => void;
  vitesse: number;
  onVitesse: (v: number) => void;
  transit: boolean;
  onTransit: (v: boolean) => void;
  /** Y a-t-il un itinéraire à jouer (au moins deux jours) ? Sinon rien à afficher. */
  actif: boolean;
}) {
  if (!actif) return null;
  const borne = (v: number) => Math.min(3, Math.max(0.5, Number.isFinite(v) ? v : 1));

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card/95 p-3 text-foreground shadow-flottante backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <Bouton size="sm" onClick={() => onLecture(!lecture)} aria-label={lecture ? 'Mettre en pause' : 'Lancer la lecture'}>
          {lecture ? '⏸ Pause' : '▶ Lecture'}
        </Bouton>
        <Bouton size="sm" variant="outline" onClick={onRejouer} aria-label="Rejouer depuis le début">
          ⟲ Rejouer
        </Bouton>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Vitesse</span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.5}
          value={vitesse}
          onChange={(e) => onVitesse(borne(Number(e.target.value)))}
          aria-label="Vitesse de lecture"
          className="h-2 w-28 cursor-pointer"
          style={{ accentColor: 'var(--ocre)' }}
        />
        {/* Saisie directe liée au curseur (règle UI transverse). */}
        <input
          type="number"
          min={0.5}
          max={3}
          step={0.5}
          value={vitesse}
          onChange={(e) => onVitesse(borne(Number(e.target.value)))}
          aria-label="Vitesse de lecture (saisie)"
          className="min-h-tactile w-16 rounded-md border border-border bg-background px-2 text-center text-sm tabular-nums"
        />
        <span className="text-muted-foreground">×</span>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={transit}
          onChange={(e) => onTransit(e.target.checked)}
          className="h-4 w-4"
          style={{ accentColor: 'var(--ocre)' }}
        />
        <span>Inclure les jours de route</span>
      </label>
    </div>
  );
}
