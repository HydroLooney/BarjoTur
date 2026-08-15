import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useIdentite } from '@/stores/identite';
import type { Annotation, DirectionFleche } from '@/lib/guides/catalogue';

// GuideEcran (M166/M168/M177) : un VOILE sombre qui annote chaque bouton d'un texte et d'une flèche. Un seul
// composant, deux modes. Le MÉCANISME vit ici ; les TEXTES viennent du catalogue (données), passés en `annotations`.
//  - 'legende'  : toutes les annotations d'un coup (à la demande depuis le « ? »). Tap n'importe où / Échap ferme.
//  - 'visite'   : une annotation à la fois, « Suivant / Passer » (onboarding pas à pas).
// Les cibles sont ancrées sur `data-guide="<cible>"` (pas de coordonnées en dur). Une cible absente du DOM est
// simplement ignorée (règle « à venir » du catalogue). Filtre par RÔLE (M168) : les annotations vote/compose ne
// s'affichent qu'au rôle qui y a droit (l'invité ne les voit pas). A11y : focus, Échap, contraste sur le voile.

const GLYPHE: Record<DirectionFleche, string> = { haut: '↑', bas: '↓', gauche: '←', droite: '→' };
const MARGE = 6; // halo autour de la cible

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AnnotationPlacee extends Annotation {
  rect: Rect;
}

interface Props {
  annotations: Annotation[];
  mode: 'legende' | 'visite';
  onFermer: () => void;
  titre?: string;
}

export function GuideEcran({ annotations, mode, onFermer, titre }: Props) {
  const role = useIdentite((s) => s.role);
  const [placees, setPlacees] = useState<AnnotationPlacee[]>([]);
  const [i, setI] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Filtre par rôle : annotation sans rôle = tous ; 'organisateur' = organisateur(s) ; 'voyageur' = qui peut voter.
  function autorisee(a: Annotation): boolean {
    if (!a.role) return true;
    if (a.role === 'organisateur') return role === 'organisateur' || role === 'organisateur_principal';
    if (a.role === 'voyageur') return role !== null && role !== 'invite';
    return true;
  }

  // Mesure les cibles présentes dans le DOM au montage. Scroll verrouillé pendant le guide → rects stables.
  useLayoutEffect(() => {
    const trouvees: AnnotationPlacee[] = [];
    for (const a of annotations) {
      if (!autorisee(a)) continue;
      const el = document.querySelector(`[data-guide="${a.cible}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      trouvees.push({ ...a, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
    }
    setPlacees(trouvees);
    setI(0);
  }, [annotations, role]);

  // Verrou de défilement + Échap + focus piégé/restauré (a11y, M181 §8) : on mémorise l'élément focalisé,
  // on donne le focus au dialogue, et on le restaure à la fermeture.
  useEffect(() => {
    const prec = document.body.style.overflow;
    const focusPrec = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    function onTouche(e: KeyboardEvent) {
      if (e.key === 'Escape') onFermer();
    }
    window.addEventListener('keydown', onTouche);
    return () => {
      document.body.style.overflow = prec;
      window.removeEventListener('keydown', onTouche);
      focusPrec?.focus?.();
    };
  }, [onFermer]);

  const visibles = mode === 'visite' ? placees.slice(i, i + 1) : placees;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={titre ?? 'Guide de l’écran'}
      tabIndex={-1}
      className="fixed inset-0 z-[100] outline-none"
      onClick={mode === 'legende' ? onFermer : undefined}
    >
      {/* Voile sombre avec découpes sur les cibles (elles restent lisibles), plus un halo autour de chacune. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="guide-decoupe">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {visibles.map((a) => (
              <rect
                key={`m-${a.cible}`}
                x={a.rect.x - MARGE}
                y={a.rect.y - MARGE}
                width={a.rect.w + 2 * MARGE}
                height={a.rect.h + 2 * MARGE}
                rx="8"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" style={{ fill: 'var(--voile)' }} mask="url(#guide-decoupe)" />
        {visibles.map((a) => (
          <rect
            key={`h-${a.cible}`}
            x={a.rect.x - MARGE}
            y={a.rect.y - MARGE}
            width={a.rect.w + 2 * MARGE}
            height={a.rect.h + 2 * MARGE}
            rx="8"
            fill="none"
            style={{ stroke: 'var(--fil-halo)' }}
            strokeWidth="2"
          />
        ))}
      </svg>

      {/* Libellés ancrés, avec la flèche vers la cible. */}
      {visibles.map((a) => (
        <Etiquette key={`e-${a.cible}`} a={a} />
      ))}

      {/* Bannière / commandes. */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 p-4 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[color:var(--fil-halo)]">
          {titre ?? (mode === 'legende' ? 'Guide de l’écran · touchez pour fermer' : 'Visite guidée')}
        </p>
        {mode === 'visite' ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFermer}
              className="min-h-tactile rounded-md px-3 text-[color:var(--fil-halo)] underline"
            >
              Passer
            </button>
            <button
              type="button"
              onClick={() => (i + 1 < placees.length ? setI(i + 1) : onFermer())}
              className="min-h-tactile rounded-md border border-[color:var(--fil-halo)] px-3 text-[color:var(--fil-halo)]"
            >
              {i + 1 < placees.length ? 'Suivant' : 'Terminer'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onFermer}
            className="min-h-tactile rounded-md border border-[color:var(--fil-halo)] px-3 text-[color:var(--fil-halo)]"
          >
            Fermer
          </button>
        )}
      </div>

      {placees.length === 0 ? (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg px-4 py-2 text-center text-[color:var(--fil-halo)]"
          onClick={(e) => e.stopPropagation()}
        >
          Rien à guider sur cet écran pour l’instant.
        </div>
      ) : null}
    </div>
  );
}

// Une étiquette posée à côté de sa cible, avec la flèche pointant vers elle. Position calculée depuis le rect.
function Etiquette({ a }: { a: AnnotationPlacee }) {
  const { rect, fleche } = a;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const style: CSSProperties = { position: 'absolute', maxWidth: '16rem' };

  if (fleche === 'haut') {
    style.left = cx;
    style.top = rect.y + rect.h + MARGE + 8;
    style.transform = 'translateX(-50%)';
  } else if (fleche === 'bas') {
    style.left = cx;
    style.top = rect.y - MARGE - 8;
    style.transform = 'translate(-50%, -100%)';
  } else if (fleche === 'gauche') {
    style.left = rect.x + rect.w + MARGE + 8;
    style.top = cy;
    style.transform = 'translateY(-50%)';
  } else {
    style.left = rect.x - MARGE - 8;
    style.top = cy;
    style.transform = 'translate(-100%, -50%)';
  }

  return (
    <div style={style} className="pointer-events-none flex items-center gap-1.5">
      {(fleche === 'gauche' || fleche === 'haut') ? (
        <span aria-hidden className="text-[color:var(--fil-halo)]">
          {GLYPHE[fleche]}
        </span>
      ) : null}
      <span className="rounded-md bg-[color:var(--voile)] px-2 py-1 text-xs leading-snug text-[color:var(--fil-halo)]">
        {a.texte}
      </span>
      {(fleche === 'droite' || fleche === 'bas') ? (
        <span aria-hidden className="text-[color:var(--fil-halo)]">
          {GLYPHE[fleche]}
        </span>
      ) : null}
    </div>
  );
}
