import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { FamilleReglage, Reglage } from '@barjotur/shared';
import { useTousReglages, FAMILLES_REGLAGE } from '@/lib/queries/reglages';
import { usePeut } from '@/hooks/usePeut';
import { useOnboarding } from '@/stores/onboarding';
import { Chargement, MessageErreur, MessageVide } from '@/ui/blocs/EtatVue';
import { Bouton } from '@/ui/primitives/button';
import { Champ } from '@/ui/primitives/input';
import { LigneReglage } from '@/ui/blocs/LigneReglage';
import { AdminVoyageurs } from '@/components/AdminVoyageurs';
import { GenererLien } from '@/components/GenererLien';
import { ProfilsDeplacement } from '@/components/ProfilsDeplacement';
import { ReglageCarburant } from '@/components/ReglageCarburant';

// COULISSES › Regler (M391, expert, gate capacite). Les seuils et preferences en registre UNIQUE (budget.parametre),
// groupes par SENS (pas un mur de champs), chaque famille gatee par sa capacite d'edition. Le serveur (B) fait
// autorite : ici on MONTRE et on VERROUILLE. Le PIN, saisi une seule fois pour le panneau, porte l'ecriture (jamais
// stocke, A03). Un non-habilite voit tout en lecture seule avec la raison. La gestion du voyage (voyageurs, lien) et
// les reglages metier existants (profils, carburant) vivent aussi ici, sous la meme porte experte.

const LIBELLE_FAMILLE: Record<FamilleReglage, string> = {
  conduite: 'Conduite et roulage',
  composition: 'Composition et confort',
  profils: 'Préférences du moteur',
  medical: 'Contraintes médicales (personnel)',
};

function grouperParFamille(reglages: Reglage[]): Map<FamilleReglage, Reglage[]> {
  const m = new Map<FamilleReglage, Reglage[]>();
  for (const r of reglages) {
    const liste = m.get(r.famille) ?? [];
    liste.push(r);
    m.set(r.famille, liste);
  }
  return m;
}

export function VoletRegler() {
  const { reglages, isLoading, isError, vide } = useTousReglages();
  const [pin, setPin] = useState('');
  const reafficherPremiersPas = useOnboarding((s) => s.reafficher);
  const peutAdmin = usePeut('administrer_voyageurs');

  // Capacites calculees une fois (les hooks ne s'appellent pas en boucle). medical = personnel, toujours editable.
  const peutComposition = usePeut('regler_composition');
  const peutConduite = usePeut('regler_conduite');
  const peutProfils = usePeut('regler_profils');
  const editablePar: Record<FamilleReglage, boolean> = {
    composition: peutComposition,
    conduite: peutConduite,
    profils: peutProfils,
    medical: true,
  };

  const groupes = useMemo(() => grouperParFamille(reglages), [reglages]);
  const famillesPresentes = FAMILLES_REGLAGE.filter((f) => (groupes.get(f) ?? []).length > 0);
  const auMoinsUnEditable = famillesPresentes.some((f) => editablePar[f]);

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-muted-foreground">
        Les seuils et préférences du voyage, groupés par sens. Vous ne voyez à modifier que ce que votre rôle
        vous permet ; le reste est en lecture. Le cadre (mini, maxi, défaut) est fixé par les responsables.
      </p>

      {/* PIN du panneau : une seule saisie, portee a chaque ecriture, jamais conservee. */}
      {auMoinsUnEditable ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="pin-reglages" className="text-xs text-muted-foreground">
              PIN pour appliquer un changement
            </label>
            <Champ
              id="pin-reglages"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="min-h-tactile w-40"
              placeholder="••••"
            />
          </div>
          <p className="max-w-prose text-xs text-muted-foreground">
            Le code reste sur votre appareil le temps d'appliquer. Il n'est ni affiché ni enregistré.
          </p>
        </div>
      ) : null}

      {/* Gestion du voyage (auto-gatee : se masque pour un voyageur simple). */}
      <AdminVoyageurs />
      <GenererLien />

      {/* Reglages metier deja batis, sous la meme porte. */}
      <ProfilsDeplacement />
      <ReglageCarburant />

      {isLoading && vide ? <Chargement libelle="Chargement des réglages." /> : null}
      {isError && vide ? (
        <MessageErreur>Réglages indisponibles pour l'instant (le service n'est pas branché).</MessageErreur>
      ) : null}
      {!isLoading && !isError && vide ? (
        <MessageVide>Aucun réglage exposé pour l'instant.</MessageVide>
      ) : null}

      {famillesPresentes.map((famille) => (
        <section key={famille} className="space-y-1 rounded-lg border border-border bg-card p-4 shadow-posee">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-section font-medium">{LIBELLE_FAMILLE[famille]}</h3>
            {!editablePar[famille] ? (
              <span className="text-xs text-muted-foreground">Lecture seule</span>
            ) : null}
          </div>
          <div>
            {(groupes.get(famille) ?? []).map((r) => (
              <LigneReglage key={r.cle} reglage={r} editable={editablePar[famille]} pin={pin} />
            ))}
          </div>
        </section>
      ))}

      {/* Utilitaires : revoir l'onboarding (tout public), acces backstage a la carte de diagnostic (organisateur). */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <Bouton size="sm" variant="outline" onClick={reafficherPremiersPas}>
          Revoir les premiers pas
        </Bouton>
        {peutAdmin ? (
          <Link to="/coulisses/carte" className="text-sm text-accent hover:underline">
            Carte de coulisses (diagnostic) →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
