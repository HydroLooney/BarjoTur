import { useState } from 'react';
import { usePipeline, ORDRE_CRANS, type CranParcours } from '@/stores/pipeline';
import { Champ } from '@/ui/primitives/input';
import { Bouton } from '@/ui/primitives/button';
import { cn } from '@/lib/utils';

const LIBELLE: Record<CranParcours, string> = {
  idee: 'Idée',
  explo: 'Explorer',
  vote: 'Voter',
  composition: 'Composer',
  logistique: 'Logistique',
  voyage: 'Voyage',
};

// Stepper du parcours (C08 / A07) : les six crans, du plus ouvert au plus verrouillé. Un cran verrouillé
// est VISIBLE mais son ouverture demande le PIN organisateur. C'est une GARDE D'UI (empêche un enfant de
// tout déverrouiller) : l'autorité reste serveur (toute mutation est refusée sans jeton valide, A03).
export function PipelineStepper() {
  const cranActuel = usePipeline((s) => s.cranActuel);
  const cransOuverts = usePipeline((s) => s.cransOuverts);
  const validerPin = usePipeline((s) => s.validerPin);
  const ouvrirCran = usePipeline((s) => s.ouvrirCran);

  const [demande, setDemande] = useState<CranParcours | null>(null);
  const [pin, setPin] = useState('');

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-2">
        {ORDRE_CRANS.map((c, i) => {
          const ouvert = cransOuverts.has(c);
          const actuel = c === cranActuel;
          return (
            <li key={c}>
              <button
                type="button"
                aria-current={actuel ? 'step' : undefined}
                onClick={() => (ouvert ? undefined : setDemande(c))}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  actuel
                    ? 'border-primary bg-muted font-medium text-foreground'
                    : ouvert
                      ? 'border-border hover:bg-muted'
                      : 'border-dashed border-border text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-xs',
                    actuel ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {i + 1}
                </span>
                {LIBELLE[c]}
                {!ouvert ? <span className="text-xs text-muted-foreground">(PIN)</span> : null}
              </button>
            </li>
          );
        })}
      </ol>

      {demande ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3">
          <span className="text-sm text-muted-foreground">Déverrouiller « {LIBELLE[demande]} » (organisateur) :</span>
          <Champ
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-28"
            aria-label="PIN organisateur"
            autoComplete="off"
          />
          <Bouton
            size="sm"
            disabled={pin === ''}
            onClick={() => {
              validerPin();
              ouvrirCran(demande);
              setDemande(null);
              setPin('');
            }}
          >
            Déverrouiller
          </Bouton>
          <Bouton size="sm" variant="ghost" onClick={() => setDemande(null)}>
            Annuler
          </Bouton>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Les crans verrouillés restent visibles ; leur ouverture demande le PIN organisateur. L'autorité reste serveur.
      </p>
    </div>
  );
}
