import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FamilleReglage, Reglage } from '@barjotur/shared';
import { useTousReglages } from '@/lib/queries/reglages';
import { usePeut } from '@/hooks/usePeut';
import { useExpert } from '@/stores/expert';
import { Bouton } from '@/ui/primitives/button';
import { Champ } from '@/ui/primitives/input';
import { LigneReglage } from '@/ui/blocs/LigneReglage';

// Overlay « Reglages de cet ecran » (M343/C131, valide M390). Les parametres experts d'un ecran, appelables SUR cet
// ecran sans aller a Coulisses, via un panneau leger. Il ne montre QUE les reglages dont `ecran ∋ <ecran>` ET que
// l'utilisateur peut deja editer (gating capacite, jamais un droit de plus). Meme source unique que l'ecran Regler :
// on regle, on voit l'effet en place, on ferme. L'affordance ⚙ n'apparait que si le MODE EXPERT est allume et qu'il
// y a au moins un reglage editable pour cet ecran : un voyageur ordinaire ne voit rien, zero complexite imposee.

function useReglagesEcranEditables(ecran: string): Reglage[] {
  const { reglages } = useTousReglages();
  const peutComposition = usePeut('regler_composition');
  const peutConduite = usePeut('regler_conduite');
  const peutProfils = usePeut('regler_profils');
  const editablePar: Record<FamilleReglage, boolean> = {
    composition: peutComposition,
    conduite: peutConduite,
    profils: peutProfils,
    medical: true,
  };
  // editablePar est derive des trois booleens de capacite (stables entre rendus a capacite constante).
  return useMemo(
    () => reglages.filter((r) => editablePar[r.famille] && (r.ecran ?? []).includes(ecran)),
    [reglages, ecran, peutComposition, peutConduite, peutProfils],
  );
}

function PanneauExpert({ ecran, reglages, onClose }: { ecran: string; reglages: Reglage[]; onClose: () => void }) {
  const [pin, setPin] = useState('');

  // Esc ferme (retour immediat au contexte).
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Réglages de l'écran ${ecran}`}>
      {/* Voile discret, cliquable pour fermer. */}
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-granite/40" onClick={onClose} />
      {/* Panneau lateral (web/tablette) qui devient feuille basse au telephone. */}
      <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 shadow-flottante sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-80 sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-section font-medium">Réglages de cet écran</h2>
          <Bouton size="sm" variant="ghost" onClick={onClose} aria-label="Fermer">
            ×
          </Bouton>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          On règle, l'effet se voit ici même. Ce qui se règle ailleurs reste dans l'onglet Régler.
        </p>

        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor={`pin-overlay-${ecran}`} className="text-xs text-muted-foreground">
            PIN pour appliquer
          </label>
          <Champ
            id={`pin-overlay-${ecran}`}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="min-h-tactile w-32"
            placeholder="••••"
          />
        </div>

        <div className="mt-3">
          {reglages.map((r) => (
            <LigneReglage key={r.cle} reglage={r} editable pin={pin} />
          ))}
        </div>

        <Link to="/reglages?volet=regler" className="mt-4 inline-block text-sm text-accent hover:underline" onClick={onClose}>
          Tout régler dans Coulisses →
        </Link>
      </div>
    </div>
  );
}

/**
 * A poser sur un ecran qui porte des parametres experts (carte, composeur, budget…). Rend l'affordance ⚙ (gatee
 * mode expert + presence d'au moins un reglage editable) et le panneau. Autonome : aucun cablage cote page hote.
 */
export function AffordanceExpert({ ecran, className }: { ecran: string; className?: string }) {
  const modeExpert = useExpert((s) => s.modeExpert);
  const reglages = useReglagesEcranEditables(ecran);
  const [ouvert, setOuvert] = useState(false);

  if (!modeExpert || reglages.length === 0) return null;

  return (
    <>
      <Bouton size="sm" variant="outline" className={className} onClick={() => setOuvert(true)}>
        ⚙ Réglages de cet écran
      </Bouton>
      {ouvert ? <PanneauExpert ecran={ecran} reglages={reglages} onClose={() => setOuvert(false)} /> : null}
    </>
  );
}
