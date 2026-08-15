// Section Conseils (T056), content-driven : la source de vérité est `documentation/conseils/*.md` (rédaction de
// Guillaume, HORS client/, M198 opt.A). On la bundle via import.meta.glob ?raw (eager:false → chargée à la
// demande, hors bundle principal), sans jamais copier le contenu. Le titre et l'ordre se lisent du nom de fichier
// (« 01 - Sortir de la foule.md ») pour l'index, sans charger le corps ; le corps se charge à l'ouverture d'une page.

const fichiers = import.meta.glob('../../../documentation/conseils/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>;

/** Nom de fichier nu depuis un chemin de glob (« .../01 - Sortir de la foule.md » → « 01 - Sortir de la foule »). */
function nomBase(chemin: string): string {
  const dernier = chemin.split('/').pop() ?? chemin;
  return dernier.replace(/\.md$/i, '');
}

/** Ordre de tête (« 01 - … » → 1) ; 999 si absent, pour ne jamais casser le tri. */
function ordreDe(nom: string): number {
  const m = nom.match(/^(\d+)\s*-\s*/);
  return m ? Number(m[1]) : 999;
}

/** Titre lisible : on retire le préfixe d'ordre (« 01 - Sortir de la foule » → « Sortir de la foule »). */
function titreDe(nom: string): string {
  return nom.replace(/^\d+\s*-\s*/, '').trim();
}

/** Slug d'URL sans accents (« Sortir de la foule » → « sortir-de-la-foule »). */
export function slugConseil(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface ConseilMeta {
  slug: string;
  ordre: number;
  titre: string;
  /** Charge le corps markdown brut à la demande. */
  charger: () => Promise<string>;
}

// Tous les conseils, triés par ordre. Le fichier « 00 - … » est l'intro (ordre 0) ; les 5 autres sont les pages.
const TOUS: ConseilMeta[] = Object.entries(fichiers)
  .map(([chemin, charger]) => {
    const nom = nomBase(chemin);
    const titre = titreDe(nom);
    return { slug: slugConseil(titre), ordre: ordreDe(nom), titre, charger };
  })
  .sort((a, b) => a.ordre - b.ordre);

/** L'intro (ordre 0) si elle existe. */
export const INTRO_CONSEIL: ConseilMeta | undefined = TOUS.find((c) => c.ordre === 0);

/** Les pages de conseil (hors intro), dans l'ordre. */
export const PAGES_CONSEIL: ConseilMeta[] = TOUS.filter((c) => c.ordre !== 0);

/** Retrouve une page par slug (intro comprise). */
export function conseilParSlug(slug: string): ConseilMeta | undefined {
  return TOUS.find((c) => c.slug === slug);
}

/**
 * Réécrit un lien interne de conseil (« 01 - Sortir de la foule.md ») en route d'app (« /conseils/sortir-de-la-foule »).
 * Renvoie null si ce n'est pas un lien de fichier .md (lien externe ou ancre : laissé tel quel par l'appelant).
 */
export function routeDepuisLienMd(href: string): string | null {
  if (!/\.md($|#|\?)/i.test(href)) return null;
  const nom = nomBase(decodeURIComponent(href.split(/[#?]/)[0] ?? href));
  return `/conseils/${slugConseil(titreDe(nom))}`;
}
