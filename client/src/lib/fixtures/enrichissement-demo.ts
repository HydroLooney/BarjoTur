import type { PoiEnrichissement } from '@barjotur/shared';

// Enrichissement de démonstration (A28 / M137 / M151). Contenu RÉEL calé sur le lot 1 du vault (« Enrichissement
// lieux - lot 1 », 37 lieux) : descriptions, « ce qu'il s'en dit » (parole communautaire sourcée), Wikipédia,
// photos Wikimedia avec licence + auteur EXACTS (R1). En démo, chaque fiche reçoit l'un de ces enrichissements
// réels par hash de l'osm_id (variété) ; au flip, le mapping réel par `poi_id` vient d'A. Les photos rendent leur
// attribution + licence ; l'affichage image lui-même est un placeholder sobre en démo, vraies URL au flip.
const REELS: PoiEnrichissement[] = [
  {
    poi_id: 0,
    nom_no: 'Jøssingfjorden',
    description:
      "Route panoramique de petits fjords entre Flekkefjord et Egersund (sud du Rogaland), qui enfile criques, tunnels taillés dans la falaise et hameaux au ras de l'eau. Point fort : le Jøssingfjord, bras étroit de 2,5 km à Sokndal où la route passe sous un surplomb rocheux.",
    ce_qu_il_sen_dit:
      "La liste maître la cote « très recommandée » pour son enfilade de petits fjords. Route de bord de mer qu'on savoure au ralenti, dans une zone géologiquement remarquable (Magma Geopark).",
    wikipedia_url: 'https://no.wikipedia.org/wiki/J%C3%B8ssingfjorden',
    wikipedia_resume:
      "Fjord de 2,5 km à Sokndal (Rogaland), connu pour l'affaire de l'Altmark de 1940, avec Helleren et la Fylkesvei 44 à flanc de falaise.",
    signaux_communaute: [
      { aire_langue: 'scandinave', n_sources: 3, endossement: 0.8, perle: false },
      { aire_langue: 'nl_de', n_sources: 2, endossement: 0.62, perle: false },
      { aire_langue: 'fr_be', n_sources: 1, endossement: 0.5, perle: false },
    ],
    provenance: [{ canal: 'communaute', source: 'signal maître par lieu', n_sources: 6 }],
    photos: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/1/11/Norway_Rogaland_J%C3%B8ssingfjord_overview.JPG',
        source: 'Wikimedia Commons',
        licence: 'CC BY-SA 3.0',
        attribution: 'Gunleiv Hadland',
        legende: "Vue d'ensemble du fjord",
      },
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/f/f1/J%C3%B8ssingfjord%2C_Sokndal.jpg',
        source: 'Wikimedia Commons',
        licence: 'CC BY-SA 4.0',
        attribution: 'CathrineJS',
        legende: 'Le fjord et la route',
      },
    ],
  },
  {
    poi_id: 0,
    nom_no: 'Norangsdalen',
    description:
      "L'une des vallées les plus étroites et atmosphériques de Norvège (Sunnmøre), qui relie Hellesylt au Hjørundfjord via le hameau d'Øye. Parois abruptes, éboulis, petits lacs dont le Lygnstøylsvatnet et ses restes d'un hameau englouti en 1908.",
    ce_qu_il_sen_dit:
      "Décrite comme « l'une des vallées les plus étroites et les plus riches, en paysages comme en mémoire culturelle » (Fjord Norway). Øye « semble appartenir à une autre époque ».",
    wikipedia_url: 'https://no.wikipedia.org/wiki/Norangsdalen',
    wikipedia_resume: 'Vallée des communes d\'Ørsta et Stranda (Møre og Romsdal).',
    signaux_communaute: [
      { aire_langue: 'scandinave', n_sources: 2, endossement: 0.7, perle: true },
      { aire_langue: 'anglophone', n_sources: 2, endossement: 0.66, perle: true },
    ],
    provenance: [{ canal: 'communaute', source: 'signal maître par lieu', n_sources: 4 }],
    photos: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Norangsdalen_003.jpg',
        source: 'Wikimedia Commons',
        licence: 'CC BY-SA 4.0',
        attribution: 'Sundgot',
        legende: 'La vallée étroite',
      },
    ],
  },
  {
    poi_id: 0,
    nom_no: 'Runde',
    description:
      "Île du Sunnmøre reliée au continent par un pont depuis 1982. La montagne aux oiseaux la plus connue de Norvège : de fin avril à fin juillet, ses falaises accueillent plusieurs centaines de milliers d'oiseaux de mer, dont une colonie de macareux.",
    ce_qu_il_sen_dit:
      "Cotée « très recommandée » et citée par les CINQ aires linguistiques (concordance maximale). Réputée pour les macareux et l'ambiance de bout du monde, accessible sans bateau grâce au pont.",
    wikipedia_url: 'https://en.wikipedia.org/wiki/Runde',
    wikipedia_resume:
      'Île de la commune de Herøy (Møre og Romsdal), reliée par un pont ; célèbre colonie d\'oiseaux de mer.',
    signaux_communaute: [
      { aire_langue: 'scandinave', n_sources: 4, endossement: 0.85, perle: false },
      { aire_langue: 'nl_de', n_sources: 3, endossement: 0.75, perle: false },
      { aire_langue: 'anglophone', n_sources: 3, endossement: 0.78, perle: false },
      { aire_langue: 'fr_be', n_sources: 2, endossement: 0.6, perle: false },
      { aire_langue: 'russophone', n_sources: 1, endossement: 0.5, perle: false },
    ],
    provenance: [{ canal: 'communaute', source: 'signal maître par lieu', n_sources: 13 }],
    photos: [
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/c/c9/The_Island_of_Runde.jpg',
        source: 'Wikimedia Commons',
        licence: 'CC BY 2.0',
        attribution: 'Bernt Sønvisen',
        legende: "L'île",
      },
      {
        url: 'https://upload.wikimedia.org/wikipedia/commons/7/75/Runde_birds.jpg',
        source: 'Wikimedia Commons',
        licence: 'CC BY 2.0',
        attribution: 'Ranveig',
        legende: 'Oiseaux de mer sur les falaises',
      },
    ],
  },
];

/** Hash déterministe simple d'un osm_id vers un index (variété en démo, sans dépendre de Math.random). */
function indexDe(osmId: string): number {
  let h = 0;
  for (let i = 0; i < osmId.length; i += 1) h = (h * 31 + osmId.charCodeAt(i)) >>> 0;
  return h % REELS.length;
}

/** Enrichissement d'un lieu (démo, contenu RÉEL du lot 1). Au flip, mapping réel par `poi_id` (A). */
export function enrichissementDemo(osmId: string): PoiEnrichissement {
  return REELS[indexDe(osmId)] as PoiEnrichissement;
}
