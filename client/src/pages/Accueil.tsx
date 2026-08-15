import { Link } from 'react-router-dom';
import { PremiersPas } from '@/components/PremiersPas';
import { BandeauAToiDeJouer } from '@/components/BandeauAToiDeJouer';
import { FilDepuisDerniereVisite } from '@/components/FilDepuisDerniereVisite';
import { FilDuParcours } from '@/components/FilDuParcours';
import { usePeut } from '@/hooks/usePeut';
import { useIdentite } from '@/stores/identite';
import { useRecos } from '@/lib/queries/recos';
import { RECOS_TEST } from '@/lib/fixtures/recos-test';
import { jetonEspace } from '@/lib/espaces-couleur';
import { ESPACES, humaniserTexte } from '@/lib/libelles';

// ACCUEIL = HUB « Où en est-on ? » (ossature V2, M471/M473). Point d'entrée qui RACONTE et ORIENTE : un mot
// d'accueil + le compte à rebours, la prochaine action (v3 : « à toi de jouer »), l'onboarding (v3 : PremiersPas),
// et des CARTES vers chaque espace par activité. On garde les avancées v3 (onboarding, fil, signal boucle) et on
// pose l'organisation v2 par-dessus. Le logo-maison (en tête) ramène toujours ici.

// Départ = ferry Kristiansand 04/08/2027 (canonique). Compte à rebours indicatif (heure navigateur).
const DEPART = new Date('2027-08-04T00:00:00');
function joursAvantDepart(): number | null {
  if (typeof window === 'undefined') return null;
  const ms = DEPART.getTime() - Date.now();
  return ms > 0 ? Math.ceil(ms / 86_400_000) : 0;
}

interface Espace {
  to: string;
  titre: string;
  quoi: string;
  ownerOnly?: boolean;
}

// Les 8 espaces (M499 §3), « un même voyage », circulation libre. Le voyage = cette page ; les 7 autres en cartes.
const ESPACES_HUB: Espace[] = [
  { to: '/explorer', titre: ESPACES.explorer, quoi: 'Découvrir les lieux et voter.' },
  { to: '/mes-envies', titre: ESPACES.envies, quoi: 'Votre façon de voyager : rythme, paysages, thèmes.' },
  { to: '/mon-voyage', titre: ESPACES.monVoyage, quoi: 'Votre itinéraire idéal et votre écart au commun.' },
  { to: '/le-trajet', titre: ESPACES.notreVoyage, quoi: 'Composer, décider et figer en famille.' },
  { to: '/carte', titre: ESPACES.carte, quoi: 'L’itinéraire animé, jour après jour.' },
  { to: '/preparatifs', titre: ESPACES.preparatifs, quoi: 'Budget, réservations, intendance.' },
  { to: '/reglages', titre: ESPACES.coulisses, quoi: 'Réglages, aide, glossaire.', ownerOnly: true },
];

function CarteEspace({ e }: { e: Espace }) {
  return (
    <Link
      to={e.to}
      className="group flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-posee transition-colors duration-court hover:bg-muted"
    >
      <span className="flex items-center gap-2">
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: jetonEspace(e.to) }} />
        <span className="text-lg font-medium group-hover:text-accent">{e.titre}</span>
      </span>
      <span className="text-sm text-muted-foreground">{e.quoi}</span>
    </Link>
  );
}

export default function Accueil() {
  const prenom = useIdentite((s) => s.prenom);
  const code = useIdentite((s) => s.code);
  const peutCoulisses = usePeut('administrer_voyageurs');
  const jours = joursAvantDepart();
  const espaces = ESPACES_HUB.filter((e) => !e.ownerOnly || peutCoulisses);
  // 6 recommandations personnalisées à explorer (M485) : « Voici des lieux pour toi. » Clic → fiche.
  // Jeu de test DEV (R1, balisé, retiré au flip) tant que l'endpoint rend [] — comme l'Explorer.
  const recosReel = useRecos(code).data?.recos ?? [];
  const recos = (recosReel.length ? recosReel : import.meta.env.DEV ? RECOS_TEST : []).slice(0, 6);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="font-serif text-sm uppercase tracking-[0.15em] text-muted-foreground">Norvège 2027</p>
        <h1 className="font-serif text-3xl leading-tight">
          {prenom ? `Bonjour ${prenom} !` : 'Bonjour !'}
        </h1>
        {jours != null ? (
          <p className="text-muted-foreground">
            {jours > 0 ? (
              <>Le grand départ dans <span className="chiffres font-medium text-foreground">{jours}</span> jours.</>
            ) : (
              'Le voyage a commencé. Bonne route !'
            )}
          </p>
        ) : null}
      </div>

      {/* Prochaine action + onboarding (avancées v3 gardées) — le « guide » du parcours (M475/M485). */}
      <PremiersPas />
      <BandeauAToiDeJouer />
      <FilDepuisDerniereVisite />

      {/* 6 recommandations personnalisées à explorer (M485). */}
      {recos.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Des lieux pour vous, à explorer</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {recos.map((r) => (
              <Link
                key={r.cle}
                to={`/explorer/${encodeURIComponent(r.cle)}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-posee transition-colors duration-court hover:bg-muted"
              >
                <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: 'var(--ocre)' }} />
                <span className="font-medium">{humaniserTexte(r.nom)}</span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Les espaces, en cartes (hub v2). */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Où aller</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {espaces.map((e) => (
            <CarteEspace key={e.to} e={e} />
          ))}
        </div>
      </div>

      {/* Où en est-on : le fil du parcours (avancée v3 gardée), plus discret. */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Où en est-on</h2>
        <FilDuParcours />
      </div>
    </section>
  );
}
