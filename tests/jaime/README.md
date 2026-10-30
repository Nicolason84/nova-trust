# Jaime — reprise directe, messagerie et univers

Frontend : `docs/jaime/`. Version R4 du 30 octobre 2026. Sources du coffre, de la caméra et du client Matrix : `tools/jaime-secure/`.

## État livré

L’entrée `start.html` enregistre un prénom local puis ouvre l’app, sans compte ChatGPT. La reprise de l’ancien profil `nova_client_account_local` et des exports `JAIME_APP_LOCAL_EXPORT` reste disponible avec aperçu, conservation des sources et détection des doublons. L’enregistrement utilise réellement MediaRecorder ; le moteur financier FreightCore est inchangé.

La navigation comporte Conversar, Mi día, Mensajes et Mi universo. Mi día conserve tâches, notes et brouillons de courrier localement, sans chiffrement. Les courriers `.eml` sont analysés comme texte non fiable ; aucune boîte mail n’est connectée et les modèles de réponse ne sont pas présentés comme une IA. WhatsApp a été retiré.

`universos.html` ajoute le coffre chiffré de documents, la sélection explicite de fichiers, des règles CAnnoNico réellement adaptées, la recherche, la restitution des originaux et la sauvegarde chiffrée. La caméra utilise uniquement les capacités réellement exposées par le navigateur : luminosité de la vue et torche matérielle lorsqu’elle est disponible. Aucune vision infrarouge ou thermique n’est simulée. Les espaces juridiques, chasse et tauromachie organisent les notes et documents, avec des sources officielles ; aucun prix, événement, délai juridique ou réservation n’est inventé.

`mensajes.html` charge un véritable client Matrix avec chiffrement Rust, identité et appareils vérifiés, SAS et récupération des clés. Les tests réels sur serveur local ont réussi. Le serveur de test a été arrêté. Les comptes et le serveur HTTPS de Jaime restent à préparer, ainsi qu’une origine web dédiée. GitHub Pages sert le client uniquement. Le VPN nécessite un client natif et un endpoint réel ; il n’est pas actif.

## Reproduire les vérifications

Depuis la racine du dépôt :

```sh
node tests/jaime/legacy.test.cjs
node tests/jaime/recorder.test.cjs
node tests/jaime/economics.test.cjs
node tests/jaime/communications.test.cjs
```

Résultats attendus : 6 cas reprise/profil, 25 cas audio (sous-cas inclus), 8 financiers, 12 courrier. Les événements audio sont simulés ; le microphone réel de l’iPhone reste à vérifier.

Depuis `tools/jaime-secure/`, après `npm ci --ignore-scripts` :

```sh
npm test
JAIME_DIST_DIR=../../docs/jaime npm run build
```

Cas directs : 36 contrats de façade Matrix, 15 du coffre de documents, 3 du coffre de session, 4 de caméra. Le test réel Matrix, son empreinte source et ses limites se trouvent dans [validation/README.md](../../tools/jaime-secure/validation/README.md). Il utilise un véritable SDK, protocole et serveur local ; IndexedDB est émulé en mémoire. Ce n’est pas un audit indépendant.

Le navigateur a servi à contrôler le rendu à 390 × 844, la navigation, la préparation d’un dossier juridique fictif et les états visibles. Le chiffrement persistant réel de Safari, le matériel iPhone, les comptes HTTPS de Jaime et le VPN n’ont pas été validés.

## Reprise et activation

Voir [provenance et limites](../../tools/jaime-secure/REUSE_AND_LIMITS.md), [état technique](../../tools/jaime-secure/STATUS.md) et [fiche d’activation](../../tools/jaime-secure/DEPLOYMENT.md).

`gateway.js` reste déconnecté. Aucun service d’IA, transcription, OCR, analyse de PDF/Office, notification ou chargement du dossier personnel n’est activé. Les choix de mémoire personnelle, d’accompagnement et de rappels appartiendront à Jaime. Aucune archive privée, donnée sensible ou valeur secrète n’est publiée avec le code.
