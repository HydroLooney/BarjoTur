// Mes lieux (C15) : le « papier ». Mes votes groupes par tier, budget de vote restant,
// collections perso (« a revoir », « pour la mere », « si beau temps »), carnet de lieux perso.
export default function MesLieux() {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Mes lieux</h1>
      <p className="max-w-prose text-muted-foreground">
        Mes choix rassembles : ce que j'ai vote, ce que je veux revoir, ce que j'ajoute au carnet.
      </p>
    </section>
  );
}
