# La Bête — dialogue public et préparation des démarches

Statut de ce reçu : IMPLEMENTED_AND_LOCALLY_TESTED. La publication et les réponses GitHub réelles nécessitent leurs reçus distincts ; les tests ne sont pas des actions externes.

## Ce qui est implémenté

Le modèle d’évolution existant prépare un dossier à partir des accès officiels AFT indisponibles. Les quatre ressources du cas initial sont regroupées sous un identifiant stable : `LA_BETE_AFT_PUBLIC_DATA_ACCESS_V1`. Le dossier contient motif, sources, dates de vérification, brouillon de demande, empreinte du texte, étapes et blocages. Il n’invente ni interlocuteur personnel ni adresse électronique.

Le formulaire officiel de contact AFT a été consulté le 3 octobre 2026 : https://www.aft.gouv.fr/fr/contact . Il comporte des champs d’identité, une acceptation relative à l’usage des informations et un CAPTCHA. Le passage de cette validation reste humain. Cette observation ne constitue ni un mandat ni une soumission.

La page existante reçoit deux entrées : `#dialogue-public` et `#demarches`. L’habillage actuel, la 3D, les courbes, preuves, exports et l’unique actualisation sont conservés. La logique et l’affichage ajoutés sont dans des fichiers séparés pour préparer la transition multiunivers.

## Dialogue disponible

Une personne sans compte peut poser une question ou structurer une idée localement dans l’onglet. Les réponses indiquent les éléments retenus pour examen, les limites, une reformulation testable lorsque le thème est couvert et l’étape suivante. Les questions sur le flux utilisent uniquement le contexte chargé et ses références.

Limite essentielle : `LOCAL_STRUCTURED_NO_LLM`. Il s’agit de règles explicites et de rapprochements par thèmes, pas d’un modèle conversationnel généraliste, d’une recherche web autonome ni d’un apprentissage démontré. Une question non couverte reçoit un manque explicite, jamais une réponse inventée.

Une proposition politique est instruite comme question factuelle, sans oui/non politique, soutien, opposition, score, classement ou pronostic. Une contribution ne devient pas un fait, une permission ou une adoption. Les règles restent prudentes mais leurs détections lexicales ne sont pas une preuve d’analyse exhaustive de tout langage naturel.

La conversation n’est pas stockée dans localStorage, sessionStorage ou un nouveau serveur. L’utilisateur peut l’effacer ou l’exporter. Cette portée concerne le texte du dialogue ; elle ne signifie pas que l’hébergeur ou les autres éléments du site ne réalisent aucun journal technique.

## Fil partagé

Après consentement et relecture, seul le dernier message peut être proposé à la publication dans une issue GitHub `[LA BÊTE]`. L’ouverture du formulaire ne publie rien ; le compte GitHub et la confirmation sur GitHub sont nécessaires. Ne pas y inclure de données privées. Le contrôle de coordonnées et de secrets est une précaution, non un détecteur exhaustif.

Le workflow Reality Pulse existant inclut un traitement borné des fils volontaires. Aucun nouveau cron, daemon ou timer de page. Le job utilise `contents: read` et `issues: write`, sans persistance des identifiants du checkout. Les messages sont lus comme données, jamais interpolés dans un shell ou utilisés comme permission. Les liens utilisateur ne sont pas visités.

Le traitement partage exactement les règles du navigateur. Il conserve un marqueur par message traité et n’affirme une réponse envoyée qu’après réception d’un identifiant de commentaire du fournisseur. Limites explicites : au plus cinq réponses et quinze fils examinés par exécution, exploration des deux premières pages d’issues récentes, dernière intervention humaine du fil. La réponse dépend de l’exécution du workflow et n’est pas garantie instantanée ; ce n’est pas encore une messagerie temps réel ni une couverture sans limite.

## Envoi administratif : non raccordé

Le contrat privé de `dispatch_once` exige les adaptateurs réels d’Authority, du fournisseur et du MissionStore. Il ne crée pas de seconde base. Il vérifie validité et révocation du mandat, destinataire, empreinte du contenu, preuve du contact, coût nul, absence de pièces jointes et validité des en-têtes. Une réservation durable doit précéder l’envoi. Une livraison incertaine bloque la répétition tant qu’une réconciliation fournisseur n’a pas établi le résultat.

Ces adaptateurs ne sont pas raccordés dans cette livraison. Les tests utilisent des fixtures clairement identifiées. Aucun mail, formulaire, recours, paiement, signature, délai légal, relance ou dossier personnel n’a été exécuté par ce chantier. Le contrat de validation d’une réponse ne modifie pas lui-même la vérité canonique.

La page publique continue de déclarer `external_action: false`. Le runtime, la source native SUPRA, le bridge, le Megabus et les registres privés ne sont pas modifiés ici.

## Validation locale enregistrée

- 17 tests acquisition : regroupement, stabilité, récupération, provenance, politique, adaptateurs absents, mandat, changement de destinataire/contenu, révocation, coût, pièce privée, en-têtes, envoi unique, livraison incertaine, preuve partielle et absence de promotion automatique.
- 37 tests dialogue : contexte, limites, non-adoption, factualité politique, consentement, confidentialité, URL autorisées, absence d’exécution, préservation du contexte, absence d’injection HTML, de stockage persistant ou de nouvelle boucle, contrat GitHub, déduplication et suivi.
- Contrôles existants : évolution, mémoire de santé, convergence, transferts de savoir-faire, pont, identité, ADN artistique, hydratation, résonance et liaison canonique.
- Navigateur réel Chrome, ordinateur 1440×1000 et mobile 390×844 : initialisation, dossier provenant du même instantané, réponse à une idée, suivi, consentement, absence de débordement horizontal, rendu textuel d’une tentative HTML, blocage du partage de coordonnées, effacement et zéro exception non interceptée.

Les reçus de tests locaux sont distincts d’une preuve d’usage sur iPhone physique, d’une preuve d’envoi administratif ou d’une preuve de publication publique.

## Étape suivante demandée

Nicolas demande de quitter ensuite la présentation monolithique pour un multiunivers navigable et explorable. La direction est conservée dans `LA_BETE_MULTIUNIVERS_DIRECTION_20261003.md` : objets canoniques, relations, profondeur progressive, chemins directs, historique, dialogue contextuel, 3D optionnelle et aucune deuxième vérité. Cette architecture n’est pas annoncée comme déjà déployée.
