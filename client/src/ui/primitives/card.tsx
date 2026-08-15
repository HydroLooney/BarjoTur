import * as React from 'react';
import { cn } from '@/lib/utils';

// Carte shadcn/ui, restylee par les jetons (fond `card`, bordure `border`, rayon `lg`). Bloc de base
// des fiches, tuiles et panneaux (A06). Zero hex : tout passe par les classes token-driven.

export const Carte = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border border-border bg-card text-card-foreground shadow-posee', className)}
      {...props}
    />
  ),
);
Carte.displayName = 'Carte';

export const CarteEntete = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 p-4', className)} {...props} />
  ),
);
CarteEntete.displayName = 'CarteEntete';

export const CarteTitre = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('font-serif text-section leading-tight', className)} {...props} />
  ),
);
CarteTitre.displayName = 'CarteTitre';

export const CarteContenu = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />,
);
CarteContenu.displayName = 'CarteContenu';

export const CartePied = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-2 p-4 pt-0', className)} {...props} />
  ),
);
CartePied.displayName = 'CartePied';
