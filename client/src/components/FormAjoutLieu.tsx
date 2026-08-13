import { useState, type FormEvent } from 'react';
import { Champ } from '@/ui/primitives/input';
import { Bouton } from '@/ui/primitives/button';
import { useAjouterLieu } from '@/lib/queries/carnet';

// Formulaire d'ajout d'un lieu au carnet perso (gaté PIN, A03/arbitrage #8). Provenance « voyageur »,
// confiance basse, tier TSAB provisoire, votable ensuite. Le PIN n'est jamais stocké (champ éphémère).
export function FormAjoutLieu({ code }: { code: string }) {
  const ajouter = useAjouterLieu(code);
  const [nom, setNom] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [categorie, setCategorie] = useState('');
  const [presentation, setPresentation] = useState('');
  const [pin, setPin] = useState('');

  const valide = nom.trim() !== '' && lat !== '' && lon !== '' && pin !== '';

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!valide) return;
    ajouter.mutate(
      {
        pin,
        nom: nom.trim(),
        lat: Number(lat),
        lon: Number(lon),
        categorie: categorie.trim() || undefined,
        presentation: presentation.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNom('');
          setLat('');
          setLon('');
          setCategorie('');
          setPresentation('');
          setPin('');
        },
      },
    );
  }

  return (
    <form onSubmit={soumettre} className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p className="text-sm font-medium">Ajouter un lieu au carnet</p>
      <Champ placeholder="Nom du lieu" value={nom} onChange={(e) => setNom(e.target.value)} aria-label="Nom du lieu" />
      <div className="flex gap-2">
        <Champ
          type="number"
          step="any"
          placeholder="Latitude"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          aria-label="Latitude"
        />
        <Champ
          type="number"
          step="any"
          placeholder="Longitude"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          aria-label="Longitude"
        />
      </div>
      <Champ
        placeholder="Catégorie (optionnel)"
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
        aria-label="Catégorie"
      />
      <Champ
        placeholder="Ce que c'est, en clair (optionnel)"
        value={presentation}
        onChange={(e) => setPresentation(e.target.value)}
        aria-label="Présentation"
      />
      <Champ
        type="password"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        aria-label="PIN"
        autoComplete="off"
      />
      <div className="flex items-center gap-2">
        <Bouton type="submit" disabled={!valide || ajouter.isPending}>
          {ajouter.isPending ? 'Ajout en cours' : 'Ajouter'}
        </Bouton>
        {ajouter.isError ? <span className="text-xs text-rouge">Échec (PIN incorrect ou service indisponible).</span> : null}
        {ajouter.isSuccess ? <span className="text-xs text-vert">Lieu ajouté au carnet.</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Provenance « voyageur » : confiance basse, votable ensuite par la famille.
      </p>
    </form>
  );
}
