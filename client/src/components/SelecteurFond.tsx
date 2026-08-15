import { useState } from 'react';
import { useUi } from '@/stores/ui';
import { FONDS } from '@/lib/fonds-carte';
import { cn } from '@/lib/utils';

// Sélecteur de fond (DOCTRINE-CARTO §2 : sur TOUTES les cartes). REPLIABLE et DISCRET (fix Guillaume M239) : au
// repos, une petite puce effacée qui montre le fond courant ; au clic, la rangée des 4 fonds se déploie ; choisir
// un fond l'applique et replie. La carte est la vedette, le contrôle s'efface. Choix partagé par toutes les cartes
// (store `ui`). Zéro hex.

export function SelecteurFond({ className }: { className?: string }) {
  const fond = useUi((s) => s.fondCarte);
  const setFond = useUi((s) => s.setFondCarte);
  const [ouvert, setOuvert] = useState(false);
  const courant = FONDS.find((f) => f.cle === fond) ?? FONDS[0]!;

  if (!ouvert) {
    // Replié : puce discrète (petit, effacé au repos, net au survol).
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        title="Choisir le fond de carte"
        className={cn(
          // Replié = DISCRET mais PRÉSENT (M289) : fond assez opaque + liseré + ombre, trouvable et cliquable du
          // premier coup ; plein contraste au survol.
          'inline-flex items-center gap-1 rounded-full border border-border bg-card/95 px-2.5 py-1 text-micro font-medium text-muted-foreground shadow-posee backdrop-blur-sm transition-colors duration-court hover:bg-card hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          className,
        )}
      >
        <span aria-hidden>◍</span>
        {courant.libelle}
      </button>
    );
  }

  // Déplié : la rangée des 4 fonds.
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-flottante',
        className,
      )}
      role="radiogroup"
      aria-label="Fond de carte"
    >
      {FONDS.map((f) => {
        const actif = f.cle === fond;
        return (
          <button
            key={f.cle}
            type="button"
            role="radio"
            aria-checked={actif}
            title={f.aide}
            onClick={() => {
              setFond(f.cle);
              setOuvert(false);
            }}
            className={cn(
              'min-h-[2rem] rounded-full px-2.5 text-micro font-medium transition-colors duration-court',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              actif ? 'bg-primary text-primary-foreground' : 'text-foreground/75 hover:bg-muted hover:text-foreground',
            )}
          >
            {f.libelle}
          </button>
        );
      })}
    </div>
  );
}
