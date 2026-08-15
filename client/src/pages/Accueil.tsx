import { Link } from 'react-router-dom';
import { PremiersPas } from '@/components/PremiersPas';
import { BandeauAToiDeJouer } from '@/components/BandeauAToiDeJouer';
import { FilDepuisDerniereVisite } from '@/components/FilDepuisDerniereVisite';
import { FilDuParcours } from '@/components/FilDuParcours';
import { usePeut } from '@/hooks/usePeut';
import { useIdentite } from '@/stores/identite';
import { jetonEspace } from '@/lib/espaces-couleur';
import { ESPACES } from '@/lib/libelles';

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

const ESPACES_HUB: Espace[] = [
  { to: '/explorer', titre: ESPACES.explorer, quoi: 'Découvrir les lieux sur la carte.' },
  { to: '/voter', titre: ESPACES.voter, quoi: 'Dire ce qu’on aime, sans classer personne.' },
  { to: '/composer', titre: ESPACES.composer, quoi: 'Bâtir l’itinéraire ensemble.' },
  { to: '/notre-voyage', titre: ESPACES.notreVoyage, quoi: 'Le voyage jour après jour, sur la carte.' },
  { to: '/preparatifs', titre: ESPACES.preparer, quoi: 'Le van, le ferry, les repas, le matériel.' },
  { to: '/compter', titre: ESPACES.compter, quoi: 'Le budget prévisionnel du voyage.' },
  { to: '/reglages', titre: ESPACES.coulisses, quoi: 'Régler et comprendre la mécanique.', ownerOnly: true },
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
  const peutCoulisses = usePeut('administrer_voyageurs');
  const jours = joursAvantDepart();
  const espaces = ESPACES_HUB.filter((e) => !e.ownerOnly || peutCoulisses);

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

      {/* Prochaine action + onboarding (avancées v3 gardées). */}
      <PremiersPas />
      <BandeauAToiDeJouer />
      <FilDepuisDerniereVisite />

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
