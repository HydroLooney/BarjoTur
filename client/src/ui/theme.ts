// Resout un jeton de charte en valeur calculee, pour les styles de couches MapLibre
// (qui n'acceptent pas les variables CSS). SOURCE UNIQUE : ui/tokens.css.
// Regle R03 : aucune valeur hex ne vit dans le JS ; on lit toujours le jeton, y compris
// pour la carto, ce qui garde le darkmode coherent (la couche relit le jeton au changement de theme).
export function charte(jeton: string, repli = 'transparent'): string {
  if (typeof document === 'undefined') return repli;
  const nom = jeton.startsWith('var(')
    ? jeton.slice(4, -1).trim()
    : jeton.startsWith('--')
      ? jeton
      : `--${jeton}`;
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  return valeur || repli;
}
