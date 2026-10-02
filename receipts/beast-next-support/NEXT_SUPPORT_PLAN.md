# La Bête — prochain support et domaine

Préparation du 2 octobre 2026. La refonte artistique et la résonance web sont publiées ; leurs preuves sont dans receipts/beast-art-resonance. Cette préparation n’annonce aucune app iPhone distribuée ni aucun domaine acheté.

## Récupération constatée

GitHub Pages sert actuellement main:/docs, build_type legacy, HTTPS activé, cname null. Aucun CNAME, projet Xcode ou manifeste installable trouvé dans nova-trust. Le lien public actuel reste la référence publiée.

Sur le Mac, quatre copies SUPRA sous ACTIVE_REVIEW/NOVA_OS ont été inspectées : SUPRA, SUPRA_RUNTIME_EVIDENCE_READONLY, SUPRA_FRESH et SUPRA_BISECT. Leurs projets Xcode utilisent SDKROOT macosx, sans cible iPhone identifiée dans les configurations examinées. Ces copies ne sont pas certifiées comme source native canonique. Elles ne doivent pas être promues sur la seule base de leur nom. La recherche ne constitue pas un inventaire exhaustif de toutes les archives.

## Direction proposée

Préparer une cible iPhone native comme nouvelle projection de France, une fois la source native SUPRA active réconciliée. Le client affiche les mêmes identités, observations, deltas, preuves et scénarios. Il ne crée aucun bus, scheduler, modèle de dette ou Truth Store. Le cache local conserve seulement un snapshot canonique identifié et son âge ; aucune valeur recalculée indépendante ne peut le remplacer.

Le contrat à réutiliser est docs/data/FRANCE_BEAST_BINDING.json. Pays : OJO_FRANCE_ORGANISM_V1#/identity. Système : OJO_FRANCE_ORGANISM_V1#/physiology/systems/finance. Organe : OJO_FRANCE_DEBT_RATE_LIVE_V1. Sortie : EXECUTIVE_OUTPUT. Source de lecture : docs/data/france-debt-rate-live.json. Les identités du ProofGraph restent inchangées. National ne devient jamais territorial sans preuve.

Écrans à porter : Pouls en cinq secondes ; Bête ; horizon/refinancement ; preuves. Son facultatif, haptique native facultative, arrêt en arrière-plan. La texture sonore reste artistique. Première distribution proposée : TestFlight, après compilation, tests, signature et identification du compte Apple autorisé. Aucun compte, certificat ou accès supplémentaire n’est configuré par cette préparation.

## Domaine propre

Un domaine améliore l’adresse publique ; il ne transforme pas, à lui seul, la page en application native. Réutiliser GitHub Pages et le canon existants évite de créer un deuxième hébergement de vérité.

Noms de travail : ojofrance.fr, labetefrance.fr, suprafrance.fr. Disponibilité, propriété et droit d’usage non vérifiés ; aucun achat ni réservation. Réutiliser un domaine déjà possédé est préférable lorsqu’il existe.

Une fois le nom et sa propriété établis : vérifier le domaine côté GitHub ; configurer Pages pour ce nom ; ajouter les DNS appropriés ; vérifier le certificat et imposer HTTPS. Pour un sous-domaine, le CNAME DNS doit pointer vers nicolason84.github.io, sans /nova-trust. Pour un domaine racine, utiliser les enregistrements publiés par GitHub au moment de l’opération. Le site sert main:/docs ; un fichier de domaine ne doit donc pas être placé à la racine du dépôt par erreur.

Avant bascule : vérifier tous les liens et feeds relatifs, l’ancien lien GitHub Pages, les redirects, le JSON, le prerender, les exports et les mêmes tests publics. L’ancienne adresse peut rediriger ; sa disponibilité doit être contrôlée. Préparer le retour arrière DNS/Pages avec le domaine réel avant toute modification.

## Informations qui manquent pour distribuer

Le nom de domaine et son titulaire/fournisseur DNS ; l’autorité de la source native SUPRA ; le compte de distribution Apple et la méthode de test autorisée. Ces éléments ne bloquent pas la préparation, mais empêchent d’annoncer un domaine connecté ou une app distribuée.

## Références officielles consultées

- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages
- https://developer.apple.com/documentation/corehaptics
- https://developer.apple.com/documentation/swiftui/sensoryfeedback
- https://help.apple.com/xcode/mac/current/en.lproj/dev2539d985f.html
