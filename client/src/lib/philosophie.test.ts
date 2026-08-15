import { describe, expect, it } from 'vitest';
import {
  CURSEURS_SECOURS,
  ENVIES_SECOURS,
  profilDefaut,
  completerProfil,
  fusionnerCatalogue,
  resumeCurseur,
  resumeEnvie,
  syntheseHumaine,
} from './philosophie';
import { CURSEUR_CLES, ENVIE_CLES } from '@barjotur/shared';

describe('philosophie (profil voyageur, MCDA v3)', () => {
  it('le catalogue de secours couvre les 7 curseurs et 4 envies du contrat', () => {
    expect(CURSEURS_SECOURS.map((c) => c.cle).sort()).toEqual([...CURSEUR_CLES].sort());
    expect(ENVIES_SECOURS.map((e) => e.cle).sort()).toEqual([...ENVIE_CLES].sort());
  });

  it('Nouveauté et Tempo sont présents mais pas encore actifs', () => {
    const inactifs = CURSEURS_SECOURS.filter((c) => !c.actifLive).map((c) => c.cle).sort();
    expect(inactifs).toEqual(['nouveaute', 'tempo']);
  });

  it('profil par défaut = tout au milieu (0.5)', () => {
    const p = profilDefaut();
    expect(Object.values(p.curseurs).every((v) => v === 0.5)).toBe(true);
    expect(Object.values(p.envies).every((v) => v === 0.5)).toBe(true);
    expect(p.cap_nord).toBe(0.5);
  });

  it('completerProfil comble les clés manquantes sur le défaut', () => {
    const p = completerProfil({ curseurs: { effort: 1 } });
    expect(p.curseurs.effort).toBe(1);
    expect(p.curseurs.rythme).toBe(0.5);
    expect(p.envies.paysage).toBe(0.5);
    expect(p.cap_nord).toBe(0.5);
  });

  it('fusionnerCatalogue laisse le serveur primer sur le secours', () => {
    const cat = fusionnerCatalogue({
      curseurs: [{ cle: 'effort', libelle: 'Servi', poleA: 'a', poleB: 'b', defaut: 0.5, actifLive: true }],
    });
    expect(cat.curseurs.find((c) => c.cle === 'effort')?.libelle).toBe('Servi');
    // les autres restent au secours, et rien ne manque
    expect(cat.curseurs).toHaveLength(CURSEURS_SECOURS.length);
    expect(cat.envies).toHaveLength(ENVIES_SECOURS.length);
  });

  it('resumeCurseur choisit pôle A / équilibre / pôle B selon la position', () => {
    const cat = { poleA: 'Prendre le temps', poleB: 'Voir un maximum' };
    expect(resumeCurseur(cat, 0.1)).toBe('prendre le temps');
    expect(resumeCurseur(cat, 0.5)).toBe('un équilibre');
    expect(resumeCurseur(cat, 0.9)).toBe('voir un maximum');
  });

  it('resumeEnvie va de peu à beaucoup', () => {
    const cat = { libelle: 'La randonnée' };
    expect(resumeEnvie(cat, 0.1)).toMatch(/^peu/);
    expect(resumeEnvie(cat, 0.5)).toMatch(/^un peu/);
    expect(resumeEnvie(cat, 0.9)).toMatch(/^beaucoup/);
  });

  it('syntheseHumaine ignore les curseurs proches du milieu et retient les marqués', () => {
    const cat = fusionnerCatalogue();
    expect(syntheseHumaine(profilDefaut(), cat)).toMatch(/encore ouvert/);
    const marque = completerProfil({ curseurs: { effort: 0.95 } });
    expect(syntheseHumaine(marque, cat)).toMatch(/grandes randos/i);
  });
});
