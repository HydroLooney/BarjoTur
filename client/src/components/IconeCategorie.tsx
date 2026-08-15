import { categorieDe, type CleIcone } from '@/lib/categories-poi';

// Jeu d'icônes UNIQUE des catégories POI (étape 3) : un style, rondes, trait `currentColor` (prend la couleur de
// famille sur une pastille claire, ou blanc sur un marqueur plein). viewBox 24, trait arrondi. Zéro dépendance
// externe (icônes maison) : sobre et sous contrôle charte. Une icône par catégorie, stable partout.

const GLYPHES: Record<CleIcone, JSX.Element> = {
  vue: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  cascade: (
    <>
      <path d="M8 3v9M12 3v9M16 3v9" />
      <path d="M6 15c1.6 1.8 3.2 1.8 4.8 0s3.2-1.8 4.8 0 3.2 1.8 3.4 0" />
      <path d="M6 19c1.6 1.8 3.2 1.8 4.8 0s3.2-1.8 4.8 0" />
    </>
  ),
  glacier: (
    <>
      <path d="M3 20l6-12 5 8 2-3 5 7z" />
      <path d="M7.5 14l1.5-3 2 3" />
    </>
  ),
  fjord: (
    <>
      <path d="M2 14l4-7 4 7M10 14l4-8 6 8" />
      <path d="M2 18c2 1.4 3.5 1.4 5.5 0s3.5-1.4 5.5 0 3.5 1.4 5 0" />
    </>
  ),
  nature: (
    <>
      <path d="M12 3l4 6h-2.6l3 5h-2.6l2 4H8.2l2-4H7.6l3-5H8z" />
      <path d="M12 21v-3" />
    </>
  ),
  parc: (
    <>
      <path d="M12 21v-5" />
      <path d="M12 4a4.5 4.5 0 00-2.6 8.2A3.5 3.5 0 0012 16a3.5 3.5 0 002.6-3.8A4.5 4.5 0 0012 4z" />
    </>
  ),
  plage: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M12 2v1.5M12 12.5V14M5.6 8H4M20 8h-1.6M7.4 3.4l-1 -1M17.6 3.4l1 -1" />
      <path d="M3 19c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" />
    </>
  ),
  ile: (
    <>
      <path d="M3 19c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0" />
      <path d="M8 16c0-3.5 1.8-6 4-6s4 2.5 4 6" />
      <path d="M12 10V6M12 6c-1.4 0-2.4 1-2.4 2M12 6c1.4 0 2.4 1 2.4 2" />
    </>
  ),
  rando: (
    <>
      <circle cx="13.5" cy="4.5" r="2" />
      <path d="M12 9l-2.5 4 3 2-1 5" />
      <path d="M12 9l3.5 1.5 3-1M18 5v9" />
    </>
  ),
  route: (
    <>
      <path d="M8.5 21c0-5 7-4.5 7-9.5 0-3.5-3.5-3.5-3.5-7.5" />
      <path d="M12 4v2M13.5 10v2M9 17v2" />
    </>
  ),
  ville: (
    <>
      <path d="M4 21V9l5-2.5V21M9 21V3.5L15 6v15M15 21v-8l5 2.5V21" />
      <path d="M3 21h18" />
    </>
  ),
  culture: (
    <>
      <path d="M4 9l8-5 8 5" />
      <path d="M5.5 9v8M10 9v8M14 9v8M18.5 9v8" />
      <path d="M3 21h18M3.5 9h17" />
    </>
  ),
  table: (
    <>
      <path d="M7 3v18M5 3v4.5a2 2 0 004 0V3" />
      <path d="M17 3c-1.8 0-3 2-3 5s1.2 4 3 4v9" />
    </>
  ),
  lit: (
    <>
      <path d="M3 18v-5h18v5" />
      <path d="M3 13V8h9v5M21 18v-1.5M3 18v-1.5" />
    </>
  ),
  activite: <path d="M12 3l2.6 6.1 6.4.5-4.9 4.2 1.5 6.2L12 16.9 6.4 20l1.5-6.2L3 9.6l6.4-.5z" />,
  van: (
    <>
      <path d="M2 16V8h12l4 4h4v4" />
      <path d="M2 16h4M10 16h5M20 16h2" />
      <circle cx="7.5" cy="17" r="1.6" />
      <circle cx="17.5" cy="17" r="1.6" />
    </>
  ),
  phare: (
    <>
      <path d="M9.5 21h5M10.5 21l1-8h1l1 8M11 13l-.6-3.5h3.2L14 13" />
      <path d="M11.4 9.5V6.5h1.2v3M12 4.5v1" />
      <path d="M9 8l-2.5-1.5M15 8l2.5-1.5" />
    </>
  ),
  autre: (
    <>
      <path d="M12 21c4-6 6-8.4 6-11.4A6 6 0 006 9.6c0 3 2 5.4 6 11.4z" />
      <circle cx="12" cy="9.6" r="2.2" />
    </>
  ),
};

interface Props {
  /** Valeur `categorie_calque` (résolue en icône via le contrat unique). */
  categorie: string | null | undefined;
  className?: string;
  /** Trait ; défaut 2. Un peu plus fin sur les petites tailles. */
  trait?: number;
}

export function IconeCategorie({ categorie, className, trait = 2 }: Props) {
  const cat = categorieDe(categorie);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trait}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {GLYPHES[cat.icone]}
    </svg>
  );
}
