# Jaime — iPhone, R6

30 octobre 2026.

## Résultat matériel

La version web possède une page espagnole `instalar.html`, une icône Apple opaque180px, un manifeste à identité inchangée, un affichage autonome et des marges adaptées aux zones de sécurité. Les pages et le guide font partie du cache public existant. Le service worker ne met en cache ni messages, ni jetons, ni fichiers personnels, ni API. Les MP3 restent hors préchargement.

Le projet `ios/jaime/OjoJaime.xcodeproj` réutilise l'application HTTPS existante dans SwiftUI/WebKit. Compilation Debug et archivage Release réussis sur Xcode27.0, SDK iOS27.0, cible minimale iOS16.4. L'archive contient un exécutable arm64 de237816octets, SHA256 `110b2d419328cf741b5bce2a4618796e62215b571b6957b45f3bf9ac1de5a320`. Elle n'est pas signée et n'est donc pas installable directement. Aucune publication TestFlight/AppStore.

## Vérification

- 31cas exécutés de politique de navigation et noms d'export, via Swift/Foundation sur Mac.
- 5cas exécutés de cache public: ressources existantes, exclusions privées, repli hors connexion, erreurs explicites, refus des réponses redirigées ou hors origine.
- Guide et parcours accueil → univers → tendido vérifiés dans un navigateur à390×844. Largeur375px hors barre de défilement, sans débordement horizontal. Copier le lien utilise correctement la sélection manuelle lorsque ClipboardAPI est indisponible.
- Les128cas de la livraisonR5 sont conservés comme validation antérieure; ils ne sont pas présentés comme réexécutés ici.
- Cœur financier, fonctions métier, contenus taurins, bundles Matrix/coffre et audios inchangés.

## Limites précises

Aucune exécution sur iPhone physique ni simulateur: aucun runtime de simulateur n'est installé. Aucun téléchargement de runtime ni achat n'a été engagé. Il reste à signer/provisionner la version native puis vérifier voix/caméra, exports, permissions, audio, arrière-plan et reprise sur le téléphone.

Le conteneur natif possède un stockage distinct de Safari et de l'app web. Aucune migration automatique des données ou clés n'est supposée. L'installation web ne raccorde pas l'assistant, n'active pas les notifications et ne crée pas de serveur de messagerie. La voie installable immédiatement est l'ajout à l'écran d'accueil depuis Safari.

Voir `../../ios/jaime/README.md` pour le projet natif et `QA_IOS_R6.json` pour les empreintes et preuves.
