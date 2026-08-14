import { CurseurValeur } from '@/ui/primitives/curseur';
import { useCadence } from '@/stores/cadence';
import { usePeut } from '@/hooks/usePeut';
import { MesIncontournables } from '@/components/MesIncontournables';
import { AppetitsThematiques } from '@/components/AppetitsThematiques';

// Espace « Mon voyage » (A26 / M112) : la vision de CHAQUE voyageur. Sa cadence (porte d'entrée simple qui
// pilotera tous ses budgets temps), ses incontournables, ses envies par thème, et — à venir — son itinéraire
// idéal (dépend du moteur, gaté DSN : on ne le simule pas, R1). Tout en local pour l'instant, flip au DSN.
export default function MonVoyage() {
  const cadence = useCadence((s) => s.cadence);
  const setCadence = useCadence((s) => s.setCadence);
  const peutVoter = usePeut('voter');

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
      </section>

      <MesIncontournables />

      {peutVoter ? (
        <section className="space-y-2 rounded-lg border border-border p-3">
          <AppetitsThematiques />
        </section>
      ) : null}

      <section className="space-y-1 rounded-lg border border-dashed border-border p-3">
        <h2 className="text-sm font-medium">Mon itinéraire idéal</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Bientôt : à partir de votre cadence, de vos coups de cœur et de vos envies, le voyage vous proposera VOTRE
          version idéale. On y travaille.
        </p>
      </section>
    </section>
  );
}
