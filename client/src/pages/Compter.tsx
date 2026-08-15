import { VueBudget } from '@/components/VueBudget';

// Espace « Compter » (ossature V2, M473) : le budget PRÉVISIONNEL, séparé du réel (le vécu est dans « Notre voyage »).
// Tarifs, nuits, activités, synthèse, marges. Réutilise VueBudget (fourchette basse→haute, marge effective, EUR-only).
export default function Compter() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl">Compter</h1>
        <p className="max-w-prose text-muted-foreground">
          Le budget prévisionnel du voyage : van, carburant, ferry, hébergement, repas et activités. Une
          estimation prudente, pas une cible.
        </p>
      </div>
      <VueBudget />
    </section>
  );
}
