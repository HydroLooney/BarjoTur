import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ContenuConseil } from '@/components/ContenuConseil';
import { Chargement, MessageVide } from '@/ui/blocs/EtatVue';
import { INTRO_CONSEIL, conseilParSlug, type ConseilMeta } from '@/lib/conseils';

// Section Conseils (T056) : lecteur éditorial content-driven (source `documentation/conseils/`, M198). Deux vues
// dans une route : l'index (intro + les pages) et une page ouverte (/conseils/:slug). Accès depuis la carte
// « Le voyage » et le menu avatar, PAS un onglet de la barre principale (granite, discret, M174).

// Petit chargeur du corps markdown à la demande (le glob est eager:false : hors bundle principal).
function useCorps(conseil: ConseilMeta | undefined) {
  const [corps, setCorps] = useState<string | null>(null);
  const [charge, setCharge] = useState(false);
  useEffect(() => {
    let vivant = true;
    setCorps(null);
    setCharge(false);
    if (!conseil) {
      setCharge(true);
      return;
    }
    void conseil.charger().then((md) => {
      if (vivant) {
        setCorps(md);
        setCharge(true);
      }
    });
    return () => {
      vivant = false;
    };
  }, [conseil]);
  return { corps, charge };
}

// Index = le markdown d'intro rendu tel quel (content-driven, M198/M200) : son propre H1 fait le titre (pas de
// double titre de route), et sa section « Les cinq pages » porte déjà les liens vers chaque page (réécrits en
// routes par ContenuConseil). Même motif qu'une vue slug : un seul titre, celui du md.
function IndexConseils() {
  const { corps } = useCorps(INTRO_CONSEIL);
  return (
    <section className="space-y-4">
      {corps ? <ContenuConseil markdown={corps} /> : <Chargement libelle="Chargement des conseils." />}
    </section>
  );
}

function PageConseil({ slug }: { slug: string }) {
  const conseil = conseilParSlug(slug);
  const { corps, charge } = useCorps(conseil);
  return (
    <section className="space-y-4">
      <Link to="/conseils" className="inline-block text-sm text-accent hover:underline">
        ← Tous les conseils
      </Link>
      {!conseil && charge ? (
        <MessageVide>Ce conseil n'existe pas (ou plus). Revenez à la liste.</MessageVide>
      ) : !corps ? (
        <Chargement libelle="Chargement du conseil." />
      ) : (
        <ContenuConseil markdown={corps} />
      )}
    </section>
  );
}

export default function Conseils() {
  const { slug } = useParams<{ slug: string }>();
  return slug ? <PageConseil slug={slug} /> : <IndexConseils />;
}
