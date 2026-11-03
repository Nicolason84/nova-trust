# Jaime — candidate d’accès privé et d’installation iPhone

Date : 30 octobre 2026.
Branche : `candidate/jaime-private-delivery-20261030`.
Base vérifiée : `5db28617637f5d17b3a936403c709260457a94b4`.

## Problème et correction

L’entrée GitHub Pages ouvrait exclusivement un carnet local. Son gateway est volontairement déconnecté ; elle ne peut pas fournir la conversation du propriétaire privé existant. Un ancien profil local sautait directement cette entrée.

Cette candidate reprend la passerelle déjà préparée, vérifie ses préimages sur le dernier code public, puis :

- ajoute un lien explicite vers `https://jaime.nova-era.fr/ojo/jaime/` à l’entrée et dans le carnet ;
- conserve l’accès au carnet, ses données, ses pièces jointes et ses fonctions existantes ;
- supprime uniquement le saut automatique qui masquait le choix sur l’entrée publique officielle ;
- corrige les trois instructions iPhone : ouvrir l’espace privé dans Safari, s’identifier, puis ajouter cette page à l’écran d’accueil ;
- fait copier l’URL privée par le guide ;
- distingue l’ancienne PWA du carnet de l’assistant privé ;
- compacte le bandeau après un défaut observé sur 320 × 568 ;
- renouvelle le nom du cache public, sans changer son périmètre ni forcer son activation.

Les liens ne contiennent aucun prénom, note, message ou paramètre. Ils n’ajoutent aucun corps de requête ni referrer. Les cookies de connexion habituels d’une session autorisée restent sous le contrôle du navigateur. Aucun fetch cross-origin, transfert de carnet, notification ou nouvelle permission n’est ajouté.

## Vérification de la candidate

- 65 tests unitaires existants et ciblés : PASS.
- 9 parcours Chromium : PASS. Quatre formats (320 × 568, 375 × 667, 390 × 844 et 430 × 932), profils nouveaux et existants, puis ancienne PWA publique.
- Contrôles : destination fixe, absence de transfert des données locales, notes et stockage tiers conservés, brouillon repris après rechargement, commandes visibles et non recouvertes, guide d’installation privé.
- Tous les appels des parcours Chromium sont interceptés. La destination privée est une page synthétique. Aucun login ni modèle réel n’est appelé par ces essais.
- Les tests de cache existants restent verts ; sa mise à jour sur un appareil réel n’a pas été testée.
- Revue indépendante du diff : favorable après correction du guide d’aide et du bandeau mobile.

Preuves dans `private-entry-evidence/`. Les captures contiennent uniquement des données de test.

## État du propriétaire existant, distinct de ces tests

Une relecture le 30 octobre confirme l’admission native existante et la disponibilité du modèle local. Le reçu historique d’un premier échange réel dans l’espace propriétaire est intègre. Cette relecture ne constitue pas un nouvel échange dans le navigateur, un essai de continuité ou un usage personnel par Jaime.

Le nouveau test authentifié est bloqué par le contrôle automatique d’autorisation d’origine du navigateur. Aucun autre navigateur, token, outil HTTP ou session privée n’est utilisé pour contourner ce refus.

Les sources et les assets privés déjà admis restent inchangés. Les capacités de recherche en direct, transcription, restitution audio conversationnelle, mémoire chiffrée et suppression de l’historique serveur ne sont pas revendiquées par cette candidate.

## Admission et publication

État : candidate testée, non publiée, livraison personnelle non validée.

GitHub Pages est configuré sur `main:/docs`. Le push de cette branche et la PR en brouillon ne remplacent pas la version publique. Avant fusion :

1. autoriser puis réaliser la recette navigateur avec le profil propriétaire existant ;
2. vérifier une question, une réponse et une relance cohérente, puis la reprise ;
3. valider la candidate ;
4. après fusion, vérifier les fichiers HTTP publiés et la mise à jour du cache ;
5. effectuer la recette sur l’iPhone de Jaime avant d’annoncer la livraison.

La session de Jaime et son consentement restent personnels. Un essai propriétaire ne les remplace pas.

## Retour arrière

Les préimages sont dans le commit de base. Le patch complet de la candidate fait l’objet d’un contrôle inverse `git apply --reverse --check` avant commit. Aucun retour arrière de production n’est exécuté, puisque cette candidate ne remplace pas encore la production.

Après une éventuelle fusion, un `git revert` du commit d’intégration permettra de restaurer ces fichiers publics en conservant les travaux ultérieurs. Le propriétaire natif ne change pas dans cette candidate.

Dépense supplémentaire engagée : 0 €. Ratio 95 % SUPRA / 5 % GPT non démontré ; ne pas le présenter comme atteint.
