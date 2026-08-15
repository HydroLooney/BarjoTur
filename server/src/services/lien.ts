// Service génération/révocation de liens d'invitation par portée (A34/M173/M176). Données PRÉCIEUSES (membre.*, hors
// sync). Autorité serveur : organisateur (peut administrer_voyageurs) + PIN RE-vérifié côté RPC (010). Le rôle du lien
// vient de ROLE_PAR_PORTEE (shared) ; `votesComptent` est porté par ce rôle (le consensus ignore déjà demo/invite).
// Ne connaît pas Express. Flip-ready : RPC api.voyageur_lien_generer/_revoquer (010) au GO.

import { appelerRpc, argTexte, argTexteArray } from '../db/rpc.js';
import { Erreurs, ErreurRequete, exigerPresent } from '../http/erreurs.js';
import { lireWhoami } from './identite.js';
import { exigerCapacite } from './voyageurs.js';
import { versVoyageur } from '../domain/voyageurs.js';
import { PORTEE_DEFAUT } from '../domain/lien.js';
import type { PorteeLien, EspaceId, DemandeGenererLien, DemandeRevoquerLien, LienGenere } from '../domain/lien.js';
import type { MembreBrut } from '../domain/voyageurs.js';

const PORTEES: readonly PorteeLien[] = ['membre', 'suggestion', 'vitrine'];
const ESPACES: readonly EspaceId[] = [
  'le_voyage', 'explorer', 'mes_envies', 'mon_voyage', 'notre_voyage', 'carte', 'preparatifs', 'reglages',
];

function exigerTexte(v: unknown, nom: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw Erreurs.requeteInvalide(`Champ requis manquant ou vide : ${nom}.`);
  return v;
}

/** Valide { portee (énum), prenom?, espacesVisibles?, pin }. Pure. */
export function validerDemandeGenererLien(corps: unknown): DemandeGenererLien {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  const portee = exigerTexte(c.portee, 'portee');
  if (!(PORTEES as readonly string[]).includes(portee)) throw Erreurs.requeteInvalide(`Portée inconnue : ${portee}.`);
  const out: DemandeGenererLien = { portee: portee as PorteeLien, pin: exigerTexte(c.pin, 'pin') };
  if (typeof c.prenom === 'string' && c.prenom.trim() !== '') out.prenom = c.prenom;
  if (Array.isArray(c.espacesVisibles)) {
    out.espacesVisibles = c.espacesVisibles.filter(
      (e): e is EspaceId => typeof e === 'string' && (ESPACES as readonly string[]).includes(e),
    );
  }
  return out;
}

/** Valide { code (cible), pin }. Pure. */
export function validerDemandeRevoquerLien(corps: unknown): DemandeRevoquerLien {
  if (typeof corps !== 'object' || corps === null || Array.isArray(corps)) {
    throw Erreurs.requeteInvalide('Le corps attendu est un objet JSON.');
  }
  const c = corps as Record<string, unknown>;
  return { code: exigerTexte(c.code, 'code'), pin: exigerTexte(c.pin, 'pin') };
}

function refusRpc(error: string | undefined): ErreurRequete {
  const e = (error ?? '').toLowerCase();
  if (e.includes('pin') || e.includes('rôle') || e.includes('role')) return Erreurs.roleInsuffisant(error);
  return Erreurs.requeteInvalide(error ?? 'Action refusée.');
}

/** Génère un lien (portée→rôle) : autorité organisateur (peut) ; la RPC RE-vérifie organisateur+PIN. Rend le nouveau
 *  Voyageur (avec son code_lien, que l'organisateur partage). */
export async function genererLien(
  _voyageId: number,
  codeOrg: string,
  d: DemandeGenererLien,
  rpc = appelerRpc,
): Promise<LienGenere> {
  const qui = await lireWhoami(codeOrg, rpc);
  exigerCapacite(qui.role, 'administrer_voyageurs');
  const res = await rpc<{ ok: boolean; error?: string; membre?: MembreBrut }>('voyageur_lien_generer', [
    argTexte(d.portee),
    argTexte(d.prenom ?? null),
    argTexteArray(d.espacesVisibles ? [...d.espacesVisibles] : null),
    argTexte(codeOrg),
    argTexte(d.pin),
  ]);
  if (!res?.ok) throw refusRpc(res?.error);
  const voyageur = versVoyageur(exigerPresent(res.membre, () => Erreurs.requeteInvalide('Génération de lien sans retour.')));
  // Portée, votesComptent et espaces effectifs viennent de la demande validée + PORTEE_DEFAUT (autorité serveur = ce que
  // la RPC a stocké : elle a reçu ces mêmes espaces). Rien n'est re-dérivé par C : le contrat est complet ici (T057).
  const reglage = PORTEE_DEFAUT[d.portee];
  const espacesVisibles = d.espacesVisibles ?? reglage.espacesVisibles;
  return {
    voyageur,
    portee: d.portee,
    votesComptent: reglage.votesComptent,
    ...(espacesVisibles ? { espacesVisibles } : {}),
  };
}

/** Révoque un lien cible (le code meurt) : autorité organisateur (peut) ; la RPC RE-vérifie organisateur+PIN. */
export async function revoquerLien(
  _voyageId: number,
  codeOrg: string,
  d: DemandeRevoquerLien,
  rpc = appelerRpc,
): Promise<{ ok: true }> {
  const qui = await lireWhoami(codeOrg, rpc);
  exigerCapacite(qui.role, 'administrer_voyageurs');
  const res = await rpc<{ ok: boolean; error?: string }>('voyageur_lien_revoquer', [
    argTexte(d.code),
    argTexte(codeOrg),
    argTexte(d.pin),
  ]);
  if (!res?.ok) throw refusRpc(res?.error);
  return { ok: true };
}
