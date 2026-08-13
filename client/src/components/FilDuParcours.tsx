import { useEtatVoyage } from '@/lib/queries/etat-voyage';

// Fil conducteur du parcours (C19 / A15) : « où en est le voyage » et « quoi faire maintenant ». Se
// tait proprement si l'état agrégé n'est pas disponible (l'accueil reste neutre, pas de crash).
const LIBELLE_BUDGET: Record<string, string> = {
  inconnu: 'à cadrer',
  'pre-budget': 'pré-budget',
  estime: 'estimé',
  fiabilise: 'fiabilisé',
};

export function FilDuParcours() {
  const { data } = useEtatVoyage();
  if (!data) return null;

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium">Où en est le voyage</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span>Votes : {data.vote_pct}%</span>
        <span>Cran : {data.cran_actuel}</span>
        <span>Budget : {LIBELLE_BUDGET[data.budget_etat] ?? data.budget_etat}</span>
        <span>Réservations : {data.reservations_n}</span>
      </div>
      {data.prochaine_action ? (
        <p className="text-sm">
          <span className="font-medium">Quoi faire maintenant : </span>
          {data.prochaine_action}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Le voyage est complet.</p>
      )}
    </div>
  );
}
