import { CoquilleAVenir } from '@/components/CoquilleAVenir';

// Sous-onglet « Réservations » de Préparatifs (M543) : coquille d'abord, contenu riche à venir (van, aires et
// campings à réserver, activités payantes à caler). Pas de trou : un état vide guidé.
export default function PreparatifsReservations() {
  return (
    <CoquilleAVenir
      titre="Les réservations"
      texte="Ce qu'il faut réserver à l'avance se retrouvera ici : le van, quelques aires ou campings aux étapes tendues, et les activités qui se remplissent vite."
    />
  );
}
