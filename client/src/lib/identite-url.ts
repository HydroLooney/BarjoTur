// Extrait le code de lien d'une URL de la forme /app/<code>/<Prenom>[/...]. Le code identifie le
// voyageur (non secret ; l'autorite reste serveur via whoami). Pur et testable, sans dependance au DOM.
// Retourne null si le segment /app/<code> est absent (ex. en dev a la racine).
export function lireCodeLien(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const i = segments.indexOf('app');
  if (i < 0) return null;
  const code = segments[i + 1];
  return code ? decodeURIComponent(code) : null;
}
