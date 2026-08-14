import { useEffect, useRef } from 'react';
import { useIdentite } from '@/stores/identite';
import { useMemoireExploration } from '@/stores/memoire-exploration';
import { useCollections } from '@/stores/collections';
import { useIntendance } from '@/stores/intendance';
import {
  useCollectionServeur,
  useEcrireCollection,
  useExplorationServeur,
  useMarquerExploration,
} from '@/lib/queries/memoire';

// Sync mémoire perso flip-ready (M033). Gated par un DRAPEAU `live` (comme compose-launch) : à false, hook
// inerte (aucun appel réseau) ; à true, hydratation serveur au montage + push idempotent au changement.
// On bascule à la montée du BFF (VITE_SYNC_LIVE=1, ou `?sync` en DEV pour tester sans rebuild).
//
// Politique de fusion (documentée, R1) :
//  - exploration : UNION non destructive (le local et le serveur se complètent) ;
//  - collections / intendance : le serveur GAGNE s'il existe déjà (blob versionné, source de vérité) ; s'il
//    est absent (contenu null), le local est préservé et le premier changement l'amorce au serveur.
const SYNC_LIVE_ENV = import.meta.env.VITE_SYNC_LIVE === '1';
const CLE_COLLECTIONS = 'collections';
const CLE_INTENDANCE = 'intendance';

export function useSyncMemoire(): void {
  const forceSync = import.meta.env.DEV && new URLSearchParams(window.location.search).has('sync');
  const live = SYNC_LIVE_ENV || forceSync;
  const code = useIdentite((s) => s.code);
  const actif = live && !!code;

  // Lectures serveur (hydratation) ; `enabled` gate l'appel réseau.
  const exploration = useExplorationServeur(code, actif);
  const collectionServeur = useCollectionServeur(code, CLE_COLLECTIONS, actif);
  const intendanceServeur = useCollectionServeur(code, CLE_INTENDANCE, actif);

  // Écritures serveur (push idempotent).
  const marquer = useMarquerExploration(code);
  const ecrireCollections = useEcrireCollection(code, CLE_COLLECTIONS);
  const ecrireIntendance = useEcrireCollection(code, CLE_INTENDANCE);

  // Actions d'hydratation des stores.
  const fusionnerExploration = useMemoireExploration((s) => s.fusionnerServeur);
  const remplacerCollections = useCollections((s) => s.remplacer);
  const remplacerIntendance = useIntendance((s) => s.remplacer);

  // Valeurs locales observées (pour pousser au changement).
  const explores = useMemoireExploration((s) => s.explores);
  const collections = useCollections((s) => s.collections);
  const recettes = useIntendance((s) => s.recettes);
  const menus = useIntendance((s) => s.menus);
  const materiel = useIntendance((s) => s.materiel);

  // Gardes anti-boucle : on ne pousse qu'après hydratation, et on mémorise ce qui est déjà au serveur.
  const hydrateExp = useRef(false);
  const dejaAuServeur = useRef<Set<string>>(new Set());
  const hydrateCol = useRef(false);
  const dernierCol = useRef<string | null>(null);
  const hydrateInten = useRef(false);
  const dernierInten = useRef<string | null>(null);

  // Hydratation exploration (union).
  useEffect(() => {
    if (!actif || hydrateExp.current || !exploration.data) return;
    const ids = exploration.data.marques.map((m) => m.osm_id);
    dejaAuServeur.current = new Set(ids);
    fusionnerExploration(ids);
    hydrateExp.current = true;
  }, [actif, exploration.data, fusionnerExploration]);

  // Hydratation collections (serveur gagne s'il existe).
  useEffect(() => {
    if (!actif || hydrateCol.current || !collectionServeur.data) return;
    const c = collectionServeur.data.contenu;
    if (c && typeof c === 'object') {
      remplacerCollections(c as Record<string, string[]>);
      dernierCol.current = JSON.stringify(c);
    }
    hydrateCol.current = true;
  }, [actif, collectionServeur.data, remplacerCollections]);

  // Hydratation intendance (serveur gagne s'il existe).
  useEffect(() => {
    if (!actif || hydrateInten.current || !intendanceServeur.data) return;
    const c = intendanceServeur.data.contenu as
      | { recettes?: unknown; menus?: unknown; materiel?: unknown }
      | null;
    if (c && typeof c === 'object' && Array.isArray(c.recettes) && Array.isArray(c.menus) && Array.isArray(c.materiel)) {
      const blob = { recettes: c.recettes, menus: c.menus, materiel: c.materiel } as Parameters<typeof remplacerIntendance>[0];
      remplacerIntendance(blob);
      dernierInten.current = JSON.stringify(blob);
    }
    hydrateInten.current = true;
  }, [actif, intendanceServeur.data, remplacerIntendance]);

  // Push exploration : chaque osm_id local pas encore au serveur est marqué (idempotent).
  useEffect(() => {
    if (!actif || !hydrateExp.current) return;
    for (const id of explores) {
      if (!dejaAuServeur.current.has(id)) {
        dejaAuServeur.current.add(id);
        marquer.mutate({ osm_id: id, statut: 'explore' });
      }
    }
  }, [actif, explores, marquer]);

  // Push collections : au changement du blob (après hydratation), écrire.
  useEffect(() => {
    if (!actif || !hydrateCol.current) return;
    const blob = JSON.stringify(collections);
    if (blob === dernierCol.current) return;
    dernierCol.current = blob;
    ecrireCollections.mutate(collections);
  }, [actif, collections, ecrireCollections]);

  // Push intendance : au changement du blob (après hydratation), écrire.
  useEffect(() => {
    if (!actif || !hydrateInten.current) return;
    const blob = JSON.stringify({ recettes, menus, materiel });
    if (blob === dernierInten.current) return;
    dernierInten.current = blob;
    ecrireIntendance.mutate({ recettes, menus, materiel });
  }, [actif, recettes, menus, materiel, ecrireIntendance]);
}
