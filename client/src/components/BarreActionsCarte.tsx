import { useState, type ReactNode } from 'react';
import { QuestionnaireVoyageur } from '@/components/QuestionnaireVoyageur';
import { Bouton } from '@/ui/primitives/button';

// BARRE D'ACTIONS DE CARTE (M506/M543) : la barre « à la v2 » posée en tête de TOUS les écrans carte, pour la
// cohérence (Guillaume : « Commencer ici » manquait sur certains écrans). Toujours : « Commencer ici » (ouvre le
// questionnaire de voyage, même overlay que le profil voyageur). Les boutons CONTEXTUELS de l'espace passent en
// `children`. Composant autonome (gère son overlay), à déposer sans recâbler.

export function BarreActionsCarte({ children }: { children?: ReactNode }) {
  const [questionnaire, setQuestionnaire] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Bouton size="sm" onClick={() => setQuestionnaire(true)}>
          Commencer ici
        </Bouton>
        {children}
      </div>
      {questionnaire ? <QuestionnaireVoyageur onClose={() => setQuestionnaire(false)} /> : null}
    </>
  );
}
