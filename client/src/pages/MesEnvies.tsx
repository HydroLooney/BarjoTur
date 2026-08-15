import { Outlet } from 'react-router-dom';
import { useIdentite } from '@/stores/identite';
import { SousOnglets, type OngletItem } from '@/components/SousOnglets';

// Espace « Mes envies » (avatar) — couche sous-onglets v2 (M543/M546). Coquille mince : titre + intro + segmented
// control (Ma façon de voyager · Mon carnet · Mes votes) + <Outlet/>. Sans lien perso, on invite à ouvrir son lien.
// Zéro réécriture : les contenus (profil voyageur, carnet, paniers) vivent dans les sous-onglets, inchangés.

const ONGLETS: OngletItem[] = [
  { cle: 'facon', libelle: 'Ma façon de voyager', to: '/mes-envies/facon' },
  { cle: 'carnet', libelle: 'Mon carnet', to: '/mes-envies/carnet' },
  { cle: 'votes', libelle: 'Mes votes', to: '/mes-envies/votes' },
];

export default function MesEnvies() {
  const code = useIdentite((s) => s.code);

  if (!code) {
    return (
      <section className="space-y-3">
        <h1 className="font-serif text-2xl">Mes envies</h1>
        <p className="max-w-prose text-muted-foreground">
          Ouvrez votre lien perso pour dire votre façon de voyager, voter et proposer des lieux.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl">Mes envies</h1>
        <p className="max-w-prose text-muted-foreground">
          Votre façon de voyager (le rythme, les paysages, les thèmes), vos envies et vos lieux. Sans classer
          personne.
        </p>
      </div>
      <SousOnglets espace="mes-envies" items={ONGLETS} />
      <Outlet />
    </section>
  );
}
