import { Link } from 'react-router-dom';
import { CarteMapLibre } from '@/components/CarteMapLibre';

// Page carte de COULISSES (T069) : backstage, hors barre publique. Diagnostic du découpage (régions/zones/
// sous-zones) et des bases idéales, en calques activables. Coquille montée maintenant sur un échantillon ;
// les vues `v_web_*` d'A se branchent au dump.
export default function CarteCoulisses() {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-serif text-titre">Carte de coulisses</h1>
        <Link to="/reglages" className="text-sm text-accent hover:underline">
          ← Réglages
        </Link>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Carte de diagnostic (backstage) : le découpage en régions, zones et sous-zones, et les bases idéales, chacun
        en calque activable. Rien d'autre. Les limites réelles arrivent avec les données.
      </p>
      <CarteMapLibre mode="coulisses" />
    </section>
  );
}
