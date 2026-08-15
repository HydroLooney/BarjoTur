import { useState } from 'react';
import type { Reglage, ValeurReglage } from '@barjotur/shared';
import { CurseurValeur } from '@/ui/primitives/curseur';
import { Bouton } from '@/ui/primitives/button';
import { useEcrireReglage, estReglageNumerique, nombreReglage } from '@/lib/queries/reglages';
import { cn } from '@/lib/utils';

// Une ligne de l'ecran Regler / de l'overlay expert : un parametre du registre, sa valeur active, sa valeur par
// defaut (repli du responsable), son cadre (bornes) et son unite. Curseur + saisie directe LIES (preference
// transverse de Guillaume) quand c'est numerique et editable ; sinon affichage en lecture seule avec la mention
// « reserve » qui dit POURQUOI (capacite manquante). L'ecriture porte le PIN dans le corps (jamais stocke, A03) ;
// le serveur revoit capacite + PIN avant d'ecrire. « Revenir au defaut » repose la valeur du responsable.
interface Props {
  reglage: Reglage;
  /** Vrai si l'utilisateur a la capacite d'editer cette famille (sinon lecture seule verrouillee). */
  editable: boolean;
  /** PIN saisi une fois au niveau du panneau, porte a l'ecriture. Vide = on ne peut pas encore appliquer. */
  pin: string;
  className?: string;
}

export function LigneReglage({ reglage, editable, pin, className }: Props) {
  const ecrire = useEcrireReglage(reglage.famille);
  const numerique = estReglageNumerique(reglage);
  const [enAttente, setEnAttente] = useState<number | null>(null);

  const valeurServeur = numerique ? nombreReglage(reglage.valeur) : null;
  const valeurCourante = enAttente ?? valeurServeur ?? 0;
  const defautNum = numerique ? nombreReglage(reglage.valeur_defaut) : null;
  const modifie = valeurServeur != null && valeurCourante !== valeurServeur;
  const pasDeDefaut = defautNum != null && valeurCourante === defautNum;

  const appliquer = (valeur: ValeurReglage) => {
    ecrire.mutate({ cle: reglage.cle, valeur, pin });
  };

  return (
    <div className={cn('space-y-2 border-t border-border py-3 first:border-t-0 first:pt-0', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">{reglage.libelle ?? reglage.cle}</span>
        <span className="text-xs text-muted-foreground">
          défaut&nbsp;
          <span className="chiffres">{String(reglage.valeur_defaut)}</span>
          {reglage.unite ? ` ${reglage.unite}` : ''}
        </span>
      </div>

      {numerique && editable ? (
        <>
          <CurseurValeur
            valeur={valeurCourante}
            onChange={setEnAttente}
            min={reglage.bornes?.min ?? 0}
            max={reglage.bornes?.max ?? 100}
            step={reglage.bornes?.pas ?? 1}
            suffixe={reglage.unite}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Bouton
              size="sm"
              variant="outline"
              disabled={!modifie || pin.trim().length === 0 || ecrire.isPending}
              onClick={() => appliquer(valeurCourante)}
            >
              {ecrire.isPending ? 'Enregistrement…' : 'Appliquer'}
            </Bouton>
            {defautNum != null ? (
              <Bouton
                size="sm"
                variant="ghost"
                disabled={pasDeDefaut}
                onClick={() => setEnAttente(defautNum)}
              >
                Revenir au défaut
              </Bouton>
            ) : null}
            {modifie && pin.trim().length === 0 ? (
              <span className="text-xs text-muted-foreground">Saisissez le PIN pour appliquer.</span>
            ) : null}
            {ecrire.isSuccess && !modifie ? (
              <span className="text-xs text-accent" role="status">
                Enregistré.
              </span>
            ) : null}
            {ecrire.isError ? (
              <span className="text-xs text-destructive" role="status">
                Refusé (droit ou PIN).
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="chiffres text-sm">
            {String(reglage.valeur)}
            {reglage.unite ? ` ${reglage.unite}` : ''}
          </span>
          {!editable ? (
            <span className="text-xs text-muted-foreground">Réservé au responsable de ce réglage.</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
