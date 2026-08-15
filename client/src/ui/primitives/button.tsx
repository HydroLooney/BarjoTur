import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Bouton shadcn/ui, restyle par les jetons de charte (aucun hex : tout passe par les classes token-driven).
// M520 : le bouton EPOUSE son texte — padding resserre, plus de hauteur fixe (min-h-tactile = plancher au pouce,
// ~40px), le texte garde sa taille (M516). Un seul jeu de padding, propage partout (barre d'actions, chips, votes).
const boutonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-90',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
        outline: 'border border-border bg-background hover:bg-muted',
        ghost: 'hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
      },
      size: {
        // Hauteur = min-h-tactile (plancher au pouce) ; le padding fait le reste, le bouton colle au libelle.
        default: 'min-h-tactile px-3 py-1.5',
        sm: 'min-h-tactile px-2.5 py-1',
        lg: 'min-h-12 px-5 py-2 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface BoutonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof boutonVariants> {
  asChild?: boolean;
}

export const Bouton = React.forwardRef<HTMLButtonElement, BoutonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Composant = asChild ? Slot : 'button';
    return <Composant ref={ref} className={cn(boutonVariants({ variant, size }), className)} {...props} />;
  },
);
Bouton.displayName = 'Bouton';

export { boutonVariants };
