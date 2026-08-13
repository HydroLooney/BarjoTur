import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Cache reseau unique : react-query. staleTime long et pas de refetch au focus (les donnees de
// voyage bougent peu ; un vote invalide finement ce qu'il touche, cf lib/queries).
const clientQuery = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

// Le theme (classe .dark) est applique de façon SYNCHRONE par le store `stores/ui` (des l'init et a
// chaque bascule), pas par un effet ici : cela evite le flash de couleur des couches carto. Providers
// n'a donc plus qu'a fournir le client react-query.
export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={clientQuery}>{children}</QueryClientProvider>;
}
