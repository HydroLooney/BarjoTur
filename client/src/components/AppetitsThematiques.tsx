import { CurseurValeur } from '@/ui/primitives/curseur';
import { useBudgetTemps } from '@/stores/budget-temps';
import { themesDemo } from '@/lib/fixtures/budget-temps-demo';
import { clampAppetit } from '@/lib/budget-temps';

// « Vos envies par thème » (M092), extrait pour être réutilisé (réglage budget-temps ET espace « Mon voyage »,
// M112). L'appétit d'un thème (0..100 %) fait monter le temps que le voyage lui donne. Bloc de présentation, sans
// gate propre : l'appelant décide (capacité `voter`). Le curseur double d'une saisie liée (préférence transverse).
function capitaliser(mot: string): string {
  return mot.length === 0 ? mot : mot[0]!.toUpperCase() + mot.slice(1);
}

function ReglageAppetit({ theme }: { theme: string }) {
  const valeur = useBudgetTemps((s) => s.appetits[theme]) ?? 0;
  const setAppetit = useBudgetTemps((s) => s.setAppetit);
  return (
    <CurseurValeur
      valeur={Math.round(valeur * 100)}
      min={0}
      max={100}
      step={10}
      suffixe="%"
      label={capitaliser(theme)}
      onChange={(p) => setAppetit(theme, clampAppetit(p / 100))}
    />
  );
}

export function AppetitsThematiques() {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vos envies par thème</h3>
      <p className="max-w-prose text-xs text-muted-foreground">
        Plus vous poussez un thème, plus le voyage lui donne de temps (nautique, faune, patrimoine…).
      </p>
      {themesDemo.map((t) => (
        <ReglageAppetit key={t} theme={t} />
      ))}
    </div>
  );
}
