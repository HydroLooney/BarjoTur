import { DEMI_JOURNEE_MIN, JOURNEE_MIN, type SourceDuree } from '@barjotur/shared';
import { CurseurValeur } from '@/ui/primitives/curseur';
import { Bouton } from '@/ui/primitives/button';
import { usePeut } from '@/hooks/usePeut';
import { useBudgetTemps } from '@/stores/budget-temps';
import { joursDemo, themesDemo, visitesDemo, type JourDemo, type VisiteDemo } from '@/lib/fixtures/budget-temps-demo';
import { ajusterDuree, ajusterFlanerie, clampAppetit, formatDuree } from '@/lib/budget-temps';

// Réglage du budget-temps (M089 / A21) : combien de temps on passe SUR PLACE par visite, la flânerie de chaque
// jour, et les envies par thème. Régler les attributs d'une composition = composer (M088) → gaté `composer`
// (un invité ne le voit pas). La durée est un curseur + saisie liée pour les activités libres, des paliers pour
// celles « en bloc » (kayak). Flânerie = bloc de temps libre DISTINCT des durées d'activité (pas de double
// compte, A21). Hors live, valeurs illustratives (R1) ; au flip, durées calculées par A et budget par B.
const SOURCE_LISIBLE: Record<SourceDuree, string> = {
  type: 'défaut par type',
  lieu: 'défaut du lieu',
  preference: "d'après vos avis",
  manuel: 'ajusté',
};

function libellePalier(min: number): string {
  if (min >= JOURNEE_MIN) return 'Journée';
  if (min >= DEMI_JOURNEE_MIN) return 'Demi-journée';
  return formatDuree(min);
}

function capitaliser(mot: string): string {
  return mot.length === 0 ? mot : mot[0]!.toUpperCase() + mot.slice(1);
}

function ReglageVisite({ v }: { v: VisiteDemo }) {
  const override = useBudgetTemps((s) => s.dureesParVisite[v.id]);
  const setDuree = useBudgetTemps((s) => s.setDuree);
  const courant = override ?? v.budget.duree_retenue_min;
  const source: SourceDuree = override != null ? 'manuel' : v.budget.source;

  if (v.budget.granularite !== 'libre') {
    const paliers = v.budget.granularites ?? [];
    return (
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{v.libelle}</p>
          <span className="text-xs text-muted-foreground">En bloc · {formatDuree(courant)}</span>
        </div>
        <p className="text-xs text-muted-foreground">Une activité qui se prend en bloc, pas en dessous.</p>
        <div className="flex flex-wrap gap-2">
          {paliers.map((p) => (
            <Bouton
              key={p}
              size="sm"
              variant={p === courant ? 'default' : 'outline'}
              aria-pressed={p === courant}
              onClick={() => setDuree(v.id, ajusterDuree(p, v.budget))}
            >
              {libellePalier(p)}
            </Bouton>
          ))}
        </div>
      </div>
    );
  }

  const max = v.budget.max_min ?? JOURNEE_MIN;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{v.libelle}</p>
        <span className="text-xs text-muted-foreground">
          {formatDuree(courant)} · {SOURCE_LISIBLE[source]}
        </span>
      </div>
      <CurseurValeur
        valeur={courant}
        min={v.budget.min_min}
        max={max}
        step={v.budget.pas_min}
        suffixe="min"
        label={`Durée de « ${v.libelle} »`}
        onChange={(m) => setDuree(v.id, ajusterDuree(m, v.budget))}
      />
    </div>
  );
}

function ReglageFlanerieJour({ j }: { j: JourDemo }) {
  const override = useBudgetTemps((s) => s.flanerieParJour[j.id]);
  const setFlanerie = useBudgetTemps((s) => s.setFlanerie);
  const courant = override ?? j.flanerieDefaut;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{j.libelle}</p>
        <span className="text-xs text-muted-foreground">{formatDuree(courant)}</span>
      </div>
      <CurseurValeur
        valeur={courant}
        min={0}
        max={240}
        step={15}
        suffixe="min"
        label={`Flânerie · ${j.libelle}`}
        onChange={(m) => setFlanerie(j.id, ajusterFlanerie(m))}
      />
    </div>
  );
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

export function ReglageBudgetTemps() {
  // Régler le temps d'une composition = composer (M088). Un invité ne le voit pas.
  if (!usePeut('composer')) return null;

  return (
    <section className="space-y-4 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-medium">Le temps sur place</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Combien de temps on reste à chaque endroit, la flânerie de chaque jour, et vos envies par thème. Le
          composeur compte tout ça, pas seulement la route. Ici, des valeurs d'exemple tant que le calcul n'est pas
          branché.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Durée par visite</h3>
        {visitesDemo.map((v) => (
          <ReglageVisite key={v.id} v={v} />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Flânerie par jour</h3>
        <p className="max-w-prose text-xs text-muted-foreground">
          Un bloc de temps libre, en plus des visites (jamais compté deux fois) : balade, marché, port, pauses.
        </p>
        {joursDemo.map((j) => (
          <ReglageFlanerieJour key={j.id} j={j} />
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vos envies par thème</h3>
        <p className="max-w-prose text-xs text-muted-foreground">
          Plus vous poussez un thème, plus le voyage lui donne de temps (nautique, faune, patrimoine…).
        </p>
        {themesDemo.map((t) => (
          <ReglageAppetit key={t} theme={t} />
        ))}
      </div>
    </section>
  );
}
