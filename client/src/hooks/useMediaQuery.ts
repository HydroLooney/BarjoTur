import { useEffect, useState } from 'react';

// Media query réactive (A26 / M112) : socle de l'app conçue DIFFÉREMMENT par appareil (pas un simple
// redimensionnement). Téléphone = un écran, une tâche ; grand écran = plusieurs volets côte à côte. Un composant
// s'en sert pour choisir sa mise en page en JS (ex. monter la carte ET la liste ensemble sur grand écran, ou une
// seule à la fois sur mobile), au-delà de ce que fait Tailwind en pur CSS.
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return match;
}

/** Vrai sur grand écran (>= 1024 px) : bureau / grande tablette, où l'on peut poser plusieurs volets côte à côte. */
export function useGrandEcran(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
