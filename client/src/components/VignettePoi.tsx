import { useState } from 'react';
import type { PoiPhoto } from '@barjotur/shared';
import { categorieDe, FAMILLES } from '@/lib/categories-poi';
import { IconeCategorie } from '@/components/IconeCategorie';
import { cn } from '@/lib/utils';

// Vignette d'un lieu (C12). Couverture photo partielle (~319/964) : le FALLBACK est donc le cas le plus fréquent, il
// doit être BEAU et intentionnel, pas une boîte « image manquante ». Parti pris : une carte topographique miniature,
// courbes de niveau concentriques + icône de la catégorie, teintée par la FAMILLE (le même contrat couleur que la carte
// et le filtre). Ça dit « un lieu sur la carte, qu'on n'a pas encore photographié », cohérent avec un compagnon de
// carto. Zéro hex (couleurs par jetons `var(--…)` + `color-mix`), dark-safe (les jetons portent le thème).
//
// Quand une photo EXISTE (licence + attribution obligatoires, R1) : on l'affiche avec son crédit ; si elle ne charge
// pas (source tierce, hors-ligne), on retombe proprement sur le fallback charté (jamais d'image cassée à l'écran).

interface Props {
  photo?: PoiPhoto | null;
  categorie: string | null;
  nom: string;
  /** Classe de ratio Tailwind (défaut 4/3 pour la fiche ; ex. `aspect-video` en bandeau). */
  ratio?: string;
  className?: string;
}

// Fond topographique : ellipses concentriques (courbes de niveau) dans la couleur de famille, opacité décroissante.
const COURBES = [
  { rx: 13, ry: 10, o: 0.36 },
  { rx: 23, ry: 18, o: 0.28 },
  { rx: 33, ry: 26, o: 0.21 },
  { rx: 43, ry: 34, o: 0.14 },
  { rx: 53, ry: 42, o: 0.08 },
];

export function VignettePoi({ photo, categorie, nom, ratio = 'aspect-[4/3]', className }: Props) {
  const [cassee, setCassee] = useState(false);
  const cat = categorieDe(categorie ?? '');
  const fam = FAMILLES[cat.famille];
  const token = fam.token; // ex. --nature, --eau…
  const montrerPhoto = photo?.url && !cassee;

  return (
    <figure className={cn('relative overflow-hidden rounded-lg border border-border', ratio, className)}>
      {montrerPhoto ? (
        <>
          <img
            src={photo!.url}
            alt={nom}
            loading="lazy"
            onError={() => setCassee(true)}
            className="h-full w-full object-cover"
          />
          {/* Crédit obligatoire (R1) : jamais de photo sans sa source et sa licence. */}
          <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-2 py-1 text-[0.625rem] text-white/90">
            {photo!.source}
            {photo!.licence ? ` · ${photo!.licence}` : ''}
          </figcaption>
        </>
      ) : (
        // FALLBACK charté par famille : carte topo miniature (courbes de niveau + icône de catégorie).
        <div
          className="grid h-full w-full place-items-center"
          style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(${token}) 30%, var(--card)), var(--card))` }}
          aria-label={`${cat.libelle}, sans photo pour l'instant`}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
            <g transform="rotate(-16 50 50)" fill="none" stroke={`var(${token})`} strokeWidth={1.1}>
              {COURBES.map((c) => (
                <ellipse key={c.rx} cx="50" cy="50" rx={c.rx} ry={c.ry} style={{ opacity: c.o }} />
              ))}
            </g>
          </svg>
          <span
            className="relative grid h-14 w-14 place-items-center rounded-full"
            style={{ backgroundColor: `color-mix(in srgb, var(${token}) 38%, var(--card))`, color: `var(${token})` }}
          >
            <IconeCategorie categorie={cat.cle} className="h-7 w-7" trait={2} />
          </span>
          <figcaption className="absolute bottom-1.5 left-2 flex items-center gap-1.5 text-[0.625rem] font-medium text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: `var(${token})` }} aria-hidden />
            {cat.libelle}
          </figcaption>
        </div>
      )}
    </figure>
  );
}
