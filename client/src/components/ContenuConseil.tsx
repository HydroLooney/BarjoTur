import type { ComponentPropsWithoutRef } from 'react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { routeDepuisLienMd } from '@/lib/conseils';

// Rendu du markdown d'un conseil (T056), mappé sur la charte (M198) : titres Fraunces à l'échelle typo, corps
// lisible, listes, gras. AUCUN hex (tokens seulement), AUCUN HTML brut (react-markdown ne rend pas le HTML par
// défaut → pas de dangerouslySetInnerHTML, contenu sanitize). Les liens INTERNES entre pages de conseil
// (« 01 - Sortir de la foule.md ») sont réécrits en routes d'app ; les liens externes s'ouvrent dans un onglet.

function Lien({ href, children }: ComponentPropsWithoutRef<'a'>) {
  const route = href ? routeDepuisLienMd(href) : null;
  if (route) {
    return (
      <Link to={route} className="text-accent underline underline-offset-2 hover:opacity-80">
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:opacity-80"
    >
      {children}
    </a>
  );
}

export function ContenuConseil({ markdown }: { markdown: string }) {
  return (
    <div className="max-w-prose space-y-4">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="font-serif text-titre leading-tight">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-6 font-serif text-section leading-tight">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 font-serif text-corps font-[var(--graisse-forte)]">{children}</h3>,
          p: ({ children }) => <p className="text-corps leading-[var(--interligne-corps)] text-foreground">{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 text-corps leading-[var(--interligne-corps)]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 text-corps leading-[var(--interligne-corps)]">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => <strong className="font-[var(--graisse-forte)]">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
          ),
          a: Lien,
          hr: () => <hr className="border-border" />,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
