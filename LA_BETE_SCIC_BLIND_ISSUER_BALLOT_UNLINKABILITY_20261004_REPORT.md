# La Bête — Blind Issuer × urne séparée V1

Verdict pré-publication : **PROVEN SYNTHETIC / CRYPTOGRAPHIC TRANSCRIPT UNLINKABILITY / PROCESS SEPARATION / NOT PRODUCTION**.

## Architecture

MEMBERSHIP_AUTHORITY → BLIND_ISSUER → BALLOT_BOX

- l'autorité de sociétariat connaît le membre et son collège mais n'émet plus de token de vote direct ;
- elle délivre seulement un entitlement aléatoire, signé, spécifique à une élection, sans identité ni pseudonyme public ;
- le Blind Issuer reçoit l'élection, le collège, l'entitlement et un message aveuglé ; il ne reçoit ni identité, ni member_public_id, ni serial final ;
- l'urne reçoit l'élection, le collège, le token déblindé et le choix ; elle ne reçoit ni entitlement, ni identité, ni pseudonyme public ;
- les trois autorités utilisent des processus et stockages distincts dans la preuve.

## Preuve de blindness

Deux membres synthétiques distincts du même collège CITIZENS_USERS reçoivent chacun un credential aveugle.

La preuve calcule la compatibilité de chaque transcript d'émission avec chacun des deux tokens finaux. Résultat attendu et obtenu : [[true, true], [true, true]].

La relation de signature elle-même ne permet donc pas de déterminer quelle émission correspond à quel bulletin dans cette preuve synthétique multi-membre.

## Révocation

Après délivrance d'un credential anonyme, une révocation sélective rétroactive recréerait un canal de liaison. La V1 utilise donc des credentials courts et spécifiques à une élection : une révocation bloque les émissions futures mais ne révoque pas individuellement un credential déjà aveuglé.

## Limites cryptographiques explicites

Le schéma de preuve est CHAUM_STYLE_RAW_RSA_RESEARCH_PROOF.

Il s'inspire de la séparation émission/rédemption et des signatures aveugles, mais **ne revendique pas la conformité RFC 9474**. La métadonnée réseau/temps, les empreintes TLS, les petits ensembles d'anonymat et les risques de corrélation opérationnelle restent non prouvés. Une production réelle exige une implémentation auditée conforme à un protocole standard, une séparation opérationnelle indépendante, du batching/relay ou protection réseau adaptée et un audit cryptographique externe.

## Preuves

- évolution : G182 / NON_REGRESSION_PASS;
- coffre privé : 49 tests PASS;
- navigateur privé WebAuthn : 26 PASS;
- blind signature : 14 tests PASS;
- séparation de processus : 1 PASS;
- modèle démocratie : 38 tests PASS;
- explorer : 62 PASS;
- navigateur public : 49 PASS, 0 exception;
- aucune donnée réelle de sociétaire ni bulletin réel.
