# Pilote citoyen — exécution de tests uniquement

Ce module ne doit pas recevoir de données personnelles. Il refuse les comptes autres que deux identités fictives, les fichiers téléversés, les destinataires externes, les signatures et les paiements. La variable et le répertoire de test ne sont pas des moyens de promouvoir ce code en production.

## Reproduire dans un environnement isolé

Depuis la racine du dépôt, avec Python 3.12 et un Chrome déjà installé :

```sh
TEST_ENV=$(mktemp -d /tmp/ojo-citizen-proof.XXXXXX)
python3.12 -m venv "$TEST_ENV/venv"
"$TEST_ENV/venv/bin/python" -m pip install -r app/citizen-pilot-requirements.txt
PYTHONPATH=. "$TEST_ENV/venv/bin/python" scripts/test_citizen_pilot.py
OJO_PILOT_PYTHON="$TEST_ENV/venv/bin/python" \
OJO_PRIVATE_PROOF_DIR="$TEST_ENV/proof" \
node scripts/test_citizen_pilot_browser.cjs
```

Sur un système où Chrome n’est pas à l’emplacement macOS usuel, fournir `CHROME_BIN` vers le binaire existant. Aucun navigateur n’est installé par le script.

Le test navigateur crée son serveur local et son certificat éphémère, utilise un authentificateur virtuel et arrête les processus qu’il a lancés à la fin. Il ne modifie pas les autorités de confiance du système et ne publie pas l’espace privé. Aucune intervention sur un compte réel ou un appareil mobile n’est nécessaire.

## Sorties à ne pas publier

Le répertoire temporaire contient des invitations, une clé enveloppante, les données de test, le certificat TLS, des cookies et le profil d’un navigateur fictif. Même synthétiques, ces secrets et états ne doivent pas être versés au dépôt ou aux artefacts publics. Seul `private-browser-receipt.json`, relu et dépourvu de secrets, peut être retenu comme compte rendu. Les captures ne doivent montrer que le jeu fictif.

Lancer à nouveau le test crée un nouvel environnement. La récupération de compte et la rotation de clés de production ne sont pas implémentées. Les deux sessions artificiellement précréées par les tests unitaires ne constituent pas une preuve WebAuthn : le test navigateur séparé réalise les cérémonies signées.

## Matrice de portée

| Sujet | Contrôle disponible | Limite restant ouverte |
|---|---|---|
| Identité | Signature WebAuthn, origine, challenge, vérification utilisateur exigée | Identité civile et habilitation administrative non vérifiées |
| Dossiers | Autorisation par propriétaire, chiffrement des corps, intégrité, version | Métadonnées non intégralement chiffrées ; stockage de production à raccorder |
| Mandats | Portée serveur, empreinte, durée, révocation | Aucun acte réel ni représentant habilité |
| Dépôt | Réutilisation de dispatch_once et reçu local explicite | Pas de garantie sur une transaction distribuée chez un tiers |
| Disponibilité | Tests locaux et sauvegarde/restauration synthétiques | Pas de SLA, test de charge, reprise de production ou audit externe |
| Compte perdu | Toutes les sessions/clés de test peuvent être révoquées | Récupération refusée, pas résolue |
| Confidentialité | Aucun modèle ni tiers appelé par le pilote | Une future chaîne de traitement devra être approuvée et auditée séparément |
| Sociétariat | Candidature chiffrée, vérification et admission séparées, reçu public pseudonyme sans PII | Identité civile réelle, statuts adoptés et admission juridique non activés |
| Bulletin | Jeton privé à usage unique, bulletin sans identité ni pseudonyme, tally agrégé par collège | Anonymat cryptographique contre l'autorité émettrice non prouvé ; séparation/credential anonyme requise avant production |

Ne pas exposer ce serveur de test via un tunnel, une adresse publique ou un reverse proxy. Ne pas installer son certificat comme autorité de confiance globale. Un écran fonctionnel, les tests et le chiffrement ne constituent pas une certification de sécurité.
