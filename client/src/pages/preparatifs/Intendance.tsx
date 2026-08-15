import { Intendance } from '@/components/Intendance';

// Sous-onglet « Intendance » de Préparatifs (M543). Le composant Intendance garde ses PROPRES sous-onglets internes
// (Charge utile · Courses · Trousseau · Matériel/Recettes/Menus) — le 2e niveau, inchangé. Thin layer.
export default function PreparatifsIntendance() {
  return <Intendance />;
}
