import { useEffect, useState } from 'react';

// État hors réseau (M103) : vrai si le navigateur se dit en ligne. Sert à afficher un message clair quand on
// perd la connexion (« vous consultez la dernière version »), plutôt qu'un écran blanc ou des erreurs muettes.
// L'app reste utilisable hors ligne grâce au service worker (shell précaché, tuiles et dernière version en cache).
export function useEnLigne(): boolean {
  const [enLigne, setEnLigne] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const passerEnLigne = () => setEnLigne(true);
    const passerHorsLigne = () => setEnLigne(false);
    window.addEventListener('online', passerEnLigne);
    window.addEventListener('offline', passerHorsLigne);
    return () => {
      window.removeEventListener('online', passerEnLigne);
      window.removeEventListener('offline', passerHorsLigne);
    };
  }, []);

  return enLigne;
}
