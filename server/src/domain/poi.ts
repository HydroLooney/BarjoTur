// Contrats POI désormais CANONIQUES dans @barjotur/shared (M15) : `CataloguePoi` (api.catalogue) et
// `FeatureCollection` (api.poi_in_bbox). Re-export, plus de type local dupliqué.

export type { CataloguePoi, FeatureCollection, PhotoPoi, PoiDetail, PoiFiche, Reco, RecosReponse } from '@barjotur/shared';
