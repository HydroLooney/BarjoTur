import { Map } from '@vis.gl/react-maplibre';
import type { ComponentProps, ReactNode } from 'react';
import { HAUTEUR_CARTE_DEFAUT } from '@/lib/carte-config';
import { useStyleFond } from '@/lib/useStyleFond';
import { CoucheTopo } from '@/components/CoucheTopo';
import { SelecteurFond } from '@/components/SelecteurFond';
import { cn } from '@/lib/utils';

// Cadre carte partagé (A20 « même composant carte partout », partie sûre du merge M076). Le SEUL endroit qui
// monte le <Map> (un unique contexte WebGL, A05). Il porte désormais le SYSTÈME DE FOND (DOCTRINE-CARTO §2) :
//  - `mapStyle` = fond choisi dans le store `ui`, PERSONNALISÉ aux couleurs de la charte (style graybeard patché),
//    partagé par toutes les cartes ;
//  - la couche topo multi-échelle amortie (CoucheTopo), rendue AVANT les enfants → sous la donnée ;
//  - le sélecteur de fond (SelecteurFond) en coin bas-droit, « sur toutes les cartes » (§2).
// Les trois vues (itinéraire animé, POI de l'Explorer, mini-circuit, coulisses) passent leur vue initiale, leurs
// handlers et leurs sources/calques de DONNÉE en enfants. Le reveal animé fige.geom vit ENTIER dans les enfants
// (useMap) et n'est pas touché ici.
type PropsMap = ComponentProps<typeof Map>;

interface Props extends Omit<PropsMap, 'mapStyle' | 'style'> {
  /** Hauteur du cadre ; le canvas remplit 100 %. */
  hauteur?: string;
  /** Rayon d'arrondi : 'lg' pour les grandes cartes, 'md' pour la mini. */
  arrondi?: 'lg' | 'md';
  /** Contexte de positionnement pour les calques en surimpression (défaut oui). */
  relatif?: boolean;
  /** Calques absolus au-dessus du canvas (légende, panneau au clic, bandeau). */
  surimpression?: ReactNode;
  /** Masque le sélecteur de fond (mini-cartes très contraintes). Défaut : affiché. */
  sansSelecteurFond?: boolean;
  children?: ReactNode;
}

export function CadreCarte({
  hauteur = HAUTEUR_CARTE_DEFAUT,
  arrondi = 'lg',
  relatif = true,
  surimpression,
  sansSelecteurFond = false,
  children,
  ...propsMap
}: Props) {
  const { mapStyle, fond } = useStyleFond();

  return (
    <div
      className={cn(
        'overflow-hidden border border-border',
        relatif && 'relative',
        arrondi === 'md' ? 'rounded-md' : 'rounded-lg',
      )}
      style={{ height: hauteur }}
    >
      <Map mapStyle={mapStyle} style={{ width: '100%', height: '100%' }} {...propsMap}>
        {/* Topo AVANT la donnée : reste sous les aplats/marqueurs, au-dessus du fond vectoriel. */}
        <CoucheTopo fond={fond} />
        {children}
      </Map>
      {surimpression}
      {!sansSelecteurFond ? (
        // Bas-droit ; sur mobile on remonte au-dessus de la barre de nav basse fixe (~45px) pour ne pas la
        // chevaucher (QA T070). Sur desktop (nav en haut) : bas-droit normal.
        <div className="absolute bottom-14 right-2 z-10 sm:bottom-2">
          <SelecteurFond />
        </div>
      ) : null}
    </div>
  );
}
