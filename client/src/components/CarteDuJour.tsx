import type { JourAgenda } from '@barjotur/shared';
import { Badge } from '@/ui/primitives/badge';
import { DENSITE_INFO, DENSITE_PART, formatDuree } from '@/lib/agenda-libelles';

// CARTE DU JOUR (M499/M502 §1-2) : l'en-tête d'un jour de l'itinéraire — lieu, thème, perle, lever/coucher, et la
// jauge de DENSITÉ (souple ↔ soutenue, dépassement dit en clair, R1) avec le budget-temps prévu vs consommé. Voix
// famille, gros texte. Se pose sous la barre d'animation, pilotée par le jour sélectionné.

export function CarteDuJour({ jour }: { jour: JourAgenda }) {
  const densite = jour.densite ? DENSITE_INFO[jour.densite] : null;
  const part = jour.densite ? DENSITE_PART[jour.densite] : 0;
  const budget = formatDuree(jour.budget_temps_min);
  const consomme = formatDuree(jour.temps_consomme_min);
  const depasse = jour.densite === 'depasse';

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-posee">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Jour <span className="chiffres">{jour.jour}</span>
            </span>
            {jour.perle ? <Badge variant="primaire">perle</Badge> : null}
          </div>
          <h2 className="font-serif text-2xl">{jour.lieu ?? 'Étape'}</h2>
          {jour.theme ? <p className="max-w-prose text-sm text-muted-foreground">{jour.theme}</p> : null}
        </div>
        {jour.lever || jour.coucher ? (
          <div className="text-right text-xs text-muted-foreground">
            {jour.lever ? (
              <div>
                <span aria-hidden>☀︎</span> lever <span className="chiffres">{jour.lever}</span>
              </div>
            ) : null}
            {jour.coucher ? (
              <div>
                <span aria-hidden>☾</span> coucher <span className="chiffres">{jour.coucher}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {densite ? (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{densite.libelle}</span>
            {budget ? (
              <span className="text-xs text-muted-foreground">
                {consomme ? `${consomme} sur ` : ''}
                {budget} prévu
              </span>
            ) : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.round(part * 100)}%`, backgroundColor: `var(${densite.token})` }}
            />
          </div>
          {depasse ? (
            <p className="text-xs" style={{ color: 'var(--destructive)' }}>
              Le programme dépasse le temps du jour : de quoi alléger, ou prévoir de rentrer plus tard.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
