import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Map } from '@vis.gl/react-maplibre';
import type { StyleSpecification as StyleSpecCharte } from '@maplibre/maplibre-gl-style-spec';
import { useUi } from '@/stores/ui';
import { URL_GRAYBEARD, URL_NEUTRINO, URL_COLORFUL, styleCharte, type CleFond } from '@/lib/fonds-carte';

// Type exact du `mapStyle` attendu par <Map> (@vis.gl) — évite le heurt entre les copies du style-spec en
// s'alignant sur ce que le composant consomme réellement.
type MapStyle = NonNullable<ComponentProps<typeof Map>['mapStyle']>;

// Résout le fond choisi (store `ui`, partagé par toutes les cartes) en `mapStyle` MapLibre.
//  - graybeard (défaut) et topo  → base graybeard PATCHÉE aux couleurs de la charte (chargée async ; repli URL
//    brute le temps du fetch, donc jamais d'écran gris) ; topo pose EN PLUS la couche raster (cf CoucheTopo).
//  - neutrino / colorful         → style VersaTiles hébergé tel quel (URL).
// Le style perso est rechargé au changement de thème (le patch relit les jetons → fond dark-safe).
export function useStyleFond(): { mapStyle: MapStyle; fond: CleFond } {
  const fond = useUi((s) => s.fondCarte);
  const theme = useUi((s) => s.theme);
  const [perso, setPerso] = useState<StyleSpecCharte | null>(null);

  useEffect(() => {
    let vivant = true;
    styleCharte(theme)
      .then((s) => {
        if (vivant) setPerso(s);
      })
      .catch(() => {
        // Fetch du style échoué : on retombe sur l'URL brute (géré dans le useMemo), pas de crash.
        if (vivant) setPerso(null);
      });
    return () => {
      vivant = false;
    };
  }, [theme]);

  const mapStyle = useMemo<MapStyle>(() => {
    if (fond === 'neutrino') return URL_NEUTRINO;
    if (fond === 'colorful') return URL_COLORFUL;
    // graybeard + topo : base personnalisée charte, repli URL brute pendant le chargement. Le style patché est
    // typé par la copie @maplibre/… du style-spec ; on l'expose au type exact de <Map> (structure identique).
    return (perso as unknown as MapStyle) ?? URL_GRAYBEARD;
  }, [fond, perso]);

  return { mapStyle, fond };
}
