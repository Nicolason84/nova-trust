# La Bête — présence prédominante dans l’Atlas

Demande de Nicolas : La Bête est retrouvée mais n’occupe pas une place prédominante. Cette correction remplace sa relégation dans un univers secondaire par sa présence principale dès l’accueil.

État source : IMPLEMENTED_AND_LOCALLY_TESTED. Le reçu public séparé établira la publication et le test sur l’adresse publique.

## Modification

L’Atlas expose désormais la scène 3D existante en son centre, avec les huit univers accessibles autour sur ordinateur. Sur mobile, la scène apparaît avant les portes d’univers, dans le premier écran sans défilement. Le titre principal est « La Bête ». L’objet France reste directement ouvrable sous sa représentation.

Un accès « La Bête » est présent dans l’en-tête sur les autres parcours. Il mène à la vue d’immersion et aux contrôles détaillés, sans imposer un détour par « État de La Bête ».

Le même élément `beastStage` et le même canvas sont déplacés entre Atlas, vue détaillée et lecture complète ; ils ne sont pas dupliqués. La seule initialisation existante est réutilisée. Le raccourci global est un lien, pas une scène miniature ou un second rendu.

La scène se charge dès l’ouverture de l’Atlas : c’est un changement intentionnel par rapport à la V1, qui la chargeait seulement à l’ouverture d’une vue secondaire. Un lien direct vers un objet continue de ne pas charger la 3D inutilisée.

Le texte technique et les panneaux de mesures ne recouvrent pas le corps dans l’Atlas ; ils restent dans la vue détaillée. Le message d’erreur et le dessin de secours restent disponibles en cas d’interruption WebGL. Le son, la caméra et les capteurs ne sont pas activés automatiquement.

La navigation, le retour, la recherche, le dialogue contextuel et la vérité canonique sont conservés. Aucun shader, calcul, registre Person, boucle de rafraîchissement, bridge ou moteur SUPRA natif n’est créé ou remplacé.

## Contrôles

Les assertions de navigation sont complétées pour vérifier l’emplacement initial de la scène et son identité DOM entre les vues. Le test de rechargement force désormais un rechargement complet du document et vérifie un marqueur de nouvelle page ; il ne se limite pas à une transition de fragment d’adresse.

Le navigateur local confirme un seul canvas, la scène dans le premier écran 1440 × 1050 et 390 × 844, sa position avant les univers sur mobile, les parcours existants et l’absence d’activation caméra ou son. Le mobile est émulé ; aucune vérification sur iPhone physique n’est revendiquée.

Les rapports de V1 précédents restent des reçus historiques. Cette correction change délibérément leur règle de chargement de la présence sur l’Atlas, sans changer les garanties d’unicité de scène ni la séparation public/privé.

Le retour vers l’Atlas conserve l’arrêt des éventuels accès caméra, capteurs et son activés dans la vue détaillée. Cet arrêt ne coupe pas le rendu 3D existant : la présence reste visible, sans capture ni son automatiques.
