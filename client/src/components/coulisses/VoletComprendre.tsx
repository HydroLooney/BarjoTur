import { Link } from 'react-router-dom';

// COULISSES › Comprendre (M391, tout public, lecture seule). Explique comment l'app decide, sobrement, pour la
// confiance par la transparence. Aucun reglage ici : la methode et les chiffres vivent en Coulisses, pas devant
// la famille pendant le vote (anti-cadrage). Voix R7. Les planches de concept (clustering, vignettes, symbologie)
// restent accessibles pour qui veut voir le detail visuel.

function BlocMethode({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-posee">
      <h3 className="text-section font-medium">{titre}</h3>
      <div className="max-w-prose space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function VoletComprendre() {
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-muted-foreground">
        Comment l'application décide, en clair. Rien à régler ici : juste ce qu'il faut savoir pour faire
        confiance aux propositions, et garder la main.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <BlocMethode titre="Comment un lieu est mis en avant">
          <p>
            Chaque lieu reçoit une note d'intérêt à partir de plusieurs critères objectifs (accès en van,
            beauté, calme, services à proximité, saison). Cette note le range dans un niveau, de « vaut le
            voyage » à « au passage ». C'est une aide à trier, pas un jugement définitif.
          </p>
          <Link to="/coulisses/clustering" className="text-accent hover:underline">
            Voir la planche des niveaux →
          </Link>
        </BlocMethode>

        <BlocMethode titre="Le découpage du pays">
          <p>
            La Norvège est découpée en trois échelles emboîtées : la <strong>région</strong>, puis le{' '}
            <strong>district</strong>, puis le <strong>paysage</strong>. Le fil au-dessus de chaque lieu
            rappelle où l'on se trouve dans cet emboîtement. Le découpage suit le terrain réel, il n'est pas
            dessiné à la main.
          </p>
          <Link to="/coulisses/decoupage" className="text-accent hover:underline">
            Explorer le découpage de haut en bas →
          </Link>
        </BlocMethode>

        <BlocMethode titre="Le vote : prioriser, pas noter">
          <p>
            Voter n'est pas mettre une note. Chacun dispose d'un petit budget de coups de cœur par niveau :
            on choisit ce qui compte le plus, quitte à échanger un lieu contre un autre. On exprime des envies,
            on ne classe pas des élèves.
          </p>
          <Link to="/mes-paniers" className="text-accent hover:underline">
            Voir mes paniers de vote →
          </Link>
        </BlocMethode>

        <BlocMethode titre="La confiance dans la donnée">
          <p>
            L'intérêt d'un lieu et la solidité de l'information sont deux choses distinctes. Un lieu peut être
            magnifique et mal documenté. On garde donc la confiance sur un axe à part, pour ne jamais confondre
            « on en est sûr » et « c'est bien ». Le détail de ce qui est réel ou estimé est dans l'onglet
            Transparence.
          </p>
        </BlocMethode>
      </div>
    </div>
  );
}
