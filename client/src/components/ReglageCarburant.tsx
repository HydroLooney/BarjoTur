import { CurseurValeur } from '@/ui/primitives/curseur';
import { usePeut } from '@/hooks/usePeut';
import { useCarburant } from '@/stores/carburant';
import {
  CONSO_BASE_L_100,
  PRIX_DIESEL_MAX,
  PRIX_DIESEL_MIN,
  SURCONSO_PCT_MAX,
  avecMarge,
  consoEffectiveL100,
  coutCarburantEur,
} from '@/lib/carburant';

// Réglages carburant + marges (M090/M092, T045). Le van consomme 9,5 L/100 km FIXE ; l'utilisateur règle la
// surconsommation (%), le prix du diesel (€/L) et la marge de sécurité (%), tout au curseur + saisie liée. Le
// coût € se recompose à la volée (km × conso effective × prix, puis marge). C'est du budget détaillé : gaté
// `voir_budget_detaille` (adulte/organisateur ; masqué à l'enfant et à l'invité). Le km RÉEL vient du calcul
// d'itinéraire d'A (gaté DSN) ; ici un km d'exemple. Formule = miroir temporaire de B (`lib/carburant`, B044),
// à remplacer par `@barjotur/shared` dès que M hisse le module (single-source).
const KM_DEMO = 4200;

function euro(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`;
}

function nombre(n: number, decimales = 1): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: decimales });
}

export function ReglageCarburant() {
  const peutVoirBudget = usePeut('voir_budget_detaille');
  const { surconsoPct, prixDiesel, margePct, setSurconso, setPrix, setMarge } = useCarburant();
  if (!peutVoirBudget) return null;

  const consoEff = consoEffectiveL100(surconsoPct);
  const coutBrut = coutCarburantEur(KM_DEMO, surconsoPct, prixDiesel);
  const coutPrudent = avecMarge(coutBrut, margePct);

  return (
    <section className="space-y-4 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-medium">Carburant et marges</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Réglez la surconsommation (montagne, charge), le prix du diesel et la marge de sécurité : le coût se
          recalcule tout de suite. Sur {nombre(KM_DEMO, 0)} km d'exemple (le kilométrage réel viendra du calcul
          d'itinéraire).
        </p>
      </div>

      <p className="text-sm">
        Consommation de base : <span className="font-medium">{nombre(CONSO_BASE_L_100)} L/100 km</span>{' '}
        <span className="text-xs text-muted-foreground">(caractéristique du van, fixe)</span>
      </p>

      <CurseurValeur
        label="Surconsommation"
        valeur={surconsoPct}
        min={0}
        max={SURCONSO_PCT_MAX}
        step={5}
        suffixe="%"
        onChange={setSurconso}
      />
      <CurseurValeur
        label="Prix du diesel"
        valeur={prixDiesel}
        min={PRIX_DIESEL_MIN}
        max={PRIX_DIESEL_MAX}
        step={0.05}
        suffixe="€/L"
        onChange={setPrix}
      />
      <CurseurValeur
        label="Marge de sécurité"
        valeur={margePct}
        min={0}
        max={50}
        step={5}
        suffixe="%"
        onChange={setMarge}
      />

      <dl className="space-y-1 rounded-md bg-muted p-3 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Consommation effective</dt>
          <dd className="tabular-nums">{nombre(consoEff)} L/100 km</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Carburant estimé</dt>
          <dd className="tabular-nums">{euro(coutBrut)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Avec marge {nombre(margePct, 0)} %</dt>
          <dd className="font-medium tabular-nums">{euro(coutPrudent)}</dd>
        </div>
      </dl>
    </section>
  );
}
