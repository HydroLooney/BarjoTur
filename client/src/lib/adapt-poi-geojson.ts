import type { CataloguePoi, Reco } from '@barjotur/shared';
import type { Feature, Geometry } from 'geojson';

// Adapteur RECO → fiche (M379/M426) : ouvrir la FichePOI au clic sur une reco. Le Reco est autoportant (cle, nom, lat,
// lon, sous_zone_id, tier). Le détail/photos arrivent en lazy via `usePoiFiche(cle)`.
export function poiDeReco(r: Reco): CataloguePoi {
  return poiDeGeojson({
    type: 'Feature',
    properties: {
      poi_id: r.cle.replace(/^poi:/, ''),
      osm_id: r.cle.startsWith('poi:') ? undefined : r.cle,
      nom: r.nom,
      tier: r.tier,
      votable: true,
      sous_zone_id: r.sous_zone_id ?? undefined,
    },
    geometry: { type: 'Point', coordinates: [r.lon, r.lat] },
  });
}

// Adapteur GEOJSON → fiche (M375 §3 / M404) : ouvrir la FichePOI IMMÉDIATEMENT au clic sur un marqueur, à partir de ce
// que porte déjà le geojson carto (nom, tier, catégorie, confiance, votable, sous_zone_id…), sans attendre le réseau.
// Le détail rédigé + les photos arrivent en LAZY via `usePoiFiche(id)` (B125). `id` = clé fiche : `poi:<poi_id>` (marche
// pour tous, B125) ou l'osm_id si présent.
export function poiDeGeojson(f: Feature): CataloguePoi {
  const p = (f.properties ?? {}) as Record<string, unknown>;
  const g = f.geometry as { coordinates?: number[] } | null;
  const coords = g && Array.isArray(g.coordinates) ? g.coordinates : [0, 0];
  const lon = coords[0] ?? 0;
  const lat = coords[1] ?? 0;
  const cle = p.osm_id != null ? String(p.osm_id) : `poi:${String(p.poi_id ?? '')}`;
  const categorie = p.categorie != null ? String(p.categorie) : p.categorie_calque != null ? String(p.categorie_calque) : null;
  return {
    id: cle,
    nom: String(p.nom ?? 'Lieu'),
    region: null,
    region_id: null,
    zone_id: null,
    categorie,
    sous_categorie: null,
    score_interet: null,
    score_frequentation: null,
    score_mcda: null,
    temps_visite: null,
    lat,
    lon,
    geometrie: (f.geometry as Geometry) ?? null,
    trace_reelle: null,
    description_a_rediger: null,
    verifie: null,
    tier_defaut: p.tier != null ? String(p.tier) : null,
    tier_defaut_source: null,
    honeypot: null,
    cruise_expose: null,
    payant: null,
    tarif: null,
    saison: null,
    parking: null,
    votable: p.votable === true,
    exclu: null,
    motif_exclusion: null,
    hors_emprise: null,
    presentation: null,
    description: null,
    page_guide: null,
    provenance: null,
    url: null,
    image: null,
    photos: [],
    // Annexes utiles au rendu (index signature) : confiance/sous-zone/fréquentation portées par le geojson.
    confiance: typeof p.confiance === 'number' ? p.confiance : null,
    sous_zone_id: p.sous_zone_id ?? null,
    tres_frequente: p.tres_frequente === true,
    categorie_calque: p.categorie_calque ?? categorie,
  } as CataloguePoi;
}
