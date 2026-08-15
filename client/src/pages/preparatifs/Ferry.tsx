import { CoquilleAVenir } from '@/components/CoquilleAVenir';

// Sous-onglet « Ferry » de Préparatifs (M543) : coquille d'abord, contenu riche à venir (horaires, réservations
// de traversées, ancres). Pas de trou : un état vide guidé plutôt qu'un écran mort.
export default function PreparatifsFerry() {
  return (
    <CoquilleAVenir
      titre="Les ferries du voyage"
      texte="Les traversées à réserver et leurs horaires arriveront ici : le grand ferry aller-retour, et les petits ferries de fjord en cours de route."
    />
  );
}
