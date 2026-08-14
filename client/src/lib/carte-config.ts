// Configuration partagée des cartes (A20 : « même composant carte partout », fond/centre/palette identiques).
// Le fond OpenFreeMap (CDN, aucun Martin requis), le centre Norvège et la hauteur par défaut sont UNIQUES ;
// les trois vues carto (itinéraire animé, POI de l'Explorer, mini-circuit rando) s'y adossent, pour un viewer
// cohérent. Les couleurs de couches passent par les jetons de charte (cf `ui/theme`), jamais de hex.
export const FOND_CARTE = 'https://tiles.openfreemap.org/styles/positron';
export const CENTRE_NORVEGE = { longitude: 10, latitude: 63, zoom: 3.4 } as const;
export const HAUTEUR_CARTE_DEFAUT = '420px';
