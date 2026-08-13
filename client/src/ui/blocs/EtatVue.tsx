import type { ReactNode } from 'react';

// EtatVue (C-19) : socle unique des etats non-nominaux d'une vue (chargement, vide, erreur).
// Objectif accessibilite : annoncer le chargement aux lecteurs d'ecran (role=status, aria-live),
// donner une sortie lisible et honnete quand le service n'est pas branche (R1), et rester dark-safe
// (aucun hex : uniquement des jetons semantiques). A reutiliser partout plutot que des <p> ad hoc.

// Squelette de chargement : bloc gris anime, annonce polie pour lecteur d'ecran.
export function Chargement({ libelle = 'Chargement en cours.' }: { libelle?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">{libelle}</span>
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted motion-reduce:animate-none" aria-hidden="true" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-muted motion-reduce:animate-none" aria-hidden="true" />
    </div>
  );
}

// Etat vide : aucune donnee a montrer, mais le service repond. Ton neutre, pas d'alerte.
export function MessageVide({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

// Etat d'erreur : le service n'est pas joignable ou a echoue. On le dit franchement (R1),
// sans dramatiser. role=status (pas alert) car ce n'est pas une urgence a interrompre.
export function MessageErreur({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {children}
    </p>
  );
}
