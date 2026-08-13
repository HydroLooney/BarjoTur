// Carnet de lieux perso (Explorer, T015 / arbitrage #8) : un voyageur ajoute un lieu (provenance « voyageur »,
// confiance basse, tier TSAB provisoire, votable), consulte ses propositions et ses lieux par tier, et signale un POI.
// L'ajout et le signalement sont gatés PIN (corrections/ajouts de POI, A03/M052) ; la lecture non.
//
// Le DTO de SORTIE `CarnetProposition` est canonique dans @barjotur/shared (M024) : on le re-exporte.
// Restent locaux les DTO d'ENTRÉE HTTP (corps de requête), propres au BFF.

export type { CarnetProposition } from '@barjotur/shared';

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
