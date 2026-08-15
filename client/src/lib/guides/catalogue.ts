// Catalogue des guides (M166/M167/M168/M177). CONTENU, séparé du mécanisme : les textes sont ici (données), pas
// en dur dans le composant `GuideEcran` — on les relit/ajuste sans toucher au code de rendu.
// SOURCE humaine : `documentation/guides-scripts.md` (transcription fidèle ; à terme un script de build pourra
// régénérer ce module depuis le markdown, pour éditer la seule source .md). Un texte UNIQUE par annotation
// (M168) : la direction de flèche portée ici est la direction NOMINALE ; le montage peut l'adapter par appareil.
// Une annotation dont la cible n'existe pas encore dans l'app n'apparaît pas (GuideEcran ignore les cibles
// absentes du DOM) : c'est la règle « à venir » du catalogue, tenue automatiquement.

export type DirectionFleche = 'haut' | 'bas' | 'gauche' | 'droite';

/** Rôle requis pour voir une annotation. Absent = visible par tous. Filtre invité (M168). */
export type RoleGuide = 'voyageur' | 'organisateur';

export interface Annotation {
  /** Clé stable de la cible (attribut `data-guide` posé sur l'élément ancré). */
  cible: string;
  /** La ligne qui s'affiche sur le voile. Une phrase, concrète. */
  texte: string;
  /** Direction nominale de la flèche vers la cible. */
  fleche: DirectionFleche;
  /** Si présent, l'annotation n'est montrée qu'au rôle qui la porte (vote/compose masqués à l'invité). */
  role?: RoleGuide;
}

/** Clé d'espace, alignée sur les routes de l'app. */
export type EspaceGuide =
  | 'le-voyage'
  | 'explorer'
  | 'mes-envies'
  | 'mon-voyage'
  | 'notre-voyage'
  | 'carte'
  | 'preparatifs'
  | 'reglages';

const ESPACE_PAR_ROUTE: Record<string, EspaceGuide> = {
  '/': 'le-voyage',
  '/explorer': 'explorer',
  '/mes-envies': 'mes-envies',
  '/mon-voyage': 'mon-voyage',
  '/le-trajet': 'notre-voyage',
  '/carte': 'carte',
  '/preparatifs': 'preparatifs',
  '/agenda': 'preparatifs',
  '/reglages': 'reglages',
  // Vues carto/backstage rattachées à leur espace parent (le « ? » y montre l'aide de l'espace le plus proche).
  '/coulisses': 'reglages',
};

/** Espace-guide de la route courante (préfixe le plus long, ex. /explorer/12 → explorer). Défaut : le voyage. */
export function espaceGuideDepuisRoute(pathname: string): EspaceGuide {
  if (pathname === '/') return 'le-voyage';
  const routes = Object.keys(ESPACE_PAR_ROUTE).filter((r) => r !== '/');
  const match = routes
    .filter((r) => pathname === r || pathname.startsWith(`${r}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? ESPACE_PAR_ROUTE[match]! : 'le-voyage';
}

// --- Section 1 : la légende de chaque écran (toutes les annotations d'un espace, montrées d'un coup) ---
export const LEGENDES: Record<EspaceGuide, Annotation[]> = {
  'le-voyage': [
    { cible: 'fil-crans', texte: 'Ton voyage se lit ici, de l’idée au départ.', fleche: 'bas' },
    { cible: 'fil-cran', texte: 'Touche un moment pour aller y travailler.', fleche: 'bas' },
    { cible: 'fil-cadenas', texte: 'Ouvert, ça se change encore ; fermé, c’est décidé pour de bon.', fleche: 'haut' },
    { cible: 'bandeau', texte: 'Il te rappelle où on en est, même après une pause.', fleche: 'bas' },
    { cible: 'avatar', texte: 'Ton profil, tes envies et Mon voyage sont là.', fleche: 'droite' },
    { cible: 'barre-bas', texte: 'Reviens ici à tout moment.', fleche: 'bas' },
  ],
  explorer: [
    { cible: 'bascule-vue', texte: 'Passe de la liste à la carte, ce sont les mêmes lieux.', fleche: 'haut' },
    { cible: 'boutons-avis', texte: 'Ici tu votes en un geste : Coup de cœur, Vraiment envie, Bien, Pourquoi pas.', fleche: 'haut', role: 'voyageur' },
    { cible: 'recherche', texte: 'Tape un nom pour retrouver un lieu tout de suite.', fleche: 'haut' },
    { cible: 'filtres', texte: 'Resserre la liste : par genre de lieu, par réputation, ou tes lieux à noter.', fleche: 'haut' },
    { cible: 'chip-jour', texte: 'N’affiche que les lieux de la région où tu seras ce jour-là.', fleche: 'haut' },
    { cible: 'recos', texte: 'Quatre sélections toutes prêtes, avec le pourquoi de chacune.', fleche: 'bas' },
    { cible: 'avatar', texte: 'Ton profil, tes envies et Mon voyage sont là.', fleche: 'droite' },
    { cible: 'barre-bas', texte: 'Reviens ici à tout moment.', fleche: 'bas' },
  ],
  'mes-envies': [
    { cible: 'curseurs', texte: 'Dis le genre de voyage que tu veux : calme ou intense, nature ou culture, la part du paysage.', fleche: 'haut' },
    { cible: 'affiner', texte: 'Des réglages plus fins, à ouvrir si tu veux, à ignorer sinon.', fleche: 'bas' },
    { cible: 'recos', texte: 'Bouge un curseur, elles changent sous tes yeux.', fleche: 'bas' },
    { cible: 'envie-chiffree', texte: 'Fixe un nombre voulu, comme six restaurants ; l’app les placera.', fleche: 'droite' },
    { cible: 'envie-theme', texte: 'Dis à quel point tu aimes la mer, la faune, le patrimoine : l’app donne plus de temps à ces lieux.', fleche: 'droite' },
    { cible: 'boutons-avis', texte: 'Vote sur un lieu ici comme dans Explorer, en quatre crans.', fleche: 'haut', role: 'voyageur' },
    { cible: 'avatar', texte: 'Reviens à ton profil et à Mon voyage.', fleche: 'droite' },
  ],
  'mon-voyage': [
    { cible: 'bloc-ideal', texte: 'Le voyage que tu ferais tout seul, rien qu’un repère.', fleche: 'droite' },
    { cible: 'bloc-ecart', texte: 'De combien le voyage commun s’éloigne de ton idéal.', fleche: 'droite' },
    { cible: 'curseur-cadence', texte: 'Resserre ou allège tes journées, sans jamais rouler tard le soir.', fleche: 'haut' },
    { cible: 'lien-mes-envies', texte: 'Tes goûts se règlent là-bas ; ici, tu en vois le résultat.', fleche: 'droite' },
  ],
  'notre-voyage': [
    { cible: 'voyage-commun', texte: 'Le voyage de la famille, raconté jour après jour.', fleche: 'bas' },
    { cible: 'composer', texte: 'L’organisateur demande à l’app d’assembler tout le voyage d’un coup.', fleche: 'haut', role: 'organisateur' },
    { cible: 'mon-ecart', texte: 'Ce que ce voyage te fait gagner et ce qu’il te fait céder.', fleche: 'droite' },
    { cible: 'ecarts-autres', texte: 'Déplie-les pour comprendre un choix, le tien d’abord.', fleche: 'bas' },
    { cible: 'comparateur', texte: 'Un autre itinéraire, chiffré face au voyage retenu : nuits, kilomètres, euros.', fleche: 'bas' },
    { cible: 'temps-sur-place', texte: 'Allonge ou raccourcis le temps passé à un endroit.', fleche: 'droite', role: 'organisateur' },
    { cible: 'reservation', texte: 'Épingle l’endroit réservé ; l’app recale le voyage autour.', fleche: 'bas' },
    { cible: 'date-qui-compte', texte: 'Marque un jour important, un anniversaire ; il s’affiche en étoile.', fleche: 'bas' },
  ],
  carte: [
    { cible: 'trace-anime', texte: 'L’itinéraire se déroule dans l’ordre du voyage, jour après jour.', fleche: 'bas' },
    { cible: 'fil-perles', texte: 'Une perle par séjour ; déplie-la pour voir ses journées.', fleche: 'haut' },
    { cible: 'agenda-jour', texte: 'La journée regardée grossit, ses voisines se réduisent.', fleche: 'haut' },
    { cible: 'choix-vue', texte: 'En surimpression sur la carte, ou en plein écran comme un carnet.', fleche: 'droite' },
    { cible: 'traversees', texte: 'Les passages en ferry se distinguent du reste du tracé.', fleche: 'droite' },
    { cible: 'barre-bas', texte: 'Reviens ici à tout moment.', fleche: 'bas' },
  ],
  preparatifs: [
    { cible: 'onglets', texte: 'Tout le concret rangé : le budget, puis les réservations.', fleche: 'haut' },
    { cible: 'budget-poste', texte: 'Où part l’argent : van, carburant, hébergement, ferries, le reste.', fleche: 'droite' },
    { cible: 'fourchette', texte: 'Du plus serré au plus large, par adulte.', fleche: 'droite' },
    { cible: 'curseur-marge', texte: 'Ajoute un coussin de sécurité ; c’est lui qui ouvre la fourchette.', fleche: 'haut' },
    { cible: 'postes-fermes', texte: 'Le van et la grande traversée sont payés : ces chiffres ne bougent plus.', fleche: 'droite' },
    { cible: 'marquer-reservation', texte: 'Un lieu réel et une date, et l’étape devient un point fixe.', fleche: 'droite' },
  ],
  reglages: [
    { cible: 'profils-deplacement', texte: 'Comment on roule et on marche, pour que l’app trace juste.', fleche: 'droite' },
    { cible: 'reglages-fins', texte: 'Chaque réglage avec sa valeur, celle conseillée, et le pourquoi en clair.', fleche: 'bas' },
    { cible: 'theme', texte: 'Passe l’app en sombre le soir, dans le van.', fleche: 'haut' },
    { cible: 'lien-glossaire', texte: 'Le sens court de chaque mot de l’app.', fleche: 'bas' },
  ],
};
