# La Bête — sociétariat vérifié & bulletin secret V1

Verdict pré-publication : **PROVEN / SYNTHETIC PRIVATE PILOT / REAL ENROLLMENT CLOSED**.

## Chaîne privée

Passkey WebAuthn → candidature → preuve d'éligibilité chiffrée → vérificateur privé séparé → autorité d'admission séparée → collège statutaire → credential pseudonyme → droit de vote → jeton à usage unique → bulletin sans identité → tally agrégé.

Le participant ne peut pas s'auto-admettre. L'admission et l'affectation au collège exigent des autorités privées distinctes. Aucune identité, adresse, email, pièce, passkey ou preuve brute d'éligibilité ne figure dans le reçu public.

## Secret du bulletin

Le bulletin persistant ne contient ni identité privée ni member_public_id. Un seul jeton peut être émis par sociétaire et élection dans le pilote ; le rejeu est refusé. Le registre public ne reçoit que des agrégats par collège.

Limite conservée explicitement : **l'anonymat cryptographique vis-à-vis de l'autorité émettrice n'est pas encore prouvé**. Une séparation d'autorité ou un credential anonyme/blind-signature équivalent devra être ajouté avant un scrutin réel.

## Frontière juridique

real_enrollment_open = false. current_legal_societaires = 0.

Ce changement ne crée aucun associé juridique réel : l'acquisition/perte de cette qualité et l'affectation aux collèges devront suivre les statuts adoptés et l'immatriculation vérifiée.

## Preuves

- génération : G180 / NON_REGRESSION_PASS;
- coffre privé : 49 tests PASS;
- navigateur privé : 26 PASS, vrai WebAuthn avec authentificateur virtuel Chrome;
- démocratie / modèle public : 38 tests PASS;
- explorer : 61 PASS;
- navigateur public : 49 PASS, 0 exception;
- aucune donnée citoyenne réelle utilisée;
- aucun état privé publié.
