import type { PoiEnrichissement } from '@barjotur/shared';
import { estPerle, libelleAire, nbCommunautes, origineGuide, totalCitations } from '@/lib/enrichissement';
import { Badge } from '@/ui/primitives/badge';

// Provenance d'un lieu (A28 / M137) : d'où vient sa réputation, dit en clair, sur la fiche. Trois signaux :
// l'origine guide (endossement papier), le signal communauté (combien de communautés INDÉPENDANTES le citent —
// la concordance fait la robustesse), et des photos sourcées (attribution + licence, R1). Discret : le détail par
// aire est replié. Fixture hors live ; au flip, vraie donnée d'A. Placeholders de photo en démo (vraies au flip).
export function ProvenanceLieu({ enr }: { enr: PoiEnrichissement }) {
  const guide = origineGuide(enr);
  const signaux = enr.signaux_communaute ?? [];
  const nComm = nbCommunautes(signaux);
  const nCit = totalCitations(signaux);
  const perle = estPerle(signaux);
  const photos = enr.photos ?? [];

  const rien =
    !guide &&
    nComm === 0 &&
    !enr.ce_qu_il_sen_dit &&
    !enr.description &&
    !enr.wikipedia_url &&
    photos.length === 0;
  if (rien) return null;

  return (
    <section className="space-y-2 rounded-lg border border-border p-3">
      <h2 className="text-sm font-medium">Ce qu'il s'en dit</h2>

      {enr.description ? <p className="max-w-prose text-sm">{enr.description}</p> : null}
      {enr.ce_qu_il_sen_dit ? (
        <p className="max-w-prose text-sm text-muted-foreground">{enr.ce_qu_il_sen_dit}</p>
      ) : null}
      {enr.wikipedia_url ? (
        <p className="max-w-prose text-sm text-muted-foreground">
          {enr.wikipedia_resume ? `${enr.wikipedia_resume} ` : ''}
          <a
            href={enr.wikipedia_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Lire sur Wikipédia
          </a>
        </p>
      ) : null}

      {guide || perle ? (
        <div className="flex flex-wrap items-center gap-2">
          {guide ? <Badge variant="contour">D'après {guide}</Badge> : null}
          {perle ? <Badge variant="primaire">Pépite</Badge> : null}
        </div>
      ) : null}

      {nComm > 0 ? (
        <details>
          <summary className="flex min-h-tactile cursor-pointer items-center text-sm">
            Cité par {nCit} source{nCit === 1 ? '' : 's'} de {nComm} communauté{nComm === 1 ? '' : 's'}{' '}
            indépendante{nComm === 1 ? '' : 's'}
          </summary>
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {signaux
              .filter((s) => s.n_sources > 0)
              .map((s) => (
                <li key={s.aire_langue}>
                  · communauté {libelleAire(s.aire_langue)} : {s.n_sources} source{s.n_sources === 1 ? '' : 's'}
                  {s.perle ? ' · perle' : ''}
                </li>
              ))}
          </ul>
          <p className="mt-1 text-xs text-muted-foreground">
            Plus il y a de communautés d'accord, plus le lieu est une valeur sûre.
          </p>
        </details>
      ) : null}

      {photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Photos du lieu">
          {photos.map((p) => (
            <figure key={p.url} className="w-36 shrink-0">
              <div
                className="flex h-24 w-36 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground"
                aria-label={p.legende ?? 'Photo du lieu'}
              >
                {p.legende ?? 'Photo'}
              </div>
              <figcaption className="mt-0.5 text-[10px] text-muted-foreground">
                {p.source} · {p.licence}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  );
}
