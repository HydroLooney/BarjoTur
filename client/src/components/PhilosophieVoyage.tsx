import { useEffect, useState } from 'react';
import { usePhilosophie } from '@/stores/philosophie';
import { useIdentite } from '@/stores/identite';
import { useProfilPhilo, useEcrireProfilPhilo, philoLive } from '@/lib/queries/philosophie';
import { AXES_PHILO, resumeAxe, syntheseHumaine, type AxePhilo } from '@/lib/philosophie';
import { QuestionnaireVoyageur } from '@/components/QuestionnaireVoyageur';
import { Bouton } from '@/ui/primitives/button';

// « Ta façon de voyager » (AUDIT-FRONT P0 #1, cœur de Voter). Les 8 axes de philosophie en sliders continus ANCRÉS
// (pôle gauche ↔ pôle droit), chacun avec un résumé humain (aria-valuetext) et une synthèse en clair. Un questionnaire
// guidé (un axe à la fois) aide à les régler. Ces axes pondèrent le reward du composeur (MCDA v3) — le profil part au
// composeur au flip (contrat B). R1 : on exprime une préférence, jamais un score inventé.

function CurseurAxe({ axe, valeur, onChange }: { axe: AxePhilo; valeur: number; onChange: (v: number) => void }) {
  const idResume = `philo-${axe.cle}-resume`;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{axe.titre}</span>
        <span id={idResume} className="text-xs text-accent">
          {resumeAxe(axe, valeur)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={axe.titre}
        aria-describedby={idResume}
        aria-valuetext={resumeAxe(axe, valeur)}
        className="h-2 w-full cursor-pointer"
        style={{ accentColor: 'var(--ocre)' }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{axe.gauche}</span>
        <span>{axe.droite}</span>
      </div>
    </div>
  );
}

export function PhilosophieVoyage() {
  const valeurs = usePhilosophie((s) => s.valeurs);
  const regler = usePhilosophie((s) => s.regler);
  const remplacer = usePhilosophie((s) => s.remplacer);
  const reinitialiser = usePhilosophie((s) => s.reinitialiser);
  const [questionnaire, setQuestionnaire] = useState(false);

  // Sync serveur FLIP-READY (B154) : inerte tant que l'endpoint n'est pas live (philoLive off). Au flip : on hydrate
  // le profil du voyageur puis on pousse chaque changement (débattu 800 ms). Le composeur lit ensuite ce profil.
  const code = useIdentite((s) => s.code);
  const { data: profilServeur } = useProfilPhilo(code);
  const ecrire = useEcrireProfilPhilo(code);
  useEffect(() => {
    if (profilServeur) remplacer(profilServeur);
  }, [profilServeur, remplacer]);
  useEffect(() => {
    if (!philoLive || !code) return;
    const t = setTimeout(() => ecrire.mutate(valeurs), 800);
    return () => clearTimeout(t);
    // ecrire est stable pour un `code` donné ; on ne réagit qu'au changement des valeurs.
  }, [valeurs, code]);

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="font-serif text-xl">Ta façon de voyager</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{syntheseHumaine(valeurs)}</p>
        </div>
        <Bouton variant="outline" size="sm" onClick={() => setQuestionnaire(true)}>
          Répondre au questionnaire
        </Bouton>
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {AXES_PHILO.map((axe) => (
          <CurseurAxe key={axe.cle} axe={axe} valeur={valeurs[axe.cle] ?? 50} onChange={(v) => regler(axe.cle, v)} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Ces préférences orientent les propositions de voyage (elles pèsent dans le calcul).
        </p>
        <Bouton variant="ghost" size="sm" onClick={reinitialiser}>
          Tout remettre au milieu
        </Bouton>
      </div>

      {questionnaire ? <QuestionnaireVoyageur onClose={() => setQuestionnaire(false)} /> : null}
    </section>
  );
}
