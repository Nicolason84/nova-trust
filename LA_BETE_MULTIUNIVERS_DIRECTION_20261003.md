# La Bête — transition vers un espace multiunivers

Statut : NEXT_STAGE_SPECIFIED_NOT_IMPLEMENTED.
Direction demandée par Nicolas le 3 octobre 2026, après la livraison du dialogue public et de la préparation des démarches.

## Changement de présentation

Sortir du long document à faire défiler. Ne pas remplacer ce document par une grille de liens qui renvoie à la même page monolithique.

L’utilisateur entre dans un univers, ouvre un objet, explore ses relations et ses preuves, puis revient à sa trajectoire. La page publique actuelle reste le point d’entrée canonique et le secours pendant la migration. Une seule La Bête ; aucune application parallèle.

## Réutilisation constatée dans le dépôt

- `docs/data/france-organism.json` : identité `OJO_FRANCE_ORGANISM_V1`, France, topologie et systèmes transversaux.
- `docs/data/france-topology.json` : topologie territoriale existante.
- `docs/data/france-debt-rate-live.json` : vérité dette/taux, sources, ProofGraph, horizons et historique.
- `docs/data/france-debt-rate-evolution.json` : état, santé, mémoire et préparation des démarches.
- `docs/france-debt-rate-risk-live-2026-10-02.html` : surfaces déjà reliées à ces états, scène 3D et projections existantes.
- `docs/assets/la-bete-dialogue.js` : règles de dialogue partagées entre navigateur et traitement des fils publics.
- `docs/assets/la-bete-participation.js` : projection des propositions et démarches, sans nouvelle boucle.
- Fils GitHub `[LA BÊTE]` : contributions publiques explicites ; aucune seconde base des contributions.

Les anciennes pages `budget-2027-living-world-v5-2026-09-21.html` et `budget-2027-organism-v6-2026-09-21.html` sont des ressources à examiner pour récupération de composants. Leur existence ne vaut pas validation de leur sémantique, fraîcheur ou autorité. Ne pas les promouvoir aveuglément.

## Expérience cible

Un atlas d’entrée expose les objets réellement disponibles, leurs relations et leur état de preuve. Il permet recherche, retour à l’accueil, historique de navigation et chemins partageables. Il n’exige pas de comprendre l’architecture interne.

Les univers sont des vues reliées d’un même graphe :

- Territoires : France → région → département → intercommunalité → commune, lorsque les données de ce niveau sont effectivement disponibles.
- Systèmes : finances publiques → dette/taux/refinancement, puis uniquement les domaines documentés.
- Organisations : organismes sources déjà identifiés ; références communes, pas second registre.
- Preuves et temps : publication → observation → transformation → scénario → limites et versions.
- Idées : question → proposition → clarification → éléments documentés → expérience proposée → décision humaine.
- Démarches : manque → dossier → autorisation privée → action attestée → réponse → validation.

Les personnes et organisations privées de SUPRA ne deviennent jamais publiques par cette navigation. Un univers privé peut exister dans SUPRA uniquement avec son autorisation existante ; aucun export public implicite.

## Contrat de navigation

Chaque route transporte un identifiant canonique, le contexte courant et, lorsqu’il est figé, l’identifiant de l’instantané. Un retour conserve l’objet, les filtres et l’état de lecture ; il ne recrée pas l’objet.

La navigation latérale traverse les relations : territoire ↔ système ↔ organisation ↔ source ↔ démarche ↔ idée. Les relations descriptives, causales, proposées et inconnues sont distinguées. Une proximité spatiale ou un effet lumineux ne constitue jamais une preuve de causalité.

Le dialogue est contextuel et accessible depuis l’objet ouvert. La réponse précise ce qu’elle sait sur cet objet, sa période et ses sources, et ce qu’elle ne sait pas. Le contexte utile est transmis, pas un export global des données.

Le détail est chargé à la demande. Un univers ne doit pas initialiser toutes les scènes, graphiques et abonnements du produit. Tous les univers utilisent le rafraîchissement et l’état canoniques existants.

## Art et accessibilité

Préserver l’ADN rouge/cuivre/verre/brume. Employer profondeur et transitions pour rendre les relations lisibles, non pour masquer un vide d’information.

La 3D est une projection optionnelle des mêmes routes, jamais un mode obligatoire. Vue lisible en deux dimensions, clavier, lecteur d’écran, réduction du mouvement, retour visible et fonctionnement mobile restent requis.

## Invariants

Aucun nouveau runtime, daemon, ordonnanceur, bus, moteur de décision, registre Person ou copie de la vérité. Une seule identité France et une seule La Bête.

Aucune imputation d’un taux national à un territoire sans preuve territorialisée. Aucun univers ne reçoit de chiffres synthétiques pour paraître rempli. Afficher NON DOCUMENTÉ, DONNÉE RETENUE ou ACCÈS PRIVÉ lorsque c’est le cas.

Aucune recommandation, approbation, opposition ou notation politique ; les questions de politique publique sont instruites comme des dossiers factuels, avec période, population, sources, incertitudes et arbitrages humains.

Une contribution n’est ni un fait, ni une permission, ni une adoption. Le passage entre preuve, publication, mission et exécution conserve les Human Gates existants.

## Ordre de réalisation prévu

1. Inventorier seulement les surfaces et identifiants nécessaires au premier parcours, sans audit global.
2. Extraire les composants de lecture actuellement présents, sans changer leurs calculs.
3. Installer navigation par objet, historique, liens directs et vue atlas sur le socle actuel.
4. Prouver un parcours complet : France → finances publiques → dette → source AFT → manque → démarche → retour à la preuve.
5. Rendre le dialogue contextuel sur ce même parcours ; conserver explicitement ses limites actuelles tant qu’un véritable modèle conversationnel n’est pas relié.
6. Ouvrir progressivement d’autres univers uniquement après preuves, tests de non-régression, validation de confidentialité et possibilité de retour arrière.

## Critères de passage

Ouvrir directement un objet, recharger la route, revenir en arrière, traverser une relation et partager le même état doivent fonctionner sur mobile et ordinateur. Les chiffres et leurs identifiants restent inchangés. Une donnée absente n’est jamais remplacée par un décor, un score ou une estimation silencieuse.

Cette note fixe la prochaine étape. Elle ne prouve pas que l’interface multiunivers est déjà déployée.
