import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bouton } from '@/ui/primitives/button';
import { LimiteErreur } from './LimiteErreur';
import { MenuAvatar } from '@/components/MenuAvatar';
import { GuideEcran } from '@/components/GuideEcran';
import AccesPrive from '@/pages/AccesPrive';
import { LEGENDES, espaceGuideDepuisRoute } from '@/lib/guides/catalogue';
import { cn } from '@/lib/utils';
import { ESPACES } from '@/lib/libelles';
import { useUi } from '@/stores/ui';
import { useIdentite } from '@/stores/identite';
import { useSyncMemoire } from '@/hooks/useSyncMemoire';
import { useEnLigne } from '@/hooks/useEnLigne';
import { signalBoucleDemo } from '@/lib/fixtures/signal-boucle-demo';
import { jetonEspace, jetonEspaceCourant } from '@/lib/espaces-couleur';

// Libellé de nav avec l'identité couleur PAR ESPACE (M162) : pastille discrète de la couleur de l'espace, plus
// le signal « du nouveau ici » (M112) quand la route porte des nouveautés (fixture hors live ; au flip, l'état
// vient du serveur). Accent DISCRET : jamais d'aplat, une pastille de la taille d'un point.
function LabelNav({ to, libelle, pastille = true }: { to: string; libelle: string; pastille?: boolean }) {
  const nouveaute = (signalBoucleDemo.nouveautes[to] ?? 0) > 0;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {/* Pastille couleur d'espace : sur la barre basse (mobile, colonnes etroites) on l'omet pour que les
          libelles a deux mots (« Notre Voyage ») tiennent sur une ligne (M201) ; la couleur active suffit la. */}
      {pastille ? (
        <span
          aria-hidden
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: jetonEspace(to) }}
        />
      ) : null}
      {libelle}
      {nouveaute ? (
        <>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="sr-only">du nouveau</span>
        </>
      ) : null}
    </span>
  );
}

// Socle d'app A20 : titres explicites pour un enfant (zéro jargon), nav mobile au pouce (barre du bas),
// bandeau parcours persistant en tête de chaque vue (anti-« perdu »), squelette commun. Responsive-first,
// petit écran d'abord : la nav primaire passe en barre basse sur mobile, inline en tête sur desktop.
// Libellés depuis le tableau central (miroir du glossaire figé, M067).
// Barre principale = OSSATURE V2 par activité (M471, directive Guillaume) : Accueil (hub « Où en est-on ? ») +
// Explorer · Décider · Préparer · Compter · Le réel. Chaque mot est une action, chaque espace répond à UNE
// question. Coulisses (owner) reste dans le menu avatar. Fini le bandeau « Parcours » incohérent (retiré ci-dessous).
const PRIMAIRES = [
  { to: '/', libelle: ESPACES.accueil, exact: true },
  { to: '/explorer', libelle: ESPACES.explorer, exact: false },
  { to: '/voter', libelle: ESPACES.voter, exact: false },
  { to: '/composer', libelle: ESPACES.composer, exact: false },
  { to: '/notre-voyage', libelle: ESPACES.notreVoyage, exact: false },
  { to: '/preparatifs', libelle: ESPACES.preparer, exact: false },
  { to: '/compter', libelle: ESPACES.compter, exact: false },
] as const;
// Barre BASSE mobile : sous-ensemble CORE (7 entrées ne tiennent pas au pouce) ; Accueil = logo-maison, Compter +
// Coulisses via l'accueil-hub + l'avatar. Desktop montre tout en tête.
const PRIMAIRES_MOBILE = PRIMAIRES.filter((l) => l.to !== '/' && l.to !== '/compter');

export function Coquille() {
  const basculerTheme = useUi((s) => s.basculerTheme);
  const location = useLocation();
  const enLigne = useEnLigne();
  const [guideOuvert, setGuideOuvert] = useState(false);
  const espaceGuide = espaceGuideDepuisRoute(location.pathname);
  // Sync mémoire perso (C-16/C-18/C-17) : inerte tant que le drapeau live est off (pré-bascule).
  useSyncMemoire();

  // Identité de DÉMO pour les captures QA hors BFF (M184), DEV seulement : `?identite=<role>` pose une identité
  // fictive (prénom fictif, adulte) pour voir les écrans identifiés (Mes envies, Notre Voyage, vote). Aucune
  // écriture réelle débloquée (autorité serveur). Rôles : organisateur, voyageur, demo, invite.
  const demoDevIdentite = useIdentite((s) => s.demoDev);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const r = new URLSearchParams(window.location.search).get('identite');
    const roles = ['organisateur_principal', 'organisateur', 'voyageur', 'demo', 'invite'] as const;
    if (r && (roles as readonly string[]).includes(r)) demoDevIdentite(r as (typeof roles)[number]);
  }, [demoDevIdentite]);

  // GARDE D'ACCÈS (M468 §1) : l'app est PRIVÉE. Sans identité résolue (ni persistée d'une visite précédente du
  // lien perso, ni en cours de résolution via /app/<token>/), on ne montre RIEN de l'app → page d'accès privé.
  // L'identité est hydratée SYNCHRONE depuis localStorage (persist) → pas de flash à froid pour un invité connu.
  // En DEV, `?identite=<role>` (résolu à l'effet ci-dessus) bypasse la garde pour les captures QA.
  const codeResolu = useIdentite((s) => s.code) !== null;
  const estBootstrap = location.pathname.startsWith('/app/');
  const bypassDemo = import.meta.env.DEV && new URLSearchParams(location.search).has('identite');
  if (!codeResolu && !estBootstrap && !bypassDemo) {
    return <AccesPrive />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        {/* Logo-maison : ramène à l'accueil hub depuis n'importe où (v2). */}
        <NavLink to="/" className="font-serif text-xl hover:text-accent">
          Barjøtur
        </NavLink>
        <nav aria-label="Navigation principale" className="hidden flex-wrap gap-1 md:flex">
          {PRIMAIRES.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.exact}
              className={({ isActive }) =>
                cn(
                  // Textes PLUS GROS (M471) : la v2 les avait plus lisibles (Mamie + enfants).
                  'inline-flex min-h-tactile items-center rounded-md px-3 py-2 text-base transition-colors',
                  isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted',
                )
              }
            >
              <LabelNav to={l.to} libelle={l.libelle} />
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto" data-guide="avatar">
          <MenuAvatar />
        </div>
        {/* « ? » de l'espace (M166) : ouvre le Guide de l'écran (voile annoté) de l'espace courant. L'aide en ligne
            en slide-over viendra se greffer ici aussi. */}
        <Bouton
          variant="ghost"
          size="sm"
          onClick={() => setGuideOuvert(true)}
          aria-label="Guide de l’écran"
          aria-haspopup="dialog"
        >
          ?
        </Bouton>
        <Bouton
          variant="ghost"
          size="sm"
          onClick={basculerTheme}
          aria-label="Basculer le thème clair ou sombre"
        >
          Thème
        </Bouton>
      </header>

      {/* Liseré en tête d'espace (M162) : fine barre de la couleur de l'espace courant, accent discret. */}
      <div aria-hidden style={{ height: '3px', backgroundColor: jetonEspaceCourant(location.pathname) }} />

      {!enLigne ? (
        <div role="status" className="border-b border-border bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
          Hors ligne. Vous consultez la dernière version enregistrée du voyage.
        </div>
      ) : null}

      <main id="contenu" className="mx-auto w-full max-w-6xl p-4 pb-24 md:pb-4">
        <LimiteErreur key={location.pathname}>
          <Suspense fallback={<p className="text-muted-foreground">Chargement en cours.</p>}>
            <Outlet />
          </Suspense>
        </LimiteErreur>
      </main>

      {/* Nav mobile au pouce : barre basse fixe, cibles larges, masquée sur desktop (nav inline en tête). */}
      <nav
        aria-label="Navigation (bas d'écran)"
        data-guide="barre-bas"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card md:hidden"
      >
        {PRIMAIRES_MOBILE.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.exact}
            className={({ isActive }) =>
              cn(
                'flex min-h-tactile flex-1 flex-col items-center justify-center gap-0.5 py-2 text-center text-sm leading-tight transition-colors',
                isActive ? 'font-medium text-primary' : 'text-muted-foreground',
              )
            }
          >
            <LabelNav to={l.to} libelle={l.libelle} pastille={false} />
          </NavLink>
        ))}
      </nav>

      {guideOuvert ? (
        <GuideEcran
          annotations={LEGENDES[espaceGuide]}
          mode="legende"
          onFermer={() => setGuideOuvert(false)}
        />
      ) : null}
    </div>
  );
}
