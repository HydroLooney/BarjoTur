import { useEffect, useState } from 'react';
import type { ActionCran, Cran, EtatParcours, TransitionCran } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { useVoyageContexte } from '@/stores/voyage';
import { appliquerTransition, estOrganisateur } from '@/lib/parcours';
import { parcoursDemo } from '@/lib/fixtures/parcours-demo';
import { useParcoursServeur, useTransitionParcours } from '@/lib/queries/parcours';
import { Badge } from '@/ui/primitives/badge';
import { Bouton } from '@/ui/primitives/button';
import { Champ } from '@/ui/primitives/input';
import { MessageErreur } from '@/ui/blocs/EtatVue';
import { CRANS, ETATS_CRAN } from '@/lib/libelles';
import { cn } from '@/lib/utils';

// Fil du parcours (A18 / M046) : la machine à crans du voyage. Chaque cran montre son état de validation
// (brouillon, cadenas ouvert = modifiable, cadenas fermé = verrouillé). Conscient du rôle (A03/C05) :
// l'organisateur voit les transitions (valider / verrouiller / rouvrir) gatées par le PIN ; les voyageurs
// lisent l'avancement. Rouvrir un cran signale l'aval invalidé (à refaire). STRUCTURE générique : la
// politique (quel cran est irréversible) est lue depuis `Cran.reouvrable`, jamais codée en dur (M048).
// Flip-ready : hors `live`, fixture + machine locale (`lib/parcours`) ; en live, endpoints B (M047).
const PARCOURS_LIVE_ENV = import.meta.env.VITE_PARCOURS_LIVE === '1';

type VariantBadge = 'neutre' | 'contour' | 'primaire';

function etatLisible(c: Cran): { texte: string; variant: VariantBadge } {
  if (c.etat === 'valide_verrouille') return { texte: ETATS_CRAN.valide_verrouille, variant: 'primaire' };
  if (c.etat === 'valide_modifiable') return { texte: ETATS_CRAN.valide_modifiable, variant: 'contour' };
  return { texte: ETATS_CRAN.brouillon, variant: 'neutre' };
}

export function CransParcours() {
  const forceLive = import.meta.env.DEV && new URLSearchParams(window.location.search).has('parcours');
  const live = PARCOURS_LIVE_ENV || forceLive;
  const role = useIdentite((s) => s.role);
  const orga = estOrganisateur(role);
  const voyageId = useVoyageContexte((s) => s.voyageId);

  const serveur = useParcoursServeur(voyageId, live);
  const transition = useTransitionParcours(voyageId);

  const [etat, setEtat] = useState<EtatParcours>(parcoursDemo);
  const [pin, setPin] = useState('');
  const [refus, setRefus] = useState<string | null>(null);
  const [avalInvalide, setAvalInvalide] = useState<string[]>([]);

  useEffect(() => {
    if (live && serveur.data) setEtat(serveur.data);
  }, [live, serveur.data]);

  const crans = [...etat.crans].sort((a, b) => a.ordre - b.ordre);

  async function agir(cran: Cran, action: ActionCran) {
    setRefus(null);
    setAvalInvalide([]);
    // PIN requis pour une transition modifiable (le corps le porte, jamais stocké : A03).
    const t: TransitionCran = { voyage_id: etat.voyage_id, cran: cran.id, action, pin: pin || undefined };
    if (live) {
      const r = await transition.mutateAsync(t).catch(() => null);
      if (r && r.ok && r.etat) {
        setEtat(r.etat);
        setAvalInvalide(r.aval_invalide ?? []);
      } else {
        setRefus(r?.raison ?? 'Transition refusée par le service.');
      }
    } else {
      const r = appliquerTransition(etat, t, role);
      if (r.ok && r.etat) {
        setEtat(r.etat);
        setAvalInvalide(r.aval_invalide ?? []);
      } else {
        setRefus(r.raison ?? 'Transition refusée.');
      }
    }
  }

  const pinManquant = orga && pin.trim().length === 0;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Le fil du parcours</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Les étapes du voyage et leur état. Un cadenas ouvert peut être rouvert (l'aval sera à refaire) ; un
          cadenas fermé est figé par un fait extérieur (réservation, dates, ferry).
          {orga ? " En tant qu'organisateur, vous faites évoluer chaque cran." : ' Avancement en lecture.'}
        </p>
      </div>

      {orga ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="pin-parcours" className="text-xs text-muted-foreground">
            PIN organisateur
          </label>
          <Champ
            id="pin-parcours"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="requis pour valider ou rouvrir"
            className="max-w-56"
            autoComplete="off"
          />
        </div>
      ) : null}

      <ol className="space-y-2">
        {crans.map((c) => {
          const lisible = etatLisible(c);
          const courant = c.id === etat.cran_courant;
          const invalide = avalInvalide.includes(c.id);
          return (
            <li
              key={c.id}
              className={cn(
                'rounded-lg border p-3',
                courant ? 'border-primary bg-muted' : 'border-border',
                invalide ? 'border-accent' : '',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{c.ordre}</span>
                <span className="font-medium">{CRANS[c.id] ?? c.libelle}</span>
                <Badge variant={lisible.variant}>{lisible.texte}</Badge>
                {courant ? <span className="text-xs text-primary">en cours</span> : null}
                {invalide ? <span className="text-xs text-accent">à refaire</span> : null}
                {!c.reouvrable && c.etat !== 'brouillon' ? (
                  <span className="text-xs text-muted-foreground">définitif</span>
                ) : null}
              </div>

              {c.gele.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">Fige : {c.gele.join(', ')}.</p>
              ) : null}

              {orga ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.etat === 'brouillon' ? (
                    <Bouton size="sm" variant="outline" disabled={pinManquant} onClick={() => agir(c, 'valider')}>
                      Valider
                    </Bouton>
                  ) : null}
                  {c.etat === 'valide_modifiable' ? (
                    <>
                      <Bouton size="sm" variant="outline" disabled={pinManquant} onClick={() => agir(c, 'verrouiller')}>
                        Verrouiller
                      </Bouton>
                      <Bouton size="sm" variant="ghost" disabled={pinManquant} onClick={() => agir(c, 'rouvrir')}>
                        Rouvrir
                      </Bouton>
                    </>
                  ) : null}
                  {c.etat === 'valide_verrouille' && c.reouvrable ? (
                    <Bouton size="sm" variant="ghost" disabled={pinManquant} onClick={() => agir(c, 'rouvrir')}>
                      Rouvrir
                    </Bouton>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {pinManquant ? (
        <p className="text-xs text-muted-foreground">Saisissez le PIN pour faire évoluer un cran.</p>
      ) : null}
      {refus ? <MessageErreur>{refus}</MessageErreur> : null}
      {avalInvalide.length > 0 ? (
        <p className="text-xs text-accent">
          Réouverture : {avalInvalide.length} cran(s) en aval repassent en brouillon, à refaire.
        </p>
      ) : null}
    </section>
  );
}
