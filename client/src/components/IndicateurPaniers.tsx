import { Link } from 'react-router-dom';
import { useIdentite } from '@/stores/identite';
import { usePaniers } from '@/lib/queries/votes';
import { cn } from '@/lib/utils';

// Notification VISIBLE mais non intrusive (M394) : dès qu'un panier de vote déborde (`budget_a_resoudre`), un indicateur
// discret « panier à rééquilibrer » apparaît (badge au profil, pastille sur Explorer). Jamais bloquant, jamais silencieux.
// Cliquer mène à l'écran de classement pour ranger. Inerte tant que rien ne déborde (aucune notification par défaut).

interface Props {
  /** `pastille` = petit point + libellé court (sur Explorer) ; `badge` = pilule au profil. */
  variante?: 'pastille' | 'badge';
  /** Route de l'écran de classement (profil « mes paniers »). */
  vers?: string;
  className?: string;
}

export function IndicateurPaniers({ variante = 'pastille', vers = '/mes-paniers', className }: Props) {
  const code = useIdentite((s) => s.code);
  const { data } = usePaniers(code);
  if (!data?.budget_a_resoudre) return null;

  const nbDebordent = data.paniers.filter((p) => p.a_reequilibrer).length;
  const libelle = `Panier à rééquilibrer${nbDebordent > 1 ? ` (${nbDebordent})` : ''}`;

  return (
    <Link
      to={vers}
      aria-label={libelle}
      title="Des votes ne comptent pas tant que tu n'as pas rangé ton panier."
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border text-xs font-medium transition-colors',
        variante === 'badge'
          ? 'border-border bg-card px-2.5 py-1 text-foreground shadow-posee hover:bg-muted'
          : 'border-border bg-card/90 px-2 py-0.5 text-muted-foreground backdrop-blur-sm hover:text-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: 'var(--ocre)' }}
      />
      {libelle}
    </Link>
  );
}
