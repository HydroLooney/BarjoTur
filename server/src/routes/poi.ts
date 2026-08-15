// Routes POI (Explorer, T015) : catalogue votable et requête d'emprise. Minces. Aucun SQL ici.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import { parseBbox, lireCatalogue, lirePoiDansEmprise, lireRecos, lirePoiFiche, validerCle } from '../services/poi.js';
import { exigerParam } from '../http/params.js';

export const routesPoi = Router();

// Recos personnalisées du voyageur (M380/M379) : top-N POI par sa valeur/appétit. Demandeur = :code (whoami côté RPC).
routesPoi.get(
  '/recos/:code',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireRecos(exigerParam(req, 'code'))));
  }),
);

// Catalogue des POI votables (488).
routesPoi.get(
  '/catalogue',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireCatalogue()));
  }),
);

// POI dans une emprise carto : /api/poi/bbox?minlon=&minlat=&maxlon=&maxlat= (défini AVANT /poi/:cle : littéral prioritaire).
routesPoi.get(
  '/poi/bbox',
  asyncHandler(async (req, res) => {
    const bbox = parseBbox(req.query as Record<string, unknown>);
    res.json(ok(await lirePoiDansEmprise(bbox)));
  }),
);

// Fiche POI (M405/A140) : détail + photos, chargée en lazy par C à l'ouverture. :cle = osm_id ou poi:<id>.
routesPoi.get(
  '/poi/:cle',
  asyncHandler(async (req, res) => {
    res.json(ok(await lirePoiFiche(validerCle(exigerParam(req, 'cle')))));
  }),
);
