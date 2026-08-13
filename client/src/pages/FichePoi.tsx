import { useParams } from 'react-router-dom';

// Fiche POI pleine page (deep-link /explorer/:osm). Le controle de vote se posera EN HAUT,
// avec le tier par defaut affiche distinctement (jamais ecrase), et le circuit rando visible
// (mini-carte du trace) pour comprendre ce qu'on vote (A11).
export default function FichePoi() {
  const { osm } = useParams<{ osm: string }>();
  return (
    <section className="space-y-4">
      <h1 className="font-serif text-2xl">Fiche du lieu</h1>
      <p className="text-muted-foreground">Identifiant : {osm ?? 'inconnu'}.</p>
    </section>
  );
}
