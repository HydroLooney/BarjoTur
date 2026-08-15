import { useEffect, useState } from 'react';
import type { MonVoyageIdeal } from '@barjotur/shared';
import { CurseurValeur } from '@/ui/primitives/curseur';
import { useCadence } from '@/stores/cadence';
import { usePeut } from '@/hooks/usePeut';
import { useIdentite } from '@/stores/identite';
import { useMonVoyageIdeal } from '@/lib/queries/mon-voyage';
import { MesIncontournables } from '@/components/MesIncontournables';
import { AppetitsThematiques } from '@/components/AppetitsThematiques';
import { CarnetNotes } from '@/components/CarnetNotes';
import { VueMonVoyageIdeal } from '@/components/VueMonVoyageIdeal';

// Espace « Mon voyage » (A26 / M112) : la vision de CHAQUE voyageur. Sa cadence (porte d'entrée simple qui
// pilotera tous ses budgets temps), ses incontournables, ses envies par thème, et — à venir — son itinéraire
// idéal (dépend du moteur, gaté DSN : on ne le simule pas, R1). Tout en local pour l'instant, flip au DSN.
export default function MonVoyage() {
  const cadence = useCadence((s) => s.cadence);
  const setCadence = useCadence((s) => s.setCadence);
  const dureeSurPlacePct = useCadence((s) => s.dureeSurPlacePct);
  const flaneriePct = useCadence((s) => s.flaneriePct);
  const plafondJourH = useCadence((s) => s.plafondJourH);
  const setDureeSurPlace = useCadence((s) => s.setDureeSurPlace);
  const setFlanerie = useCadence((s) => s.setFlanerie);
  const setPlafondJour = useCadence((s) => s.setPlafondJour);
  const peutVoter = usePeut('voter');

  // Mon voyage idéal (#2, endpoint M554 GET /api/mon-voyage/:code) : l'itinéraire composé pour MON profil + mon écart
  // au commun. Se remplit dès le bff redéployé ; en DEV `?mon-voyage` charge un aperçu de structure (R1, hors prod).
  const code = useIdentite((s) => s.code);
  const { data } = useMonVoyageIdeal(code);
  const [apercuVoyage, setApercuVoyage] = useState<MonVoyageIdeal | null>(null);
  useEffect(() => {
    const veut = import.meta.env.DEV && new URLSearchParams(window.location.search).has('mon-voyage');
    if (veut && !data) void import('@/lib/fixtures/mon-voyage-demo').then((m) => setApercuVoyage(m.monVoyageIdealDemo));
  }, [data]);
  const monVoyage = data ?? apercuVoyage;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl">Mon voyage</h1>
        <p className="max-w-prose text-muted-foreground">
          Votre vision à vous : votre cadence, vos coups de cœur, vos envies. Chacun façonne la sienne, et le voyage
          cherche l'accord de la famille.
        </p>
      </div>

      <section className="space-y-2 rounded-lg border border-border p-3">
        <div>
          <h2 className="text-sm font-medium">La densité de mes journées</h2>
          <p className="max-w-prose text-xs text-muted-foreground">
            Des journées légères, où l'on prend le temps, aux journées denses, où l'on enchaîne. Ce seul réglage guide
            tous vos budgets de temps. C'est une moyenne : le voyage alternera les rythmes.
          </p>
        </div>
        <CurseurValeur
          label="Densité des journées : légères ↔ denses"
          valeur={cadence}
          min={0}
          max={100}
          step={5}
          onChange={setCadence}
        />

        {/* Réglage fin optionnel (divulgation progressive, M122) : le débutant ne voit que la densité ; qui veut
            affine, dans des bornes de sécurité. */}
        <details className="rounded-md border border-border">
          <summary className="flex min-h-tactile cursor-pointer items-center px-3 text-sm text-muted-foreground">
            Réglage fin (facultatif)
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            <p className="max-w-prose text-xs text-muted-foreground">
              Ces réglages restent dans des bornes raisonnables : le voyage protège vos journées.
            </p>
            <CurseurValeur
              label="Temps sur place"
              valeur={dureeSurPlacePct}
              min={0}
              max={100}
              step={5}
              suffixe="%"
              onChange={setDureeSurPlace}
            />
            <CurseurValeur
              label="Flânerie"
              valeur={flaneriePct}
              min={0}
              max={100}
              step={5}
              suffixe="%"
              onChange={setFlanerie}
            />
            <CurseurValeur
              label="Plafond par jour"
              valeur={plafondJourH}
              min={4}
              max={12}
              step={1}
              suffixe="h"
              onChange={setPlafondJour}
            />
          </div>
        </details>
      </section>

      <MesIncontournables />

      {peutVoter ? (
        <section className="space-y-2 rounded-lg border border-border p-3">
          <AppetitsThematiques />
        </section>
      ) : null}

      <CarnetNotes />

      {/* Mon itinéraire idéal (#2) : rendu dès que l'endpoint répond ; sinon un mot honnête (R1), pas de simulation. */}
      {monVoyage ? (
        <VueMonVoyageIdeal data={monVoyage} />
      ) : (
        <section className="space-y-1 rounded-lg border border-dashed border-border p-3">
          <h2 className="text-sm font-medium">Mon itinéraire idéal</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            À partir de votre cadence, de vos coups de cœur et de vos envies, le voyage compose VOTRE version idéale.
            Elle apparaît ici dès qu'elle est prête.
          </p>
        </section>
      )}
    </section>
  );
}
