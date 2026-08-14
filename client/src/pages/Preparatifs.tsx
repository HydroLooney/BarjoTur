import { VueBudget } from '@/components/VueBudget';
import { Intendance } from '@/components/Intendance';

// Espace « Préparatifs » (A20 §10, ex-Intendance) : le budget prévisionnel et l'intendance (recettes, menus,
// matériel). Un des trois espaces issus de Voyager. Ce qu'on prépare avant de partir.
export default function Preparatifs() {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Préparatifs</h1>
      <p className="max-w-prose text-muted-foreground">
        Ce qu'on prépare avant de partir : le budget prévisionnel du voyage, les recettes, les menus et le
        matériel à emporter.
      </p>
      <VueBudget />
      <Intendance />
    </section>
  );
}
