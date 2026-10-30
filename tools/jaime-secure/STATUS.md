# Façade Matrix de messagerie — état technique

Date : 30 octobre 2026. SDK examiné dans le paquet installé : **matrix-js-sdk 45.0.0**, moteur Rust/WASM **18.9.0**. Cette façade est distincte de l’ancien module local de brouillons/imports ; celui-ci n’assure aucun chiffrement.

## Reconstruction dans le dépôt

Dans `nova-trust`, les sources se trouvent sous `tools/jaime-secure/` et l’interface sous `docs/jaime/`. Depuis **`tools/jaime-secure`**, avec Node 22 ou plus et le `package-lock.json` versionné :

```sh
npm ci --ignore-scripts
JAIME_DIST_DIR=../../docs/jaime npm run build
```

La compilation produit les bundles et le moteur WASM sous `docs/jaime/secure/`. La publication de ces fichiers fournit le client web ; le homeserver reste un service distinct à préparer selon [DEPLOYMENT.md](DEPLOYMENT.md). Voir aussi [réutilisation et limites](REUSE_AND_LIMITS.md) et le [rapport de validation](validation/README.md).

## Ce qui est implémenté

`matrix-client.mjs` utilise les API du vrai SDK. Elle ne réimplémente ni Olm, ni Megolm, ni SAS, ni le format de récupération. Le SDK est injecté par le point d’entrée du navigateur ; les doubles des tests ne font jamais partie d’un « mode démo ».

Une connexion exige un homeserver HTTPS choisi explicitement, le compte, l’identifiant d’appareil, son jeton, et une protection du magasin cryptographique : `storagePassword` d’au moins 12 caractères ou `storageKey` de 32 octets. Le SDK Rust réalise le chiffrement de son magasin IndexedDB. La façade n’enregistre jamais le jeton, le mot de passe de connexion, ni la phrase du magasin.

Le serveur confirme d’abord le couple compte/appareil via `whoami`. Le magasin possède un nom dérivé du serveur, du compte et de l’appareil. Un verrou Web Locks exclusif, non bloquant, empêche deux onglets de l’ouvrir simultanément ; l’absence de Web Locks est un refus explicite, sans verrou artisanal de secours. L’état `connected` attend la synchronisation réelle et la correspondance des clés publiques locales avec celles du serveur.

Le magasin annexe de cycle de vie conserve seulement des clés **publiques** et un éventuel marqueur de retrait. À la reprise, les clés publiques serveur doivent toujours correspondre au même appareil. Cela évite de réutiliser un ancien magasin comme si un appareil supprimé puis recréé possédait encore ses anciennes clés.

Les requêtes SDK utilisent `Authorization`, sans cookies, sans referrer, sans cache et sans redirection. Le transport fourni à la façade interdit une autre origine que celle du homeserver. Le journal applicatif ne reçoit pas les objets d’erreur bruts du SDK et la façade ne journalise aucun texte de message. Le point d’entrée doit également désactiver les journaux globaux du SDK pour la production.

## Politique d’envoi

L’utilisateur choisit le destinataire et déclenche chaque envoi. La façade refuse les messages si l’une de ces conditions manque :

- session active, synchronisation et moteur Rust disponibles ;
- appareil local confirmé par le serveur ;
- participation effective à une salle privée par invitation ;
- état `m.room.encryption` avec `m.megolm.v1.aes-sha2`, également reconnu par l’API crypto ;
- identité de chaque destinataire actuellement vérifiée par cross-signing, sans changement d’identité en attente ;
- chaque appareil destinataire connu, non bloqué, vérifié et signé par son propriétaire ;
- liste de participants inchangée pendant le contrôle.

Les contrôles de l’interface ne suffisent pas à couvrir une modification entre le contrôle et le chiffrement. La façade configure donc également le moteur au moment d’envoyer :

```js
crypto.globalBlacklistUnverifiedDevices = true;
crypto.setDeviceIsolationMode(new AllDevicesIsolationMode(true));
room.setBlacklistUnverifiedDevices(true);
```

Dans le SDK 45, cette combinaison transmet **`CollectStrategy.deviceBasedStrategy(true, true)`** au moteur Rust. Malgré le nom de la classe, ce réglage ne demande pas d’envoyer les clés à tous les appareils. `OnlySignedDevicesIsolationMode`, lui, ignore le blacklistage et peut accepter une identité jamais vérifiée lorsque le propriétaire a signé ses appareils ; il ne correspond donc pas à la politique demandée ici. Aucun bouton de la façade ne peut contourner les contrôles, épingler une identité sans vérification ou appeler `setDeviceVerified`.

`inspectRoomSafety` est un état observé à un instant donné. Son résultat favorable ne remplace jamais le nouveau contrôle de `sendText`. Le retour d’un identifiant d’événement prouve l’acceptation de la requête par le homeserver ; il ne prouve ni la lecture, ni la livraison à chaque destinataire.

## Contrat d’intégration

Le point d’entrée doit importer les objets réels suivants :

```js
import * as matrix from 'matrix-js-sdk';
import { AllDevicesIsolationMode, EventShieldColour } from 'matrix-js-sdk/lib/crypto-api/index.js';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key.js';
import { createSecureMessenger } from './matrix-client.mjs';

const messenger = createSecureMessenger({
  sdk: { ...matrix, AllDevicesIsolationMode, EventShieldColour, CryptoEvent, decodeRecoveryKey },
  onState, onRooms, onMessage, onError, onVerification,
});
```

`runtime`, `lifecycleFactory` et `allowLoopbackForTests` servent aux tests isolés. Ils ne sont pas des options proposées aux utilisateurs. Le point d’entrée de production n’active pas l’exception HTTP pour loopback et n’utilise aucun double de SDK, de verrou ou de magasin.

| Méthode | Entrée et résultat |
|---|---|
| `connect` | `{homeserverUrl,userId,deviceId,accessToken,storagePassword}` ou `storageKey` ; renvoie l’état après confirmation réelle. |
| `getState` | Copie de l’état, sans secret. `cryptoReady` décrit le moteur initialisé ; `ownDeviceVerified`, `ownIdentityVerified` et `deviceKeysConfirmed` sont des contrôles distincts. |
| `listEncryptedRooms` | Salles dont l’état annonce Megolm, y compris invitations reconnues ; chaque entrée contient `roomId,name,encrypted,algorithm,privateInviteOnly,membership,participants,sendPolicy`. |
| `createEncryptedRoom` | `{name,invite:[matrixUserId]}` ; crée une salle privée avec chiffrement, historique réservé aux membres et invités anonymes interdits. Retour `readyToSend:false` : la synchronisation et les vérifications restent nécessaires. |
| `acceptInvite` | `roomId` ; exige une invitation directe à ce compte et un état de salle privé/chiffré. Ne rejoint jamais automatiquement. |
| `getRoomDevices` | `roomId` ; liste actuelle `{userId,deviceId,known,verified,blocked,identityVerified,...}`. Une liste inconnue donne `deviceId:null`. Ne change aucune confiance. |
| `getDeviceStatus` | `(userId,deviceId)` ; état effectif de l’appareil. |
| `getIdentityStatus` | `userId` ; état effectif de l’identité. |
| `inspectRoomSafety` | `roomId` ; `{allowed,code,message,checkedAt}`. Lecture seule, sans envoi. |
| `sendText` | `(roomId,text)` ; message texte de 1 à 16 000 caractères. Retour `{eventId,acceptedByHomeserver:true,recipientDeliveryConfirmed:false}`. |
| `getRoomMessages` | `(roomId,{limit:50})`, maximum 100 événements ; `{messages,completeHistory:false,limited,source:'synced_live_timeline'}`. Pas de pagination d’archives dans cette version. |
| `prepareIdentity` | Prépare une nouvelle identité seulement si aucun cross-signing, aucune récupération 4S et aucun backup ne sont présents. Renvoie une seule fois `{setupId,recoveryKey,requiresHumanConfirmation:true}`. |
| `initializeIdentity` | `{setupId,recoveryKeyConfirmation,authUploadDeviceSigningKeys}` ; impose la ressaisie de la clé et l’authentification interactive humaine, puis configure 4S, cross-signing et backup. |
| `cancelIdentityPreparation` | Efface la clé préparée tant que l’écriture serveur n’a pas commencé. |
| `restoreIdentity` | Clé de récupération ; validation 4S, import des secrets, comparaison aux clés publiques actuelles et signature du nouvel appareil. Retour séparant identité et historique restaurés. |
| `requestOwnVerification` | Retourne le vrai `VerificationRequest` SDK pour un autre appareil du même compte. |
| `requestDeviceVerification` | `(userId,deviceId)` ; vrai protocole SAS vers l’appareil choisi. |
| `requestPeerVerification` | `(userId,roomId)` ; réservé à une identité déjà vérifiée. Pour le premier contact, choisir son appareil via `getRoomDevices`, puis utiliser `requestDeviceVerification`. |
| `getPendingVerifications` | Requêtes SDK encore en attente ; aucune n’est acceptée automatiquement. |
| `refreshOwnTrust` | Relit les contrôles de confiance propres au compte et à l’appareil. |
| `lock` / `disconnect` | Arrêt local, effacement des références applicatives au jeton et libération du verrou ; conserve l’appareil serveur et le magasin chiffré pour une reprise autorisée. |
| `logout` | Demande la révocation serveur, ferme localement, marque le magasin retiré si la révocation est confirmée. Retour explicite `serverRevoked`, `deviceRetired`, `retirementRecorded`, `newDeviceRequired`. |

`onError` reçoit uniquement `{code,message}`. Les exceptions exposées sont des `SecureMessagingError` avec code exploitable par l’interface. Les messages de l’interface sont en espagnol.

`onMessage` reçoit uniquement un événement dont le chiffrement réseau et le déchiffrement effectif ont été constatés. Il contient notamment `eventId,roomId,sender,timestamp,kind,msgtype,body,decrypted,senderVerified,shieldColour,shieldReason,isEdit,truncated`. Le texte original authentifié est utilisé ; le remplacement agrégé fourni par le serveur n’est pas utilisé pour attribuer une vérification au texte d’un autre événement. `decrypted:true` et `senderVerified:true` ont des significations distinctes.

L’interface doit rendre les corps, noms et identifiants avec `textContent`, jamais avec `innerHTML`. Elle doit afficher les avertissements de confiance, les éditions comme événements distincts et les types non pris en charge. Les pièces jointes donnent `kind:'unsupported'` ; la façade ne télécharge ni n’exécute leurs contenus. Un texte reçu dépassant 65 536 caractères est explicitement marqué `truncated:true`.

## Premier compte et récupération

La préparation de la clé de récupération utilise `createRecoveryKeyFromPassphrase()` du SDK sans passphrase, donc la clé aléatoire SDK ; elle n’effectue aucune écriture serveur. L’interface affiche cette clé dans une étape dédiée, demande de la conserver et impose sa ressaisie. Elle ne doit ni la mettre dans un journal, ni l’envoyer à une IA, ni la conserver en clair.

Après confirmation, `initializeIdentity` crée le stockage de secrets chiffrés 4S, appelle le SDK pour le cross-signing avec une authentification interactive fournie par l’utilisateur, puis ne crée un backup que si aucun backup n’existe toujours. Toute identité ou sauvegarde préexistante interrompt la procédure. Un échec partiel n’est jamais suivi d’un reset automatique ; la clé déjà sauvegardée doit être conservée. Une seule initialisation d’identité à la fois doit être menée pour un même compte, y compris depuis d’autres clients.

Pour restaurer, la façade décode la clé avec le SDK, appelle `secretStorage.checkKey`, déchiffre les trois secrets de cross-signing via 4S, les importe avec `importSecretsBundle`, puis compare les trois clés publiques résultantes aux clés actuelles téléchargées. Elle ne signe l’appareil qu’après cette correspondance. Une discordance bloque l’envoi. Elle n’appelle pas `bootstrapCrossSigning` dans ce parcours : le code du SDK peut créer de nouvelles clés lorsque des secrets manquent, même si `setupNewCrossSigning:false`.

La restauration du backup vérifie séparément sa confiance et sa correspondance à la clé. L’absence ou l’échec d’un backup n’est pas présenté comme une récupération complète de l’historique. Une sauvegarde n’implique pas que tous les anciens messages ou toutes les anciennes sessions y figurent.

## Vérification humaine

Le SDK est configuré pour SAS (`m.sas.v1`) dans cette version. `onVerification` transmet la requête réelle. L’interface doit afficher le compte et l’appareil concerné, demander l’acceptation, démarrer la méthode SAS et montrer les données fournies par `getShowSasCallbacks()`. La confirmation n’est appelée qu’après une comparaison humaine via un moyen approprié. Le SDK reste l’autorité sur le résultat final ; cliquer sur « identique » ne suffit pas à produire une pastille de confiance.

La façade n’offre pas de QR simulé, ne confirme jamais un SAS automatiquement, ne possède pas de bouton « faire confiance quand même » et n’abaisse pas ses contrôles pour acheminer la première demande. Celle-ci peut passer par la vérification SDK vers un appareil (`to-device`), sans un message de conversation non chiffré.

## Session et cycle de vie

La façade ne crée aucun coffre de jetons. Un éventuel coffre externe doit être conçu, implémenté et testé séparément. `sessionPersisted:false` décrit toujours le comportement de la façade, même si son appelant possède un tel coffre. Le jeton déchiffré lui est transmis en mémoire seulement.

`lock()` permet de reprendre **le même appareil existant** avec son même jeton autorisé et sa même phrase de magasin. `logout()` révoque le jeton/appareil côté serveur : après succès, une nouvelle connexion par mot de passe doit créer un **nouvel identifiant d’appareil**, puis restaurer ou vérifier l’identité. Les anciens magasins restent chiffrés et ne sont pas effacés automatiquement.

Si la révocation échoue ou si sa réponse n’arrive pas, le résultat ne prétend pas que le serveur a fermé la session. L’appelant doit conserver la possibilité d’effectuer la révocation. Le magasin n’est pas marqué retiré sur un échec réseau non confirmé. Un ancien jeton déjà révoqué sera refusé par `whoami`.

La fermeture détache les écouteurs de la façade, arrête le SDK et efface ses références applicatives aux secrets. Même pendant une connexion en cours, `lock` arrête immédiatement le transport et vide le jeton du client. Le verrou du magasin est conservé jusqu’à la fin du nettoyage, pour qu’une initialisation Rust déjà engagée ne concurrence jamais celle d’un autre onglet. L’appelant doit aussi vider ses champs de saisie, textes affichés, tableaux et références aux requêtes de vérification. JavaScript ne permet pas de garantir l’effacement physique de toutes les copies d’une chaîne en mémoire ; aucun tel effacement garanti n’est annoncé.

## Vérification et limites de livraison

**Tests de contrat locaux : 36 réussis**, par `node tests/matrix-client.contract.test.mjs`. Ils vérifient les refus, le transport, le cycle de vie, les flux de préparation/récupération, les invitations et le traitement du texte. Ils comprennent les régressions des trois courses constatées avec le vrai SDK et l’arrêt immédiat pendant une authentification en cours. Ces tests de contrat utilisent des doubles et ne démontrent pas eux-mêmes du chiffrement réel.

**Test d’intégration réel de cette façade : réussi**, avec SDK 45.0.0, moteur Rust/WASM 18.9.0, Synapse 1.164.1 sur loopback, deux comptes synthétiques et un troisième appareil neuf pour la récupération. Le SDK, le serveur, les échanges SAS et les opérations cryptographiques sont réels. Node 24.22.1 fournit Web Locks natif ; `fake-indexeddb 6.2.6` remplace seulement le stockage du navigateur dans ce banc d’essai. Il ne s’agit donc pas d’une validation Safari/iPhone.

Le rapport conservé dans `validation/local-facade-e2ee-20261030.json` atteste ces résultats ; `validation/README.md` décrit les limites du banc d’essai :

- ouverture de deux clients et refus d’un second client sur le même magasin ;
- création réelle de 4S, cross-signing et backup fiable ; refus d’une mauvaise confirmation et d’une réinitialisation d’identité existante ;
- refus d’envoi avant SAS, sans requête HTTP de message ;
- comparaison des véritables données SAS entre les deux clients ;
- un message envoyé en `m.room.encrypted`, conservé sous forme chiffrée au serveur, puis déchiffré et authentifié par l’autre client ;
- consultation du message via la méthode d’historique de la façade ;
- verrouillage puis reprise du même appareil avec conservation de ses clés et de sa confiance ;
- blocage du nouvel appareil avant récupération ; refus d’une mauvaise clé ; récupération de la même identité, du backup et de l’ancien message, sans changement de la clé maître publique ;
- révocation et retrait de l’appareil, puis refus de sa réutilisation ;
- zéro envoi de message en clair et zéro requête extérieure au serveur de test.

Le SHA-256 du module testé, identique avant et après le test, est :

```text
4933beff7e454f1f8bc4e3b608fb8e3e5051a0ab5ea26eff380462ed5f23caf2
```

Trois attentes bornées ont été ajoutées après observation réelle, sans relâcher les contrôles : le SDK peut annoncer sa première synchronisation avant l’upload de ses clés ; l’ACK d’entrée dans une salle précède parfois le nouvel état de membre ; l’upload d’une signature d’appareil peut précéder son état cross-signé dans la synchronisation. La façade attend la preuve réelle correspondante. Une clé contradictoire échoue immédiatement ; un délai écoulé n’est jamais interprété comme une réussite.

Ces tests locaux ne créent ni serveur de production ni comptes de vraies personnes. Le navigateur mobile, l’interface de comparaison humaine et le coffre extérieur doivent être vérifiés séparément avant un usage personnel.

Restent distincts de ce module : hébergement et administration du homeserver, authentification de l’interface, coffre externe, implémentation visuelle du SAS, récupération après perte complète d’un appareil, tests Safari/iPhone, notifications, messages en arrière-plan, fichiers/audio/vidéos, appels et maintenance opérationnelle. Un site web ne configure pas à lui seul un VPN sur iPhone. **Cette façade ne fournit aucun VPN.**

## Sources primaires vérifiées

- [README officiel du SDK](https://github.com/matrix-org/matrix-js-sdk) : Rust/WASM, IndexedDB, initialisation, secret storage et vérification.
- [API MatrixClient](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html) : `initRustCrypto`, stockage chiffré, `whoami`, `logout`, synchronisation.
- [API CryptoApi](https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html) : contrôles d’identité/appareil, isolation, import des secrets et backup.
- [DeviceVerificationStatus](https://matrix-org.github.io/matrix-js-sdk/classes/crypto-api.DeviceVerificationStatus.html) et [UserVerificationStatus](https://matrix-org.github.io/matrix-js-sdk/classes/crypto-api.UserVerificationStatus.html) : signification des différents contrôles.
- [VerificationRequest](https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.VerificationRequest.html) : véritables étapes du protocole de vérification.
- Sources exactes du paquet installé 45.0.0 : `src/client.ts`, `src/crypto-api/index.ts`, `src/crypto-api/verification.ts`, `src/rust-crypto/RoomEncryptor.ts`, `src/rust-crypto/rust-crypto.ts`, `src/rust-crypto/CrossSigningIdentity.ts`, `src/models/event.ts`, `src/secret-storage.ts`.
- Définitions du paquet Rust/WASM 18.9.0 : `pkg/matrix_sdk_crypto_wasm.d.ts`, pour le comportement d’`importSecretsBundle`.
