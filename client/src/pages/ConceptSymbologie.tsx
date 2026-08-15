import { FAMILLES, CATEGORIES, categorieDe, type CategoriePoi } from '@/lib/categories-poi';
import { IconeCategorie } from '@/components/IconeCategorie';

// Planche de CONCEPTS de symbologie POI (étape 3, frontend-design) : on ne tranche pas sur du texte, on tranche
// sur des pixels. Montre le jeu d'icônes + les 6 familles de couleur, puis 3 traitements de MARQUEUR côte à côte,
// un cluster et une carte de survol. Dev-only (route /symbologie). Couleurs = jetons de charte via var(--…) en DOM.

const varFamille = (cat: CategoriePoi) => `var(${FAMILLES[cat.famille].token})`;

// Échantillon d'une catégorie par famille pour comparer les marqueurs.
const ECHANTILLON = ['fjord', 'point_de_vue', 'rando', 'ville', 'restauration', 'activite'].map(categorieDe);

function PastillePleine({ cat, taille = 36 }: { cat: CategoriePoi; taille?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full text-[var(--papier)] shadow-flottante"
      style={{ width: taille, height: taille, backgroundColor: varFamille(cat) }}
    >
      <IconeCategorie categorie={cat.cle} className="h-[55%] w-[55%]" />
    </span>
  );
}

function Goutte({ cat }: { cat: CategoriePoi }) {
  return (
    <span className="relative grid h-9 w-9 place-items-center">
      <span
        className="absolute inset-0 rotate-45 rounded-full rounded-br-none shadow-flottante"
        style={{ backgroundColor: varFamille(cat) }}
      />
      <IconeCategorie categorie={cat.cle} className="relative h-[52%] w-[52%] text-[var(--papier)]" />
    </span>
  );
}

function JetonClair({ cat }: { cat: CategoriePoi }) {
  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-full border-2 bg-[var(--papier)] shadow"
      style={{ borderColor: varFamille(cat), color: varFamille(cat) }}
    >
      <IconeCategorie categorie={cat.cle} className="h-[52%] w-[52%]" />
    </span>
  );
}

const CONCEPTS = [
  { titre: 'A · Pastille pleine', desc: 'Rond plein couleur de famille, icône blanche, ombre douce.', rendu: (c: CategoriePoi) => <PastillePleine cat={c} /> },
  { titre: 'B · Goutte', desc: 'Marqueur en goutte à coin adouci, ancré au point.', rendu: (c: CategoriePoi) => <Goutte cat={c} /> },
  { titre: 'C · Jeton clair', desc: 'Jeton papier, liseré + icône couleur de famille (plus léger sur la carte).', rendu: (c: CategoriePoi) => <JetonClair cat={c} /> },
];

export default function ConceptSymbologie() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="font-serif text-titre">Symbologie des lieux — concepts</h1>
        <p className="text-corps text-muted-foreground">
          18 catégories réelles → 6 familles de couleur (on mène par le frais), l'icône distingue le type. Couleur =
          thème, icône = catégorie. À trancher sur pixels.
        </p>
      </header>

      {/* Familles + jeu d'icônes complet */}
      <section className="space-y-3">
        <h2 className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">Familles & icônes (18)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.values(FAMILLES).map((f) => (
            <div
              key={f.cle}
              className="rounded-[var(--rayon)] border border-border bg-card p-3"
              style={f.reservee ? { borderStyle: 'dashed', opacity: 0.85 } : undefined}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `var(${f.token})` }} />
                <span className="text-corps font-medium">{f.libelle}</span>
                {f.reservee ? <span className="text-[0.625rem] italic text-muted-foreground">réservée · à venir</span> : null}
              </div>
              {f.reservee ? (
                <p className="text-meta text-muted-foreground">
                  Aménités van (bobilplass, carburant, ravitaillement, parkings) — place tenue, câblée quand la donnée
                  arrive.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.filter((c) => c.famille === f.cle).map((c) => (
                    <div key={c.cle} className="flex w-16 flex-col items-center gap-1 text-center">
                      <span style={{ color: `var(${f.token})` }}>
                        <IconeCategorie categorie={c.cle} className="h-6 w-6" />
                      </span>
                      <span className="text-[0.625rem] leading-tight text-muted-foreground">{c.libelle}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3 concepts de marqueur, même échantillon */}
      <section className="space-y-3">
        <h2 className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">Marqueurs — 3 concepts</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CONCEPTS.map((cc) => (
            <div key={cc.titre} className="space-y-2 rounded-[var(--rayon)] border border-border bg-card p-3">
              <p className="text-corps font-medium">{cc.titre}</p>
              <p className="min-h-8 text-meta text-muted-foreground">{cc.desc}</p>
              {/* bande « carte » papier chaud pour juger sur le vrai fond */}
              <div
                className="flex flex-wrap items-center gap-3 rounded-[var(--rayon-s)] p-3"
                style={{ backgroundColor: 'var(--carte-terre)' }}
              >
                {ECHANTILLON.map((c) => (
                  <span key={c.cle}>{cc.rendu(c)}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cluster + carte de survol */}
      <section className="space-y-3">
        <h2 className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">Cluster au loin & carte de survol</h2>
        <div className="flex flex-wrap items-start gap-6 rounded-[var(--rayon)] p-4" style={{ backgroundColor: 'var(--carte-terre)' }}>
          {/* Cluster */}
          <div className="flex flex-col items-center gap-1">
            <span
              className="grid h-11 w-11 place-items-center rounded-full font-semibold text-[var(--papier)] shadow-flottante ring-4 ring-[var(--papier)]/60"
              style={{ backgroundColor: 'var(--glacier)' }}
            >
              23
            </span>
            <span className="text-[0.625rem] text-muted-foreground">amas au dézoom</span>
          </div>

          {/* Carte de survol */}
          <div className="w-64 overflow-hidden rounded-[var(--rayon)] border border-border bg-card shadow-flottante">
            <div className="flex items-center gap-2 p-3">
              <PastillePleine cat={categorieDe('rando')} taille={30} />
              <div className="min-w-0">
                <p className="truncate font-serif text-section">Preikestolen</p>
                <p className="text-meta text-muted-foreground">Randonnées · Rogaland</p>
              </div>
            </div>
            <div className="space-y-2 px-3 pb-3">
              <p className="text-corps">La falaise-plateau au-dessus du Lysefjord, une marche exigeante et un panorama.</p>
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[0.625rem] font-medium"
                style={{ backgroundColor: 'var(--ocre-voile)', color: 'var(--ocre-actif)' }}
              >
                Très fréquenté
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
