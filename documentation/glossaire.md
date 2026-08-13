# Glossaire

Le vocabulaire de Barjøtur, en un seul endroit. Un mot par concept, cohérent partout, côté code comme côté
interface. Deux registres coexistent : un mot concret pour la famille, un terme exact pour les coulisses et le code.
Cette page est la référence partagée de l'équipe pendant la construction, et sert aussi de glossaire au lecteur
extérieur.

## Côté famille et côté coulisses

L'interface famille bannit le jargon et ne montre jamais de score brut, pour ne pas cadrer les votes. Les coulisses
montrent tout, mais expliquent tout.

| Terme exact (code, coulisses) | Mot famille (interface) |
|---|---|
| Qualité d'un lieu | l'intérêt du lieu |
| Tier par défaut | la réputation, ce qu'en disent les guides |
| Vote TSAB | mon avis (Trésor, Super, Sympa, Bof) |
| Philosophie, curseurs | l'esprit du voyage |
| Envie, cible plafonnée | nos envies, par exemple combien de restos |
| Récompense de nœud | jamais montrée |
| Orienteering, composeur | on assemble le voyage |
| Consensus égalitariste | le voyage qui va à tout le monde |
| Archétype | une idée de voyage, une ambiance |
| Satiété | varier les plaisirs |
| Glanage de corridor | ce qu'on voit en chemin |

## Les termes, définis

**Voyageur.** Le rôle de base d'une personne du voyage, qualifiée adulte ou enfant. Un voyageur vote, explore,
ajoute des lieux. Le terme de domaine est voyageur ; la table qui le stocke garde son nom d'origine, pour ne pas
perturber les votes et les liens déjà posés.

**Organisateur, organisateur principal.** Un voyageur peut être organisateur. L'organisateur principal, unique,
détient le code maître et arbitre les droits. Les gestes sensibles, comme régénérer un lien ou changer un rôle, sont
protégés par un code.

**Tier TSAB.** L'échelle d'avis en quatre crans, du meilleur au plus ordinaire : Trésor, Super, Sympa, Bof. Un vote
range un lieu, un circuit ou une variante dans un de ces crans, sous un budget de votes rééquilibrable.

**Tier par défaut.** La réputation d'un lieu avant tout vote, dérivée de l'analyse des guides et des retours de la
communauté. C'est une valeur calculée, tracée jusqu'à sa source, distincte du tier qu'un voyageur pose.

**Philosophie du voyage.** Un genre de voyage décrit par des tensions réglées au curseur, comme calme contre intense
ou nature contre culture. Elle oriente le moteur sans noter les lieux.

**Envie.** Une cible chiffrée et plafonnée, propre à un voyageur, par exemple un nombre de randonnées ou de
restaurants. Une envie se confronte à ce que le voyage peut réellement offrir, elle ne devient pas un score de lieu.

**Qualité.** La mesure objective de l'intérêt d'un lieu, agrégée à partir de critères indépendants par une moyenne
pondérée ordonnée. Elle est cardinale et stable, pour alimenter l'optimisation.

**Moyenne pondérée ordonnée.** La méthode d'agrégation retenue pour la qualité. Elle généralise la somme pondérée et
règle le degré de compensation entre critères, d'un ET prudent à un OU optimiste.

**Standardisation floue.** La mise à l'échelle de chaque critère par une fonction d'appartenance adaptée à son sens,
avant agrégation, pour comparer des grandeurs de natures différentes.

**Krigeage réseau.** L'interpolation de la qualité le long des routes et sentiers empruntables, par arête densifiée,
plutôt qu'à vol d'oiseau, pour éviter que le résultat dépende du maillage d'affichage.

**Archétype.** Un voyage complet donné en exemple, une ambiance. Classer des archétypes aide à caler l'échelle de
valeur d'un voyageur, sans lui imposer d'étiquette en entrée.

**Consensus égalitariste.** Le voyage faisable qui soigne d'abord la personne la moins bien lotie, puis la suivante.
Il ne moyenne pas les envies. Il s'affiche honnêtement, avec ce que chacun gagne et ce qu'il cède.

**Orienteering, composeur.** Le problème de choisir les haltes sous un budget de temps, résolu par un solveur dédié
et un routage réel. Le composeur en est la mise en œuvre.

**Récompense.** La valeur qu'une halte apporte au voyage, combinant qualité, votes, envies, prix et progression.
Elle pilote l'optimisation et n'est jamais montrée pendant le vote.

**Glanage de corridor.** Le fait de saisir le beau qui se trouve sur le trajet, sans détour coûteux.

**Satiété.** La règle qui pousse à varier les plaisirs plutôt qu'à empiler des lieux du même genre.

**Enveloppe d'activité.** La marge de temps réellement disponible pour les activités, selon le rythme du voyage, qui
détermine ce qu'une envie peut recevoir.

**Base.** Un point d'ancrage d'où rayonne une portion du voyage, souvent un lieu de nuitée. La matrice de temps
entre bases est un calcul central.

**Fige.** L'itinéraire retenu, enregistré avec sa géométrie continue et son agenda jour par jour. La carte animée
rejoue le fige.

**Écart DB1 et DB2.** Le contrôle qui compare la base maître, qui calcule, et la base de service, qui sert, par
empreinte. Il casse à la moindre divergence et garantit que le service reflète bien le dernier calcul.

**Calcul canonique.** Un calcul dont une seule version fait foi, nommé, documenté, rejouable par un script
versionné, sans valeur en dur, tracé jusqu'à sa source. C'est ce qui rend le projet fiable et rejouable.

**Bascule strangler.** La méthode de mise en ligne, où la nouvelle version remplace l'ancienne module par module,
avec parité vérifiée et retour arrière prêt, sans jamais couper le service.

**Base maître et base de service.** La base maître porte tout et calcule le lourd, par intermittence. La base de
service, toujours en ligne et autonome, sert l'application et compose en direct, sans dépendre de la base maître.

**Sidecar.** Le service Python qui résout la composition d'itinéraire, appelé par le backend.

**Martin.** Le serveur de tuiles vectorielles qui alimente la carte.
