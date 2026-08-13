// Carnet de lieux perso (Explorer, T015 / arbitrage #8) : un voyageur ajoute un lieu (provenance « voyageur »,
// confiance basse, tier TSAB provisoire, votable), consulte ses propositions et ses lieux par tier, et signale un POI.
// L'ajout et le signalement sont gatés PIN (corrections/ajouts de POI, A03/M052) ; la lecture non.
//
// Types locaux au BFF (DTO d'entrée + passe-plat de sortie). À canoniser dans @barjotur/shared/poi.ts si le front
// en a besoin (demande à poser à M le cas échéant).

/** Corps validé d'un ajout de lieu voyageur (api.ajouter_poi). */
export interface AjoutPoiInput {
  pin: string;
  nom: string;
  lon: number;
  lat: number;
  categorie: string | null;
  sous_categorie: string | null;
  presentation: string | null;
}

/** Corps validé d'un signalement de POI (api.signaler). */
export interface SignalInput {
  osm_id: string;
  motif: string;
  commentaire: string | null;
}
