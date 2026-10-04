# La Bête — Production Privacy Gate V1

Verdict pré-publication : **CRYPTOGRAPHIC PREREQUISITE PROVEN / PRODUCTION BLOCKED**.

## Ce qui est désormais prouvé

La primitive cryptographique cible n'est plus le raw-RSA de recherche du pilote. Un gate indépendant utilise **Cloudflare CIRCL v1.6.5**, piné avec `go.sum`, et vérifie le profil Blind RSA publiquement vérifiable de Privacy Pass :

- RFC 9578 token type `0x0002` ;
- RSA 2048 bits ;
- `RSABSSA-SHA384-PSS-Deterministic` ;
- token input `0x0002 || nonce || SHA256(challenge) || token_key_id` ;
- requête/réponse Blind RSA de 256 octets ;
- finalisation CIRCL ;
- vérification indépendante du résultat par `rsa.VerifyPSS` SHA-384 / sel 48 ;
- suite upstream CIRCL `blindsign/blindrsa`, incluant les vecteurs RFC 9474 : PASS.

Workflow validé sur le code réconcilié : run **37169316271**, job **111338842172**, commit **d8758f3a51a6f9c11923e6c16894b3f86d7f5060**.

## Ce qui reste volontairement fermé

La présence d'une primitive RFC-grade ne suffit pas à ouvrir un scrutin réel.

Le **Production Privacy Gate** reste `BLOCKED` avec `production_activation=false` tant que les preuves suivantes manquent :

1. le backend CIRCL standard n'est pas encore lié au runtime réel du bulletin ;
2. aucun relais OHTTP RFC 9458 indépendant n'est configuré ;
3. le seuil minimal d'anonymat n'est pas encore approuvé par une revue privacy ;
4. la fenêtre de batching de production n'est pas encore approuvée ;
5. la garde/rotation de la clé privée de l'Issuer n'est pas prouvée ;
6. aucun audit cryptographique externe n'est terminé ;
7. aucune revue externe du threat model privacy n'est terminée.

## Batching fail-closed

Un mécanisme de fenêtre fixe sur enveloppes opaques est implémenté et testé :

- aucune libération avant la fermeture de la fenêtre ;
- aucune libération si l'ensemble d'anonymat minimal n'est pas atteint ;
- aucun timestamp individuel dans le reçu public ;
- aucun digest individuel d'enveloppe dans le reçu public ;
- les petits ensembles restent bloqués.

Les valeurs de production `minimum_set_size` et `window_seconds` restent **UNSET_REQUIRES_PRIVACY_REVIEW**. Elles ne sont pas inventées par le runtime.

## Réseau cible

La cible est **RFC 9458 Oblivious HTTP ou équivalent avec relais indépendant** :

- client → relay : HTTPS ;
- relay → gateway : HTTPS ;
- relay et gateway ne peuvent pas avoir le même opérateur dans ce modèle ;
- le relay ne doit pas transférer les headers identifiants ;
- contexte HPKE frais par requête ;
- politique de padding à approuver.

## Non-régression

- coffre privé : 49 tests PASS ;
- navigateur privé WebAuthn : 26 PASS ;
- blind-signature research proof : 14 PASS ;
- séparation de processus : 1 PASS ;
- Production Privacy Gate : 10 PASS ;
- modèle public / démocratie : 40 PASS ;
- explorer : 63 PASS ;
- navigateur public candidate G185 : 49 PASS, 0 exception ;
- desktop + mobile : PASS ;
- git diff --check : PASS.

Aucune donnée réelle de sociétaire n'a été utilisée. Aucun vrai bulletin n'a été exprimé. Aucun état privé n'est publié.

## État candidat

- génération : **G185**
- évolution : **NON_REGRESSION_PASS**
- production voting : **FERMÉ**
- primitive RFC : **PASS**
- runtime binding : **NOT_PROVEN**
- réseau OHTTP : **NOT_CONFIGURED**
- audit externe : **NOT_COMPLETED**
