# Provenance, reprise et limites — Universos

État des sources : 30 octobre 2026. Ce document concerne la page Universos, son coffre de documents et sa caméra locale. Les cinq empreintes ci-dessous ont été recalculées sur les copies de travail retrouvées et correspondent au relevé de capture privé. Les sources originales complètes ne sont pas publiées avec ce paquet ; seuls les éléments décrits ont été adaptés. Aucun identifiant de machine, chemin personnel ou contenu privé n’est reproduit ici.

## Sources retrouvées et usage réel

| Fichier source retrouvé | Usage dans cette livraison | SHA-256 |
| --- | --- | --- |
| `cannonico_inputs.js` | Réduction CAnnoNico 1.1 adaptée dans `document-vault.mjs`. | `7957e5fe608bd8d881e4a1b1c2fde1b7f126e6b2f96aca80ff8aed4ce7a08676` |
| `la-bete-art.css` | Palette, surfaces, typographie et sculpture orbitale adaptées dans `docs/jaime/universos.css`. | `a0fcd12828e765458d42877076ffa2910c5c27b09e1a607b867e4ee1580f8f28` |
| `la-bete-living-advisory-house-premium-v1.css` | Scène architecturale et lumière adaptées dans `docs/jaime/universos.css`. | `c03272494ae38d4049725c63f97788eee728003790c1446c59f65cb046e2f895` |
| `la-bete-living-advisory-house-premium-v1.js` | Source conservée pour référence ; le script original n’est pas chargé par la page Universos. | `497d745bfd5c22362c126451a4bc9e6385dd1328790379365d06580357924765` |
| `humain_local_scan_server.py` | Source conservée pour référence ; aucun serveur natif de scan n’est exécuté ou exposé par cette intégration. | `114a24d46df378cea2ad1b01cf36dc3a3d0fe4ef035eacf4c0a2c957c8654215` |

### CAnnoNico : ce qui fonctionne

La fonction `reduceCannonicoText()` reprend les dix champs de la source : identité, date, lieu, personnes, faits, preuves, chronologie, risque, décision et prochaine action. Elle conserve le texte admis, les lignes non classées et les comptes de couverture. Des expressions espagnoles complètent les règles d’origine. Elle est appelée pour les textes compatibles lors de l’import et de la consultation.

Les résultats sont des correspondances de mots, pas des faits vérifiés ni une analyse IA. Les marqueurs de non-promotion restent explicites. La fiche détaillée rattache la réduction au nom, à la taille et au SHA-256 de l’original effectivement déchiffré et contrôlé. Cette empreinte vérifie l’intégrité des octets, pas l’authenticité juridique d’un document.

### La Bête : ce qui a été adapté

Les couleurs `#080c0f`, `#ede7da`, `#dca47c`, les fonds radiaux, les cartes en dégradé et leurs bordures proviennent du vocabulaire visuel de `la-bete-art.css`. Les styles des orbites, du noyau, des tendons et des satellites sont repris sous `.signal-sculpture`. La composition premium apporte la paroi inclinée, les divisions de fenêtre et le faisceau lumineux flouté, adaptés sous `.scene-wall`, `.scene-window` et `.scene-light`.

Les dimensions, espacements, formulaires et règles mobiles sont adaptés à Universos. Ces éléments assurent uniquement la présentation ; ils n’activent aucun moteur, registre, mémoire ou service natif de La Bête.

## Lecture locale : périmètre exact

L’application reçoit uniquement les fichiers que la personne sélectionne explicitement. La sélection d’un dossier dépend du navigateur ; elle ne donne pas accès à tout le téléphone. Il n’existe ni parcours silencieux du disque, ni service local ouvert, ni envoi automatique des documents à un serveur ou à une IA.

La caméra s’ouvre sur une action explicite. Une photographie n’est conservée qu’à la demande. Le réglage de luminosité modifie la vue à l’écran ; il ne crée pas de capteur infrarouge. La photographie d’un document reste une image : **aucun OCR, aucune extraction PDF/Office et aucune transcription audio/vidéo ne sont implémentés**.

## Coffre : fonctions et limites

Le coffre crée ou ouvre une session locale, importe les originaux, recherche dans l’index déchiffré en mémoire, classe les fichiers, modifie leurs catégories et tags, restitue les octets d’origine et supprime sur demande explicite. Il permet une sauvegarde JSON chiffrée et une restauration par fusion, sans remplacer les documents déjà présents. Un nom d’affichage peut changer sans modifier l’original.

| Limite | Valeur réelle |
| --- | --- |
| Original, quel que soit son format | 25 MiB par fichier |
| Texte extrait | UTF-8 valide, jusqu’à 2 MiB |
| Réduction CAnnoNico | 10 000 premières lignes ; dépassement signalé |
| Recherche dans le contenu | 64 KiB par fichier ; noms, catégories et tags également recherchables |
| Capacité logique | 1 000 fichiers et 32 MiB de métadonnées chiffrées ; quota du navigateur applicable |
| Sauvegarde JSON | 100 MiB, encodage base64 compris ; mémoire temporaire nécessaire |

Les métadonnées et contenus sont chiffrés dans une base IndexedDB distincte : AES-256-GCM, PBKDF2-SHA256 à 600 000 itérations, sel de 32 octets et nonces de 12 octets. La phrase doit compter au moins 14 caractères. La clé demeure en mémoire ; le verrouillage libère ses références et interrompt les opérations en cours, sans prétendre garantir l’effacement intégral de la mémoire JavaScript. Les écritures entre onglets nécessitent Web Locks. Il n’existe pas de récupération de phrase ni de synchronisation entre appareils. Une copie téléchargée de l’original sort du coffre.

## Reprendre le travail

Le contrat d’intégration est dans [DOCUMENT_VAULT_STATUS.md](DOCUMENT_VAULT_STATUS.md). Les sources actives sont `document-vault.mjs`, `universos-ui.mjs`, `camera-controller.mjs`, `docs/jaime/universos.html` et `docs/jaime/universos.css`. Quinze tests synthétiques du coffre passent via `node tests/document-vault.test.mjs` ; ils couvrent notamment l’intégrité, le verrouillage, IndexedDB et les sauvegardes. Ce résultat ne constitue pas un audit indépendant ni une preuve de publication ou de validation sur un iPhone réel.
