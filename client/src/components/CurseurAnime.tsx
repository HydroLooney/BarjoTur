import type { ModeCurseur } from '@/lib/anim-trajet';

// Curseur de la carte animée (étape 4, sous-brique 2) : icône PAR MODE (van / pied / transport / ferry) + variante
// NUIT (pastille au ton « fil-nuit » + petit croissant), 5 états. Trait blanc sur pastille colorée, ombre. Zéro
// hex : couleurs via var(--fil-jour/--fil-nuit/--papier/--encre). van + ferry sont dérivés du modèle aujourd'hui ;
// pied + transport se brancheront quand le mode par segment arrivera (donnée A) — le rendu est déjà prêt pour 5.

const ICONES: Record<ModeCurseur, JSX.Element> = {
  van: (
    <>
      <path d="M2 15V8h11l3.4 4H20v3" />
      <path d="M2 15h18" />
      <circle cx="7" cy="16" r="1.6" />
      <circle cx="16" cy="16" r="1.6" />
    </>
  ),
  ferry: (
    <>
      <path d="M4 14h16l-2.3 5H6.3z" />
      <path d="M12 4v6M8.5 8.5h7" />
    </>
  ),
  pied: (
    <>
      <circle cx="13" cy="4.4" r="1.8" />
      <path d="M12 8l-2.2 4 3 2-1 5M12 8l3 1.5 3-1" />
    </>
  ),
  transport: (
    <>
      <path d="M5 5h14v9H5z" />
      <path d="M5 11h14M8 14v2M16 14v2" />
      <circle cx="8.5" cy="12.5" r="0.9" />
      <circle cx="15.5" cy="12.5" r="0.9" />
    </>
  ),
};

export function CurseurAnime({ mode, nuit }: { mode: ModeCurseur; nuit: boolean }) {
  return (
    <span style={{ position: 'relative', display: 'block', width: 30, height: 30 }}>
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 30,
          height: 30,
          borderRadius: 9999,
          background: nuit ? 'var(--fil-nuit)' : 'var(--fil-jour)',
          border: '2px solid var(--papier)',
          boxShadow: 'var(--ombre-flottante)',
          color: 'var(--papier)',
        }}
      >
        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONES[mode]}
        </svg>
      </span>
      {nuit ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            display: 'grid',
            placeItems: 'center',
            width: 14,
            height: 14,
            borderRadius: 9999,
            background: 'var(--encre)',
            border: '1.5px solid var(--papier)',
            color: 'var(--papier)',
          }}
        >
          <svg viewBox="0 0 24 24" width={8} height={8} fill="currentColor" aria-hidden>
            <path d="M20 14.5A8 8 0 019.5 4a7 7 0 100 16 8 8 0 0010.5-5.5z" />
          </svg>
        </span>
      ) : null}
    </span>
  );
}
