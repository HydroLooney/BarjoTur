import { useEffect, useState } from 'react';
import type { Role, Voyageur } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { useVoyageContexte } from '@/stores/voyage';
import { estOrganisateur } from '@/lib/parcours';
import { voyageursDemo } from '@/lib/fixtures/voyageurs-demo';
import { useChangerRole, useRegenererLien, useVoyageurs } from '@/lib/queries/admin';
import { ROLES_LABEL } from '@/lib/libelles';
import { Badge } from '@/ui/primitives/badge';
import { Bouton } from '@/ui/primitives/button';
import { Champ } from '@/ui/primitives/input';
import { MessageErreur } from '@/ui/blocs/EtatVue';
import { cn } from '@/lib/utils';

// Admin des voyageurs (T039 / A03) : l'organisateur gère la famille. Il peut changer un rôle et régénérer un
// lien perso (l'ancien devient caduc), gaté par le PIN. Les voyageurs simples ne voient jamais ce panneau.
// Autorité serveur : le PIN transite dans le corps, jamais stocké ; le rôle envoyé est revérifié par B.
// Flip-ready : hors `live`, la fixture alimente le panneau et les gestes sont une démo locale (rien n'est
// enregistré) ; en live, endpoints B (à poser, remontés à M). Le lien perso n'est réémis QUE sur demande.
const ADMIN_LIVE_ENV = import.meta.env.VITE_ADMIN_LIVE === '1';

// Rôles qu'un organisateur peut attribuer depuis l'écran. On ne propose pas « organisateur en chef » (unique,
// arbitré par le PIN maître) ni « démo » (compte de démonstration) : ils restent une bascule serveur.
const ROLES_ATTRIBUABLES: Role[] = ['organisateur', 'voyageur', 'invite'];

export function AdminVoyageurs() {
  const forceLive = import.meta.env.DEV && new URLSearchParams(window.location.search).has('admin');
  const live = ADMIN_LIVE_ENV || forceLive;
  const role = useIdentite((s) => s.role);
  const orga = estOrganisateur(role);
  const voyageId = useVoyageContexte((s) => s.voyageId);

  const serveur = useVoyageurs(voyageId, live && orga);
  const changerRole = useChangerRole(voyageId);
  const regenererLien = useRegenererLien(voyageId);

  const [roster, setRoster] = useState<Voyageur[]>(voyageursDemo);
  const [pin, setPin] = useState('');
  const [refus, setRefus] = useState<string | null>(null);
  const [confirmLien, setConfirmLien] = useState<number | null>(null);

  useEffect(() => {
    if (live && serveur.data) setRoster(serveur.data);
  }, [live, serveur.data]);

  if (!orga) return null;

  const pinManquant = pin.trim().length === 0;

  function remplacer(v: Voyageur) {
    setRoster((r) => r.map((x) => (x.id === v.id ? v : x)));
  }

  async function surRole(v: Voyageur, nouveau: Role) {
    if (nouveau === v.role) return;
    setRefus(null);
    if (live) {
      const r = await changerRole.mutateAsync({ membre_id: v.id, role: nouveau, pin: pin || undefined }).catch(() => null);
      if (r) remplacer(r);
      else setRefus('Changement de rôle refusé par le service (PIN ou droits).');
    } else {
      remplacer({ ...v, role: nouveau });
    }
  }

  async function surRegenerer(v: Voyageur) {
    setRefus(null);
    setConfirmLien(null);
    if (live) {
      const r = await regenererLien.mutateAsync({ membre_id: v.id, pin: pin || undefined }).catch(() => null);
      if (r) remplacer(r);
      else setRefus('Régénération du lien refusée par le service (PIN ou droits).');
    } else {
      remplacer({ ...v, codeLien: `${v.codeLien}-neuf` });
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Les voyageurs</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Qui participe et avec quel rôle. Vous pouvez changer un rôle ou régénérer un lien perso ; l'ancien lien
          cesse alors de marcher. Ces gestes demandent le PIN.
          {live ? '' : ' Ici, sans service branché, les changements sont une démo : rien n’est enregistré.'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="pin-admin" className="text-xs text-muted-foreground">
          PIN organisateur
        </label>
        <Champ
          id="pin-admin"
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="requis pour changer un rôle ou un lien"
          className="max-w-64"
          autoComplete="off"
        />
      </div>

      <ul className="space-y-2">
        {roster.map((v) => {
          const chef = v.role === 'organisateur_principal';
          return (
            <li
              key={v.id}
              className={cn('rounded-lg border border-border p-3', v.actif ? '' : 'opacity-60')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{v.prenom}</span>
                <Badge variant={chef ? 'primaire' : 'contour'}>{ROLES_LABEL[v.role]}</Badge>
                {v.qualification ? (
                  <span className="text-xs text-muted-foreground">{v.qualification}</span>
                ) : null}
                {v.actif ? null : <span className="text-xs text-muted-foreground">lien coupé</span>}
              </div>

              <p className="mt-1 font-mono text-xs text-muted-foreground">/app/{v.codeLien}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {chef ? (
                  <span className="text-xs text-muted-foreground">
                    Rôle en chef : se change par le PIN maître, pas ici.
                  </span>
                ) : (
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    Rôle
                    <select
                      value={v.role}
                      disabled={pinManquant && live}
                      onChange={(e) => surRole(v, e.target.value as Role)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-50"
                    >
                      {(ROLES_ATTRIBUABLES.includes(v.role)
                        ? ROLES_ATTRIBUABLES
                        : [v.role, ...ROLES_ATTRIBUABLES]
                      ).map((r) => (
                        <option key={r} value={r}>
                          {ROLES_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {confirmLien === v.id ? (
                  <span className="flex items-center gap-1">
                    <Bouton size="sm" variant="outline" disabled={pinManquant && live} onClick={() => surRegenerer(v)}>
                      Confirmer le nouveau lien
                    </Bouton>
                    <Bouton size="sm" variant="ghost" onClick={() => setConfirmLien(null)}>
                      Annuler
                    </Bouton>
                  </span>
                ) : (
                  <Bouton
                    size="sm"
                    variant="ghost"
                    disabled={pinManquant && live}
                    onClick={() => setConfirmLien(v.id)}
                  >
                    Régénérer le lien
                  </Bouton>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {pinManquant && live ? (
        <p className="text-xs text-muted-foreground">Saisissez le PIN pour agir sur un voyageur.</p>
      ) : null}
      {refus ? <MessageErreur>{refus}</MessageErreur> : null}
    </section>
  );
}
