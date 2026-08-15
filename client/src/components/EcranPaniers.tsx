import { AVIS } from '@/lib/libelles';
import { useIdentite } from '@/stores/identite';
import { usePaniers, useVoteUnitaire } from '@/lib/queries/votes';
import { cn } from '@/lib/utils';

// Écran de classement « mes paniers / mon budget TSAB » (M383/M394/M424) : par cran (T/S/A/B/C), ce qui est DANS le
// budget (compté) vs le SURPLUS hors-budget (NON compté tant que non rangé, en rouge), avec le quota. Rééquilibrage d'un
// geste : « retirer » un surplus (le dévote) → le panier rentre, la notification s'efface. Feedback LIVE (usePaniers
// invalidé au vote). Charté par tokens, dark-safe. Vide en dev (dégradé propre) ; se remplit avec les vrais votes.

export function EcranPaniers() {
  const code = useIdentite((s) => s.code);
  const { data, isLoading } = usePaniers(code);
  const voter = useVoteUnitaire(code);

  if (!code) {
    return <p className="text-sm text-muted-foreground">Ouvrez votre lien perso pour voir vos paniers.</p>;
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement de vos paniers…</p>;
  const paniers = data?.paniers ?? [];

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h2 className="font-serif text-lg">Mes paniers</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Vos votes rangés par cran. Ce qui déborde du budget est gardé en <span className="text-[var(--ocre-actif)]">surplus</span>{' '}
          mais <strong>ne compte pas</strong> tant que vous ne l'avez pas rangé.
        </p>
      </header>

      {data?.budget_a_resoudre ? (
        <p className="rounded-md border border-border bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
          Un ou plusieurs crans débordent. Retirez un surplus pour que tout rentre.
        </p>
      ) : null}

      {paniers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun vote pour l'instant. Votez des lieux pour composer vos paniers.</p>
      ) : null}

      <ul className="space-y-2">
        {paniers.map((p) => (
          <li key={p.tier} className={cn('rounded-lg border p-2', p.a_reequilibrer ? 'border-[var(--ocre-actif)]' : 'border-border')}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">
                {AVIS[p.tier as keyof typeof AVIS] ?? p.tier}
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {p.dans_budget.length}
                  {p.quota != null ? ` / ${p.quota}` : ''}
                </span>
              </span>
              {p.a_reequilibrer ? (
                <span className="rounded-full px-2 py-0.5 text-[0.625rem] font-medium" style={{ backgroundColor: 'var(--ocre-voile)', color: 'var(--ocre-actif)' }}>
                  à rééquilibrer
                </span>
              ) : null}
            </div>
            {p.dans_budget.length ? (
              <ul className="space-y-0.5">
                {p.dans_budget.map((l) => (
                  <li key={l.ref} className="truncate text-sm text-foreground">{l.nom}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Vide.</p>
            )}
            {p.hors_budget.length ? (
              <div className="mt-1.5 border-t border-border pt-1.5">
                <p className="text-[0.625rem] font-medium" style={{ color: 'var(--ocre-actif)' }}>
                  Surplus (ne compte pas) :
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {p.hors_budget.map((l) => (
                    <li key={l.ref} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm text-muted-foreground">{l.nom}</span>
                      <button
                        type="button"
                        disabled={voter.isPending}
                        onClick={() => void voter.mutateAsync({ ref: l.ref as `p:${string}`, tier: undefined })}
                        className="min-h-tactile shrink-0 rounded-md border border-border px-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
                      >
                        retirer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
