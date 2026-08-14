import { useState } from 'react';
import type { EtapeTransit } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { estOrganisateur } from '@/lib/parcours';
import { transitDemo } from '@/lib/fixtures/voyage-demo';
import { basculerAutonomie, libelleArret, nouvelleEtapeTransit } from '@/lib/transit';
import { Badge } from '@/ui/primitives/badge';
import { Bouton } from '@/ui/primitives/button';
import { MessageVide } from '@/ui/blocs/EtatVue';

// Transit app-side (A19 / M055) : distingue les étapes de TRANSIT (repositionnement, on minimise) des
// étapes d'EXPÉRIENCE (la boucle, on maximise le beau). Une étape de transit montre son corridor et son
// faisceau d'arrêts candidats (réservé / épinglé / autonomie / payant). L'organisateur peut basculer
// autonomie/payant et INSÉRER une étape de transit (A19 §8.2). Flip-ready sur fixture jusqu'au routage réel.
const POINT_A_PRECISER = { label: 'à préciser', lat: 0, lon: 0 };

type VariantBadge = 'primaire' | 'tierB' | 'contour' | 'neutre';
function variantEtat(label: string): VariantBadge {
  if (label === 'réservé') return 'primaire';
  if (label === 'épinglé') return 'tierB';
  if (label === 'autonomie') return 'contour';
  return 'neutre';
}

export function EtapesTransit() {
  const role = useIdentite((s) => s.role);
  const orga = estOrganisateur(role);
  const [etapes, setEtapes] = useState<EtapeTransit[]>(transitDemo);

  const ordonnees = [...etapes].sort((a, b) => a.ordre - b.ordre);

  function toggle(etapeId: string, arretId: string) {
    setEtapes((es) =>
      es.map((e) => (e.id === etapeId ? { ...e, faisceau: basculerAutonomie(e.faisceau, arretId) } : e)),
    );
  }
  function inserer() {
    setEtapes((es) => {
      const ordre = es.reduce((m, e) => Math.max(m, e.ordre), 0) + 1;
      return [...es, nouvelleEtapeTransit(ordre, POINT_A_PRECISER, POINT_A_PRECISER)];
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Transit</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Les étapes de <strong>transit</strong> repositionnent le van (on minimise le temps) ; les étapes
          d'<strong>expérience</strong> maximisent le beau (la boucle, sur la carte et l'atlas). Un arrêt de
          transit est un candidat : réservé et épinglé sont imposés, les autres sont choisis par l'optimisation,
          nuits en autonomie par défaut.
        </p>
      </div>

      {ordonnees.length === 0 ? <MessageVide>Aucune étape de transit.</MessageVide> : null}

      <ol className="space-y-2">
        {ordonnees.map((e) => (
          <li key={e.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="neutre">transit</Badge>
              <span className="font-medium">{e.depuis.label}</span>
              <span className="text-muted-foreground">→ {e.vers.label}</span>
              {e.jalon_date ? <span className="text-xs text-accent">jalon {e.jalon_date}</span> : null}
            </div>
            {e.faisceau.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {e.faisceau.map((a) => {
                  const lab = libelleArret(a);
                  return (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span>{a.label}</span>
                      <Badge variant={variantEtat(lab)}>{lab}</Badge>
                      {orga && !a.reserve ? (
                        <button
                          type="button"
                          onClick={() => toggle(e.id, a.id)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          {a.autonomie ? 'passer en payant' : 'passer en autonomie'}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Faisceau à préciser (corridor en attente du routage).</p>
            )}
          </li>
        ))}
      </ol>

      {orga ? (
        <Bouton size="sm" variant="outline" onClick={inserer}>
          Insérer une étape de transit
        </Bouton>
      ) : null}
    </section>
  );
}
