import { Link, Outlet } from 'react-router-dom';
import { SousOnglets, type OngletItem } from '@/components/SousOnglets';

// Espace « Préparatifs » (A20 §10, ex-Intendance) — PILOTE de la couche sous-onglets v2 (M543). Coquille mince :
// titre + intro + accès Atlas/Agenda, puis le segmented control (Budget · Intendance · Ferry · Réservations) et
// l'<Outlet/> qui monte le sous-onglet actif (pages v3 existantes, inchangées). Ce qu'on prépare avant de partir.

const ONGLETS: OngletItem[] = [
  { cle: 'budget', libelle: 'Budget', to: '/preparatifs/budget' },
  { cle: 'intendance', libelle: 'Intendance', to: '/preparatifs/intendance' },
  { cle: 'ferry', libelle: 'Ferry', to: '/preparatifs/ferry' },
  { cle: 'reservations', libelle: 'Réservations', to: '/preparatifs/reservations' },
];

export default function Preparatifs() {
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Préparatifs</h1>
      <p className="max-w-prose text-muted-foreground">
        Ce qu'on prépare avant de partir : le budget prévisionnel du voyage, l'intendance (recettes, menus,
        matériel), les ferries et les réservations.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/atlas"
          className="inline-flex min-h-tactile items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Ouvrir l'atlas du voyage (à imprimer)
        </Link>
        <Link
          to="/agenda"
          className="inline-flex min-h-tactile items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Voir l'agenda du confort
        </Link>
      </div>
      <SousOnglets espace="preparatifs" items={ONGLETS} />
      <Outlet />
    </section>
  );
}
