// Appétit thématique par voyageur (M097/M092) — le contrat `AppetitThematique { theme, appetit }` est canonique dans
// @barjotur/shared (activite.ts, posé par M). Re-export. C règle ces envies au curseur, B les agrège (égalitariste)
// pour moduler le budget-temps ; l'autorité d'écriture est la capacité `voter` (carte partagée `peut`).

export type { AppetitThematique, Theme } from '@barjotur/shared';
