// Configuration partagée des cartes (A20 : « même composant carte partout », fond/centre/palette identiques).
// Fond = VersaTiles `graybeard` (M219, tranché par Guillaume) : gris doux, data-forward, libre (OSM, CC0, SANS
// clé API, auto-hébergeable au déploiement) — sobriété voulue pour que le découpage et les bases RESSORTENT
// (l'ancien OpenFreeMap/OSM était label-lourd et bruité). Un seul point : toutes les cartes en héritent via
// CadreCarte. Les couleurs des couches de DONNÉES passent par les jetons de charte (cf `ui/theme`), jamais de hex.
export const FOND_CARTE = 'https://tiles.versatiles.org/assets/styles/graybeard/style.json';
export const CENTRE_NORVEGE = { longitude: 10, latitude: 63, zoom: 3.4 } as const;
export const HAUTEUR_CARTE_DEFAUT = '420px';
