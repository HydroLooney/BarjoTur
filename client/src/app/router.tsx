import { lazy } from 'react';
import { createBrowserRouter, redirect } from 'react-router-dom';
import { Coquille } from './layout';

// Vues lourdes en lazy : chaque route tire son propre chunk (les cartes restent hors du chemin critique).
const Accueil = lazy(() => import('@/pages/Accueil'));
const Explorer = lazy(() => import('@/pages/Explorer'));
const FichePoi = lazy(() => import('@/pages/FichePoi'));
const Voyager = lazy(() => import('@/pages/Voyager'));
const MesLieux = lazy(() => import('@/pages/MesLieux'));
const Coulisses = lazy(() => import('@/pages/Coulisses'));
const JourImprimable = lazy(() => import('@/pages/JourImprimable'));

// Compat strangler : les anciens deep-links v2 (?onglet=, ?fiche=) redirigent vers les routes
// propres v3, pour ne pas casser les liens deja partages pendant la bascule.
function redirigerDepuisV2(): Response | null {
  if (typeof window === 'undefined') return null;
  const p = new URLSearchParams(window.location.search);
  const fiche = p.get('fiche');
  if (fiche) return redirect(`/explorer/${encodeURIComponent(fiche)}`);
  const onglet = p.get('onglet');
  const table: Record<string, string> = {
    explorer: '/explorer',
    voyager: '/voyager',
    mesLieux: '/mes-lieux',
    coulisses: '/coulisses',
  };
  if (onglet && table[onglet]) return redirect(table[onglet]);
  return null;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Coquille />,
    children: [
      { index: true, loader: redirigerDepuisV2, element: <Accueil /> },
      { path: 'explorer', element: <Explorer /> },
      { path: 'explorer/:osm', element: <FichePoi /> },
      { path: 'voyager', element: <Voyager /> },
      { path: 'mes-lieux', element: <MesLieux /> },
      { path: 'coulisses', element: <Coulisses /> },
      { path: 'jour/:date', element: <JourImprimable /> },
    ],
  },
]);
