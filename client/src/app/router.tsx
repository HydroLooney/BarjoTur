import { lazy, useEffect } from 'react';
import { createBrowserRouter, redirect, useNavigate, useParams } from 'react-router-dom';
import { Coquille } from './layout';
import { useWhoami } from '@/lib/queries/whoami';
import { useIdentite } from '@/stores/identite';

// Vues lourdes en lazy : chaque route tire son propre chunk (les cartes restent hors du chemin critique).
// Socle d'app A20 : 7 espaces à titres explicites pour un enfant (« Le voyage », « Notre Voyage », « Mes
// envies », « Préparatifs », « Réglages »…). Les anciens chemins redirigent (compat strangler).
const Accueil = lazy(() => import('@/pages/Accueil')); // « Le voyage »
const Explorer = lazy(() => import('@/pages/Explorer'));
const FichePoi = lazy(() => import('@/pages/FichePoi'));
const LeTrajet = lazy(() => import('@/pages/LeTrajet')); // ex-Composer
const Carte = lazy(() => import('@/pages/Carte'));
const Preparatifs = lazy(() => import('@/pages/Preparatifs')); // ex-Intendance
const MonVoyage = lazy(() => import('@/pages/MonVoyage')); // « Mon voyage » (par voyageur, A26)
const MesEnvies = lazy(() => import('@/pages/MesEnvies')); // « Mes envies »
const Coulisses = lazy(() => import('@/pages/Coulisses')); // « Réglages »
const JourImprimable = lazy(() => import('@/pages/JourImprimable'));
const Atlas = lazy(() => import('@/pages/Atlas'));
const Conseils = lazy(() => import('@/pages/Conseils')); // « Les conseils du voyage » (T056, react-markdown lazy)
const CarteCoulisses = lazy(() => import('@/pages/CarteCoulisses')); // carte de coulisses backstage (T069)
const ConceptSymbologie = lazy(() => import('@/pages/ConceptSymbologie')); // planche de concepts symbologie POI (étape 3)
const ConceptVignettes = lazy(() => import('@/pages/ConceptVignettes')); // planche de concept vignette + fallback (C12)
const ConceptClustering = lazy(() => import('@/pages/ConceptClustering')); // planche de concept clustering + proéminence 5 tiers (C13)
const Paniers = lazy(() => import('@/pages/Paniers')); // écran classement paniers / budget TSAB (M383/M394)
const Decoupage = lazy(() => import('@/pages/Decoupage')); // C15 drill-down interactif région › district › paysage
const RoutesSceniquesPage = lazy(() => import('@/pages/RoutesSceniques')); // C19 routes scéniques + couche bases
const Agenda = lazy(() => import('@/pages/Agenda')); // #6 agenda confort (type de nuit, série autonomie/PPC, laverie)

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

/**
 * Route /app/:code/:prenom : bootstrap whoami + redirection vers /explorer.
 * L'identite est resolue autoritairement cote serveur (whoami non gate PIN, A03).
 * On monte ce composant, il fetche whoami, pose l'identite dans le store, puis navigue.
 * Si le BFF n'est pas branche : message d'erreur clair, sans crash.
 */
function BootstrapIdentite() {
  // Le prenom de l'URL est decoratif : l'autorite sur l'identite (prenom compris) est le retour whoami.
  const { code } = useParams<{ code: string; prenom: string }>();
  const navigate = useNavigate();
  const depuisWhoami = useIdentite((s) => s.depuisWhoami);
  const { data: whoami, isError } = useWhoami(code ?? null);

  useEffect(() => {
    if (whoami && code) {
      depuisWhoami(code, whoami);
      void navigate('/explorer', { replace: true });
    }
  }, [whoami, code, depuisWhoami, navigate]);

  if (isError) {
    return (
      <section className="space-y-2 p-4">
        <p className="text-muted-foreground">
          Lien non reconnu. Verifiez votre lien d'invitation et reessayez.
        </p>
      </section>
    );
  }

  return (
    <section className="p-4">
      <p className="text-muted-foreground">Identification en cours...</p>
    </section>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Coquille />,
    children: [
      { index: true, loader: redirigerDepuisV2, element: <Accueil /> },
      { path: 'explorer', element: <Explorer /> },
      { path: 'explorer/:osm', element: <FichePoi /> },
      { path: 'le-trajet', element: <LeTrajet /> },
      { path: 'carte', element: <Carte /> },
      { path: 'preparatifs', element: <Preparatifs /> },
      { path: 'mon-voyage', element: <MonVoyage /> },
      { path: 'mes-envies', element: <MesEnvies /> },
      { path: 'mes-paniers', element: <Paniers /> },
      { path: 'reglages', element: <Coulisses /> },
      { path: 'jour/:date', element: <JourImprimable /> },
      { path: 'atlas', element: <Atlas /> },
      { path: 'conseils', element: <Conseils /> },
      { path: 'conseils/:slug', element: <Conseils /> },
      { path: 'coulisses/carte', element: <CarteCoulisses /> },
      { path: 'coulisses/symbologie', element: <ConceptSymbologie /> },
      { path: 'coulisses/vignettes', element: <ConceptVignettes /> },
      { path: 'coulisses/clustering', element: <ConceptClustering /> },
      { path: 'coulisses/decoupage', element: <Decoupage /> },
      { path: 'carte/routes-sceniques', element: <RoutesSceniquesPage /> },
      { path: 'agenda', element: <Agenda /> },
      // Compat des anciens chemins (strangler) : redirection vers les espaces A20.
      { path: 'voyager', loader: () => redirect('/carte') },
      { path: 'mes-lieux', loader: () => redirect('/mes-envies') },
      { path: 'coulisses', loader: () => redirect('/reglages') },
      // Bootstrap identite : /app/<code>/<Prenom> (non gate PIN, A03).
      { path: 'app/:code/:prenom', element: <BootstrapIdentite /> },
    ],
  },
]);
