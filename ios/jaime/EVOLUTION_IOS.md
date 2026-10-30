# Préparation de Jaime iOS aux améliorations communes ojO

Document d'intégration, 30 octobre 2026. Version native préparée : **1.0, build 2**. Les preuves de compilation, les empreintes et les capacités livrées appartiennent au champ existant `DELIVERY.json.native_ios` et au reçu du lot. Ce document ne crée aucun registre, manifeste d'exécution ou protocole supplémentaire.

## Composant réutilisé

Le conteneur iOS ouvre les mêmes pages HTTPS que l'app Jaime. `index.html` charge déjà le composant partagé `nova.ojo-evolution` et son adaptateur `evolution-ui.js`. La fonction **Mis mejoras** et l'export sont donc disponibles sans copier le moteur en Swift ni créer une deuxième mémoire.

État de la source observée pendant cette préparation :

| Élément | Valeur observée |
|---|---|
| Composant / version | `nova.ojo-evolution` / `1.0.0` |
| SHA-256 de `ojo-evolution.js` | `b6668fa30d284c8b5be510a6eec707d5a755949db2a617ec1cbed04f1f25eefa` |
| Méthode déclarée | `LA_BETE_PROSPECTIVE_RECOVERY` |
| Empreinte de la source de méthode déclarée | `02fb155a27f11855db33ece9706691622b552d3d34e8d223336facfb5d0d524b` |
| Propriétaire déclaré par `status()` | `SUPRA_LOCAL_EXECUTION_AGENT_V1` |
| Connexion constatée dans ce client | `CANDIDATE_NOT_CONNECTED` |
| Transport de la provenance | `NO_NETWORK_LOCAL_REVIEW_FILE_ONLY` |

L'empreinte du fichier public local correspond à `EVOLUTION_PROVENANCE.json`. Cette provenance **déclare** comme emplacement canonique `Nicolason84/nova-era`, `library/javascript/ojo-evolution/ojo-evolution.js`. La présence de ce chemin dans la branche principale n'a pas été confirmée pendant ce lot : la lecture ciblée par le responsable du lot a renvoyé 404 alors que le dépôt était accessible. On conserve donc le fichier existant et son empreinte ; on ne fabrique ni admission canonique, ni reçu de connexion, ni endpoint.

Ces valeurs décrivent l'observation du lot, pas un état garanti à chaque ouverture future. L'écran natif « Acerca de esta app » affiche la version et le build réels du bundle et dirige vers **Mis mejoras** pour l'état courant. Il ne fige pas un statut de connexion dans le binaire.

## Capacités natives préparées

| Besoin | Comportement iOS |
|---|---|
| Afficher les propositions communes | Réutilisation de la page web existante ; aucune proposition calculée en Swift. |
| Choisir les permissions | Les quatre choix restent dans le composant web ; aucun consentement natif supplémentaire ou précoché. |
| Préparer une contribution | Le contrat JSON existant passe par le `blob:` du site, `WKDownload`, puis la feuille de partage iOS. |
| Conserver les données locales | Stockage WebKit propre à l'app ; aucun accès natif au contenu du coffre, aux messages, aux préférences ou aux observations. |
| Réseau | Le moniteur natif alimente seulement le bandeau de connexion. Il n'injecte aucune observation dans le composant partagé. |
| Recharger / revenir à l'accueil | Action manuelle, précédée d'une confirmation invitant à enregistrer les brouillons et terminer les captures. Aucune recharge périodique ni activation forcée de service worker. |
| Versions | `CFBundleShortVersionString` et `CFBundleVersion` proviennent des réglages Xcode, affichés dans la page d'informations. |
| Exécution / installation | Aucun exécuteur, ordonnanceur, pont JavaScript natif, téléchargement de moteur ou modification du binaire. |

La confirmation de navigation ne prouve pas que les brouillons sont enregistrés. Le conteneur ne lit pas le contenu des champs pour le déterminer. Les liens internes et gestes ordinaires gardent le comportement du site et de WebKit ; cette garde concerne les actions natives **Accueil** et **Recharger**, y compris la nouvelle tentative après erreur.

## Consentements : portée inchangée

Les quatre choix initiaux restent `false` : `memory`, `observations`, `suggestions`, `technicalSharing`. Les choix sont propres au stockage de Jaime dans l'app native. Ils ne sont pas importés depuis Safari, une installation PWA ou un autre ojO.

`technicalSharing` autorise **la préparation d'un fichier pour relecture**. Ce n'est pas une autorisation d'upload automatique, de partage à SUPRA en arrière-plan ou d'envoi à un destinataire. La feuille iOS laisse Jaime choisir une action. Aucun destinataire n'est présélectionné par le conteneur.

Les booléens de consentement local ne constituent pas une preuve authentifiée de permission auprès du propriétaire natif. Une future connexion propriétaire devra respecter son mécanisme d'identité, ses droits et ses reçus existants. Elle ne peut pas déduire un droit d'accès aux données personnelles de l'activation de « Mis mejoras ».

Les conversations, notes personnelles, pièces jointes, courriels, clés, coffre et identités Matrix restent hors du contrat technique. Le conteneur n'en extrait aucun champ. Les demandes caméra/micro conservent leurs contrôles d'origine et la permission iOS explicite.

## Contrat d'export V1 inchangé

L'adaptateur web produit `OJO_TECHNICAL_METHOD_CANDIDATE_V1`. Le conteneur conserve ses champs exacts :

```json
{
  "schema": "OJO_TECHNICAL_METHOD_CANDIDATE_V1",
  "component": "nova.ojo-evolution",
  "component_version": "1.0.0",
  "method": "LA_BETE_PROSPECTIVE_RECOVERY",
  "method_source_sha256": "02fb155a27f11855db33ece9706691622b552d3d34e8d223336facfb5d0d524b",
  "issue_codes": [],
  "requested_action": "QUALIFY_ONLY",
  "privacy": "TECHNICAL_ENUMS_ONLY",
  "contains_personal_data": false,
  "automatic_promotion": false
}
```

Cet exemple vide documente le format ; ce n'est pas une contribution émise. Selon les observations du client, `issue_codes` peut contenir uniquement les codes techniques admis par le composant V1 : `CHAT_UNAVAILABLE`, `STORAGE_FAILURE`, `OFFLINE`, `INVALID_DATA`.

Ces codes sont des **signaux candidats à requalifier**, pas une attestation de panne actuelle. Dans V1, seuls deux `CHAT_OK` successifs peuvent marquer le problème de conversation comme rétabli. Les épisodes `OFFLINE` et `STORAGE_FAILURE` ne passent pas automatiquement à `RECOVERED`. Le propriétaire doit donc refaire une qualification appropriée et ne pas traiter l'export comme un diagnostic en temps réel.

Accepter une proposition locale produit `APPROVED_NOT_EXECUTED`. Les marqueurs `requiresNativeValidation: true`, `executed: false`, `causalEffectProven: false` gardent leur sens. Ils ne doivent pas être changés par le conteneur pour afficher un succès.

La version de l'app native, les capacités et la preuve de compilation ne sont pas ajoutées à cet export. Elles restent dans le reçu de livraison et `DELIVERY.json.native_ios`.

## Publication et raccord propriétaire

Les contenus et corrections web continuent à suivre le circuit existant de revue, tests et publication du dépôt Jaime. Le conteneur n'effectue pas de mise à jour du code depuis une proposition technique. Il ne crée pas de sondage en arrière-plan, ne force pas la prise de contrôle d'un service worker et ne recharge pas une session pendant une capture.

L'URL HTTPS publiée reste une dépendance de confiance : elle peut servir une version web plus récente lors d'une ouverture ou d'une navigation. Une empreinte inscrite dans ce document ne vérifie pas, à elle seule, le contenu servi ultérieurement. Aucune vérification cryptographique supplémentaire de la publication distante n'est annoncée ici. Tout durcissement futur doit être décidé avec l'acteur déjà propriétaire de la publication, sans fourcher son composant ni contourner sa revue.

La connexion au backend commun, l'admission d'une méthode, ses essais, sa promotion et un éventuel retour arrière restent du ressort du travail Work Desktop et du propriétaire existant. Ce lot fournit une surface compatible et ses preuves ; il n'annonce pas leur activation.

Une modification des capacités natives passe par une nouvelle compilation, signature et voie de distribution Apple. Le conteneur ne télécharge pas de binaire ou script natif pour s'ajouter des fonctions. Pour une distribution future, conserver les critères Apple applicables, notamment [App Review Guidelines §2.5.2 et §4.2](https://developer.apple.com/app-store/review/guidelines/), vérifiés le 30 octobre 2026. Cette préparation ne vaut pas approbation App Store.

## Validation et prochaine qualification

Le projet conserve les **31 contrôles Foundation de navigation et d'export** de `Tests/PolicyChecks.swift`. Les tests du composant partagé et de l'adaptateur Jaime appartiennent à leurs sources existantes ; le responsable du lot consigne leurs résultats et les contrôles de compatibilité ajoutés dans le reçu, sans modifier le contrat ou transformer un signal local en résultat natif.

Les builds 1 puis 2 ont chacun été compilés en Debug et archivés en Release sans signature sur le Mac. Le build 2 a été vérifié dans son propre bundle : version 1.0, build 2, exécutable arm64 de 239648 octets, SHA-256 `f12554eafb6a5f407aad87866230a308785cf433c9fdc5ce6096e4cc8d8d8f50`. Les 31 contrôles Foundation et les 6 contrôles de compatibilité du composant partagé passent. Le reçu `../../tests/jaime/QA_IOS_R7.json` consigne ces résultats. Aucun runtime simulateur ni essai physique sur l'iPhone ne sont fournis par ce document.

Lors de la qualification iPhone, vérifier avec des données fictives : ouverture de Mis mejoras ; quatre choix désactivés dans une installation neuve ; activation volontaire et retrait ; export conforme après autorisation ; annulation de la feuille de partage sans envoi ; conservation des choix après relance ; oubli des seuls réglages d'amélioration ; Annuler puis Confirmer avant recharge et accueil ; absence de demande caméra/micro à l'ouverture des améliorations ; comparaison du build affiché au bundle effectivement signé. Aucun test ne doit déclencher une action auprès du propriétaire tant que sa connexion n'est pas qualifiée.
