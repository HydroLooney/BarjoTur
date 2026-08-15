import { useState, type FormEvent } from 'react';
import { useCarnet } from '@/stores/carnet';
import { Champ } from '@/ui/primitives/input';
import { Bouton } from '@/ui/primitives/button';

// Carnet de notes privé (A33 / M158 / M160) : vos notes sur le voyage, à vous. Ajout + suppression, en local
// (persist). Tranché, stable (indépendant de la restructure « Notre Voyage »). Le partage au collectif (épingler
// une note) viendra avec la sync collaborative — dit en clair, pas simulé (R1).
export function CarnetNotes() {
  const notes = useCarnet((s) => s.notes);
  const ajouter = useCarnet((s) => s.ajouter);
  const supprimer = useCarnet((s) => s.supprimer);
  const [texte, setTexte] = useState('');

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (texte.trim().length === 0) return;
    ajouter(texte);
    setTexte('');
  }

  return (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <div>
        <h2 className="text-sm font-medium">Mon carnet</h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Vos notes privées sur le voyage : idées, rappels, coups de cœur. Elles restent à vous ; le partage au collectif
          viendra plus tard.
        </p>
      </div>

      <form onSubmit={soumettre} className="flex flex-wrap gap-2">
        <Champ
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Une idée, un rappel…"
          aria-label="Nouvelle note"
          className="min-w-40 flex-1"
        />
        <Bouton type="submit" size="sm" disabled={texte.trim().length === 0}>
          Ajouter
        </Bouton>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Pas encore de note.</p>
      ) : (
        <ul className="space-y-1">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border p-2 text-sm"
            >
              <span className="whitespace-pre-wrap">{n.texte}</span>
              <button
                type="button"
                onClick={() => supprimer(n.id)}
                aria-label={`Supprimer la note : ${n.texte.slice(0, 20)}`}
                className="flex min-h-tactile shrink-0 items-center px-2 text-lg text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
