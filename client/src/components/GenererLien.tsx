import { useState } from 'react';
import type { EspaceId, LienGenere, PorteeLien } from '@barjotur/shared';
import { PORTEE_DEFAUT } from '@barjotur/shared';
import { useIdentite } from '@/stores/identite';
import { useVoyageContexte } from '@/stores/voyage';
import { usePeut } from '@/hooks/usePeut';
import { useGenererLien } from '@/lib/queries/admin';
import { Bouton } from '@/ui/primitives/button';
import { Champ } from '@/ui/primitives/input';
import { MessageErreur } from '@/ui/blocs/EtatVue';

// Génération de liens de partage à PORTÉE (T057 / M199) : l'organisateur crée un lien Membre / Suggestion /
// Vitrine et voit EN CLAIR ce qu'il ouvre (votes comptés ?, quels espaces). Autorité serveur : PIN dans le corps,
// jamais stocké ni affiché (R2). Flip-ready : hors `live`, on fabrique un LienGenere de démo (rien enregistré).

const PORTEES: { cle: PorteeLien; titre: string; aide: string }[] = [
  { cle: 'membre', titre: 'Membre', aide: 'Participe pleinement, son avis compte dans le voyage commun.' },
  { cle: 'suggestion', titre: 'Suggestion', aide: 'Explore et donne son avis (non compté), voit Notre Voyage.' },
  { cle: 'vitrine', titre: 'Vitrine', aide: 'Lecture seule : la carte animée du voyage, rien d’autre.' },
];

const ESPACE_LABEL: Record<EspaceId, string> = {
  le_voyage: 'Le voyage',
  explorer: 'Explorer',
  mes_envies: 'Mes envies',
  mon_voyage: 'Mon voyage',
  notre_voyage: 'Notre Voyage',
  carte: 'Carte',
  preparatifs: 'Préparatifs',
  reglages: 'Réglages',
};

const ADMIN_LIVE_ENV = import.meta.env.VITE_ADMIN_LIVE === '1';

function espacesVisiblesLisibles(l: LienGenere): string {
  if (!l.espacesVisibles || l.espacesVisibles.length === 0) return 'selon son rôle';
  return l.espacesVisibles.map((e) => ESPACE_LABEL[e]).join(', ');
}

export function GenererLien() {
  const forceLive = import.meta.env.DEV && new URLSearchParams(window.location.search).has('admin');
  const live = ADMIN_LIVE_ENV || forceLive;
  const peutAdministrer = usePeut('administrer_voyageurs');
  const code = useIdentite((s) => s.code);
  const voyageId = useVoyageContexte((s) => s.voyageId);
  const generer = useGenererLien(voyageId, code);

  const [portee, setPortee] = useState<PorteeLien>('suggestion');
  const [prenom, setPrenom] = useState('');
  const [pin, setPin] = useState('');
  const [resultat, setResultat] = useState<LienGenere | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  if (!peutAdministrer) return null;

  const pinManquant = pin.trim().length === 0;

  async function surGenerer() {
    setRefus(null);
    setResultat(null);
    const demande = { portee, prenom: prenom.trim() || undefined, pin };
    if (live) {
      const r = await generer.mutateAsync(demande).catch(() => null);
      if (r) setResultat(r);
      else setRefus('Génération du lien refusée par le service (PIN ou droits).');
      return;
    }
    // Démo hors service : on reconstruit un LienGenere depuis PORTEE_DEFAUT (aucun enregistrement).
    const reglage = PORTEE_DEFAUT[portee];
    setResultat({
      voyageur: {
        id: 0,
        prenom: prenom.trim() || PORTEES.find((p) => p.cle === portee)?.titre || 'Invité',
        role: 'demo',
        qualification: null,
        actif: true,
        codeLien: `demo-${portee}`,
      },
      portee,
      votesComptent: reglage.votesComptent,
      espacesVisibles: reglage.espacesVisibles,
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">Partager un lien</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Créez un lien selon ce que la personne peut faire. Vous voyez avant d’envoyer ce que le lien ouvre.
          {live ? '' : ' Ici, sans service branché, c’est une démo : aucun lien n’est vraiment créé.'}
        </p>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Portée du lien">
        {PORTEES.map((p) => (
          <label
            key={p.cle}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm"
          >
            <input
              type="radio"
              name="portee-lien"
              value={p.cle}
              checked={portee === p.cle}
              onChange={() => setPortee(p.cle)}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="font-medium">{p.titre}</span>
              <span className="block text-xs text-muted-foreground">{p.aide}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Prénom (facultatif)
          <Champ value={prenom} onChange={(e) => setPrenom(e.target.value)} className="max-w-48" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          PIN organisateur
          <Champ
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="max-w-48"
            autoComplete="off"
            placeholder="requis"
          />
        </label>
        <Bouton size="sm" disabled={pinManquant && live} onClick={() => void surGenerer()}>
          Générer le lien
        </Bouton>
      </div>

      {resultat ? (
        <div className="space-y-1 rounded-lg border border-border bg-card p-3 text-sm shadow-posee">
          <p className="font-medium">Lien prêt à partager</p>
          <p className="text-xs text-muted-foreground">
            Portée : <span className="text-foreground">{PORTEES.find((p) => p.cle === resultat.portee)?.titre}</span> ·
            avis {resultat.votesComptent ? 'compté dans le voyage' : 'non compté'} · voit{' '}
            {espacesVisiblesLisibles(resultat)}.
          </p>
          {/* Le code de lien EST fait pour être partagé (pas un secret) ; le PIN, lui, n'apparaît jamais (R2). */}
          <p className="select-all break-all font-mono text-xs text-foreground">/app/{resultat.voyageur.codeLien}</p>
        </div>
      ) : null}

      {refus ? <MessageErreur>{refus}</MessageErreur> : null}
    </section>
  );
}
