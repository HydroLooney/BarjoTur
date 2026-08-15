import { useEffect, useRef, useState } from 'react';
import type { EnvieCatalogue, EnvieCle } from '@barjotur/shared';
import { usePhilosophie } from '@/stores/philosophie';
import { useIdentite } from '@/stores/identite';
import { usePhilosophieProfil, useEcrirePhilosophieProfil, philoSecours } from '@/lib/queries/philosophie';
import { CAP_NORD_META, ancrageEnvie, resumeCurseur, resumeEnvie, syntheseHumaine } from '@/lib/philosophie';
import { QuestionnaireVoyageur } from '@/components/QuestionnaireVoyageur';
import { Bouton } from '@/ui/primitives/button';

// PROFIL VOYAGEUR UNIQUE (M502/M511) — « ta façon de voyager » : la seule surface de réglage par voyageur. 7 curseurs
// bipolaires + 4 envies + le cap vers le Nord, en [0..1], LIBELLÉS venus du catalogue serveur (A159, secours local
// sinon). Ce profil part au composeur (reward MCDA v3, prouvé B169). Le questionnaire guidé écrit le MÊME profil.
// Voix famille : gros libellés, deux pôles nommés, une phrase d'ancrage, jamais un piège. R1 : une préférence, pas un score.

/** La forme d'affichage d'un curseur bipolaire (curseur de catalogue OU le cap Nord scalaire). `cle` sert d'id. */
interface FicheBipolaire {
  cle: string;
  libelle: string;
  poleA: string;
  poleB: string;
  ancrage?: string;
  actifLive: boolean;
}

/** Curseur bipolaire [0..1] (pôle A ↔ pôle B), résumé humain en aria-valuetext. `assoupli` = terme pas encore actif. */
function CurseurBipolaire({
  cat,
  valeur,
  onChange,
}: {
  cat: FicheBipolaire;
  valeur: number;
  onChange: (v: number) => void;
}) {
  const idResume = `philo-${cat.cle}`;
  const assoupli = !cat.actifLive;
  return (
    <div className={assoupli ? 'space-y-1 opacity-70' : 'space-y-1'}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-base font-medium">
          {cat.libelle}
          {assoupli ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              bientôt
            </span>
          ) : null}
        </span>
        <span id={idResume} className="text-sm text-accent">
          {resumeCurseur(cat, valeur)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={cat.libelle}
        aria-describedby={idResume}
        aria-valuetext={resumeCurseur(cat, valeur)}
        className="h-2 w-full cursor-pointer"
        style={{ accentColor: 'var(--ocre)' }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{cat.poleA}</span>
        <span>{cat.poleB}</span>
      </div>
      {cat.ancrage ? <p className="text-xs text-muted-foreground">{cat.ancrage}</p> : null}
    </div>
  );
}

/** Curseur d'envie [0..1] mono-pôle (peu ↔ beaucoup). */
function CurseurEnvie({
  cat,
  valeur,
  onChange,
}: {
  cat: EnvieCatalogue;
  valeur: number;
  onChange: (v: number) => void;
}) {
  const idResume = `envie-${cat.cle}`;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-medium">{cat.libelle}</span>
        <span id={idResume} className="text-sm text-accent">
          {resumeEnvie(cat, valeur)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={valeur}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={cat.libelle}
        aria-describedby={idResume}
        aria-valuetext={resumeEnvie(cat, valeur)}
        className="h-2 w-full cursor-pointer"
        style={{ accentColor: 'var(--glacier)' }}
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Peu</span>
        <span>Beaucoup</span>
      </div>
      {ancrageEnvie(cat) ? <p className="text-xs text-muted-foreground">{ancrageEnvie(cat)}</p> : null}
    </div>
  );
}

export function PhilosophieVoyage() {
  const profil = usePhilosophie((s) => s.profil);
  const reglerCurseur = usePhilosophie((s) => s.reglerCurseur);
  const reglerEnvie = usePhilosophie((s) => s.reglerEnvie);
  const reglerCapNord = usePhilosophie((s) => s.reglerCapNord);
  const remplacer = usePhilosophie((s) => s.remplacer);
  const reinitialiser = usePhilosophie((s) => s.reinitialiser);
  const [questionnaire, setQuestionnaire] = useState(false);

  // Serveur = vérité (DB2, endpoints LIVE B166/B169). On hydrate le store depuis le profil serveur UNE fois par lien,
  // puis chaque réglage repart au serveur (débattu 800 ms), qui le passe au composeur. Sans lien : secours local.
  const code = useIdentite((s) => s.code);
  const { data } = usePhilosophieProfil(code);
  const ecrire = useEcrirePhilosophieProfil(code);
  const catalogue = data?.catalogue ?? philoSecours().catalogue;

  const hydrate = useRef<string | null>(null);
  useEffect(() => {
    if (data?.profil && hydrate.current !== code) {
      hydrate.current = code;
      remplacer(data.profil);
    }
  }, [data, code, remplacer]);

  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => {
      ecrire.mutate({ curseurs: profil.curseurs, envies: profil.envies, cap_nord: profil.cap_nord });
    }, 800);
    return () => clearTimeout(t);
    // ecrire est stable pour un `code` donné ; on ne réagit volontairement qu'aux changements du profil.
  }, [profil, code]);

  return (
    <section className="space-y-5 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="font-serif text-xl">Ta façon de voyager</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{syntheseHumaine(profil, catalogue)}</p>
        </div>
        <Bouton variant="outline" size="sm" onClick={() => setQuestionnaire(true)}>
          Répondre en douceur
        </Bouton>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Comment vous voyagez</h3>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {catalogue.curseurs.map((cat) => (
            <CurseurBipolaire
              key={cat.cle}
              cat={cat}
              valeur={profil.curseurs[cat.cle] ?? 0.5}
              onChange={(v) => reglerCurseur(cat.cle, v)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vos envies</h3>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {catalogue.envies.map((cat) => (
            <CurseurEnvie
              key={cat.cle}
              cat={cat}
              valeur={profil.envies[cat.cle as EnvieCle] ?? 0.5}
              onChange={(v) => reglerEnvie(cat.cle as EnvieCle, v)}
            />
          ))}
          <CurseurBipolaire
            cat={{
              cle: 'cap_nord',
              libelle: CAP_NORD_META.libelle,
              poleA: CAP_NORD_META.poleA,
              poleB: CAP_NORD_META.poleB,
              ancrage: CAP_NORD_META.ancrage,
              actifLive: true,
            }}
            valeur={profil.cap_nord ?? 0.5}
            onChange={reglerCapNord}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Ces préférences orientent les propositions de voyage : elles pèsent dans le calcul, elles ne décident pas à
          votre place.
        </p>
        <Bouton variant="ghost" size="sm" onClick={reinitialiser}>
          Tout remettre au milieu
        </Bouton>
      </div>

      {questionnaire ? <QuestionnaireVoyageur onClose={() => setQuestionnaire(false)} /> : null}
    </section>
  );
}
