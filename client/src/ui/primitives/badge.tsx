import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Badge / chip shadcn, token-driven. Variantes de tier (T/S/A/B) branchees sur les jetons `tier-*`
// (source unique), pour afficher un niveau sans jamais recoder une couleur (R03).
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutre: 'border-border bg-muted text-muted-foreground',
        primaire: 'border-transparent bg-primary text-primary-foreground',
        contour: 'border-border text-foreground',
        // Tiers : texte blanc sur la couleur du tier (jetons tier-*).
        tierT: 'border-transparent bg-tier-T text-primary-foreground',
        tierS: 'border-transparent bg-tier-S text-primary-foreground',
        tierA: 'border-transparent bg-tier-A text-primary-foreground',
        tierB: 'border-transparent bg-tier-B text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'neutre' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
