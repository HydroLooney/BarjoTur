import type { MonVoyageIdeal, EcartAuCommun } from '@barjotur/shared';
import type { Geometry } from 'geojson';
import { CarteMapLibre } from '@/components/CarteMapLibre';

// MON VOYAGE IDÉAL (#2, contrat 5106fd2) : l'itinéraire composé pour la SEULE signature du voyageur (son idéal) +
// son ÉCART au voyage commun (le couple miroir Moi↔Nous). Honnête (R1) : on montre combien le commun te sert, sans
// culpabiliser ni survendre. Remplace le « Bientôt ». Gros texte, voix douce.

function pct(v: number): number {
  return Math.round(Math.min(1, Math.max(0, v)) * 100);
}

/** Jauge de satisfaction [0..1], jeton de couleur passé par l'appelant (miroir Moi↔Nous). */
function Jauge({ libelle, valeur, token }: { libelle: string; valeur: number; token: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span>{libelle}</span>
        <span className="tabular-nums text-muted-foreground">{pct(valeur)} %</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full" style={{ width: `${pct(valeur)}%`, backgroundColor: `var(${token})` }} />
      </div>
    </div>
  );
}

function EcartBloc({ ecart }: { ecart: EcartAuCommun }) {
  const partagees = ecart.bases_partagees.length;
  const persoSeules = ecart.bases_perso_seules.length;
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Toi et le voyage commun</h3>
      {ecart.resume ? <p className="text-sm">{ecart.resume}</p> : null}

      <div className="space-y-2">
        <Jauge libelle="Dans ton voyage idéal" valeur={ecart.satisfaction_ideal} token="--fil-aller" />
        <Jauge libelle="Dans le voyage commun" valeur={ecart.satisfaction_dans_commun} token="--accent" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="chiffres text-foreground">{partagees}</span> coup{partagees > 1 ? 's' : ''} de cœur partagé
          {partagees > 1 ? 's' : ''}
        </span>
        {persoSeules > 0 ? (
          <span>
            <span className="chiffres text-foreground">{persoSeules}</span> rien qu’à toi (pas dans le commun)
          </span>
        ) : (
          <span>tous tes coups de cœur sont dans le commun</span>
        )}
      </div>
    </div>
  );
}

export function VueMonVoyageIdeal({ data }: { data: MonVoyageIdeal }) {
  const { ideal, ecart } = data;

  if (!ideal.ok) {
    return (
      <section className="space-y-1 rounded-lg border border-dashed border-border p-4">
        <h2 className="font-serif text-xl">Mon itinéraire idéal</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Ton itinéraire idéal se compose à partir de ta façon de voyager et de tes coups de cœur. Reviens dans un
          instant.
        </p>
      </section>
    );
  }

  const nBases = ideal.route?.length ?? ideal.n_etapes ?? 0;
  const nuits = ideal.nights_par_base
    ? Object.values(ideal.nights_par_base).reduce((a, b) => a + b, 0)
    : null;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="space-y-1">
        <h2 className="font-serif text-xl">Mon itinéraire idéal</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Composé pour toi seul, à partir de ta façon de voyager et de tes coups de cœur. C’est ta version rêvée du
          voyage.
        </p>
      </div>

      {ideal.geom ? (
        <CarteMapLibre mode="lecture-ideal" geom={ideal.geom as Geometry} hauteur="40vh" />
      ) : null}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {nBases > 0 ? (
          <span>
            <span className="chiffres font-medium">{nBases}</span> étapes
          </span>
        ) : null}
        {nuits != null ? (
          <span>
            <span className="chiffres font-medium">{nuits}</span> nuits
          </span>
        ) : null}
      </div>

      {ecart ? (
        <EcartBloc ecart={ecart} />
      ) : (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Le voyage commun n’est pas encore arrêté : ton écart au commun apparaîtra dès qu’il le sera.
        </p>
      )}
    </section>
  );
}
