import { useState } from 'react';
import { usePhilosophie } from '@/stores/philosophie';
import { AXES_PHILO, resumeAxe } from '@/lib/philosophie';
import { Bouton } from '@/ui/primitives/button';

// QUESTIONNAIRE VOYAGEUR (M486) : le mode GUIDÉ, un pas à la fois, gros et lisible (Mamie/enfants), REJOUABLE.
// Lançable en OVERLAY d'où on veut (Explorer via « Commencer ici », Voter). L'autre mode (sliders directs,
// PhilosophieVoyage dans Voter) écrit le MÊME profil (store philo). Le câblage au composeur = contrat B (M482).
// À COMPLÉTER (M486, next) : après les 8 axes de philosophie, des pas « ce qui complète le profil » (appétit
// budget-temps GLOBAL + préférences confort) — ils demandent un modèle de profil au niveau voyageur (les stores
// budget-temps sont par-jour), que je pose ensuite ; ici on couvre déjà les 8 axes de fond, correctement.

interface EtapeQ {
  cle: string;
  titre: string;
  gauche: string;
  droite: string;
  /** Résumé humain d'une valeur (0-100). */
  resume: (v: number) => string;
  /** Lit / écrit la valeur (0-100) dans le bon store. */
  lire: () => number;
  ecrire: (v: number) => void;
}

function CurseurEtape({ etape }: { etape: EtapeQ }) {
  const v = etape.lire();
  const idResume = `q-${etape.cle}-resume`;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{etape.titre}</span>
        <span id={idResume} className="text-sm text-accent">
          {etape.resume(v)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={v}
        onChange={(e) => etape.ecrire(Number(e.target.value))}
        aria-label={etape.titre}
        aria-describedby={idResume}
        aria-valuetext={etape.resume(v)}
        className="h-2 w-full cursor-pointer"
        style={{ accentColor: 'var(--ocre)' }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{etape.gauche}</span>
        <span>{etape.droite}</span>
      </div>
    </div>
  );
}

function useEtapes(): EtapeQ[] {
  const philo = usePhilosophie((s) => s.valeurs);
  const reglerPhilo = usePhilosophie((s) => s.regler);

  // Les 8 axes de philosophie (store philo, 0-100).
  return AXES_PHILO.map((a) => ({
    cle: a.cle,
    titre: `${a.titre} ?`,
    gauche: a.gauche,
    droite: a.droite,
    resume: (v) => resumeAxe(a, v),
    lire: () => philo[a.cle] ?? 50,
    ecrire: (v) => reglerPhilo(a.cle, v),
  }));
}

export function QuestionnaireVoyageur({ onClose }: { onClose: () => void }) {
  const etapes = useEtapes();
  const [i, setI] = useState(0);
  const etape = etapes[i]!;
  const dernier = i === etapes.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Questionnaire de voyage">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-granite/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg space-y-5 rounded-t-2xl border border-border bg-card p-5 shadow-flottante sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Question <span className="chiffres">{i + 1}</span> / {etapes.length}
          </p>
          <button type="button" onClick={onClose} className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground" aria-label="Fermer">
            ×
          </button>
        </div>
        <h3 className="font-serif text-xl">{etape.titre}</h3>
        <CurseurEtape etape={etape} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <Bouton variant="ghost" size="sm" disabled={i === 0} onClick={() => setI((n) => Math.max(0, n - 1))}>
            Précédent
          </Bouton>
          {dernier ? (
            <Bouton size="sm" onClick={onClose}>
              Terminer
            </Bouton>
          ) : (
            <Bouton size="sm" onClick={() => setI((n) => Math.min(etapes.length - 1, n + 1))}>
              Suivant
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
}
