# France / La Bête — non-régression

Verdict : **PASS**, sur la version publiée `fe5e000f52a1a9d6d687baffd38f29b8d75c06bc`, avec mises à jour de l’organisme préservées par `f5ef2d729e4b02b51965d79469ad7b441a31d02e`.

| Contrôle | Résultat et preuve |
|---|---|
| Vérité numérique | Observed, sensitivity, Decision Delta, maturity ladder, refinancing twin et curve history identiques au commit initial `6e983219`. La date documentaire DGFiP est réconciliée sur preuve ; la valeur brute est conservée. |
| Parsing DGFiP | Jour/mois français explicite, ISO inchangé, années bissextiles, dates invalides, document/période non concordants : PASS. |
| Claims typés / ProofGraph | Types existants conservés. Identités France/système/organe, observations et transformations ajoutées ; sources HTTPS et preuves résolues. Relations originales préservées. |
| Reality Pulse sans JS | Même JSON embarqué et même SHA-256 que le feed public. Courbe et preuves présentes ; runner UNKNOWN. Test réel navigateur JS OFF : PASS. |
| Hydratation | Canon frais accepté ; plus ancien ou politiquement/territorialement invalide rejeté. État conservé lors des pannes réseau : PASS. |
| Sources indisponibles | Véritable updater exécuté avec sources en panne dans un dossier temporaire : valeurs conservées, RETAINED_LAST_GOOD, vintage, raison, confiance et condition de remplacement. Aucun zéro fabriqué. |
| Runner / état matériel | API indisponible → UNKNOWN. Heartbeat distinct du changement matériel et de l’observation marché. |
| Mobile | 390 × 844 et 844 × 390, largeur réelle = largeur du viewport, aucun débordement du document ni ID dupliqué. Trois exports exercés : PASS. |
| Desktop | 1440 × 1000, courbe, preuves et trois exports exercés : PASS. |
| Mouvement réduit | Préférence activée, ADN calm et animations CSS bornées : PASS. |
| 3D | Canvas WebGL réellement créé dans Chrome isolé sur le Mac. Dans le navigateur cloud sans WebGL, message de secours et analyse accessibles. Caméra et capteurs non activés. |
| Évolution | Trois régimes existants testés. Candidate compilée, vérifiée ; mutation de vérité rejetée par le véritable vérificateur. Publication seulement après toutes les validations. |
| Rollback | Ancien HTML restauré byte pour byte en isolation. ADN précédent capturé ; évolution connue bonne restaurée et revérifiée byte pour byte. Aucun reset de production. |
| Neutralité / Human Gates | Pas de recommandation politique, ni promotion de claim sémantique, ni activation caméra/micro. Stress ≠ prévision ; national ≠ territorial sans preuve. |
| Corps / système nerveux | Événement MESSAGE_ROUTED réel ; organe RUNTIME_OBSERVED et impulsion causale retrouvés dans les sorties natives existantes. Tick suivant : NO_EVENT_NO_IMPULSE. |
| Pipelines coexistants | Course de push détectée entre organes existants ; retry fast-forward ajouté au workflow budget. Les deux workflows réussissent ensuite. |

Exécution locale : 9 tests de convergence, les trois régimes d’évolution et le vérificateur existant PASS. Exécution GitHub : les contrôles de génération, pré-rendu et convergence PASS. `PUBLIC_BROWSER_CHECKS.json` conserve sept résultats publics, dont les exports desktop/mobile et le feed/API injoignables.

Limites : test mobile par viewport Chrome, pas examen de Safari sur l’iPhone physique de Nicolas. Le contrôle automatique de cinq minutes utilise le watchdog existant et dépend du Mac éveillé et authentifié. Le cron GitHub natif est déclaré actif, mais aucune exécution native `schedule` n’a été observée. Le mode totalement hors ligne suppose un HTML déjà téléchargé ; aucun nouveau service worker n’a été ajouté.
