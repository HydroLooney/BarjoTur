// COQUILLE « à venir » (M543) : un sous-onglet dont le contenu riche n'est pas encore construit ne montre PAS un
// écran mort — il montre un état vide GUIDÉ, honnête (R1), qui dit ce qui viendra. Réutilisable (Ferry, Réservations,
// et toute future coquille). Voix douce, famille.

export function CoquilleAVenir({ titre, texte }: { titre: string; texte: string }) {
  return (
    <section className="space-y-2 rounded-lg border border-dashed border-border bg-card p-6 text-center">
      <h2 className="font-serif text-xl">{titre}</h2>
      <p className="mx-auto max-w-prose text-sm text-muted-foreground">{texte}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">À venir</p>
    </section>
  );
}
