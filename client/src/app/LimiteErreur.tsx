import { Component, type ErrorInfo, type ReactNode } from 'react';

// Limite d'erreur (C-19, robustesse) : capture une erreur de rendu d'une vue pour éviter l'écran blanc.
// Repli dark-safe (tokens), la barre de navigation reste utilisable. Diagnostic en console seulement,
// aucun envoi externe (vie privée, A06). Réinitialisée à chaque navigation (key=pathname côté coquille).
interface Props {
  children: ReactNode;
}
interface State {
  erreur: Error | null;
}

export class LimiteErreur extends Component<Props, State> {
  override state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  override componentDidCatch(erreur: Error, info: ErrorInfo): void {
    console.error('Erreur de rendu capturée :', erreur, info.componentStack);
  }

  reinitialiser = (): void => this.setState({ erreur: null });

  override render(): ReactNode {
    if (!this.state.erreur) return this.props.children;
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-lg">Cette vue a rencontré une erreur</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          L'affichage n'a pas pu se terminer. Le reste de l'application reste utilisable ; vous pouvez
          réessayer cette vue ou recharger la page.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={this.reinitialiser}
            className="min-h-tactile rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Réessayer
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-tactile rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Recharger la page
          </button>
        </div>
      </div>
    );
  }
}
