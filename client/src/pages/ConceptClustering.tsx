import { TIERS_SCORE } from '@/lib/tiers-score';
import { categorieDe } from '@/lib/categories-poi';
import { FAMILLES } from '@/lib/categories-poi';
import { IconeCategorie } from '@/components/IconeCategorie';

// Planche de CONCEPT du clustering + proéminence à 5 tiers (C13, frontend-design). On tranche sur des pixels : montre
// l'échelle de proéminence T→C (taille + émergence), et l'accent du cluster selon le meilleur tier caché dedans.
// Dev-only. Le tier de score (5 crans) est DISTINCT des 4 boutons de vote. Distribution cible T22/S155/A188/B196/C223.

const CIBLE: Record<string, number> = { T: 22, S: 155, A: 188, B: 196, C: 223 };
// Une catégorie repère pour la démo de pastille (peu importe : la couleur = famille, la taille = tier).
const CAT = categorieDe('point_de_vue');
const varFam = `var(${FAMILLES[CAT.famille].token})`;

function Pastille({ taille, opacite = 1 }: { taille: number; opacite?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full text-[var(--papier)] shadow-flottante"
      style={{ width: taille, height: taille, backgroundColor: varFam, opacity: opacite }}
    >
      <IconeCategorie categorie={CAT.cle} className="h-[55%] w-[55%]" />
    </span>
  );
}

function ClusterDemo({ total, liseré, note }: { total: number; liseré: number; note: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="grid h-14 w-14 place-items-center rounded-full font-serif text-lg text-[var(--papier)]"
        style={{ backgroundColor: 'var(--glacier)', boxShadow: `0 0 0 ${liseré}px var(--papier), 0 0 0 ${liseré + 1}px var(--glacier)` }}
      >
        {total}
      </span>
      <span className="text-center text-[0.625rem] text-muted-foreground">{note}</span>
    </div>
  );
}

export default function ConceptClustering() {
  const base = 52; // px pour le tier T ; les autres suivent leur facteur de proéminence.
  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-serif text-2xl">Clustering et proéminence — 5 tiers</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Le tier de score (importance d'un lieu) a cinq crans. La carte les distingue par la taille (T le plus fort, C
          le plus discret) et par l'émergence (au dézoom, C s'efface le premier, T reste le plus longtemps). Le tier de
          score ne dit pas l'avis de la famille : c'est un axe distinct des quatre boutons de vote.
        </p>
        <p className="text-xs text-muted-foreground">
          Aperçu de concept (dev). Sur la carte, la distribution vient de la donnée ; ici on illustre la cible
          T22 / S155 / A188 / B196 / C223.
        </p>
      </header>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Échelle de proéminence (taille par tier)</h2>
        <div className="flex flex-wrap items-end gap-6">
          {TIERS_SCORE.map((t) => (
            <div key={t.cle} className="flex flex-col items-center gap-1.5">
              <Pastille taille={Math.round(base * t.prominence)} />
              <span className="text-sm font-medium">{t.cle}</span>
              <span className="text-[0.625rem] text-muted-foreground">{t.libelle}</span>
              <span className="text-[0.625rem] text-muted-foreground">cible {CIBLE[t.cle]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Émergence au zoom (C s'agglomère en premier)</h2>
        <div className="flex flex-wrap items-end gap-6">
          {TIERS_SCORE.map((t, i) => (
            <div key={t.cle} className="flex flex-col items-center gap-1.5">
              {/* Opacité illustrative décroissante T→C au même dézoom : C déjà effacé, T encore plein. */}
              <Pastille taille={40} opacite={1 - i * 0.19} />
              <span className="text-sm font-medium">{t.cle}</span>
              <span className="text-[0.625rem] text-muted-foreground">émerge z{t.emergence}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Accent du cluster (le meilleur tier qu'il cache)</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Le compteur couvre les cinq tiers. Le liseré s'épaissit si le cluster cache un incontournable ou un majeur : il
          « vaut le détour », on invite à zoomer.
        </p>
        <div className="flex flex-wrap gap-8">
          <ClusterDemo total={24} liseré={3.5} note="cache un T → liseré fort" />
          <ClusterDemo total={17} liseré={2.6} note="cache un S → liseré moyen" />
          <ClusterDemo total={9} liseré={1.6} note="que des A/B/C → liseré fin" />
        </div>
      </div>
    </section>
  );
}
