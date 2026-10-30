# Activer la messagerie de Jaime

**Fiche pour Nicolas — 30 octobre 2026.** Plan d’activation ; aucune infrastructure, aucun compte réel ni aucun secret ne sont créés par ce document.

## La prochaine étape concrète

**Confier à un seul opérateur identifié la préparation d’un service privé pour deux comptes.** Demander une fiche sans secrets : infrastructure autorisée, adresse HTTPS Matrix, origine web réservée au client, sauvegarde et créneau d’installation sur les appareils. Les adresses et droits d’administration restent à confirmer ; aucun domaine, budget ou accès n’est supposé acquis.

Mission à transmettre : « Prépare un service Matrix privé pour Jaime et un interlocuteur pilote désigné : inscriptions et fédération fermées, sauvegarde et récupération vérifiables. Présente-moi le périmètre et les accès nécessaires avant activation. »

## 1. Ce qui existe déjà

Les essais réels de chiffrement, SAS et récupération ont réussi sur serveur local avec comptes synthétiques. Le [rapport de validation](validation/README.md) distingue ces preuves des vérifications restant sur iPhone.

**GitHub Pages sert uniquement l’interface et son code client : aucun homeserver, service d’IA ou VPN.** Le serveur d’essai n’est pas celui de Jaime. Les composants natifs retrouvés ne donnent aucun droit d’hébergement ou d’accès : voir [réutilisation et limites](REUSE_AND_LIMITS.md). Créer les comptes, clés et autorisations propres à Jaime, sans reprendre ceux d’une autre personne.

## 2. Le service privé à préparer

Préparer un homeserver HTTPS stable, deux comptes nominatifs et un accès d’administration séparé. Jaime doit accepter son interlocuteur pilote. Le mode de connexion doit être compatible avec le client actuel ; le SSO n’y est pas implémenté.

Fermer les inscriptions publiques et protéger la création administrative des comptes. Garder la fédération désactivée : les deux utilisateurs communiquent sur ce serveur. Toute ouverture future exige une décision explicite. Appliquer les contrôles de la [documentation Synapse](https://element-hq.github.io/synapse/latest/usage/configuration/config_documentation.html) et empêcher l’exposition des routes de fédération.

Prévoir TLS et son renouvellement, une base de production, des sauvegardes protégées et un responsable des mises à jour/incidents. Ne pas reprendre les réglages permissifs des essais. Référence : [entrée HTTPS de Synapse](https://element-hq.github.io/synapse/latest/reverse_proxy.html).

## 3. L’adresse web fait partie de la sécurité

Réserver une **origine HTTPS dédiée**, distincte des autres applications et de l’assistant. Un dossier différent sur la même origine n’isole pas le stockage. Protéger la publication, servir les scripts/WASM contrôlés, garder une CSP restrictive et limiter les destinations réseau au serveur retenu. Vérifier TLS et les en-têtes servis ; maintenir client, SDK et serveur. Références : [isolation des origines](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy), [CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP).

## 4. Avant les premiers messages personnels

À réaliser avec le **vrai iPhone de Jaime** et un second appareil autorisé :

1. Ouvrir le service, protéger le coffre local et créer ou récupérer l’identité existante. Garder la clé de récupération hors du téléphone, dans un lieu privé ; ne pas la transmettre dans un chat.
2. Comparer humainement les vrais symboles SAS avec l’interlocuteur, puis échanger un texte d’essai sans données personnelles.
3. Vérifier fermeture, verrouillage, réouverture, interruption réseau et impossibilité d’ouvrir simultanément le même magasin dans deux onglets.
4. Récupérer l’identité sur le second appareil et y relire le texte d’essai, sans effacer le seul appareil fonctionnel. Vérifier séparément la restauration du serveur depuis sa sauvegarde.

La sauvegarde du serveur, le backup chiffré des clés Matrix et la clé de récupération conservée par Jaime remplissent des rôles différents. Le résultat attendu est une récupération constatée sur ses appareils. Le stockage du navigateur peut disparaître ; une sauvegarde ne garantit pas la présence de tout l’historique.

Le chiffrement ne masque pas toutes les métadonnées : comptes participants, horaires, appartenance aux salles et certaines informations de connexion restent visibles aux services concernés. Éviter les titres de salle sensibles. Il ne protège pas contre un téléphone compromis ou un destinataire qui copie un message.

## 5. VPN et IA : deux activations séparées

**Option VPN :** préparer un endpoint WireGuard réellement administré, une paire de clés propre à l’appareil et un profil transmis de manière privée ; installer le [client iOS officiel](https://www.wireguard.com/install/), puis contrôler le tunnel sur l’iPhone. Les paramètres réseau et les clés sont décrits dans le [guide WireGuard](https://www.wireguard.com/quickstart/). La page web ne peut ni installer ce tunnel ni prouver qu’il fonctionne. Un VPN ne remplace pas le chiffrement Matrix.

**Option IA :** raccorder ensuite un service authentifié propre à Jaime, avec secrets côté serveur. Obtenir son accord explicite sur les contenus transmis, la mémoire conservée et les rappels. Aucun transfert automatique des conversations chiffrées ou de son dossier personnel. Un contenu envoyé à un fournisseur d’IA lui devient accessible pour traitement : ce partage doit être visible et choisi. Les actions externes et les notifications demandent leur propre périmètre d’autorisation.
