// Esprit de voyage (quiz A11/A12) : les curseurs de préférence d'un voyageur (choix), leur poids, et des cibles.
// Alimente le reward du composeur (au-dessus du tier par défaut). Non gaté PIN (comme le vote, A03).
//
// Types locaux au BFF (DTO d'entrée + passe-plat de sortie). À canoniser dans @barjotur/shared si le front en a besoin.

/** Carte axe→valeur (ex. { nature: 2.3, effort: 4.7 }). */
export type CarteAxes = Record<string, number>;

/** Corps validé de PUT esprit (api.set_esprit). Sections absentes = null (la RPC ne les écrase pas). */
export interface EspritInput {
  choix: CarteAxes | null;
  poids: CarteAxes | null;
  cibles: CarteAxes | null;
}
