import { PhilosophieVoyage } from '@/components/PhilosophieVoyage';
import { QuizzEnvies } from '@/components/QuizzEnvies';

// Sous-onglet « Ma façon de voyager » de Mes envies (M543/M546) : le profil voyageur (curseurs + envies) et le
// quizz raccourci pour pré-remplir ses envies. Le questionnaire guidé reste un overlay (bouton dans PhilosophieVoyage).
export default function MesEnviesFacon() {
  return (
    <div className="space-y-4">
      <PhilosophieVoyage />
      <QuizzEnvies />
    </div>
  );
}
