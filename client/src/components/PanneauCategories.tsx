import { useState } from 'react';
import { FAMILLES, CATEGORIES, type CategoriePoi } from '@/lib/categories-poi';
import { IconeCategorie } from '@/components/IconeCategorie';
import { cn } from '@/lib/utils';

// Panneau de calques POI par CATÉGORIE (étape 3, sous-étape 1). Repliable + fond solide + discret (mêmes règles
// que la coulisses, M239) : replié = petite puce « ▤ Catégories » ; déplié = les 18 catégories groupées par famille
// (couleur + icône + libellé = le MÊME contrat que la carte), avec « tout / rien ». La carte est la vedette.

const FAMILLES_ACTIVES = Object.values(FAMILLES).filter((f) => !f.reservee);

interface Props {
  actifs: Set<string>;
  onBascule: (cle: string) => void;
  onTout: (tout: boolean) => void;
  // C17 : bascule d'une FAMILLE entière (groupe) et filtre « votables seulement » (défaut) branché sur le booléen d'A.
  onBasculeFamille: (cles: string[], tout: boolean) => void;
  votablesOnly: boolean;
  onVotablesOnly: (v: boolean) => void;
}

export function PanneauCategories({ actifs, onBascule, onTout, onBasculeFamille, votablesOnly, onVotablesOnly }: Props) {
  const [ouvert, setOuvert] = useState(false);
  // C17 (polish M335) : familles REPLIABLES (accordéon) — le panneau respire, on n'affiche que les groupes qu'on veut.
  const [replie, setReplie] = useState<Set<string>>(() => new Set());
  function basculeReplie(cle: string) {
    setReplie((s) => {
      const n = new Set(s);
      if (n.has(cle)) n.delete(cle);
      else n.add(cle);
      return n;
    });
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg border border-border bg-card/95 px-2.5 py-1 text-micro font-medium text-muted-foreground shadow-posee backdrop-blur-sm transition-colors duration-court hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden>▤</span> Catégories
      </button>
    );
  }

  return (
    <div className="absolute left-2 top-2 z-10 max-h-[80%] w-52 overflow-y-auto rounded-[var(--rayon)] border border-border bg-card p-2 text-xs shadow-flottante">
      {/* En-tête STICKY (M289) : le repli reste à un clic même après avoir scrollé la liste. */}
      <div className="sticky top-0 z-10 -mx-2 -mt-2 mb-1 flex items-center justify-between border-b border-border bg-card px-2 pb-1 pt-2">
        <button
          type="button"
          onClick={() => setOuvert(false)}
          aria-label="Replier les catégories"
          className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
        >
          Catégories <span aria-hidden>▴</span>
        </button>
        <span className="flex gap-1">
          <button type="button" onClick={() => onTout(true)} className="rounded px-1 text-[0.625rem] text-accent hover:underline">
            tout
          </button>
          <button type="button" onClick={() => onTout(false)} className="rounded px-1 text-[0.625rem] text-muted-foreground hover:underline">
            rien
          </button>
        </span>
      </div>
      {/* C17 : « Votables seulement » (défaut ON) — la carte s'ouvre sur les lieux à voter (le sous-ensemble scoré) ;
          décocher fait apparaître les repères et services non votables. Branché sur le booléen `votable` d'A. */}
      <label className="mb-1.5 flex min-h-8 cursor-pointer items-center gap-2 rounded border border-border bg-muted/40 px-1.5">
        <input type="checkbox" checked={votablesOnly} onChange={(e) => onVotablesOnly(e.target.checked)} className="accent-primary" />
        <span className="font-medium text-foreground">Votables seulement</span>
        <span className="ml-auto text-[0.625rem] text-muted-foreground">repères masqués</span>
      </label>
      {FAMILLES_ACTIVES.map((f) => {
        const cats = CATEGORIES.filter((c) => c.famille === f.cle);
        const nOn = cats.filter((c) => actifs.has(c.cle)).length;
        const toutOn = nOn === cats.length;
        const partiel = nOn > 0 && !toutOn;
        const estReplie = replie.has(f.cle);
        return (
          <div key={f.cle} className="mb-1.5">
            {/* En-tête de FAMILLE (C17) : la CASE bascule tout le groupe (tout / partiel indéterminé / rien) ; le NOM
                replie/déplie le groupe (accordéon, M335) pour que le panneau respire. Sous-catégories = toggles unitaires. */}
            <div className="mb-0.5 flex items-center gap-1.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
              <input
                type="checkbox"
                checked={toutOn}
                ref={(el) => {
                  if (el) el.indeterminate = partiel;
                }}
                onChange={() => onBasculeFamille(cats.map((c) => c.cle), !toutOn)}
                className="accent-primary"
                aria-label={`Basculer la famille ${f.libelle}`}
              />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(${f.token})` }} aria-hidden />
              <button
                type="button"
                onClick={() => basculeReplie(f.cle)}
                aria-expanded={!estReplie}
                className="flex flex-1 items-center justify-between gap-1 uppercase tracking-wide hover:text-foreground"
              >
                {f.libelle}
                <span aria-hidden className="text-[0.7rem]">{estReplie ? '▸' : '▾'}</span>
              </button>
            </div>
            {estReplie ? null : (
              <div>
                {cats.map((c: CategoriePoi) => {
                  const on = actifs.has(c.cle);
                  return (
                    <label key={c.cle} className={cn('flex min-h-8 cursor-pointer items-center gap-2 rounded px-1', !on && 'opacity-45')}>
                      <input type="checkbox" checked={on} onChange={() => onBascule(c.cle)} className="accent-primary" />
                      <span style={{ color: `var(${f.token})` }}>
                        <IconeCategorie categorie={c.cle} className="h-4 w-4" trait={2.2} />
                      </span>
                      {c.libelle}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
