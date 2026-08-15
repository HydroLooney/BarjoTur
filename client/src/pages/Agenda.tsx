import { Link } from 'react-router-dom';
import { AgendaConfort } from '@/components/AgendaConfort';

// Agenda confort (M343 A / M434 #6) : le confort vécu jour après jour (type de nuit, série d'autonomie liée à la PPC,
// cadence laverie). Ouvert depuis les Préparatifs.
export default function Agenda() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl">L'agenda du confort</h1>
        <p className="max-w-prose text-muted-foreground">
          Jour après jour : où l'on dort, la série de nuits en autonomie (la PPC a besoin d'électricité), et le repère
          laverie. De quoi tenir un rythme confortable sans y penser.
        </p>
      </div>
      <AgendaConfort />
      <Link to="/preparatifs" className="inline-block text-sm text-accent hover:underline">
        ← Retour aux préparatifs
      </Link>
    </section>
  );
}
