// Page d'accès privé (M468 §1). L'app est PRIVÉE : elle ne s'ouvre QUE depuis le lien personnel /app/<token>/.
// Rendue par GardeAcces dès qu'aucune identité n'est résolue (ni persistée, ni token à l'URL), sur la racine et
// toute route de l'app. Standalone : aucune nav, aucun bandeau, rien de l'app browsable. Texte fidèle à M468.
export default function AccesPrive() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
      <section className="w-full max-w-md space-y-6 text-center">
        <p className="font-serif text-sm uppercase tracking-[0.2em] text-muted-foreground">Norvège 2027</p>
        <h1 className="font-serif text-3xl leading-tight">Accès par lien personnel</h1>
        <div className="space-y-3 text-muted-foreground">
          <p>Cette application est privée.</p>
          <p>
            Elle s'ouvre uniquement depuis le lien personnel qui vous a été envoyé. Ouvrez ce lien pour y
            accéder.
          </p>
        </div>
        <div aria-hidden className="mx-auto h-px w-16 bg-border" />
        <p className="text-xs text-muted-foreground">Barjøtur — le voyage qui vous ressemble</p>
      </section>
    </main>
  );
}
