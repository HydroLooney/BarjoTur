import type { VoteTier } from '@barjotur/shared';
import { AVIS } from '@/lib/libelles';
import { cn } from '@/lib/utils';

// Overlay d'ÉCHANGE (M385/M388) : quand un cran de vote est PLEIN, on ne bloque pas — on échange en 2-3 clics, SANS
// quitter le contexte (carte/liste/fiche). Montre mes votes de ce cran ; « retirer » un ancien → il revient au défaut
// et le NOUVEAU prend sa place (auto-promotion). Léger (pas une page), fermable, retour immédiat. Optimiste, dark-safe.
// Le « voir » (fiche en couche) se branchera avec le clic→fiche (M375 §3) ; ici le geste central = retirer/auto-promo.

interface LieuTier {
  ref: string;
  osm_id: string;
  nom: string;
}

interface Props {
  tier: VoteTier;
  lieux: LieuTier[];
  /** Nom du lieu qu'on veut poser au cran plein (celui qui a déclenché l'échange). */
  nouveauNom?: string;
  onRetirer: (ref: string) => void;
  onVoir?: (osmId: string) => void;
  /** Voie (b) « Régler plus tard » (M394) : accepter le vote en surplus hors-budget (non compté), résoudre plus tard. */
  onReglerPlusTard?: () => void;
  /** Voie (a) « Rééquilibrer maintenant » (M394) : déclencher la cascade de déclassement. */
  onRebalancer?: () => void;
  /** En mode CASCADE (voie a) : l'étape courante (déclasser un `candidat` du `tier` vers `vers`) + la position. */
  cascade?: { etape: { tier: VoteTier; vers: VoteTier; candidats: LieuTier[] }; index: number; total: number } | null;
  onDescendre?: (ref: string) => void;
  onAnnuler: () => void;
  enCours?: boolean;
}

export function OverlayEchange({
  tier,
  lieux,
  nouveauNom,
  onRetirer,
  onVoir,
  onReglerPlusTard,
  onRebalancer,
  cascade,
  onDescendre,
  onAnnuler,
  enCours,
}: Props) {
  const avis = AVIS[tier as keyof typeof AVIS] ?? tier;
  const enCascade = !!cascade;
  // En cascade (voie a) : on déclasse un candidat du cran plein vers le cran d'accueil ; sinon échange/hors-budget.
  const avisEtape = cascade ? (AVIS[cascade.etape.tier as keyof typeof AVIS] ?? cascade.etape.tier) : '';
  const avisVers = cascade ? (AVIS[cascade.etape.vers as keyof typeof AVIS] ?? cascade.etape.vers) : '';
  const items = cascade ? cascade.etape.candidats : lieux;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={enCascade ? `Rééquilibrage ${avisEtape}` : `Échange de vote ${avis}`}
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/30 p-2 backdrop-blur-[1px] sm:items-center"
    >
      <div className="w-full max-w-sm rounded-[var(--rayon)] border border-border bg-card p-3 shadow-flottante">
        <div className="mb-2 flex items-start justify-between gap-2">
          {enCascade ? (
            <p className="text-sm font-medium">
              Rééquilibrage {cascade ? `(${cascade.index + 1}/${cascade.total})` : ''}
              <br />
              <span className="text-muted-foreground">
                Le cran « {avisEtape} » est plein : descends-en un vers « {avisVers} ».
              </span>
            </p>
          ) : (
            <p className="text-sm font-medium">
              Ton cran « {avis} » est plein.
              <br />
              <span className="text-muted-foreground">
                Lequel remplacer{nouveauNom ? ` par « ${nouveauNom} »` : ''} ?
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={onAnnuler}
            aria-label="Fermer"
            className="min-h-tactile px-1 text-lg text-muted-foreground hover:text-foreground"
          >
            ×
          </button>
        </div>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {items.map((l) => (
            <li key={l.ref} className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-2 py-1.5">
              <span className="flex-1 truncate text-sm">{l.nom}</span>
              {onVoir ? (
                <button
                  type="button"
                  onClick={() => onVoir(l.osm_id)}
                  className="min-h-tactile shrink-0 px-1 text-xs text-accent hover:underline"
                >
                  voir
                </button>
              ) : null}
              <button
                type="button"
                disabled={enCours}
                onClick={() => (enCascade ? onDescendre?.(l.ref) : onRetirer(l.ref))}
                className={cn(
                  'min-h-tactile shrink-0 rounded-md border border-border px-2 text-xs font-medium hover:bg-muted disabled:opacity-50',
                )}
              >
                {enCascade ? 'descendre' : 'retirer'}
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun lieu {enCascade ? 'à déclasser' : 'à échanger'} pour l'instant.</p>
        ) : null}
        {/* Voie (a) M394 : lancer la CASCADE de déclassement (jusqu'au plancher B). Seulement hors cascade. */}
        {!enCascade && onRebalancer ? (
          <button
            type="button"
            disabled={enCours}
            onClick={onRebalancer}
            className="mt-2 w-full rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            Rééquilibrer maintenant <span className="font-normal opacity-80">(descendre en cascade jusqu'à faire de la place)</span>
          </button>
        ) : null}
        {/* Voie (b) M394 : accepter en SURPLUS hors-budget (l'app dit clairement que ça ne compte pas tant que non rangé). */}
        {!enCascade && onReglerPlusTard ? (
          <button
            type="button"
            disabled={enCours}
            onClick={onReglerPlusTard}
            className="mt-2 w-full rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            Régler plus tard <span className="opacity-80">(garde ce vote, mais il ne comptera pas tant que tu n'as pas rangé ce cran)</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onAnnuler}
          className="mt-2 min-h-tactile text-xs text-muted-foreground underline hover:text-foreground"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
