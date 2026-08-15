import { useMemo, useState } from 'react';
import type { EtatPerle, PerleJour, PerleSejour } from '@/lib/fil-itineraire';
import { filDepuisEtapes } from '@/lib/fil-itineraire';
import { etapesFilDemo } from '@/lib/fixtures/fil-demo';
import { cn } from '@/lib/utils';

// Vue plein-fil de l'itinéraire (A32 / M151 / M155, incrément 2). Le voyage en perles CENTRÉES SUR LA LIGNE :
// la ligne s'épaissit en un renflement (la perle) puis se resserre, SANS liseré — perle = même couleur que le fil
// (jour / nuit en autonomie). HYBRIDE : perles de séjour dépliables en journées. Le halo n'entoure QUE la perle
// courante (lisibilité). Fixture hors live (fige.geom + étapes), vrai figé au flip.
// Design-system unifié (SPEC-CONSOLIDEE, fork #3 M161) : `variant` = 'collectif' (voyage commun) | 'individuel'
// (Mon voyage), couleur DISTINCTE par variante mais PAR JETONS (zéro hex ici) ; la couleur individuelle reste la
// main de M (code couleur par espace, provisoire dans tokens.css). Rendu DOM dark-safe.

export type VariantFil = 'collectif' | 'individuel';

interface JetonsFil {
  jour: string;
  nuit: string;
  halo: string;
}

// Indirection variante -> noms de variables CSS. AUCUN hex : les valeurs vivent dans ui/tokens.css.
const JETONS_FIL: Record<VariantFil, JetonsFil> = {
  collectif: { jour: 'var(--fil-jour)', nuit: 'var(--fil-nuit)', halo: 'var(--fil-halo)' },
  individuel: { jour: 'var(--fil-indiv-jour)', nuit: 'var(--fil-indiv-nuit)', halo: 'var(--fil-indiv-halo)' },
};

/** Couleur du fil selon la nuit : jour par défaut, nuit d'autonomie en teinte nuit. */
function couleurPerle(nuitAutonomie: boolean, jetons: JetonsFil): string {
  return nuitAutonomie ? jetons.nuit : jetons.jour;
}

function classeEtat(etat: EtatPerle): string {
  if (etat === 'visitee') return 'opacity-55';
  return '';
}

// Un renflement (perle) posé sur la ligne : cercle de la couleur du fil, halo si courant.
function Renflement({
  couleur,
  halo,
  courante,
  taille,
}: {
  couleur: string;
  halo: string;
  courante: boolean;
  taille: number;
}) {
  return (
    <span
      aria-hidden
      className="absolute top-1 rounded-full"
      style={{
        left: `-${taille / 2 + 1}px`,
        height: `${taille}px`,
        width: `${taille}px`,
        backgroundColor: couleur,
        boxShadow: courante ? `0 0 0 3px ${halo}` : undefined,
      }}
    />
  );
}

function JourneePerle({ j, jetons }: { j: PerleJour; jetons: JetonsFil }) {
  return (
    <li className={cn('relative pb-2 pl-4', classeEtat(j.etat))}>
      <Renflement
        couleur={couleurPerle(j.nuitAutonomie, jetons)}
        halo={jetons.halo}
        courante={j.etat === 'courante'}
        taille={10}
      />
      <div className="text-sm">
        Jour {j.jour}
        {j.date ? <span className="text-muted-foreground"> · {j.date}</span> : null}
        {j.etat === 'courante' ? <span className="ml-1 text-xs text-primary">ici</span> : null}
      </div>
      {j.nuitLibelle ? <p className="text-xs text-muted-foreground">{j.nuitLibelle}</p> : null}
    </li>
  );
}

function SejourPerle({ s, jetons }: { s: PerleSejour; jetons: JetonsFil }) {
  const [ouvert, setOuvert] = useState(s.etat === 'courante');
  const plusieurs = s.journees.length > 1;

  return (
    <li className={cn('relative pb-3 pl-5', classeEtat(s.etat))}>
      {/* La perle de séjour est le « lieu » : couleur jour ; les journées dépliées portent leur jour/nuit. */}
      <Renflement couleur={jetons.jour} halo={jetons.halo} courante={s.etat === 'courante'} taille={14} />
      <button
        type="button"
        onClick={() => plusieurs && setOuvert((o) => !o)}
        aria-expanded={plusieurs ? ouvert : undefined}
        className={cn(
          'flex min-h-tactile flex-col items-start text-left',
          plusieurs ? 'cursor-pointer' : 'cursor-default',
        )}
      >
        <span className="font-medium">{s.base ?? 'Étape'}</span>
        <span className="text-xs text-muted-foreground">
          {plusieurs ? `Jours ${s.jourDebut} à ${s.jourFin}` : `Jour ${s.jourDebut}`}
          {s.etat === 'courante' ? ' · en cours' : ''}
          {plusieurs ? (ouvert ? ' · masquer' : ' · voir les journées') : ''}
        </span>
      </button>

      {plusieurs && ouvert ? (
        <ol className="relative mt-2 border-l-2" style={{ borderColor: jetons.jour }}>
          {s.journees.map((j) => (
            <JourneePerle key={j.jour} j={j} jetons={jetons} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

// Une SECTION de phase (aller/retour, M304) : l'épine porte la COULEUR de section franche (glacier/ocre, cohérente
// avec le tracé) + une étiquette ; les perles GARDENT leur jour/nuit (deux dimensions : structure vs rythme).
function SectionPhase({
  titre,
  couleur,
  sejours,
  jetons,
}: {
  titre: string;
  couleur: string;
  sejours: PerleSejour[];
  jetons: JetonsFil;
}) {
  if (!sejours.length) return null;
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleur }} />
        {titre}
      </p>
      <ol className="relative ml-2 border-l-2" style={{ borderColor: couleur }}>
        {sejours.map((s) => (
          <SejourPerle key={`${s.base_id}-${s.jourDebut}`} s={s} jetons={jetons} />
        ))}
      </ol>
    </div>
  );
}

interface Props {
  jourCourant?: number;
  /** Fil du voyage commun (défaut) ou fil de Mon voyage (couleur distincte, fork #3). */
  variant?: VariantFil;
  /** Jour de bascule ALLER → RETOUR (apex du voyage, M304). Vient du modèle d'anim au flip ; défaut = milieu. */
  jourApex?: number;
}

export function FilItineraire({ jourCourant = 2, variant = 'collectif', jourApex }: Props) {
  // Fixture hors live ; au flip, les étapes viennent du vrai figé (scenario-defaut → fige_lire).
  const sejours = useMemo(() => filDepuisEtapes(etapesFilDemo, jourCourant), [jourCourant]);
  const jetons = JETONS_FIL[variant];
  const nbJours = etapesFilDemo.length;
  // Apex = jour de bascule aller/retour (le point le plus loin du départ). À défaut de donnée, milieu du voyage.
  const jApex = jourApex ?? Math.ceil(nbJours / 2);
  const aller = sejours.filter((s) => s.jourDebut <= jApex);
  const retour = sejours.filter((s) => s.jourDebut > jApex);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-medium">
          {variant === 'individuel' ? 'Le fil de mon voyage' : 'Le fil du voyage'}
        </h2>
        <p className="max-w-prose text-xs text-muted-foreground">
          Le voyage jour après jour, en perles : aller et retour se lisent à la couleur de section (comme le tracé) ; les
          camps de base se déplient en journées, les nuits en autonomie prennent une teinte distincte. ({nbJours} jours
          d'exemple.)
        </p>
      </div>
      <div className="space-y-3">
        <SectionPhase titre="Aller" couleur="var(--fil-aller)" sejours={aller} jetons={jetons} />
        <SectionPhase titre="Retour" couleur="var(--fil-retour)" sejours={retour} jetons={jetons} />
      </div>
    </section>
  );
}
