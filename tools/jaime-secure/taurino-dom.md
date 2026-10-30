# El tendido — contrat DOM pour le module

Fichiers de présentation : `app/dist/taurino.html`, `app/dist/taurino.css`. Script attendu : `app/dist/secure/taurino.js`, chargé en module. Aucun autre fichier de l’app, du coffre ou de la messagerie n’est modifié par cette livraison.

Les zones de données commencent avec des états de chargement neutres. Elles ne contiennent aucun cartel, résultat, chiffre de progression, titre RSS ou récit de corrida fictif. Le module doit les remplir depuis les données vérifiées, supprimer les états de chargement et mettre `aria-busy="false"`. En cas d’échec, remplacer le chargement par un état explicite.

## Navigation et conventions

Les boutons `[data-taurino-tab="news|learn|talk|mine"]` pilotent respectivement `taurinoNewsPanel`, `taurinoLearnPanel`, `taurinoTalkPanel`, `taurinoMinePanel`. Le panneau `news` est initialement visible. Basculer `hidden`, puis attribuer `aria-current="page"` au seul bouton actif. Ce sont des boutons dans une navigation, sans contrat ARIA `tablist`.

`[data-taurino-close="idDuDialogue"]` ferme le dialogue nommé. Les dialogues natifs sont ouverts avec `showModal()` et fermés avec `close()`. `taurinoToast` est un message transitoire, `role="status"`, initialement caché. Les gabarits `<template>` sont détaillés ci-dessous ; leurs textes et liens doivent être affectés explicitement, sans importer de HTML issu des flux.

## Épisodes enregistrés

| ID | Fonction |
| --- | --- |
| `taurinoListenButton` | CTA du hero ; désactivé tant qu’un vrai MP3 n’est pas prêt. |
| `taurinoEpisodeList` | Choix des épisodes réels. Générer des boutons ; `aria-pressed="true"` pour l’épisode choisi. |
| `taurinoEpisodeTitle`, `taurinoEpisodeSummary` | Titre et description de l’épisode choisi. |
| `taurinoEpisodeDuration`, `taurinoEpisodeDate` | Informations réelles ; enlever `hidden` uniquement lorsqu’elles sont connues. |
| `taurinoAudio` | Lecteur HTML natif `controls`, `preload="none"`. Attribuer une source locale réelle. |
| `taurinoPlaybackRate` | Choix 0,85 / 1 / 1,15 / 1,3 ; appliquer à `audio.playbackRate`. |
| `taurinoAudioStatus` | État ou erreur lisible, sans progression inventée. |
| `taurinoTranscript`, `taurinoEpisodeSources` | Texte accessible complet et liens des sources de cet épisode. |

Le label « Voz generada » reste visible. Les fiches utilisent une lecture système distincte, avec ses propres boutons. La CSP autorise les médias `self` et `blob:` ; aucun lecteur distant ou iframe n’est présent. Aucun épisode ne commence automatiquement au chargement.

## Al día

- `taurinoEventsList` : grille des 6–10 corridas documentées. Compteur `taurinoEventCount`, fraîcheur `taurinoLastChecked`, périmètre `taurinoCoverage`, état `taurinoEventsStatus`.
- Formulaire `taurinoEventFilters` : `taurinoFilterDate`, `taurinoFilterPlaza`, `taurinoFilterTorero`. `taurinoResetFilters` est un bouton `type="reset"` : relancer le filtre après la remise à zéro native, ou remettre les valeurs à zéro explicitement.
- `taurinoEventTemplate` contient `[data-event-date]`, `status`, `plaza`, `city`, `toreros`, `summary`, `source`, `checked`, `open`, `favorite`, tous préfixés `data-event-`. Mettre une date ISO dans `time.dateTime` et un libellé espagnol dans le texte. Le favori utilise `aria-pressed`. Le badge n’affirme pas par défaut une vérification ou un résultat.
- Dialogue `taurinoEventDialog` : `taurinoEventTitle`, `taurinoEventMeta`, `taurinoEventBody`, `taurinoEventChecked`, `taurinoEventSources` et `taurinoFavoriteEvent`.
- `taurinoFeedList` / `taurinoFeedStatus` : bloc **« Actualidad y voces oficiales »**, badge **« Fuentes oficiales »**. Il est séparé des résumés de corridas. Prévu pour Clarín/RTVE, Real Maestranza et Zafra : catégories, dates et liens officiels, sans republication des titres/articles du flux.
- `taurinoFeedTemplate` : `[data-feed-owner]`, `date`, `link`, `summary`. Le résumé est caché par défaut ; le lien peut porter un libellé de catégorie rédigé pour l’interface.
- Recherche d’une autre corrida : `taurinoRequestForm` avec `taurinoRequestPlaza`, `taurinoRequestDate`, `taurinoRequestTorero`, `taurinoRequestQuestion`. Résultat caché `taurinoRequestResult`, résumé `taurinoRequestSummary`, liens `taurinoRequestLinks`. Le texte promet une **préparation de recherche**, pas une réponse IA ou des faits déjà vérifiés.

## Entender

- `taurinoLessonsList` / `taurinoLessonCount` : fiches. `taurinoLessonTemplate` expose `[data-lesson-number]`, `state`, `title`, `summary`, `open`. `data-learned="true"` sur la carte modifie son apparence après une action réelle.
- `taurinoLessonDialog` : `taurinoLessonEyebrow`, `taurinoLessonTitle`, `taurinoLessonBody`, `taurinoLessonSources`, `taurinoSpeakLesson`, `taurinoStopSpeaking`, `taurinoSpeechStatus`, `taurinoMarkLearned`, `taurinoFavoriteLesson`. La lecture avec la voix du téléphone est explicitement distinguée de l’épisode enregistré.
- `taurinoRanchesList` : 4–6 élevages documentés. `taurinoRanchTemplate` expose `[data-ranch-location]`, `name`, `summary`, `facts` et `sources`. Les faits sont une liste libre ; ne pas inventer un encaste ou une localisation manquante.
- `taurinoGlossarySearch`, `taurinoGlossaryList`, `taurinoTermCount`, `taurinoGlossaryStatus` : glossaire. `taurinoTermTemplate` contient `[data-term-name]`, `definition`, `example`, `source`. Chaque entrée est un `<details>` natif.
- Quiz : `taurinoQuizForm`, `taurinoQuizQuestion`, `taurinoQuizOptions`, `taurinoQuizProgress`, `taurinoQuizCheck`, `taurinoQuizNext`, `taurinoQuizFeedback`. Insérer des `<label>` contenant un radio et son texte dans les options. Réactiver « Comprobar » une fois la question prête. `data-state="correct"` peut colorer l’explication, sans simuler une note.
- **Reto de hoy** : `taurinoDailyTitle`, `taurinoDailyText`, `taurinoDailyOpen`. Une fiche quotidienne et un exercice réel. Le bouton commence désactivé. Le formulaire calendrier/ICS a été retiré : aucun rappel automatique n’est promis.

## Conversar et Mi afición

- `taurinoDebatesList` : six dossiers. `taurinoDebateTemplate` expose `[data-debate-number]`, `title`, `summary`, `open`.
- Dialogue `taurinoDebateDialog` : `taurinoDebateTitle`, `taurinoDebateIntro`, `taurinoDebateFor`, `taurinoDebateAgainst`, `taurinoDebateNuance`, `taurinoDebateQuestion`, `taurinoDebateSources`, `taurinoWriteOpinion`, `taurinoFavoriteDebate`. Les trois colonnes de raisonnement sont distinguées par le texte, pas seulement la couleur.
- `taurinoOpinionForm` : `taurinoOpinionTopic` et `taurinoOpinionText`. Alimenter les sujets à partir des dossiers. « Escribir mi opinión » peut fermer le dialogue, choisir le sujet et placer le focus sur ce champ.
- Progression : `taurinoProgressText`, `taurinoLearningProgress` (`max` et `value` à renseigner avec les vrais comptes), `taurinoResetProgress`. Ne compter une fiche qu’après l’action appropriée.
- Favoris : `taurinoFavoritesList`, `taurinoFavoriteCount`. `taurinoFavoriteTemplate` expose `[data-favorite-kind]`, `title`, `description`, `open`, `remove`.
- Carnet : `taurinoNoteForm`, `taurinoNoteTitle`, `taurinoNoteText`. Aucun autosave du texte n’est annoncé. Le lien « Abrir mi archivo privado » renvoie vers `universos.html`.

## Notes privées et masquage

`taurinoVaultDialog` contient `taurinoVaultSummary`, `taurinoVaultForm`, `taurinoVaultPhrase`, `taurinoVaultPhraseConfirm`, `taurinoVaultSubmit` et `taurinoVaultError`. Le module peut garder la note en mémoire pendant la demande de phrase, puis utiliser le coffre existant et sa catégorie `tauromaquia`. Les favoris et comptes de progression peuvent être locaux ; **les textes personnels et les phrases ne doivent pas être écrits en clair dans un stockage persistant**.

La classe **`taurino-private-hidden` sur `<body>`** masque immédiatement `#taurinoOpinionText`, `#taurinoNoteForm` et `#taurinoVaultDialog`. Elle ne masque pas les contenus éditoriaux publics. Le JS doit gérer les délais de purge, les opérations en attente et le retrait du masque ; le CSS ne verrouille rien à lui seul. Après fermeture/purge, vider les champs de phrase et les messages pouvant contenir un titre de note.

## Présentation et vérification

CSS autonome, sans CDN, police externe ni image bitmap. SVG d’arène et de dehesa sans scène de combat. Les contrôles atteignent au moins 44 px ; les champs utilisent 16 px pour le confort iPhone. Une navigation collante, des grilles à une colonne et des dialogues bornés sont prévus pour 390 px. Le mouvement réduit est respecté.

Cette livraison est une structure et une présentation. La validité des sources, les médias réels, les comptes de progression et le fonctionnement des interactions dépendent du module branché. Aucune session navigateur n’a été ouverte en parallèle du contrôle de root.
