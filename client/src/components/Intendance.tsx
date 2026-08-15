import { useState, type FormEvent } from 'react';
import { useIntendance } from '@/stores/intendance';
import { usePeut } from '@/hooks/usePeut';
import { Champ } from '@/ui/primitives/input';
import { Bouton } from '@/ui/primitives/button';
import { MessageVide } from '@/ui/blocs/EtatVue';
import { ChargeUtile, Trousseau } from '@/components/ChargeUtileTrousseau';

// Intendance (C-17) : recettes, menus et matériel du voyage, en client-local (privé, non destructif).
// Trois listes tenues par le store `intendance` (blob perso, patron B024). UI sobre, dark-safe, tokens.

function Materiel() {
  const items = useIntendance((s) => s.materiel);
  const ajouter = useIntendance((s) => s.ajouterMateriel);
  const basculer = useIntendance((s) => s.basculerMateriel);
  const supprimer = useIntendance((s) => s.supprimerMateriel);
  const [saisie, setSaisie] = useState('');

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    const v = saisie.trim();
    if (!v) return;
    ajouter(v);
    setSaisie('');
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Matériel</h3>
      <form onSubmit={soumettre} className="flex gap-2">
        <Champ
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder="Réchaud, gourdes, popote..."
          aria-label="Ajouter du matériel"
        />
        <Bouton type="submit" size="sm" disabled={!saisie.trim()}>
          Ajouter
        </Bouton>
      </form>
      {items.length === 0 ? (
        <MessageVide>Aucun matériel listé pour l'instant.</MessageVide>
      ) : (
        <ul className="space-y-1">
          {items.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={m.coche}
                onChange={() => basculer(m.id)}
                id={`mat-${m.id}`}
                className="h-4 w-4 accent-primary"
              />
              <label htmlFor={`mat-${m.id}`} className={m.coche ? 'text-muted-foreground line-through' : ''}>
                {m.libelle}
              </label>
              <button
                type="button"
                onClick={() => supprimer(m.id)}
                className="ml-auto flex min-h-tactile items-center px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={`Retirer ${m.libelle}`}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Recettes() {
  const recettes = useIntendance((s) => s.recettes);
  const ajouter = useIntendance((s) => s.ajouterRecette);
  const supprimer = useIntendance((s) => s.supprimerRecette);
  const [titre, setTitre] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [notes, setNotes] = useState('');

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    const t = titre.trim();
    if (!t) return;
    ajouter({ titre: t, ingredients: ingredients.trim(), notes: notes.trim() });
    setTitre('');
    setIngredients('');
    setNotes('');
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Recettes</h3>
      <form onSubmit={soumettre} className="space-y-2">
        <Champ value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de la recette" aria-label="Titre de la recette" />
        <Champ value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="Ingrédients" aria-label="Ingrédients" />
        <div className="flex gap-2">
          <Champ value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (facultatif)" aria-label="Notes" />
          <Bouton type="submit" size="sm" disabled={!titre.trim()}>
            Ajouter
          </Bouton>
        </div>
      </form>
      {recettes.length === 0 ? (
        <MessageVide>Aucune recette pour l'instant.</MessageVide>
      ) : (
        <ul className="space-y-2">
          {recettes.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-card px-3 py-2 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{r.titre}</span>
                <button
                  type="button"
                  onClick={() => supprimer(r.id)}
                  className="ml-auto flex min-h-tactile items-center px-2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={`Retirer ${r.titre}`}
                >
                  Retirer
                </button>
              </div>
              {r.ingredients ? <p className="text-muted-foreground">{r.ingredients}</p> : null}
              {r.notes ? <p className="text-xs text-muted-foreground">{r.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Menus() {
  const menus = useIntendance((s) => s.menus);
  const ajouter = useIntendance((s) => s.ajouterMenu);
  const supprimer = useIntendance((s) => s.supprimerMenu);
  const [quand, setQuand] = useState('');
  const [plat, setPlat] = useState('');

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    const p = plat.trim();
    if (!p) return;
    ajouter({ quand: quand.trim(), plat: p });
    setQuand('');
    setPlat('');
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Menus</h3>
      <form onSubmit={soumettre} className="flex flex-wrap gap-2">
        <Champ value={quand} onChange={(e) => setQuand(e.target.value)} placeholder="Quand (ex « J3 soir »)" aria-label="Quand" className="sm:max-w-40" />
        <Champ value={plat} onChange={(e) => setPlat(e.target.value)} placeholder="Plat prévu" aria-label="Plat" className="sm:flex-1" />
        <Bouton type="submit" size="sm" disabled={!plat.trim()}>
          Ajouter
        </Bouton>
      </form>
      {menus.length === 0 ? (
        <MessageVide>Aucun menu planifié pour l'instant.</MessageVide>
      ) : (
        <ul className="space-y-1">
          {menus.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
              {m.quand ? <span className="text-muted-foreground">{m.quand}</span> : null}
              <span className="font-medium">{m.plat}</span>
              <button
                type="button"
                onClick={() => supprimer(m.id)}
                className="ml-auto flex min-h-tactile items-center px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label={`Retirer ${m.plat}`}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Intendance() {
  // Intendance privée (T043) : masquée à qui n'a pas la capacité (invité). Autorité côté serveur au flip sync.
  if (!usePeut('voir_intendance')) return null;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium">Intendance</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Charge du van, trousseau, matériel, recettes et menus. Privé et local pour l'instant ; se
          synchronisera plus tard.
        </p>
      </div>
      {/* AUDIT-FRONT P0 #2 : charge utile (jauge poids) + trousseau, rétablis à côté de Matériel/Recettes/Menus. */}
      <ChargeUtile />
      <Trousseau />
      <Materiel />
      <Recettes />
      <Menus />
    </div>
  );
}
