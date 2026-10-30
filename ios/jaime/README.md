# ojO Jaime — projet iPhone

Projet iOS **SwiftUI + WKWebView**, cible iPhone iOS 16.4 ou ultérieur, sans paquet tiers natif. Ce dossier contient le projet Xcode, pas une application déjà installée ni une publication App Store. La validation de compilation et ses résultats doivent figurer dans le reçu de livraison du lot.

## Ouvrir et compiler

Ouvrir `OjoJaime.xcodeproj` dans Xcode. Le scheme partagé est `OjoJaime`.

Compilation de validation sans signature, sans simulateur lancé et sans téléchargement de runtime :

```sh
xcodebuild -project OjoJaime.xcodeproj -scheme OjoJaime \
  -configuration Debug -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/ojo-jaime-ios-build CODE_SIGNING_ALLOWED=NO build
```

Tests de la politique de navigation, exécutables sur un Mac avec les outils Swift, sans simulateur :

```sh
xcrun swiftc OjoJaime/URLPolicy.swift Tests/PolicyChecks.swift -o /tmp/ojo-jaime-ios-policy
/tmp/ojo-jaime-ios-policy
```

Une compilation réussie sans signature ne permet pas l'installation sur l'iPhone. Pour un appareil de développement connecté, choisir dans Xcode l'équipe Apple autorisée, vérifier l'identifiant `com.novaera.ojojaime`, sélectionner l'iPhone et lancer l'app. Le compte, les profils et le mode développeur relèvent du propriétaire de l'appareil. Le projet n'effectue aucune création de compte, achat ou signature à distance.

Un Personal Team gratuit implique une nouvelle installation après l'expiration du profil, actuellement 7 jours. TestFlight / App Store nécessitent la voie de distribution Apple et leurs validations ; aucune acceptation App Store n'est annoncée. Les critères 4.2 d'Apple demandent une valeur d'usage qui dépasse un simple site réemballé.

## Réutilisation et fonctionnement

Le conteneur charge **uniquement** le sous-chemin `https://nicolason84.github.io/nova-trust/jaime/` dans son WebKit. Il réutilise les pages, fonctionnalités, styles et sources déjà publiés, notamment `start.html`, le chat, les fichiers et le tendido taurino. Il ne crée aucun second backend IA, moteur de synchronisation, messagerie ou mémoire.

L'origine HTTPS distante conserve les API Web sécurisées utilisées par l'app : Web Crypto, IndexedDB, MediaRecorder, caméra et service worker. Un bundle `file://` aurait modifié l'origine et risqué de casser ces fonctions ; il n'est pas utilisé. La première ouverture et le contenu non mis en cache nécessitent une connexion. Le service worker existant reste propriétaire du cache des pages publiques. Les MP3 ne sont pas préchargés. L'état réel des connexions IA et Matrix reste celui affiché par l'app existante.

Fonctions natives préparées :

- Icône iPhone opaque, écran de lancement et cadre SwiftUI en espagnol.
- Retour, accueil, recharge, état réseau et écran d'erreur avec nouvelle tentative.
- Liens externes HTTPS ouverts par iOS dans le navigateur ou l'app externe choisi par l'utilisateur, seulement après activation d'un lien dans une page de Jaime. Les brouillons mail issus d'un bouton web demandent une confirmation native avant ouverture du logiciel de courrier.
- Caméra et micro soumis à la demande de consentement WebKit et iOS ; origine et frame principales contrôlées.
- Sélecteur de fichiers iOS via les champs `input[type=file]` existants, sans accès global aux photos ou au stockage.
- Exports `blob:` du site pris en charge par `WKDownload`, puis feuille de partage iOS. Les fichiers temporaires sont supprimés à sa fermeture et les exports abandonnés sont nettoyés au prochain lancement.
- Voile de confidentialité dans une fenêtre de la scène, au-dessus des feuilles natives, lorsque l'app perd l'activité ; arrêt de la capture et des médias au passage effectif en arrière-plan. Ce voile ne constitue ni un verrou biométrique ni un chiffrement supplémentaire. La protection des aperçus iOS reste à confirmer sur appareil.

## Données et limites de sécurité

**Le stockage de ce conteneur est distinct de celui de Safari et de l'app web sur l'écran d'accueil.** Une installation native ne récupère donc pas automatiquement les notes, fichiers, identités Matrix ou clés précédemment enregistrés ailleurs. Conserver les originaux et utiliser les fonctions d'export / import existantes. Une suppression de l'app peut supprimer son stockage local. Ne pas alterner les deux installations en croyant à une synchronisation active.

Aucun pont JavaScript natif, aucune exception ATS, aucune règle de certificat permissive, aucun secret ou profil privé n'est ajouté. `WKAppBoundDomains` et `limitsNavigationsToAppBoundDomains` limitent le conteneur à l'hôte publié ; `URLPolicy` restreint en plus le sous-chemin et rejette les URL ambiguës. Les autorisations ne s'étendent pas aux pages externes. Le conteneur n'accorde pas automatiquement l'accès caméra/micro.

Le site public reste une dépendance de confiance : ses changements arrivent dans l'app sans nouvelle compilation. Cela facilite la maintenance de Jaime, mais impose de garder les revues de publication existantes. Les brouillons ordinaires du site ne sont pas chiffrés. Seul le coffre existant applique sa protection par phrase. Le conteneur ne transforme pas ce stockage en garantie de confidentialité absolue.

Le manifeste `PrivacyInfo.xcprivacy` décrit la couche native actuelle : aucun SDK analytique, aucun suivi publicitaire, aucune collecte ajoutée par ce conteneur et aucune API native à motif requis utilisée directement. Il ne remplace pas l'examen complet des traitements du contenu web et de son hébergeur avant distribution. **Revoir les déclarations de confidentialité et l'exportation de chiffrement avant App Store / TestFlight**, particulièrement si IA, Matrix, notifications ou nouveaux services sont activés. Le projet n'invente pas de déclaration d'exemption de chiffrement.

## Validation restant à effectuer sur iPhone

La compilation ne valide pas ces parcours matériels. Vérifier au minimum sur l'iPhone de Jaime : premier lancement / icône ; voix et caméra après acceptation et refus ; sélecteur Fichiers ; sauvegarde et import d'une copie chiffrée ; export via la feuille iOS ; lecture des deux MP3 ; lien externe et retour ; brouillon mail et annulation ; verrouillage / arrière-plan avec un document, une feuille de partage et une boîte de dialogue ouverts ; reprise sans réseau après une première visite. N'utiliser aucune donnée réelle sensible pendant la validation initiale.

## Sources primaires consultées le 30 octobre 2026

- [Apple — Compte développeur / Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account)
- [Apple — Adhésion et paiement](https://developer.apple.com/help/account/membership/program-enrollment)
- [Apple — App Review Guidelines, §4.2](https://developer.apple.com/app-store/review/guidelines/)
- [WebKit — App-Bound Domains](https://webkit.org/blog/10882/app-bound-domains/)
- [Apple — Autorisations de capture WebKit](https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:requestmediacapturepermissionfor:initiatedbyframe:type:decisionhandler:))
- [Apple — Destination d'un WKDownload, y compris blob](https://developer.apple.com/documentation/webkit/wkdownloaddelegate/download(_:decidedestinationusing:suggestedfilename:completionhandler:))
- [Apple — Manifeste de confidentialité](https://developer.apple.com/documentation/BundleResources/privacy-manifest-files)
