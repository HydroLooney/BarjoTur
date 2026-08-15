import { useState } from 'react';
import type { EnvieCle } from '@barjotur/shared';
import { usePhilosophie } from '@/stores/philosophie';
import { useIdentite } from '@/stores/identite';
import { usePhilosophieProfil, philoSecours } from '@/lib/queries/philosophie';
import { CAP_NORD_META, resumeCurseur, resumeEnvie } from '@/lib/philosophie';
import { Bouton } from '@/ui/primitives/button';

// QUESTIONNAIRE VOYAGEUR (M486/M511) : le mode GUIDÉ, un pas à la fois, gros et lisible (Mamie et enfants), REJOUABLE.
// Lançable en OVERLAY d'où on veut (Explorer « Commencer ici », profil voyageur). Il écrit le MÊME profil que les
// curseurs directs (store philo → serveur → composeur). On ne demande QUE les termes qui agissent (curseurs actifs +
// cap Nord + envies) ; Nouveauté/Tempo, pas encore actifs, sont laissés au réglage fin, pas au questionnaire.

interface EtapeQ {
  id: string;
  titre: string;
  bas: string;
  haut: string;
  resume: (v: number) => string;
  lire: () => number;
  ecrire: (v: number) => void;
}

function CurseurEtape({ etape }: { etape: EtapeQ }) {
  const v = etape.lire();
  const idResume = `q-${etape.id}`;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span id={idResume} className="text-base text-accent">
          {etape.resume(v)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={v}
        onChange={(e) => etape.ecrire(Number(e.target.value))}
        aria-label={etape.titre}
        aria-describedby={idResume}
        aria-valuetext={etape.resume(v)}
        className="h-3 w-full cursor-pointer"
        style={{ accentColor: 'var(--ocre)' }}
      />
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{etape.bas}</span>
        <span>{etape.haut}</span>
      </div>
    </div>
  );
}

function useEtapes(): EtapeQ[] {
  const profil = usePhilosophie((s) => s.profil);
  const reglerCurseur = usePhilosophie((s) => s.reglerCurseur);
  const reglerEnvie = usePhilosophie((s) => s.reglerEnvie);
  const reglerCapNord = usePhilosophie((s) => s.reglerCapNord);
  const code = useIdentite((s) => s.code);
  const { data } = usePhilosophieProfil(code);
  const catalogue = data?.catalogue ?? philoSecours().catalogue;

  const curseurs: EtapeQ[] = catalogue.curseurs
    .filter((c) => c.actifLive)
    .map((c) => ({
      id: c.cle,
      titre: c.libelle,
      bas: c.poleA,
      haut: c.poleB,
      resume: (v) => resumeCurseur(c, v),
      lire: () => profil.curseurs[c.cle] ?? 0.5,
      ecrire: (v) => reglerCurseur(c.cle, v),
    }));

  const capNord: EtapeQ = {
    id: 'cap_nord',
    titre: CAP_NORD_META.libelle,
    bas: CAP_NORD_META.poleA,
    haut: CAP_NORD_META.poleB,
    resume: (v) => resumeCurseur(CAP_NORD_META, v),
    lire: () => profil.cap_nord ?? 0.5,
    ecrire: (v) => reglerCapNord(v),
  };

  const envies: EtapeQ[] = catalogue.envies.map((e) => ({
    id: `envie-${e.cle}`,
    titre: e.libelle,
    bas: 'Peu',
    haut: 'Beaucoup',
    resume: (v) => resumeEnvie(e, v),
    lire: () => profil.envies[e.cle as EnvieCle] ?? 0.5,
    ecrire: (v) => reglerEnvie(e.cle as EnvieCle, v),
  }));

  return [...curseurs, capNord, ...envies];
}

export function QuestionnaireVoyageur({ onClose }: { onClose: () => void }) {
  const etapes = useEtapes();
  const [i, setI] = useState(0);
  const etape = etapes[Math.min(i, etapes.length - 1)]!;
  const dernier = i >= etapes.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Questionnaire de voyage"
    >
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-granite/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg space-y-5 rounded-t-2xl border border-border bg-card p-5 shadow-flottante sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Question <span className="chiffres">{i + 1}</span> / {etapes.length}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="min-h-tactile px-2 text-lg text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
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
