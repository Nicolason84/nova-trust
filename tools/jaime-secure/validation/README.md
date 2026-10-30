# Validation locale réelle de la façade Matrix — 30 octobre 2026

## Résultat

`local-facade-e2ee-20261030.json` conserve le résultat positif du test réel de `matrix-client.mjs` sur SHA-256 :

`4933beff7e454f1f8bc4e3b608fb8e3e5051a0ab5ea26eff380462ed5f23caf2`

Le fichier source avait la même empreinte avant et après l'exécution. Le résultat ne valide pas automatiquement une modification ultérieure.

Composants exécutés : Matrix JS SDK 45.0.0, Rust SDK 0.19.1, Vodozemac 0.11.0, Synapse 1.164.1, Node 24.22.1. IndexedDB est émulé par `fake-indexeddb` 6.2.6, en mémoire pour le test. Les Web Locks sont ceux de Node, sans double de test. Le protocole, les clés, signatures, comptes, sauvegardes et messages sont réels, mais exclusivement synthétiques et locaux.

## Contrôles réussis

- Connexion avec vérification de l'utilisateur, de l'appareil et des clés publiques publiées.
- Refus d'une deuxième session ouvrant simultanément le même magasin.
- Préparation de la récupération, refus d'une confirmation incorrecte, configuration réelle du stockage secret 4S, du cross-signing et d'une sauvegarde chiffrée reconnue comme fiable.
- Refus de réinitialiser automatiquement une identité existante.
- Salon privé chiffré dès création, invitation et confirmation d'entrée.
- Avant vérification du correspondant : `sendText` refusé sans requête HTTP d'envoi du message.
- Véritable protocole SAS : valeurs des deux clients comparées avant les confirmations. Aucune confiance simulée et aucun appel à `setDeviceVerified`.
- Message envoyé par la façade : le serveur retourne `m.room.encrypted` et `m.megolm.v1.aes-sha2` ; le destinataire déchiffre le texte exact et reconnaît l'émetteur vérifié.
- Lecture de l'historique déjà synchronisé, sans prétendre à un historique complet.
- Verrouillage puis réouverture de la session avec les clés et la confiance conservées dans le magasin IndexedDB de test.
- Nouveau deuxième appareil du destinataire : envoi bloqué tant que cet appareil n'est pas vérifié.
- Mauvaise clé de récupération refusée ; bonne clé restaure l'identité existante, sans modifier sa clé publique maître, et restaure la sauvegarde.
- Le nouvel appareil déchiffre le message antérieur après récupération.
- Déconnexion avec révocation et retraite de l'appareil ; réouverture du même appareil refusée.
- Une requête de message chiffré, zéro requête de message en clair, zéro requête externe dans la façade instrumentée.
- Inspection de la base SQLite du serveur : événement persisté chiffré et texte synthétique absent des fichiers SQLite/WAL examinés.
- Écoute réseau effectivement contrôlée : `127.0.0.1:18765` seulement. Fédération et statistiques désactivées.

## Défauts réels trouvés puis corrigés

Les premiers essais ont révélé trois retards de synchronisation que les doubles de tests ne reproduisaient pas : publication initiale des clés d'appareil, confirmation de l'entrée dans le salon, puis réception locale des signatures de l'appareil après récupération. La façade attend désormais les conditions réelles avec une borne et échoue si elles ne sont pas confirmées. Elle ne rend pas les appareils fiables artificiellement.

Le débit de connexion du serveur temporaire a été augmenté pour les essais répétés. Cette configuration appartient uniquement à la fixture loopback et ne constitue pas une configuration de production.

## Reprise des essais

Les copies de scripts gardent leurs chemins absolus correspondant à cet environnement de travail :

- environnement Python : `/tmp/jaime-e2ee-synapse-venv` ;
- configuration et secrets synthétiques : `/tmp/jaime-e2ee-test` ;
- dépendance IndexedDB de test : `/tmp/jaime-e2ee-browser-deps` ;
- projet testé : `/workspace/scratch/79058eaabd0a/jaime_app_work/secure-messaging`.

`prepare_server.py` configure le serveur éphémère après génération de `homeserver.yaml` avec Synapse ; `register_facade_accounts.py` crée deux nouveaux comptes locaux et écrit leurs secrets dans un fichier mode 0600. `facade-test.mjs` exécute la suite complète et déconnecte ses clients à la fin. `e2ee-test.mjs` conserve le premier test du SDK seul.

Les fichiers `credentials.json`, `facade-credentials.json`, les clés de récupération, les clés privées, la configuration secrète du serveur et la base de données ne sont pas copiés dans ce dossier.

### Serveur de test arrêté

Après la validation du 30 octobre 2026, le serveur temporaire Synapse a été effectivement arrêté par `SIGTERM` (PID 39040). Le contrôle d'arrêt a confirmé l'absence de processus correspondant et l'absence de socket en écoute sur le port 18765, en IPv4 comme en IPv6. Aucun serveur de test n'a été laissé actif. Les constats d'écoute loopback du rapport JSON décrivent l'état pendant les essais, avant cet arrêt.

## Limites

Ce résultat vérifie la façade avec le vrai protocole et le vrai serveur. Il ne constitue ni un audit de sécurité complet, ni un test de Safari/iPhone, de stockage persistant réel après fermeture du navigateur, de Web Locks entre onglets Safari, d'interface utilisateur, de déploiement HTTPS, de notification, de fichier joint ou de VPN. Le serveur loopback et les comptes synthétiques ne sont pas un service de production destiné à Jaime.

Documentation primaire suivie :

- https://element-hq.github.io/synapse/latest/setup/installation.html
- https://element-hq.github.io/synapse/develop/usage/configuration/config_documentation.html
- Sources et contrats installés de `matrix-js-sdk` 45.0.0.
