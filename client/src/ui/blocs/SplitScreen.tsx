import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useSplits } from '@/stores/splits';
import { cn } from '@/lib/utils';

// SplitScreen (design-system unifié, SPEC-CONSOLIDEE §A / M136) : deux volets côte à côte séparés par une poignée
// REPOSITIONNABLE (souris/tactile ET clavier), dont le ratio est MÉMORISÉ PAR ESPACE (store `useSplits`). Pensé
// pour le grand écran (le consommateur ne le monte qu'en grand écran ; sur mobile il rend un onglet à la fois).
// Le ratio est la fraction du volet GAUCHE, bornée [min, max]. A11y : `role="separator"`, valeurs ARIA, flèches.

const PAS_CLAVIER = 0.05;

function borne(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface Props {
  /** Clé d'espace stable pour la mémoire du ratio (ex. 'explorer', 'notre-voyage', 'carte'). */
  cleEspace: string;
  /** Ratio par défaut du volet gauche (0..1) si rien n'est mémorisé. */
  ratioDefaut: number;
  gauche: ReactNode;
  droite: ReactNode;
  min?: number;
  max?: number;
  ariaLabelGauche?: string;
  ariaLabelDroite?: string;
  className?: string;
}

export function SplitScreen({
  cleEspace,
  ratioDefaut,
  gauche,
  droite,
  min = 0.2,
  max = 0.8,
  ariaLabelGauche,
  ariaLabelDroite,
  className,
}: Props) {
  const conteneur = useRef<HTMLDivElement>(null);
  const ratioMemorise = useSplits((s) => s.ratios[cleEspace]);
  const setRatio = useSplits((s) => s.setRatio);
  const [glisse, setGlisse] = useState(false);
  const ratio = borne(ratioMemorise ?? ratioDefaut, min, max);

  function auPointeur(e: ReactPointerEvent) {
    if (!glisse || !conteneur.current) return;
    const rect = conteneur.current.getBoundingClientRect();
    if (rect.width === 0) return;
    setRatio(cleEspace, borne((e.clientX - rect.left) / rect.width, min, max));
  }

  function auClavier(e: ReactKeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setRatio(cleEspace, borne(ratio - PAS_CLAVIER, min, max));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setRatio(cleEspace, borne(ratio + PAS_CLAVIER, min, max));
    }
  }

  return (
    <div ref={conteneur} className={cn('flex items-stretch', className)}>
      <div style={{ flexBasis: `${ratio * 100}%` }} className="min-w-0 shrink-0" aria-label={ariaLabelGauche}>
        {gauche}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Repositionner les volets"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        tabIndex={0}
        onKeyDown={auClavier}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setGlisse(true);
        }}
        onPointerMove={auPointeur}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setGlisse(false);
        }}
        className={cn(
          'mx-1 w-1.5 shrink-0 cursor-col-resize touch-none rounded-full',
          glisse ? 'bg-primary' : 'bg-border hover:bg-primary/50',
        )}
      />

      <div className="min-w-0 flex-1" aria-label={ariaLabelDroite}>
        {droite}
      </div>
    </div>
  );
}
