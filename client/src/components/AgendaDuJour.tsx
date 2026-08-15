import type { JourAgenda, ActiviteAgenda } from '@barjotur/shared';
import { GROUPES_MOMENT } from '@barjotur/shared';
import { LIBELLE_MOMENT, LIBELLE_TYPE_NUIT, formatDuree } from '@/lib/agenda-libelles';

// AGENDA DU JOUR (M499/M502 §2) : les activités d'un jour, GROUPÉES PAR MOMENT (matin/midi/après-midi/soir) — pas une
// liste plate. Chaque ligne : heure d'ancrage, titre, sous-titre, durée, et les ancres DURES (ferry/réservation) bien
// distinctes des activités souples. Puis le CONFORT vécu du jour (laverie + cadence, type de nuit + coût, alerte PPC).
// Voix famille, gros texte lisible. R1 : rien d'inventé, on n'affiche que ce que la donnée porte.

function LigneActivite({ a }: { a: ActiviteAgenda }) {
  const dure = a.contrainte === 'dure';
  const duree = formatDuree(a.duree_min);
  return (
    <li className="flex gap-3 py-2">
      <div className="w-14 shrink-0 pt-0.5 text-right">
        {a.heure ? (
          <span className={dure ? 'chiffres text-sm font-semibold' : 'chiffres text-sm text-muted-foreground'}>
            {a.heure}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-medium">{a.titre}</span>
          {dure ? (
            <span
              className="rounded-full px-1.5 py-0.5 text-xs font-medium text-primary-foreground"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              horaire à tenir
            </span>
          ) : null}
        </div>
        {a.sous_titre ? <p className="text-sm text-muted-foreground">{a.sous_titre}</p> : null}
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {duree ? <span>{duree}</span> : null}
          {a.payant ? (
            <span>{a.cout_eur != null ? `${a.cout_eur} € · payant` : 'payant'}</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function BlocConfort({ jour }: { jour: JourAgenda }) {
  const c = jour.confort;
  const nuit = LIBELLE_TYPE_NUIT[c.type_nuit];
  return (
    <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">La nuit</span>
        <span className="text-muted-foreground">
          {nuit}
          {c.cout_nuit_eur != null ? ` · ${c.cout_nuit_eur} €` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {c.laverie ? (
          <span>Laverie sur place</span>
        ) : c.laverie_jours_avant != null ? (
          <span>
            Prochaine laverie dans <span className="chiffres">{c.laverie_jours_avant}</span> j
          </span>
        ) : null}
        {c.streak_autonomie != null && c.streak_autonomie > 0 ? (
          <span>
            <span className="chiffres">{c.streak_autonomie}</span> nuit(s) d’autonomie d’affilée
          </span>
        ) : null}
      </div>
      {c.alerte_ppc ? (
        <p className="text-xs" style={{ color: 'var(--destructive)' }}>
          Autonomie électrique bientôt à sa limite : prévoir une nuit avec prise pour la machine (PPC).
        </p>
      ) : null}
    </div>
  );
}

export function AgendaDuJour({ jour }: { jour: JourAgenda }) {
  const parMoment = GROUPES_MOMENT.map((m) => ({
    moment: m,
    activites: jour.activites.filter((a) => a.groupe_moment === m),
  })).filter((g) => g.activites.length > 0);

  return (
    <section className="space-y-4">
      {parMoment.length === 0 ? (
        <p className="text-sm text-muted-foreground">Journée libre : rien de calé, à vous de la remplir.</p>
      ) : (
        parMoment.map((g) => (
          <div key={g.moment} className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {LIBELLE_MOMENT[g.moment]}
            </h3>
            <ul className="divide-y divide-border">
              {g.activites.map((a, i) => (
                <LigneActivite key={`${a.titre}-${i}`} a={a} />
              ))}
            </ul>
          </div>
        ))
      )}
      <BlocConfort jour={jour} />
    </section>
  );
}
