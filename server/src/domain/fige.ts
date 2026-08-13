// Contrats fige désormais CANONIQUES dans @barjotur/shared (câblés par M sur B007, M011). Ce module ne fait
// plus que re-exporter : plus de duplication, une seule source de vérité (le socle). `FigeDetail` = passe-plat
// de api.fige_lire ; `ScenarioDefaut` = api.scenario_defaut.

export type { FigeDetail, ItineraireFige, EtapeFige, ScenarioDefaut } from '@barjotur/shared';
