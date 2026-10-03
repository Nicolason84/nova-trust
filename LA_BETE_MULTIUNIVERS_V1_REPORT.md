# La Bête — interface multiunivers V1

État : DEPLOYED_AND_PUBLICLY_BROWSER_TESTED. Le reçu `receipts/LA_BETE_MULTIUNIVERS_V1_PUBLIC_PROOF.json` établit le commit, le workflow, Pages et 21 contrôles de navigation sur l’adresse publique.

## Interface

L’accueil devient `#/atlas`, sur la même adresse. Huit univers ouvrent des vues par objet : territoires, finances, sources et organismes, preuves, temps, démarches, idées, état. Ce ne sont pas des ancres vers la page longue. La lecture intégrale reste disponible sous `#/lecture` et sans JavaScript.

Le parcours vérifié localement traverse France → finances publiques → dette → source AFT → organisme → source → manque → demande préparée. Les relations sont nommées. Les positions sur l’atlas servent à la navigation, sans mesure ou causalité implicite.

Routes : `#/atlas`, `#/univers/<univers>`, `#/objet/<identifiant encodé>`, `#/analyse`, `#/horizons`, `#/chronologie`, `#/sante`, `#/presence`, `#/lecture`.

Les identités et relations du ProofGraph sont reprises du flux. Les objets sources sont référencés, non répliqués dans une autre base. Les regroupements d’organismes par domaine sont explicitement des vues, pas un registre Person.

## Continuité

L’historique natif conserve les objets, recherches, positions et brouillons ouverts dans une mémoire de session de 40 entrées. Les liens directs survivent au rechargement. Un lien vers un instantané absent affiche cette limite et ne fournit pas une autre version comme si elle était identique.

Un nouvel état du pulse signale sa disponibilité sans déplacer l’objet courant. Les anciens composants d’analyse conservent leur comportement live, indiqué à leur ouverture.

Le chat existant accompagne la navigation. Les messages restent attribués à leur objet et version ; le brouillon est préservé. Les questions sur un objet reprennent ses éléments documentés. Le dialogue reste structuré par règles, sans modèle généraliste ajouté.

Le panneau de preuve affiche le relevé disponible, les dates, la provenance et l’enregistrement brut. La pièce originale s’ouvre sur le site officiel. Ce panneau n’affirme pas l’avoir téléchargée ou revalidée. Son état local est conservé par objet et instantané.

## Réutilisation

Les régions sont chargées à la demande depuis le document territorial existant. Les seuls nombres disponibles ne deviennent pas des fiches départementales ou communales. Aucune donnée de taux nationale n’est attribuée à une région.

Les composants courbes, horizons, chronologie, santé et présence sont déplacés dans la vue active, puis remis à leur place ; leurs identifiants ne sont pas dupliqués. La scène Three.js existante est initialisée à la première ouverture, pas sur l’atlas. Son mode dégradé reste disponible.

Aucun nouveau polling, daemon, cron, bus ou moteur de décision. La lecture territoriale utilise la fonction d’entrée-sortie bornée du pulse existant. Les variables de couleur reprennent l’identité publique cuivre, nuit, rouge et cyan.

SUPRA natif, les registres privés, le bridge, Megabus et l’application iPhone restent inchangés. L’envoi administratif n’est pas raccordé. Aucune autorisation n’est donnée par une contribution publique.

## Tests et limites

44 tests de modèle et navigation passent. Les tests existants de dialogue, acquisition, convergence, mémoire, transfert, pont, identité, hydratation, art et résonance passent également.

Le test navigateur est `scripts/test_la_bete_explorer_browser.cjs`. Il distingue test local, test public, émulation mobile et appareil physique. Il contrôle parcours, retour exact, dialogue, mise à jour non intrusive, recherche, sources, liens directs, mobile, lecture de secours et JavaScript désactivé.

Le partage fixe l’instantané dette/taux. Le document territorial est daté séparément : ce lien n’est pas une archive de toutes ses versions. L’historique local est borné. Le panneau de preuve n’est pas un lecteur universel de documents externes. Aucun modèle conversationnel généraliste ni envoi administratif n’est ajouté.
