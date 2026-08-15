import { VignettePoi } from '@/components/VignettePoi';
import { categorieDe } from '@/lib/categories-poi';
import { enrichissementDemo } from '@/lib/fixtures/enrichissement-demo';

// Planche de CONCEPT des vignettes de lieu (C12, frontend-design) : on tranche sur des pixels. Montre les DEUX états
// côte à côte — la vignette PHOTO (quand elle existe, ~319/964, crédit + licence R1) et le FALLBACK charté par famille
// (le cas MAJORITAIRE, ~645/964 : carte topo miniature + glyphe de catégorie, teinté par la famille). Dev-only.
// Le fallback doit être un vrai parti-pris (« un lieu sur la carte, pas encore photographié »), jamais un pis-aller gris.

// Un échantillon de catégorie par famille pour montrer la variété du fallback (couleur + glyphe changent).
const PAR_FAMILLE = [
  { cat: 'fjord', nom: 'Nærøyfjord' },
  { cat: 'cascade', nom: 'Vøringsfossen' },
  { cat: 'point_de_vue', nom: 'Dalsnibba' },
  { cat: 'rando', nom: 'Besseggen' },
  { cat: 'route', nom: 'Trollstigen' },
  { cat: 'culture', nom: 'Bryggen' },
  { cat: 'restauration', nom: 'Table du fjord' },
  { cat: 'phare', nom: 'Lindesnes fyr' },
  { cat: 'activite', nom: 'Kayak de mer' },
];

// Trois lieux avec photo réelle (Wikimedia, licence + auteur exacts) tirés de l'enrichissement de démo.
const AVEC_PHOTO = ['a', 'zz', 'mmm'].map((seed, i) => {
  const enr = enrichissementDemo(seed);
  return { photo: enr.photos?.[0] ?? null, nom: enr.nom_no ?? `Lieu ${i + 1}`, cat: ['fjord', 'nature', 'ile'][i]! };
});

export default function ConceptVignettes() {
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl">Vignettes de lieu — concept</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Deux états, même cadre (zéro décalage). La photo quand elle existe, avec son crédit. Sinon, une carte
          topographique miniature teintée par la famille et son glyphe de catégorie — le cas le plus fréquent, soigné.
        </p>
      </header>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Avec photo (crédit et licence)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AVEC_PHOTO.map((v, i) => (
            <VignettePoi key={i} photo={v.photo} categorie={v.cat} nom={v.nom} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Sans photo — fallback charté par famille (le cas majoritaire)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PAR_FAMILLE.map((v) => (
            <VignettePoi key={v.cat} photo={null} categorie={categorieDe(v.cat).cle} nom={v.nom} />
          ))}
        </div>
      </div>
    </section>
  );
}
