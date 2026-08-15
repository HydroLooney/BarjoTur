// Base d'URL des médias photo (B127). En DEV : serveur média local (localhost:8088). Au GO LIVE : `/media/` (statique
// ou CDN derrière le proxy), MÊME arborescence `poi/**/photos/` → seule cette constante change, zéro re-câblage.
// L'URL d'une image = MEDIA_BASE + `chemin` du manifeste (champ `photos[].chemin` de GET /api/poi/:cle).
const MEDIA_BASE = 'http://localhost:8088/';

/** URL absolue d'un média à partir du `chemin` du manifeste. `null` si pas de chemin. */
export function urlMedia(chemin: string | null | undefined): string | null {
  if (!chemin) return null;
  return MEDIA_BASE + chemin.replace(/^\/+/, '');
}
