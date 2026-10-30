# Veille taurine publique

Le script produit un index de liens vers trois sources officielles. Il ne produit
pas de résumés de corridas et n'utilise aucune API d'IA, aucun compte ni aucun secret
applicatif. Les descriptions, titres d'origine et adresses des fichiers audio ne
figurent pas dans le JSON. Les intitulés sont rédigés à partir de modèles courts,
comme « Clarín · 25 octubre » ou « Literatura taurina · Sevilla ».

## Chemins de publication

Dans `nova-trust`, placer le script dans `tools/jaime-secure/taurino_refresh.py`, les
tests dans `tools/jaime-secure/tests/test_taurino_refresh.py`, et le workflow préparé
dans `.github/workflows/jaime-taurino-refresh.yml`. La seule sortie commise par ce
workflow est `docs/jaime/data/taurino-feed.json`.

```sh
python -m unittest discover -s tools/jaime-secure/tests -p test_taurino_refresh.py -v
python tools/jaime-secure/taurino_refresh.py --output docs/jaime/data/taurino-feed.json
```

Dans le dossier de travail actuel, depuis `jaime_app_work` :

```sh
PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s secure-messaging/tests -p test_taurino_refresh.py -v
python secure-messaging/taurino_refresh.py --output app/dist/data/taurino-feed.json
```

Python 3.11 ou plus récent, avec sa bibliothèque standard, suffit. Le workflow
installe une version maintenue de Python 3.13. Le script n'accepte pas de paramètre
URL : `--output` désigne uniquement le fichier local à écrire.

## Schéma stable pour le frontend

```json
{
  "schemaVersion": 1,
  "generatedAtUtc": "2026-10-30T12:00:00Z",
  "coverage": {
    "type": "source_links",
    "isLive": false,
    "includesCorridaSummaries": false,
    "noteEs": "Enlaces a novedades oficiales. No son resúmenes de corridas..."
  },
  "sources": [{
    "id": "rtve-clarin",
    "name": "Clarín · RTVE",
    "url": "https://api.rtve.es/api/programas/1907/audios.rss",
    "status": "ok",
    "lastSuccessAt": "2026-10-30T12:00:00Z",
    "errorCode": null
  }],
  "items": [{
    "id": "sha256-of-source-id-and-canonical-url",
    "sourceId": "rtve-clarin",
    "kind": "podcast",
    "date": "2026-10-25T22:48:04Z",
    "url": "https://www.rtve.es/play/audios/clarin/.../",
    "label": "Clarín · 25 octubre",
    "topics": ["Perú", "Ganaderías", "Temporada"]
  }]
}
```

Cet exemple est explicatif. Le snapshot réel est généré par une lecture des flux.
`id` est un SHA-256 hexadécimal complet, stable pour la source et l'URL canonique.
`kind` vaut `podcast` ou `institutional`. `date` est la date publiée, normalisée en
UTC ; `generatedAtUtc` indique seulement quand le fichier a été calculé.

`status` vaut `ok` après téléchargement et analyse valides, `stale` si un échec
oblige à conserver des liens précédents, ou `failed` en cas d'échec sans liens à
conserver. `lastSuccessAt` garde la dernière vérification réussie, même lors d'un
échec ; il peut être `null`. Un flux correctement lu sans article pertinent, comme
Zafra après filtrage, est `ok` avec zéro élément. Le frontend doit afficher ces
états et les dates des publications séparément. Une vérification récente ne rend
pas un vieil article récent.

## Sources fixes et contenu retenu

| ID | Flux HTTPS | Portée |
|---|---|---|
| `rtve-clarin` | https://api.rtve.es/api/programas/1907/audios.rss | Liens d'écoute sur les pages officielles de Clarín |
| `real-maestranza` | https://www.realmaestranza.com/feed/ | Actualité institutionnelle et culturelle de Sevilla |
| `zafra` | https://zafra.es/feed/ | Actualité municipale, seulement si le titre contient des mots taurins exacts |

Les trois flux ont été observés en HTTP 200 et analysés en XML le 30 octobre 2026.
Le flux de Lances Maestranza n'est pas inclus : il a répondu 403. Les URLs des
articles ne sont jamais téléchargées par le script.

Les topics appartiennent à un vocabulaire fermé : Perú, México, Ecuador, Francia,
Madrid, Sevilla, Extremadura, Ganaderías, Temporada, Ferias, Indultos, Escuelas,
Entrevistas, Debate, Literatura, Patrimonio, Cultura, Tauromaquia et Actualidad
taurina. Ils signalent des mots présents dans un titre, sans analyser le contenu de
l'émission. Le titre original est ensuite abandonné. Pour Zafra, la recherche se
fait par mots entiers (`taurino/a/s`, `tauromaquia`, `toros`, `corrida/s`) : un
« torneo » ou une entreprise nommée « Toro » ne suffit pas.

## Bornes et reprise sur incident

- HTTPS uniquement ; hôtes exacts autorisés par source. Chaque redirection est
  contrôlée avant la requête suivante, au maximum deux, en conservant le chemin du
  flux. Identifiants dans l'URL, ports non standards et chemins ambigus sont rejetés.
- GET uniquement, aucun cookie ni authentification applicative. Le transport
  respecte les réglages proxy standards de l'environnement sans les afficher ni
  les enregistrer. Timeout socket de 10 secondes et contrôle de délai de 25 secondes
  entre les lectures d'un flux ; le job complet est limité à cinq minutes.
- XML limité à 2 Mio, 20 000 nœuds, profondeur 32 et 100 entrées RSS. UTF-8 seulement,
  DTD et déclarations d'entités rejetées avant analyse, contenu compressé refusé.
  Maintenir Python/Expat à jour ; ces limites complètent les protections du parseur.
- Dates sans fuseau, invalides ou supérieures à l'horloge de plus de cinq minutes
  rejetées. Si toutes les entrées sont invalides, le flux échoue et conserve ses
  anciens liens. Aucun remplacement par la date du téléchargement.
- Déduplication par source et URL canonique, suppression des paramètres de suivi,
  au maximum 20 liens par source. Un succès remplace le lot de cette source ; un
  échec garde son précédent lot valide et sa date de dernier succès.
- Le snapshot précédent est lui aussi validé et ses champs sont reconstruits depuis
  une liste fermée. Un JSON précédent illisible fait échouer la commande sans
  l'écraser. L'écriture est atomique ; les fichiers temporaires sont supprimés.

Un code retour 0 signifie qu'un snapshot d'état a été écrit, éventuellement avec
des sources `stale` ou `failed`. Les erreurs par source restent visibles dans le
JSON et la sortie courte du script. Une erreur locale fatale renvoie 2 et conserve
le fichier existant. Aucun texte provenant d'un flux n'est injecté dans les logs.

## Workflow et visibilité réelle

Le workflow proposé tourne chaque jour à 07 h 17 UTC, ou manuellement sur la branche
par défaut. Il n'écoute aucun événement de pull request et refuse une exécution sur
une autre branche. Il utilise seulement `contents: write` et le jeton standard
fourni par GitHub Actions. Il teste le script hors réseau, calcule le snapshot,
puis ne stage que le JSON public. Les pushes concurrents passent par fetch/rebase
et trois tentatives de push sans force. Si le JSON a changé entre-temps, le job
s'arrête ; il ne remplace pas le fichier plus récent. Un conflit de rebase est
abandonné proprement. Une protection de branche refusant le push est respectée.

**Voie de publication retenue :** GitHub indique qu'un
commit poussé avec `GITHUB_TOKEN` ne déclenche pas de build GitHub Pages en mode
publication depuis une branche. Ce workflow met donc à jour le JSON du dépôt ; à
lui seul, il ne met pas à jour le fichier servi par Pages. Le frontend doit lire
l'URL publique fixe suivante, avec timeout, validation stricte du schéma et des
liens, puis utiliser le JSON local comme secours si cette lecture échoue :

`https://raw.githubusercontent.com/Nicolason84/nova-trust/main/docs/jaime/data/taurino-feed.json`

Cette destination est une constante du frontend, jamais une URL fournie par un
visiteur. Sa CSP doit autoriser explicitement cette lecture. Le recours au secours
local doit rester visible, et ses anciennes dates doivent être conservées. Aucun
PAT, permission Pages, secret supplémentaire ni déploiement n'est ajouté par ce
workflow. Le rafraîchissement public reste à confirmer après placement et exécution
du workflow dans le dépôt ; aucune exécution GitHub n'a été déclenchée ici.

Les actions sont épinglées aux commits des tags officiels `v7` lus le 30 octobre
2026 : checkout `3d3c42e5aac5ba805825da76410c181273ba90b1` ; setup-python
`6d4fd22b20465ccc0f7354476588e8df7c9ca0e0`. Le workflow n'a pas été lancé sur GitHub.

## Validation obtenue le 30 octobre 2026

Les huit tests hors réseau passent : schéma et absence de republication, filtrage
par mots entiers, déduplication et dates futures, XML hostile et limites,
redirections, erreurs et limites HTTP, conservation après échec, validation du
snapshot précédent et écriture atomique. La structure YAML et les trois blocs
shell du workflow ont également été analysés sans erreur. Aucun push, rebase réel
sur le dépôt ou lancement de workflow GitHub n'a été effectué pendant ces contrôles.

Le snapshot initial a été collecté le **30 octobre 2026 à 03:44:06 UTC** et écrit
dans `app/dist/data/taurino-feed.json` : les trois flux sont `ok`, avec **20 liens
Clarín et 10 liens Real Maestranza**. Le flux municipal Zafra est accessible mais
aucune de ses dix dernières entrées ne passe le filtre taurino. Sa sortie est donc
vide, sans erreur. Les dernières publications retenues datent du 25 octobre à
22:48:04 UTC pour Clarín et du 29 octobre à 12:08:39 UTC pour la Real Maestranza.
Ces heures sont conservées comme dates de publication, indépendamment du calcul
du snapshot. L'accès réseau de collecte respecte le proxy géré par l'environnement.

Références primaires : [checkout](https://github.com/actions/checkout),
[setup-python](https://github.com/actions/setup-python),
[publication GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site),
[sécurité XML de Python](https://docs.python.org/3.13/library/xml.html).
