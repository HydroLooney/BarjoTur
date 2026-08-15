// Base d'URL des médias photo (B127). Pilotée par env pour ne JAMAIS coder en dur un localhost dans le build prod
// (C162) : en PROD, défaut same-origin `/media/` (derrière le reverse-proxy de la stack v3, comme `/api`) ; en DEV,
// serveur média local (localhost:8088). Surchargeable par `VITE_MEDIA` (B pose l'URL/route qu'il veut au montage de
// la stack). MÊME arborescence `poi/**/photos/` dans tous les cas → zéro re-câblage. URL image = base + `chemin` du
// manifeste (champ `photos[].chemin` de GET /api/poi/:cle).
const MEDIA_BASE = import.meta.env.VITE_MEDIA ?? (import.meta.env.DEV ? 'http://localhost:8088/' : '/media/');

/** URL absolue d'un média à partir du `chemin` du manifeste. `null` si pas de chemin. */
export function urlMedia(chemin: string | null | undefined): string | null {
  if (!chemin) return null;
  return MEDIA_BASE + chemin.replace(/^\/+/, '');
}
