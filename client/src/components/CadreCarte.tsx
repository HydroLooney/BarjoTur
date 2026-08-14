import { Map } from '@vis.gl/react-maplibre';
import type { ComponentProps, ReactNode } from 'react';
import { FOND_CARTE, HAUTEUR_CARTE_DEFAUT } from '@/lib/carte-config';
import { cn } from '@/lib/utils';

// Cadre carte partagé (A20 « même composant carte partout », partie sûre du merge M076). Le SEUL endroit qui
// monte le <Map> (un unique contexte WebGL, A05), avec fond OpenFreeMap + dimensions communs. Les trois vues
// (itinéraire animé, POI de l'Explorer, mini-circuit rando) passent leur vue initiale, leurs handlers et leurs
// sources/calques en enfants ; les calques ABSOLUS en surimpression (frères du canvas, dans le cadre positionné)
// passent par `surimpression`. Le rendu animé du reveal fige.geom vit ENTIER dans les enfants (useMap) et n'est
// pas touché ici : ce shell ne fait qu'unifier props et config, à DOM identique.
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
  children?: ReactNode;
}

export function CadreCarte({
  hauteur = HAUTEUR_CARTE_DEFAUT,
  arrondi = 'lg',
  relatif = true,
  surimpression,
  children,
  ...propsMap
}: Props) {
  return (
    <div
      className={cn(
        'overflow-hidden border border-border',
        relatif && 'relative',
        arrondi === 'md' ? 'rounded-md' : 'rounded-lg',
      )}
      style={{ height: hauteur }}
    >
      <Map mapStyle={FOND_CARTE} style={{ width: '100%', height: '100%' }} {...propsMap}>
        {children}
      </Map>
      {surimpression}
    </div>
  );
}
