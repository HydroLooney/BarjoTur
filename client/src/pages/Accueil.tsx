// Accueil : amorce du fil conducteur du parcours (C19). Pour l'instant une coquille ;
// s'enrichira du « quoi faire maintenant » (ce qu'il reste a decouvrir, a voter, a decider).
export default function Accueil() {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-3xl">Barjøtur</h1>
      <p className="max-w-prose text-muted-foreground">
        Le voyage qui vous ressemble. Ici commence le fil du parcours : ce qu'il reste a decouvrir,
        ce qui attend un vote, ce qui se decide bientot.
      </p>
    </section>
  );
}
