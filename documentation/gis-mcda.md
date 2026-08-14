# Le moteur GIS-MCDA, expliqué pas à pas

Ce document explique le moteur d'aide à la décision de Barjøtur, pour un lecteur qui découvre le projet et pour
l'équipe qui le construit. Il tient au niveau de la méthode, qui est figée. Le détail d'implémentation (noms de
tables, formules exactes) vit dans le code et le dictionnaire de données, et se documente au fil du recalcul. La
réflexion complète qui la fonde, avec ses sources, nourrit chaque choix exposé ici.

## Le problème, en deux volets couplés

Barjøtur résout deux problèmes qui ne sont pas de même nature. Le premier est d'**agréger des préférences** :
reconstruire le voyage idéal de chaque voyageur, puis en déduire un compromis pour la famille. Le second est de
**planifier un itinéraire faisable** : choisir un sous-ensemble de haltes sous un budget de temps, avec un routage
réel (van, marche, transports), les ferries, les nuitées et les services.

Le couplage joue dans les deux sens, et c'est lui qui donne du sens aux votes. Le voyage idéal de chacun est déjà
une planification, calculée sous contrainte de faisabilité. Et quand deux envies s'excluent dans le temps
disponible, c'est la planification qui tranche, et ce choix remonte dans le consensus. Un moteur qui laisserait les
votes sans effet sur l'itinéraire serait cosmétique.

## Quatre couches qu'on ne mélange jamais

La qualité d'un lieu, la philosophie du voyage, les envies chiffrées et les votes sont quatre choses distinctes. Les
confondre produit un score opaque que personne ne peut expliquer. Le moteur les tient séparées, et calcule la
faisabilité à part.

- La **qualité** est une mesure objective de l'intérêt d'un lieu, à partir de critères indépendants.
- La **philosophie** décrit un genre de voyage par des tensions (calme ou intense, nature ou culture).
- Les **envies** sont des cibles chiffrées et plafonnées, propres à chaque voyageur.
- Les **votes** sont l'avis direct de la famille sur les expériences.

## Noter les lieux, une fonction de valeur

Le score d'un lieu alimente un problème d'optimisation qui exige un profit cardinal, absolu et stable. Cette
exigence commande la méthode. On emploie une **moyenne pondérée ordonnée (OWA)**, qui généralise la somme pondérée
classique et règle le degré de compensation entre critères. Un critère de sécurité ou de faisabilité se compense
peu, on abaisse alors la compensation vers un ET prudent. Un critère d'agrément se compense davantage.

Deux familles de méthodes réputées sont écartées à cette étape, pour une raison précise. La méthode TOPSIS produit
un rang relatif qui se retourne quand le catalogue change, ce qui interdit un champ stable. Les méthodes de
surclassement, PROMETHEE et ELECTRE, donnent un ordre et non une valeur cardinale, et leur coût devient prohibitif
sur des milliers de lieux. Elles restent excellentes pour un autre usage, décrit plus bas.

Agréger des critères suppose d'abord qu'ils ne comptent pas deux fois la même chose. Le moteur mesure donc leur
redondance avant de les combiner, par un diagnostic d'inflation de la variance qui distingue l'indépendance réelle
d'une simple corrélation. Quand deux critères se recoupent mais portent chacun un sens, ils ne sont pas supprimés en
silence : l'accès facile en van et la tranquillité, par exemple, s'opposent et dessinent un même axe, accès contre
solitude, qu'on documente et qu'on garde comme une tension du voyage. Les poids, de leur côté, ne sortent pas d'un
seul avis. Un jeu de poids objectif, tiré du contraste et de la dispersion des critères eux-mêmes, se confronte au
jeu de poids issu de la philosophie du voyage, et l'OWA agrège les deux, jamais l'un sans l'autre. C'est la règle des
quatre couches, tenue jusque dans le détail du calcul.

## Une qualité continue sur le réseau accessible

L'intérêt d'un lieu ne se propage pas à vol d'oiseau mais le long des routes et des sentiers qu'on peut réellement
emprunter. Le moteur standardise chaque critère par une fonction d'appartenance floue, adaptée à sa sémantique, puis
interpole la qualité sur le réseau, par arête densifiée, à une résolution fine. Cette précaution évite l'artefact
bien connu où le résultat dépend du maillage choisi pour l'affichage.

## Élire les préférences sans les biaiser

Demander à quelqu'un de choisir un archétype de voyage l'ancre sur les mots qu'on lui montre. Le moteur procède
autrement : un questionnaire neutre, sans étiquette affichée en entrée, dont on désagrège les réponses pour inférer
les poids. Le classement d'archétypes, présenté ensuite, sert à caler l'échelle de valeur, pas à cadrer le choix.

## Le consensus égalitariste

Le consensus ne moyenne pas les envies, ce qui donnerait un voyage tiède. Il cherche le voyage faisable qui soigne
d'abord la personne la moins bien lotie, puis la deuxième, et ainsi de suite. Ce principe, dit égalitariste, se
formule comme un max-min régularisé : on maximise la satisfaction du membre le moins satisfait, en évitant qu'un
membre extrême tire tout à lui.

Pour le construire, le moteur dresse une matrice de satisfaction croisée, où chaque voyage candidat, y compris le
voyage idéal de chacun et les archétypes, est évalué par la fonction de valeur de chaque voyageur. Cette lecture,
proche des méthodes de décision de groupe, montre les accords et les conflits. Le résultat s'affiche honnêtement :
chacun voit ce qu'il gagne et ce qu'il cède. Les désaccords sont assumés, pas gommés.

## La faisabilité, un orienteering routé

Choisir les haltes sous budget de temps est un problème d'orienteering, résolu par un solveur dédié et un routage
réel. Le moteur glane au passage le beau qui se trouve sur le corridor, sans détour coûteux, et applique une règle
de satiété qui pousse à varier les plaisirs plutôt qu'à empiler dix cascades. Le choix final entre quelques voyages
complets, lui, se prête bien à une méthode de surclassement de groupe, qui lit finement les conflits sur un petit
ensemble.

## Les envies et l'enveloppe d'activité

Une envie comme le nombre de restaurants n'est pas une qualité de lieu. C'est une cible plafonnée, confrontée à une
enveloppe d'activité qui dépend du rythme réel du voyage. Un restaurant se propose quand l'occasion se présente et
que le budget planifié le permet, il ne reçoit pas de score dans le champ de qualité.

## Ce que le moteur impose de calculer

Cette méthode suppose un socle précalculé : des réseaux routables propres, des isochrones, une matrice de temps
entre bases, les critères de qualité standardisés et interpolés, les valeurs par défaut des lieux, et les entrées de
la récompense du composeur. Ces calculs forment un catalogue précis. Chaque calcul est canonique : une seule version
fait foi, rejouable par un script versionné, tracée jusqu'à sa source.

## Sources

La méthode s'appuie sur des familles établies : moyenne pondérée ordonnée, standardisation floue, interpolation
spatiale, orienteering sous contraintes, consensus par distance aux idéaux, surclassement de groupe. Chacune est
citée à sa source primaire. Aucune valeur ni citation n'est avancée ici sans être vérifiée.
