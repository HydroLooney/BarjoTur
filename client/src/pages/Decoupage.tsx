import { Link } from 'react-router-dom';
import { DrillDownDecoupage } from '@/components/DrillDownDecoupage';

// C15 (M286/M434) : page du drill-down interactif du decoupage, ouverte depuis Coulisses › Comprendre. On y descend
// l'emboitement Region › District › Paysage a la main, la carte suit. Lecture (pas de reglage) : c'est de la
// pedagogie du territoire, coherent avec Comprendre.
export default function Decoupage() {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-serif text-2xl">Le découpage, de haut en bas</h1>
        <p className="max-w-prose text-muted-foreground">
          La Norvège en trois échelles emboîtées. Choisissez une région pour voir ses districts, un district
          pour ses paysages. La carte suit la descente ; le fil au-dessus vous ramène où vous voulez.
        </p>
      </div>
      <DrillDownDecoupage />
      <Link to="/reglages?volet=comprendre" className="inline-block text-sm text-accent hover:underline">
        ← Retour aux coulisses
      </Link>
    </section>
  );
}
