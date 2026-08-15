// Routes carto (M272 §3) : métadonnées légères pour le flip de C (légende des calques, hiérarchie de découpage). La
// géométrie vient de Martin (tuiles MVT). LECTURE seule, passe-plats flip-ready (vues de diffusion v3 d'A, Passe 2) :
// tant que les vues n'existent pas, les services rendent 200 vide (dégradation), jamais 500.

import { Router } from 'express';
import { asyncHandler } from '../middleware/erreurs.js';
import { ok } from '../http/envelope.js';
import {
  validerNiveau,
  lireCalques,
  lireDecoupage,
  lireSentiersDifficultes,
  lireCircuitsCarto,
  lireBasesCarto,
  lireCartoPoiGeojson,
  lireCartoDecoupageGeojson,
  lireCartoServicesVanGeojson,
  lireCartoRoutesSceniquesGeojson,
  lireCartoSentiersGeojson,
  lireCartoCircuitsGeojson,
  lireCartoBasesGeojson,
} from '../services/carto.js';

export const routesCarto = Router();

// Couches GeoJSON (M367) : carto de PRODUCTION servie depuis DB2 (v_web_*), plus de statique. FeatureCollection ; en dev
// (vues absentes) → FC vide (même contrat qu'en prod, zéro re-câblage C au flip).
routesCarto.get('/carto/poi', asyncHandler(async (_req, res) => res.json(ok(await lireCartoPoiGeojson()))));
routesCarto.get('/carto/decoupage-geo', asyncHandler(async (_req, res) => res.json(ok(await lireCartoDecoupageGeojson()))));
routesCarto.get('/carto/services-van', asyncHandler(async (_req, res) => res.json(ok(await lireCartoServicesVanGeojson()))));
routesCarto.get('/carto/routes-sceniques', asyncHandler(async (_req, res) => res.json(ok(await lireCartoRoutesSceniquesGeojson()))));
routesCarto.get('/carto/sentiers-geo', asyncHandler(async (_req, res) => res.json(ok(await lireCartoSentiersGeojson()))));
// Circuits + bases idéales en GeoJSON (M410/C139) : C retire ses DERNIERS statiques. Vues au dump final → FC vide d'ici là.
routesCarto.get('/carto/circuits-geo', asyncHandler(async (_req, res) => res.json(ok(await lireCartoCircuitsGeojson()))));
routesCarto.get('/carto/bases-geo', asyncHandler(async (_req, res) => res.json(ok(await lireCartoBasesGeojson()))));

// Légende / filtre par catégorie de calque (buckets categorie_calque + effectifs).
routesCarto.get(
  '/carto/calques',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireCalques()));
  }),
);

// Hiérarchie de découpage (niveau/id/parent_id/n_poi), filtrable ?niveau=region|zone|sous_zone.
routesCarto.get(
  '/carto/decoupage',
  asyncHandler(async (req, res) => {
    res.json(ok(await lireDecoupage(validerNiveau(req.query))));
  }),
);

// Légende sentiers : buckets de difficulté + effectifs.
routesCarto.get(
  '/carto/sentiers/difficultes',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireSentiersDifficultes()));
  }),
);

// Circuits carto (métadonnées ; géométrie via Martin).
routesCarto.get(
  '/carto/circuits',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireCircuitsCarto()));
  }),
);

// Bases carto (points de nuit ; géométrie via Martin).
routesCarto.get(
  '/carto/bases',
  asyncHandler(async (_req, res) => {
    res.json(ok(await lireBasesCarto()));
  }),
);
