import { useParams } from 'react-router-dom';

// Fiche jour imprimable (C12) : la page d'un jour du voyage, pensee pour l'impression et l'atlas.
export default function JourImprimable() {
  const { date } = useParams<{ date: string }>();
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Jour du voyage</h1>
      <p className="text-muted-foreground">Date : {date ?? 'a caler'}.</p>
    </section>
  );
}
