# La Bête — Production Privacy Gate V2

Verdict pré-publication : **INTERNAL PRIVACY RUNTIME CHAIN PROVEN / EXTERNAL HUMAN GATES BLOCK PRODUCTION**.

## Chaîne machine désormais prouvée

`Verified membership → CIRCL Blind RSA → RFC9458 OHTTP → RFC9292 BHTTP → HTTPS relay → HTTPS gateway → persistent privacy batch → ballot gateway`

### Blind RSA

- Cloudflare CIRCL `v1.6.5` ;
- RFC 9474 / RFC 9578 ;
- `RSABSSA-SHA384-PSS-Deterministic` ;
- client et issuer dans des processus séparés ;
- finalisation CIRCL + vérification RSA-PSS standard ;
- runtime binding : **PROVEN_CI_SIDECAR**.

### OHTTP + Binary HTTP

- backend `martinthomson/ohttp 0.8.0` ;
- RFC 9458 ;
- Binary HTTP **RFC 9292** validé côté gateway et client ;
- client / relay / gateway : processus séparés ;
- relay ne voit pas le plaintext du bulletin et ne possède pas la clé gateway ;
- deux hops TLS locaux avec hostname verification : **PROUVÉ** ;
- headers identifiants retirés avant la gateway : **PROUVÉ** ;
- même bulletin encapsulé deux fois → ciphertexts distincts : **PROUVÉ** ;
- endpoints TLS publics : **NON CONFIGURÉS** ;
- opérateur relay indépendant : **NON VÉRIFIÉ**.

### Batching persistant

- SQLite persistant ;
- enveloppes OHTTP opaques uniquement ;
- reprise après redémarrage : prouvée ;
- petit ensemble : `ROLL_FORWARD`, jamais libéré ;
- sortie atomique après fenêtre + seuil ;
- timestamps individuels et enveloppes absents du reçu public ;
- valeurs de production `minimum_set_size` et `window_seconds` : **UNSET_REQUIRES_PRIVACY_REVIEW**.

### Key custody

Le contrat de garde est implémenté fail-closed. Le provider courant reste **FILE_TEST_ONLY**, donc production **BLOCKED**. La production exige un provider HSM/KMS/PKCS#11 non exportable, hardware-backed, attesté, dual-control, limité à `BLIND_RSA_SIGN_ONLY`, avec rotation/destruction testées et journal d’usage immuable.

## Audit readiness

Pack : `audits/scic_privacy/SCIC_PRIVACY_AUDIT_PACK_V1.json`.

- source : `5e7edd7a83367fba398e78674beb952c1389e305` ;
- source dirty : `false` ;
- fichiers critiques hashés : 30 ;
- état privé inclus : `false` ;
- audit verdict : **NOT_PERFORMED**.

Ce pack est un **input d’audit indépendant**, jamais un auto-audit ni une certification.

## Human Gates restants

- OHTTP_INDEPENDENT_RELAY_NOT_DEPLOYED
- OHTTP_PUBLIC_TLS_ENDPOINTS_NOT_CONFIGURED
- OHTTP_PRODUCTION_OPERATOR_ATTESTATION_NOT_PROVEN
- OHTTP_PADDING_POLICY_NOT_APPROVED
- ANONYMITY_SET_POLICY_NOT_APPROVED
- BATCH_WINDOW_NOT_APPROVED
- HSM_KEY_CUSTODY_NOT_PROVEN
- KEY_ROTATION_AND_DESTRUCTION_DRILLS_NOT_PROVEN
- EXTERNAL_CRYPTO_REVIEW_NOT_COMPLETED
- PRIVACY_THREAT_MODEL_EXTERNAL_REVIEW_NOT_COMPLETED

## Non-régression candidate

- génération : **G187** / `NON_REGRESSION_PASS` ;
- privacy gate : 10 tests PASS ;
- modèle métier : 40 PASS ;
- explorer statique : 63 PASS ;
- navigateur réel : 49 PASS / 0 exception ;
- batch persistant : 8 PASS ;
- key custody : 5 PASS ;
- audit pack : 4 PASS ;
- Cargo.lock OHTTP/BHTTP : `9cdfbdccbc6b380f32d2fac1916bc0ecb15f20b7779279addbd80294f32177d3`.

## Frontière finale

`production_activation = false`. Aucun vrai sociétaire, bulletin réel, HSM production, opérateur relay indépendant ou audit externe n’est inventé par ce runtime.
