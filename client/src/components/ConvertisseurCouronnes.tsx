import { useState } from 'react';
import { useChange, NOK_PAR_EUR_DEFAUT } from '@/stores/change';
import { Bouton } from '@/ui/primitives/button';

// CONVERTISSEUR couronnes ↔ euro (slice client de #3 budget vivant). Outil famille, non gaté : tout le monde s'en
// sert au quotidien (« ça fait combien en euros ? »). Deux champs liés par le taux ; le taux est INDICATIF et
// ÉDITABLE (R1 — pas de taux temps réel), persisté. Voix douce, gros chiffres. Aucune couleur en dur (tokens).

const PRESETS_NOK = [50, 100, 200, 500];

function formate(n: number, decimales: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function ConvertisseurCouronnes() {
  const nokParEur = useChange((s) => s.nokParEur);
  const setNokParEur = useChange((s) => s.setNokParEur);

  // Ancre = les euros ; les couronnes en découlent. On garde des chaînes pour une saisie fluide dans les deux sens.
  const [eurStr, setEurStr] = useState('10');
  const [nokStr, setNokStr] = useState(formate(10 * NOK_PAR_EUR_DEFAUT, 0));

  const majDepuisEur = (v: string) => {
    setEurStr(v);
    const eur = Number(v.replace(',', '.'));
    setNokStr(Number.isFinite(eur) ? formate(eur * nokParEur, 0) : '');
  };
  const majDepuisNok = (v: string) => {
    setNokStr(v);
    const nok = Number(v.replace(/\s/g, '').replace(',', '.'));
    setEurStr(Number.isFinite(nok) && nokParEur > 0 ? formate(nok / nokParEur, 2) : '');
  };
  const majTaux = (v: string) => {
    const t = Number(v.replace(',', '.'));
    if (Number.isFinite(t) && t > 0) {
      setNokParEur(t);
      const eur = Number(eurStr.replace(',', '.'));
      if (Number.isFinite(eur)) setNokStr(formate(eur * t, 0));
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="space-y-1">
        <h2 className="font-serif text-xl">Couronnes ou euros ?</h2>
        <p className="text-sm text-muted-foreground">
          Tapez un montant d’un côté, l’autre suit. Pratique pour lire une étiquette de magasin sur place.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-1">
          <span className="text-sm font-medium">Euros (€)</span>
          <input
            type="text"
            inputMode="decimal"
            value={eurStr}
            onChange={(e) => majDepuisEur(e.target.value)}
            aria-label="Montant en euros"
            className="min-h-tactile w-full rounded-md border border-border bg-background px-3 text-lg tabular-nums"
          />
        </label>
        <span aria-hidden className="pb-2 text-xl text-muted-foreground">⇄</span>
        <label className="flex-1 space-y-1">
          <span className="text-sm font-medium">Couronnes (kr)</span>
          <input
            type="text"
            inputMode="decimal"
            value={nokStr}
            onChange={(e) => majDepuisNok(e.target.value)}
            aria-label="Montant en couronnes norvégiennes"
            className="min-h-tactile w-full rounded-md border border-border bg-background px-3 text-lg tabular-nums"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Vite fait :</span>
        {PRESETS_NOK.map((nok) => (
          <Bouton key={nok} variant="outline" size="sm" onClick={() => majDepuisNok(String(nok))}>
            {nok} kr
          </Bouton>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">1 € =</span>
          <input
            type="text"
            inputMode="decimal"
            value={String(nokParEur)}
            onChange={(e) => majTaux(e.target.value)}
            aria-label="Taux : couronnes pour un euro"
            className="min-h-tactile w-20 rounded-md border border-border bg-background px-2 text-center tabular-nums"
          />
          <span className="text-muted-foreground">kr</span>
        </label>
        <span className="text-xs text-muted-foreground">
          Taux indicatif, à ajuster.{' '}
          {nokParEur !== NOK_PAR_EUR_DEFAUT ? (
            <button
              type="button"
              onClick={() => setNokParEur(NOK_PAR_EUR_DEFAUT)}
              className="underline hover:text-foreground"
            >
              remettre {NOK_PAR_EUR_DEFAUT}
            </button>
          ) : null}
        </span>
      </div>
    </section>
  );
}
