// Identité couleur PAR ESPACE (M162) : chaque espace porte une couleur, en accent DISCRET (liseré en tête +
// pastille d'onglet, JAMAIS d'aplat plein). Les valeurs vivent dans ui/tokens.css (R03) ; ici on ne manie que
// des NOMS de variables CSS, jamais de hex. La couleur du fil individuel/collectif en dérive côté FilItineraire.

export type RouteEspace =
  | '/'
  | '/explorer'
  | '/le-trajet'
  | '/carte'
  | '/preparatifs'
  | '/mon-voyage'
  | '/mes-envies'
  | '/reglages'
  | '/conseils';

const JETON_ESPACE: Record<RouteEspace, string> = {
  '/': 'var(--espace-le-voyage)',
  '/explorer': 'var(--espace-explorer)',
  '/le-trajet': 'var(--espace-notre-voyage)',
  '/carte': 'var(--espace-carte)',
  '/preparatifs': 'var(--espace-preparatifs)',
  '/mon-voyage': 'var(--espace-mon-voyage)',
  '/mes-envies': 'var(--espace-mes-envies)',
  '/reglages': 'var(--espace-reglages)',
  '/conseils': 'var(--espace-reglages)', // granite, éditorial discret (M174)
};

/** Jeton couleur d'un espace par sa route exacte (pastille d'onglet/menu). Défaut : le voyage. */
export function jetonEspace(route: string): string {
  return JETON_ESPACE[route as RouteEspace] ?? JETON_ESPACE['/'];
}

/**
 * Jeton couleur de l'espace COURANT depuis un pathname (liseré en tête). On prend le préfixe le plus long
 * qui matche (ex. /explorer/12345 → /explorer), sinon la racine.
 */
export function jetonEspaceCourant(pathname: string): string {
  if (pathname === '/') return JETON_ESPACE['/'];
  const routes = (Object.keys(JETON_ESPACE) as RouteEspace[]).filter((r) => r !== '/');
  const match = routes
    .filter((r) => pathname === r || pathname.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? JETON_ESPACE[match] : JETON_ESPACE['/'];
}
