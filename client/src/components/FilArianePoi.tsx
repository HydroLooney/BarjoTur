import { useMemo } from 'react';
import type { Feature } from 'geojson';
import { useDecoupageData, libelleNiveau } from '@/lib/decoupage';
import { cn } from '@/lib/utils';

// Fil d'ariane contextuel d'un POI (M381/M388/M419) : sous-titre « Région › District › Paysage ». VALEURS = les
// `nom_affichage` réels du découpage (région/zone/sous-zone), remontés depuis le `sous_zone_id` du POI par `parent_id`.
// Les LIBELLÉS de niveau (Région/District/Paysage, `LIBELLES_NIVEAUX_DECOUPAGE`) restent des mots figés (M388) → portés
// en `title`/aria (accessibilité), pas dans le chemin. `useDecoupageData` est mutualisé (react-query), pas de fetch en trop.
export function FilArianePoi({ sousZoneId, className }: { sousZoneId: string | null | undefined; className?: string }) {
  const dec = useDecoupageData();
  const chemin = useMemo(() => {
    if (!sousZoneId) return null;
    const tous = [...dec.regions, ...dec.zones, ...dec.sousZones] as Feature[];
    const parId = (id: unknown) => (id == null ? undefined : tous.find((f) => String(f.properties?.id) === String(id)));
    const sz = parId(sousZoneId);
    if (!sz) return null;
    const zone = parId(sz.properties?.parent_id);
    const region = parId(zone?.properties?.parent_id);
    const niveaux = [region, zone, sz].filter(Boolean) as Feature[];
    if (!niveaux.length) return null;
    const dernier = niveaux.length - 1; // le Paysage (sous-zone)
    return {
      // POLISH M421 : en contexte BREADCRUMB, on strippe le parenthétique secteur du Paysage (« Skagerrakkysten (Arendal
      // Agder Est) » → « Skagerrakkysten ») car le District juste avant le porte déjà. Le label carte standalone garde le
      // nom_affichage complet (là, pas de chemin, le parenthétique désambiguïse).
      valeurs: niveaux.map((f, i) => {
        const nom = String(f.properties?.nom_affichage ?? f.properties?.id ?? '');
        return i === dernier ? nom.replace(/\s*\([^)]*\)\s*$/, '') : nom;
      }),
      labels: niveaux.map((f) => libelleNiveau(String(f.properties?.niveau ?? ''))),
    };
  }, [sousZoneId, dec.regions, dec.zones, dec.sousZones]);

  if (!chemin) return null;
  return (
    <p className={cn('truncate text-xs text-muted-foreground', className)} title={chemin.labels.join(' › ')}>
      {chemin.valeurs.join(' › ')}
    </p>
  );
}
