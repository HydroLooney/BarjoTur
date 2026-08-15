import { useEffect, useRef, useState } from 'react';
import type { PhotoPoi } from '@barjotur/shared';
import { VignettePoi } from '@/components/VignettePoi';
import { urlMedia } from '@/lib/media';
import { cn } from '@/lib/utils';

// Hero carrousel photo de la fiche (M378/M406, données B125/A140). Plusieurs photos triées par `ordre` → défilement
// (flèches + points), crédit/licence affichés (R1). 0 photo OU image qui ne charge pas (binaires servis au Go Live) →
// FALLBACK charté par famille (VignettePoi), jamais d'image cassée. Même cadre partout (aspect-video), zéro décalage.

interface Props {
  photos: PhotoPoi[];
  categorie: string | null;
  nom: string;
  className?: string;
}

export function HeroCarrousel({ photos, categorie, nom, className }: Props) {
  const [i, setI] = useState(0);
  const [cassees, setCassees] = useState<Set<number>>(() => new Set());
  const [pause, setPause] = useState(false);

  // AUTO-DÉFILEMENT (M422) : avance seul toutes les ~4,5 s s'il y a PLUSIEURS photos ; pause au survol/interaction ;
  // respecte `prefers-reduced-motion` (aucune animation forcée). Une seule photo → pas d'auto-défilement.
  const nb = photos.length;
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    if (nb <= 1) return;
    const reduit = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduit) return;
    const id = window.setInterval(() => {
      if (!pauseRef.current) setI((v) => (v + 1) % nb);
    }, 4500);
    return () => window.clearInterval(id);
  }, [nb]);

  // Aucune photo → fallback charté direct.
  if (photos.length === 0) {
    return <VignettePoi photo={null} categorie={categorie} nom={nom} ratio="aspect-video" className={className} />;
  }

  const idx = Math.min(i, photos.length - 1);
  const p = photos[idx];
  const src = urlMedia(p?.chemin); // MEDIA_BASE + chemin (B127) ; dev localhost:8088, prod /media/
  const cassee = !p || !src || cassees.has(idx);
  const aller = (d: number) => setI((v) => (v + d + photos.length) % photos.length);

  return (
    <figure
      className={cn('relative overflow-hidden rounded-lg border border-border', 'aspect-video', className)}
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocusCapture={() => setPause(true)}
      onBlurCapture={() => setPause(false)}
    >
      {cassee || !src ? (
        // Image indisponible → fallback charté, sans casser le cadre.
        <VignettePoi photo={null} categorie={categorie} nom={nom} ratio="aspect-video" className="!rounded-none !border-0" />
      ) : (
        <>
          <img
            src={src}
            alt={nom}
            loading="lazy"
            onError={() => setCassees((s) => new Set(s).add(idx))}
            className="h-full w-full object-cover"
          />
          <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-2 py-1 text-[0.625rem] text-white/90">
            {p.credit}
            {p.licence ? ` · ${p.licence}` : ''}
          </figcaption>
        </>
      )}

      {/* Navigation (si plusieurs photos) : flèches discrètes + points. Cibles tactiles suffisantes. */}
      {photos.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Photo précédente"
            onClick={() => aller(-1)}
            className="absolute left-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-card/80 text-lg text-foreground shadow-posee backdrop-blur-sm hover:bg-card"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Photo suivante"
            onClick={() => aller(1)}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-card/80 text-lg text-foreground shadow-posee backdrop-blur-sm hover:bg-card"
          >
            ›
          </button>
          <div className="absolute inset-x-0 top-1.5 flex justify-center gap-1" aria-hidden>
            {photos.map((_, k) => (
              <span
                key={k}
                className={cn('h-1.5 w-1.5 rounded-full', k === idx ? 'bg-card' : 'bg-card/50')}
              />
            ))}
          </div>
        </>
      ) : null}
    </figure>
  );
}
