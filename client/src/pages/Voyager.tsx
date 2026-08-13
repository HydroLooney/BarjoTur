import { CarteItineraire } from '@/components/CarteItineraire';
import { useFige } from '@/lib/queries/fige';

// Voyager (C16) : la carte itineraire animee (rendu strict fige.geom). Le profil (consensus par
// defaut, archetype, ou membre) se branchera quand B exposera api.fige_lire ; null = fond seul.
export default function Voyager() {
  const { data: fige } = useFige(null);
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Voyager</h1>
      <p className="max-w-prose text-muted-foreground">
        L'itineraire retenu, joue du depart au retour. Traversees d'eau en tirete, aucune ligne droite
        terrestre : le trace suit la geometrie continue du voyage.
      </p>
      <CarteItineraire geom={fige?.geom ?? null} />
    </section>
  );
}
