import { VueBudget } from '@/components/VueBudget';
import { ConvertisseurCouronnes } from '@/components/ConvertisseurCouronnes';

// Sous-onglet « Budget » de Préparatifs (M543) : le budget prévisionnel (VueBudget, gaté) + le convertisseur
// couronnes (outil famille non gaté). Thin layer — les composants v3 existants, inchangés.
export default function PreparatifsBudget() {
  return (
    <div className="space-y-4">
      <VueBudget />
      <ConvertisseurCouronnes />
    </div>
  );
}
