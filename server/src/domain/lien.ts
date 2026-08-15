// Portées de liens d'invitation (A34/M173) — contrats canoniques dans @barjotur/shared (role.ts, posé par M). Re-export.
// membre→voyageur (votes comptent), suggestion→demo (non comptés, voit explorer+notre_voyage), vitrine→invite (carte live).

// `LienGenere` (réponse de génération, contrat que C fronte T057) est désormais CANONIQUE dans @barjotur/shared
// (role.ts, promu par M en f9e5fda depuis ma proposition B076) : on le réexporte, plus de définition locale (source unique).
export type {
  PorteeLien,
  ReglagePortee,
  EspaceId,
  DemandeGenererLien,
  DemandeRevoquerLien,
  Voyageur,
  LienGenere,
} from '@barjotur/shared';
export { PORTEE_DEFAUT, ROLE_PAR_PORTEE } from '@barjotur/shared';
