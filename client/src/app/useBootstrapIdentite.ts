import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { lireCodeLien } from '@/lib/identite-url';
import { useWhoami } from '@/lib/queries/identite';
import { useIdentite } from '@/stores/identite';

// Lit le code de lien dans l'URL (/app/<code>/<Prenom>), resout whoami cote serveur (non gate PIN),
// et hydrate le store d'identite. A monter une fois, haut dans l'arbre (la Coquille).
export function useBootstrapIdentite(): void {
  const { pathname } = useLocation();
  const code = lireCodeLien(pathname);
  const { data } = useWhoami(code);
  const depuisWhoami = useIdentite((s) => s.depuisWhoami);
  useEffect(() => {
    if (code && data) depuisWhoami(code, data);
  }, [code, data, depuisWhoami]);
}
