# Jaime — reprise directe, messagerie et univers

Frontend : `docs/jaime/`. Version R5 du 30 octobre 2026 (El tendido ; voir TAURINO_R5.md). Sources du coffre, de la caméra et du client Matrix : `tools/jaime-secure/`.

## Fonctions existantes

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

## Candidat d’amélioration avec accord personnel

Le lot `R5-evolution-v1` ajoute « Mis mejoras » au carnet, avec observations de fonctionnement, propositions et choix séparés. Les consentements sont désactivés par défaut. Le module partagé exact `nova.ojo-evolution` et sa provenance figurent dans `docs/jaime/EVOLUTION_PROVENANCE.json`. Il ne lit pas les conversations, la foi, les humeurs, le courrier ou le coffre.

La contribution technique est seulement un fichier local de codes fermés préparé après consentement et clic explicite ; elle n’est pas envoyée à SUPRA. Une proposition acceptée reste non exécutée. Le gateway IA reste déconnecté et l’origine publique partagée ne devient pas une isolation forte par ce changement.

Le reçu `EVOLUTION_CANDIDATE.json` décrit les 51 tests existants et le contrôle mobile synthétique. Pour rejouer ce dernier avec le paquet Playwright déjà disponible dans l’environnement : `PLAYWRIGHT_MODULE=/chemin/vers/playwright node tests/jaime/evolution-ui.browser.cjs` (`CHROME_EXECUTABLE` est facultatif). Aucun consentement ni usage réel de Jaime n’est prétendu par ces fixtures.

## TUV5 access-session candidate — 2026-10-30

The existing PR35 private-entry and iPhone candidate is preserved. This extension
uses the canonical `nova.access-session` component from private source commit
0199b894ec8df350c9029feb2bcbb587714047fe, pinned in `docs/jaime/IDENTITY_PROVENANCE.json`.
The public gateway remains disconnected; the private native owner requires a
fresh admission before loading the changed assets and its corrected adapter.

65 public unit cases pass. `identity.browser.cjs` adds9 browser fixture cases;
the original9 private-entry cases pass again. Viewports include320,375,390,430px.
See `identity-evidence/qualification.json` and the two browser-result receipts.
Every browser request is intercepted. Synthetic replies do not prove a real
Cloudflare session or model exchange. No physical iPhone is claimed.

The bounded identity recipe covers401/403, HTML masquerading as success,
offline return, a model outage, preserved local transcript and an uncertain
accepted POST across reload. Interrupted `sending` messages become `uncertain`
without automatic or button-driven replay. Missing responses are not yet recovered
from the owner history. Notes remain local and unencrypted.

Run the browser fixture with the existing Playwright and Chrome installations:
`TUV5_PRIVATE_GATEWAY=/absolute/path/to/candidate/integrations/jaime/frontend/gateway.js node tests/jaime/identity.browser.cjs`.
Use the existing JAIME_PLAYWRIGHT_MODULE and JAIME_BROWSER_EXECUTABLE environment
variables when Playwright or Chrome are not on their default discovery paths.
The fixture never provisions identity, bypasses Access, enables passkeys or deploys.

## Candidate P0 : connexion et récupération d'une réponse (30 octobre 2026)

La PR35 conserve l'interface et ajoute une référence durable à chaque nouvel envoi privé. Si une réponse complète a été enregistrée mais perdue par le navigateur, « Comprobar respuesta » permet une consultation explicite après consentement. Le texte n'est pas renvoyé au modèle ; la preuve du résultat est vérifiée, et une réponse déjà affichée n'est pas dupliquée. Un stockage local indisponible empêche l'envoi dont la référence ne pourrait pas être conservée.

Les messages anciens sans référence ou les réponses non confirmées restent signalés comme incertains. La récupération nécessite le propriétaire privé compatible et sa propre admission. Le carnet local reste non chiffré. Le gateway de GitHub Pages reste déconnecté ; le paquet privé remplace uniquement cet adaptateur après admission.

La recette de cette révision comprend les 65 régressions locales de l'application, 14 scénarios d'identité/reprise et 9 scénarios d'entrée privée. Tous les échanges des scénarios Chrome sont interceptés. Les preuves R2 sont dans recovery-evidence/, recovery-entry-evidence/ et RECOVERY_CANDIDATE.json ; les anciens reçus sont conservés. L'ensemble des deux dépôts totalise 155 cas automatisés, dont les contrôles du propriétaire et du transport partagé.

Une authentification Cloudflare réelle, un échange Ollama reçu dans le navigateur et l'essai sur l'iPhone de Jaime ne sont pas encore validés. Aucun Face ID actif, nouveau chiffrement, déploiement ou livraison finale n'est annoncé.
