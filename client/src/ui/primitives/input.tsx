import * as React from 'react';
import { cn } from '@/lib/utils';

// Champ de saisie shadcn, token-driven. Hauteur = cible tactile (44px, A06). Rappel transverse :
// tout slider de l'app sera double d'un champ numerique lie a ce composant (preference UI de Guillaume).
export const Champ = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Champ.displayName = 'Champ';
