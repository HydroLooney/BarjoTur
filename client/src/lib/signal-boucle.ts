// Signal de boucle (A26 / M112) : ne jamais se perdre dans les allers-retours de la décision collective. Trois
// pièces : ce que le voyage attend de MOI (avis à donner), ce qui a bougé et OÙ (pastilles de nav), et un résumé
// calme de ce qui s'est passé depuis ma dernière visite. L'état réel de collaboration est gaté (serveur) ; ici
// une forme sur fixture. Zéro notification push : tout se lit dans l'app, à mon rythme.
export interface SignalBoucle {
  /** Nombre de lieux qui attendent MON avis (action attendue de moi). */
  avis_attendus: number;
  /** Par route, le nombre de nouveautés (pastille « du nouveau ici » sur la nav). */
  nouveautes: Record<string, number>;
  /** Résumé calme, une ligne par événement, depuis ma dernière visite. */
  depuis_derniere_visite: string[];
}
