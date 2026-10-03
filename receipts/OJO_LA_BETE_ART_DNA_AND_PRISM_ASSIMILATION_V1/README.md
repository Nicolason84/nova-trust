# La Bête — ADN artistique et prismes

L’identité canonique est `app/system_identity.json`. `docs/system_identity.json` en est une projection vérifiée, pas une seconde autorité.

## Réparations et intégration

Le shader déclare sa tension dans les deux étapes. Le bootstrap accepte html, body et le chemin canonique de secours. Les commandes sont ciblées par leur type de bouton pour ne jamais modifier le contenu de la racine HTML. L’identité absente ou incohérente reste explicite.

Palette, brume, surfaces, prismes CSS, verre SVG, matériaux et prismes Three.js proviennent de cet ADN. Les ailes sont géométriques ; l’image préexistante reste une signature secondaire. Les sources en alerte modulent la projection sans modifier les données. La seule boucle 3D préexistante est conservée et suspend le rendu hors écran. Les préférences de mouvement réduit, la pause et les effets allégés sont respectés.

Three.js reste à la version 0.180.0. Les deux modules npm non modifiés sont servis localement, avec leur licence MIT et des empreintes vérifiées, pour supprimer la dépendance d’exécution au CDN.

Les formes non parallèles affichent UNKNOWN dans toutes les sorties budgétaires liées au scénario ; les géométries suivent l’amplitude sélectionnée. Les chiffres de référence parallèles restent explicitement indépendants dans l’export. Un ancien succès du runner n’est plus présenté comme OK.

## Vérification reproductible

```sh
node scripts/test_la_bete_art_dna.cjs
node scripts/test_france_beast_hydration.cjs
node scripts/test_beast_resonance.cjs
python3 scripts/sync_system_identity.py --check
PYTHONPATH=scripts python3 scripts/test_system_identity.py
PYTHONPATH=scripts python3 scripts/test_france_beast_convergence.py
python3 scripts/verify_la_bete_evolution.py
```

`VALIDATION.json` décrit l’état avant publication. La publication et son statut se vérifient séparément dans GitHub Pages / Actions. `BROWSER_RESULTS.json` contient les résultats navigateur ; le test Spotify utilise une navigation de test et ne certifie pas la disponibilité ni la lecture audio du fournisseur. Aucun binaire, autorisation ou runtime natif SUPRA n’est modifié.
