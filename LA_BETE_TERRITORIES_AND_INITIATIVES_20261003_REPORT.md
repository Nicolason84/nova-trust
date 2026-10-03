# La Bête — territoires détaillés et initiatives préparées

État : DEPLOYED_AND_PUBLICLY_BROWSER_TESTED. Le reçu `receipts/LA_BETE_TERRITORIES_INITIATIVES_PUBLIC_PROOF.json` établit la publication, les hashes des 101 fichiers départementaux publics et les 34 contrôles du navigateur sur la page publique. Les échanges avec une mairie et les projets éditoriaux ne sont pas des envois ou diffusions réalisés.

## Territoires réellement collectés

Le collecteur France existant a été étendu, pas remplacé. Il récupère les mêmes sources officielles API Découpage administratif et Insee, conserve les détails autrefois agrégés et publie un index ainsi que 101 fichiers départementaux à nom dérivé de leur empreinte.

Périmètre observé : 18 régions, 101 départements, 1 255 entrées au catalogue des intercommunalités et 34 875 communes filtrées par les codes TYPECOM=COM du COG 2026. Le catalogue des 1 255 entrées ne remplace pas silencieusement le décompte statistique de 1 252 EPCI à fiscalité propre utilisé par l’ancien résumé : leurs périmètres restent distingués.

Sources consultées :
- https://geo.api.gouv.fr/decoupage-administratif
- https://geo.api.gouv.fr/decoupage-administratif/communes
- https://www.insee.fr/fr/information/8740222

Chaque source effectivement récupérée porte date de collecte, empreinte et Last-Modified lorsque fourni. Les fiches communales comprennent les identifiants, département, région, intercommunalité lorsque renseignée, population API, codes postaux, SIREN, surface brute API et centre géographique. Quatre communes n’ont pas de code EPCI dans le périmètre récupéré ; la valeur reste absente.

La date de collecte n’est pas présentée comme le millésime de population. L’unité de surface n’est pas convertie sans dictionnaire explicite. Aucune donnée financière nationale n’est attribuée aux communes. Les liens intercommunaux qui traversent des limites départementales restent des relations, pas une hiérarchie fictive.

L’index permet de chercher toutes les communes. Une fiche détaillée charge uniquement son fichier départemental et vérifie son SHA-256 avant utilisation. Les listes affichent 40 éléments à la fois, la recherche renvoie au plus 200 résultats. La base de 34 875 fiches n’est pas rendue d’un coup dans le navigateur.

Le collecteur suit la cadence existante de son workflow, avec conservation du dernier bon état si une récupération échoue. Les fichiers détaillés sont immuables : une version modifiée reçoit une autre adresse. Le stockage utilise le manifeste canonique `france-topology.json`, pas un second registre territorial.

## Autres univers enrichis depuis le flux existant

Huit champs financiers sont ouverts comme objets documentés ; quatre horizons de refinancement sont accessibles avec leur couverture ; 120 observations historiques et cinq formes de stress sont navigables. Les valeurs ne sont pas recalculées par un nouveau moteur.

Le document de situation mensuelle déjà réconcilié est exposé dans les preuves. Six dimensions de santé opérationnelle sont visibles dans l’univers État. Elles concernent le système, pas la compétence d’un élu, la santé d’une personne ou une notation du pays.

Les limites UNKNOWN, couverture partielle, dernier bon état et hypothèse budgétaire sont conservées. Les comptes d’objets ne sont pas des comptes de missions exécutées.

## Initiatives : trois règles explicites de préparation

La fonction d’acquisition existante prépare trois objets stables dans la même boucle : une invitation à un échange municipal, un projet de podcast et un projet de vidéo. Leur identité est dédupliquée ; aucun outil d’envoi ou de publication n’est appelé.

Le pilote municipal concerne Nogent-sur-Oise. Le contact institutionnel est documenté par l’Annuaire de l’administration :
https://lannuaire.service-public.gouv.fr/hauts-de-france/oise/d4afbbbd-a0db-474f-bfc3-273448b566ad

Adresse relevée le 3 octobre 2026 : contact@nogentsuroise.fr. Elle doit être revérifiée avant envoi. Aucun nom de maire, accord de participation ou soutien politique n’est supposé. Le courrier propose de choisir un sujet utile avec le service compétent et demande les publications officielles à consulter. Il prévoit un accord distinct pour tout entretien enregistré et toute diffusion.

Dans l’univers Démarches, le dossier expose motif, destinataire, source, brouillon, statut et approbation nécessaire. Le statut est `DRAFT_READY`, l’action extérieure `NOT_EXECUTED`. L’identité d’expéditeur et le mandat restent à valider dans l’espace privé.

Dans Questions et idées, les deux objets éditoriaux contiennent un texte pédagogique original, des sources et, pour la vidéo, un découpage en six plans. Ils sont inspectables et exportables. Ils n’affirment pas qu’un fichier audio ou vidéo est produit, ni qu’une plateforme a reçu une publication.

## Ce que ce lot ne fait pas

Aucun mail envoyé, aucun envoi collectif, aucune relance, aucune mairie contactée automatiquement. Aucun partenariat présumé. Aucun compte social ou service de publication ajouté. Aucun podcast ou vidéo diffusé sur une plateforme. Aucun contrat signé. Aucun frais engagé.

Ce lot implémente une préparation gouvernée selon trois règles, pas une autonomie générale de communication. Les autorisations existantes restent des conditions d’exécution. Le chat demeure structuré par règles, sans modèle généraliste supplémentaire.

## Préservation et vérification

La Bête reste prédominante sur l’Atlas, avec un seul canvas. Retour, dialogue contextuel, brouillon, versions, liens directs et mode de secours restent vérifiés. Les personnes et dossiers privés de SUPRA ne sont pas publiés.

Tests ajoutés : 16 tests du compilateur territorial, 27 tests d’enrichissement, quatre tests d’initiatives. Les 49 tests de navigation, les autres tests existants et le navigateur réel sont conservés. La preuve navigateur locale couvre 34 contrôles dont commune → intercommunalité, recherche nationale, hash départemental, contact institutionnel, podcast/script et storyboard.

Les captures mobiles sont des émulations 390 × 844, pas un test sur iPhone physique. Les données d’encours et de taux du fichier canonique n’ont pas été modifiées par ce lot.
