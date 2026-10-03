# La Bête — premier pilote privé et espace mobile

Mission #3 : espace privé citoyen, sécurité des données et parcours sans ressaisie inutile. Le pilote décrit ici utilise exclusivement deux identités fictives. L’espace mobile public est une projection séparée des canaux de distribution vérifiés.

État : MOBILE_HUB_PUBLICLY_TESTED_PRIVATE_PILOT_LOCAL_ONLY. Le reçu `receipts/LA_BETE_PRIVATE_PILOT_MOBILE_PUBLIC_PROOF.json` établit le déploiement public et 44 contrôles navigateur. Le pilote privé reste exclusivement local, synthétique et non ouvert sur Internet.

## Ce qui est appliqué

Le point d’entrée `app/server.py` conserve son comportement normal. Un mode explicite de test, activé uniquement avec un argument local et une variable d’environnement, utilise `app/citizen_pilot.py`. Il écoute sur 127.0.0.1, dans une origine HTTPS localhost propre au test. Aucun service de fond ni route privée n’est ajouté à GitHub Pages.

Le pilote ne permet ni une inscription publique, ni l’envoi de documents personnels. Les deux comptes sont créés à partir d’invitations de test temporaires et les pièces sont des données fictives prédéfinies. L’interface de test est dans `app/private_pilot_ui`, pas dans `docs`.

Le navigateur crée une clé WebAuthn résidente. Le serveur vérifie la signature avec py_webauthn, le domaine attendu, l’origine, le challenge à usage unique et la vérification utilisateur. Le test de bout en bout emploie un authentificateur CTAP2.1 virtuel de Chrome : ce n’est pas une preuve de fonctionnement biométrique sur un iPhone physique.

Le test TLS utilise un certificat auto-signé éphémère, limité à localhost et explicitement épinglé dans le navigateur de test. Il n’installe aucune autorité racine système, ne désactive pas la validation TLS générale et n’est pas une preuve d’hébergement HTTPS public de production.

Les sessions sont validées côté serveur et révocables. Le cookie est Secure, HttpOnly et SameSite=Strict. Les challenges sont liés à leur contexte et consommés après utilisation ; la durée absolue de session est de quinze minutes, son inactivité maximale de cinq minutes, et un mandat de test dure au plus dix minutes.

Les corps des documents fictifs sont chiffrés avec AES-GCM. Une clé par compte est enveloppée avec une clé de test distincte du fichier de données. Les données associées lient compte, document et version. Les métadonnées pseudonymes de test ne sont pas toutes chiffrées. Le serveur peut déchiffrer les contenus autorisés ; ce n’est pas un coffre zero-knowledge. La clé locale enveloppante n’est pas un KMS de production.

Un même document fictif permet de préparer deux demandes sans nouvelle inscription ni ressaisie. Un challenge WebAuthn séparé approuve le mandat limité. Le destinataire, les modèles et l’empreinte du document sont déterminés côté serveur. Une modification du document invalide son autorisation antérieure.

Le dépôt de test réutilise `scripts.la_bete_acquisition.dispatch_once`. Les adaptateurs de stockage, d’autorité et de réception sont explicitement des fixtures locales, non une deuxième implémentation de SUPRA MissionStore en production. Ils ne contactent aucun organisme. Le reçu indique `LOCAL_SYNTHETIC_RECEIVER`, `external_delivery=false` et `real_external_action=false`.

## Contrôles démontrés dans ce périmètre

37 tests unitaires couvrent : mode et origine autorisés, stockage hors dépôt, absence de contenu de document en clair dans le fichier de données, falsification du chiffré, séparation des clés, contrôle de propriétaire, expiration de session, révocation, périmètre et durée du mandat, modification de pièce, réutilisation, doublons, livraison incertaine, destinataire et contenu exacts, challenge unique, journaux cloisonnés et restauration d’une sauvegarde dont les corps de documents sont chiffrés.

25 contrôles navigateur passent avec un vrai serveur TLS local et des signatures WebAuthn vérifiées. Ils incluent deux inscriptions fictives séparées, reconnexion par clé, mandat avec vérification utilisateur, lecture interdite entre comptes, réutilisation, reçu local, anti-rejeu, signature altérée, authentification sans vérification utilisateur refusée, révocation, changement de pièce, déconnexion côté serveur, largeur mobile et absence de requête vers un tiers.

Les sessions créées directement dans les tests unitaires ne sont pas présentées comme une preuve d’authentification ; ce rôle appartient au test navigateur distinct. Les tests ne prouvent ni une identité civile, ni une signature juridique, ni une résilience distribuée avec un organisme externe.

## Frontière publique

`#/prive` affiche l’état et les limites du pilote, sans formulaire de connexion factice ni dépôt de justificatif. Aucun appel automatique vers localhost, aucun jeton et aucune clé de test n’y sont publiés. Les données de test, invitations, certificats, bases SQLite et profils navigateur restent hors du dépôt et des reçus publics.

Le cadre protège la séparation entre la parole publique et les futurs dossiers administratifs : aucune identité administrative ne devient requise pour lire l’Atlas ; aucun rapprochement automatique de contributions politiques et de pièces privées n’est ajouté.

## Espace mobile et récupération de l’existant

`#/mobile` distingue la version web actuelle, l’aperçu natif Android déjà publié et la distribution iPhone non ouverte. Il n’ajoute pas de nouvelle app native et ne modifie pas ojO Companion ou SUPRA natif.

L’APK public `La-Bete-France-0.1.1.apk` a été récupéré dans la release `france-beast-native-0.1.1-20261002`, puis contrôlé indépendamment du texte du manifeste : empreinte SHA-256, signature APK v2/v3, certificat et métadonnées du paquet. Le paquet est `com.novaera.france.beast`, versionCode 2026100202, minSdk 26, taille 930431 octets. Aucune nouvelle clé de signature ni nouveau binaire n’est produit.

Cet aperçu natif date du 2 octobre 2026 et précède le nouvel Atlas. Il ne dispose pas du pilote privé citoyen et n’est pas publié sur Google Play. Le bouton de téléchargement utilise la release existante, après lecture d’un avertissement explicite. Une empreinte et une signature valides ne valent pas audit ou certification.

Les sources iOS de la même lignée sont conservées à leur commit existant. Aucun IPA distribuable, lien TestFlight ou App Store vérifié n’a été trouvé dans ce canal. Les travaux iPhone privés antérieurs restent distincts. La page propose la version web, avec les instructions officielles pour l’ajouter à l’écran d’accueil, sans prétendre l’installer comme app native.

La présence 3D prédominante, les univers, les données financières canoniques, les fiches territoriales et la boucle publique restent inchangés. Aucun cache hors ligne de dossier privé ni service worker supplémentaire n’est créé.

## Conditions encore ouvertes — pas de données réelles

Hébergement privé de production et TLS publiquement reconnu ; revue de menace et audit indépendant ; récupération de compte accessible et résistante au détournement ; séparation/rotation/récupération des clés de production ; gouvernance, finalités, bases légales, durées et AIPD si requise ; intégrations d’identité administrative et habilitations propres à chaque organisme ; stockage et exécution réutilisant les services privés validés ; tests physiques et d’accessibilité ; comportement des prestataires et modèles ; gestion des incidents et effacement conforme aux obligations applicables.

Les reçus de test ne ferment pas ces conditions. Aucun compte administratif n’est connecté, aucun document réel n’est collecté, aucun mail ou dossier n’est déposé auprès d’une administration. Le pilote refuse la récupération non implémentée plutôt que de fournir une porte dérobée.

## Références de conception consultées

- https://duo-labs.github.io/py_webauthn/registration.html
- https://duo-labs.github.io/py_webauthn/authentication.html
- https://developer.chrome.com/docs/devtools/webauthn
- https://cryptography.io/en/latest/hazmat/primitives/aead/
- https://www.cnil.fr/fr/securite-gerer-les-habilitations
- https://www.cnil.fr/fr/les-pratiques-de-chiffrement-dans-linformatique-en-nuage-cloud-public
- https://docs.partenaires.franceconnect.gouv.fr/fs/devenir-fs/pilotage-eligibilite/
- https://support.apple.com/fr-fr/guide/iphone/iph42ab2f3a7/ios
- https://support.google.com/chrome/answer/9658361?hl=fr&co=GENIE.Platform%3DAndroid

Les références justifient des mécanismes et limites ; elles n’accordent aucune certification au projet.
