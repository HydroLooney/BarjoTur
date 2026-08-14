import { useProfilsDeplacement } from '@/lib/queries/profils';
import { profilsDemo } from '@/lib/fixtures/profils-demo';
import { PROFILS_MODE } from '@/lib/libelles';
import { Badge } from '@/ui/primitives/badge';

// Profils de déplacement (T038, décision M074) : AFFICHAGE seul des réglages de trajet par mode
// (van/piéton/rando/TC), valeur + recommandée + raison en clair, le van gelé une fois réservé (A18). L'édition
// est reportée (elle couple au recompute et au portail organisateur T027). Flip-ready : hors live, fixture
// illustrative ; en live, endpoint de lecture B/M (à confirmer). Zéro contrat inventé (réutilise `Parametre`).
const PROFILS_LIVE_ENV = import.meta.env.VITE_PROFILS_LIVE === '1';

export function ProfilsDeplacement() {
  const forceLive = import.meta.env.DEV && new URLSearchParams(window.location.search).has('profils');
  const live = PROFILS_LIVE_ENV || forceLive;
  const serveur = useProfilsDeplacement(live);
  const profils = live && serveur.data ? serveur.data : profilsDemo;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Comment on se déplace</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Les réglages de trajet par mode. En lecture : le van est gelé une fois réservé, et modifier un profil
          (ce qui relance les calculs) viendra plus tard.
          {live ? '' : ' Valeurs d’exemple tant que le service n’est pas branché.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {profils.map((p) => (
          <div key={p.mode} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">{PROFILS_MODE[p.mode]}</span>
              {p.gele ? <Badge variant="primaire">gelé</Badge> : null}
            </div>
            {p.gele && p.gelePar ? (
              <p className="mt-1 text-xs text-muted-foreground">Gelé par {p.gelePar}.</p>
            ) : null}

            <dl className="mt-2 space-y-2">
              {p.params.map((param) => {
                const recommande =
                  param.valeur_recommandee != null &&
                  String(param.valeur_recommandee) !== String(param.valeur)
                    ? ` (recommandé : ${String(param.valeur_recommandee)})`
                    : '';
                return (
                  <div key={param.cle}>
                    <dt className="text-sm">
                      <span className="font-mono text-xs text-muted-foreground">{param.cle}</span>
                      {' · '}
                      {String(param.valeur)}
                      {recommande}
                    </dt>
                    <dd className="text-xs text-muted-foreground">{param.justification}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}
