import { useId } from 'react';
import { Champ } from './input';
import { cn } from '@/lib/utils';
import { clampValeur } from '@/lib/valeurs';

interface CurseurValeurProps {
  valeur: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label?: string;
  suffixe?: string;
  className?: string;
}

// Curseur + champ numerique LIES, bornes et cales par clampValeur. Preference transverse de Guillaume :
// tout slider de l'app est double d'une saisie directe (on peut taper la valeur exacte). Token-driven
// (accent ocre via jeton, zero hex dans le JS).
export function CurseurValeur({
  valeur,
  onChange,
  min,
  max,
  step = 1,
  label,
  suffixe,
  className,
}: CurseurValeurProps) {
  const id = useId();
  const poser = (v: number) => onChange(clampValeur(v, min, max, step));
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {label ? (
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valeur}
          onChange={(e) => poser(Number(e.target.value))}
          className="h-2 flex-1 cursor-pointer"
          style={{ accentColor: 'var(--ocre)' }}
        />
        <div className="flex items-center gap-1">
          <Champ
            type="number"
            min={min}
            max={max}
            step={step}
            value={valeur}
            onChange={(e) => poser(Number(e.target.value))}
            className="h-9 w-20"
            aria-label={label ?? 'valeur'}
          />
          {suffixe ? <span className="text-sm text-muted-foreground">{suffixe}</span> : null}
        </div>
      </div>
    </div>
  );
}
