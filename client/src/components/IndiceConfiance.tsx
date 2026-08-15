// Indice de CONFIANCE d'un lieu (M334/M362) : axe VISUEL SÉPARÉ de la proéminence de tier. Un lieu peut être d'un tier
// fort et peu confiant (peu de sources concordantes) ou l'inverse. On ne le lit donc PAS comme « important » mais comme
// « validé ». Rendu neutre (jeton `--ardoise`, ni couleur de famille ni proéminence de tier) : trois segments remplis
// selon le niveau. `confiance` ∈ [0..1] ; 0 = pas encore établie (on ne crie pas « faible », on dit « à confirmer »).

const NIVEAUX = [
  { seuil: 0.65, segments: 3, libelle: 'Confiance haute' },
  { seuil: 0.4, segments: 2, libelle: 'Confiance moyenne' },
  { seuil: 0.15, segments: 1, libelle: 'Confiance faible' },
  { seuil: -1, segments: 0, libelle: 'Confiance à confirmer' },
];

function niveauDe(v: number) {
  return NIVEAUX.find((n) => v >= n.seuil) ?? NIVEAUX[NIVEAUX.length - 1]!;
}

export function IndiceConfiance({ valeur, className }: { valeur: number | null | undefined; className?: string }) {
  if (valeur == null) return null;
  const n = niveauDe(valeur);
  return (
    <span className={`flex items-center gap-1.5 text-[0.625rem] text-muted-foreground ${className ?? ''}`} title={`${n.libelle} (${Math.round(valeur * 100)} %)`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-[3px] rounded-[1px]"
            style={{
              height: `${5 + i * 3}px`,
              backgroundColor: i < n.segments ? 'var(--ardoise)' : 'var(--border)',
            }}
          />
        ))}
      </span>
      {n.libelle}
    </span>
  );
}
