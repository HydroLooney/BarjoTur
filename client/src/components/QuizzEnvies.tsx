import { useState } from 'react';
import { Bouton } from '@/ui/primitives/button';
import { useBudgetTemps } from '@/stores/budget-temps';
import { QUESTIONS_ENVIES, appetitsDepuisReponses } from '@/lib/quizz-envies';

// Quizz « Aide-moi à remplir » (M181 §B6), SUR INVITATION : la personne l'ouvre si elle veut, il ne s'impose
// jamais. Trois questions, une reponse par question, puis on pre-remplit les curseurs d'appetit (store
// budget-temps). Esprit education populaire : on propose un point de depart, tout reste ajustable (R1). Aucun
// score, aucune bonne reponse. Transitions douces via les motion tokens (prefers-reduced-motion respecte).

type Etat = 'ferme' | 'en-cours' | 'fini';

export function QuizzEnvies() {
  const remplacer = useBudgetTemps((s) => s.remplacer);
  const [etat, setEtat] = useState<Etat>('ferme');
  const [pas, setPas] = useState(0);
  const [choix, setChoix] = useState<string[]>([]);

  function ouvrir() {
    setChoix([]);
    setPas(0);
    setEtat('en-cours');
  }

  function repondre(theme: string) {
    const suite = [...choix, theme];
    if (pas + 1 < QUESTIONS_ENVIES.length) {
      setChoix(suite);
      setPas(pas + 1);
      return;
    }
    // Derniere question : on applique les appetits pre-remplis puis on remercie.
    remplacer({ appetits: appetitsDepuisReponses(suite) });
    setChoix(suite);
    setEtat('fini');
  }

  if (etat === 'ferme') {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-3">
        <p className="mb-2 max-w-prose text-sm text-muted-foreground">
          Pas envie de régler chaque curseur ? Répondez à trois questions, on part de vos réponses. Vous ajustez ensuite
          comme vous voulez.
        </p>
        <Bouton variant="outline" size="sm" onClick={ouvrir}>
          Aide-moi à remplir
        </Bouton>
      </div>
    );
  }

  if (etat === 'fini') {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-sm">
          C’est parti : vos envies sont pré-remplies. Affinez-les quand vous voulez dans « Mon voyage ».
        </p>
        <Bouton variant="ghost" size="sm" className="mt-2" onClick={() => setEtat('ferme')}>
          Fermer
        </Bouton>
      </div>
    );
  }

  const q = QUESTIONS_ENVIES[pas]!;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Question {pas + 1} sur {QUESTIONS_ENVIES.length}
        </p>
        <button
          type="button"
          onClick={() => setEtat('ferme')}
          className="min-h-tactile px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Passer
        </button>
      </div>
      {/* Jauge de progression du quizz, animee en douceur (motion tokens, coupee si mouvement reduit). */}
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[var(--anim-moyen)] ease-[var(--easing-doux)]"
          style={{ width: `${((pas + 1) / QUESTIONS_ENVIES.length) * 100}%` }}
        />
      </div>
      <p className="mb-3 font-medium">{q.question}</p>
      <div className="flex flex-col gap-2">
        {q.options.map((o) => (
          <button
            key={o.theme + o.libelle}
            type="button"
            onClick={() => repondre(o.theme)}
            className="min-h-tactile rounded-md border border-border px-3 py-2 text-left text-sm transition-colors duration-[var(--anim-court)] ease-[var(--easing-doux)] hover:bg-muted"
          >
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}
