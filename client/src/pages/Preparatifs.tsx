import { Link } from 'react-router-dom';
import { VueBudget } from '@/components/VueBudget';
import { ConvertisseurCouronnes } from '@/components/ConvertisseurCouronnes';
import { Intendance } from '@/components/Intendance';

// Espace « Préparatifs » (A20 §10, ex-Intendance) : le budget prévisionnel et l'intendance (recettes, menus,
// matériel). Un des trois espaces issus de Voyager. Ce qu'on prépare avant de partir. Donne aussi accès à
// l'Atlas (le voyage en PDF, une page par jour, à garder hors réseau, M103).
export default function Preparatifs() {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Préparatifs</h1>
      <p className="max-w-prose text-muted-foreground">
        Ce qu'on prépare avant de partir : le budget prévisionnel du voyage, les recettes, les menus et le
        matériel à emporter.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/atlas"
          className="inline-flex min-h-tactile items-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Ouvrir l'atlas du voyage (à imprimer)
        </Link>
        <Link
          to="/agenda"
          className="inline-flex min-h-tactile items-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Voir l'agenda du confort
        </Link>
      </div>
      <VueBudget />
      <ConvertisseurCouronnes />
      <Intendance />
    </section>
  );
}
