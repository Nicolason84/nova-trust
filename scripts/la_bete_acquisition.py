"""Bounded acquisition capability inside the existing evolution/mission pipeline.
No daemon, mailbox, database, credentials, autonomous permission or public write API.
The private executor must supply its authenticated Authority and MissionStore adapters.
"""
from __future__ import annotations
import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urlparse

SCHEMA = "LA_BETE_INFORMATION_ACQUISITION_V1"
PILOT_IDS = frozenset(("AFT_RSS", "AFT_MATURITY_OAT", "AFT_MATURITY_OATI", "AFT_MATURITY_OATEI"))
BAD_STATES = frozenset(("UNAVAILABLE", "DEGRADED", "CONTRADICTED"))


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def stamp(value):
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("TIMEZONE_REQUIRED")
    return dt.astimezone(timezone.utc)


def civic_mission():
    """Owner-defined purpose, not public representation or an execution mandate."""
    return {
      "id":"LA_BETE_CIVIC_MISSION_V1", "title":"Défendre les intérêts concrets des personnes",
      "mission":"Donner à chacun les moyens de comprendre, de faire entendre ses besoins et d’agir sur des faits vérifiables.",
      "authority":"NICOLAS_OWNER_DEFINED_PURPOSE_NOT_PUBLIC_REPRESENTATION",
      "status":"OWNER_DEFINED_MISSION", "external_authority_granted":False,
      "principles":[
        "Les personnes avant les indicateurs : expliciter qui est concerné, ce qui lui manque et le résultat utile recherché.",
        "Les faits avant l’adhésion : vérifier aussi ce qui contredit une proposition appréciée par le concepteur ou les utilisateurs.",
        "Pluralité : ne pas confondre majorité, popularité ou intérêt du concepteur avec l’intérêt de toutes les personnes.",
        "Indépendance non partisane : aucun soutien, opposition, score de candidats ou consigne électorale. Déclarer les intérêts et financements éventuels.",
        "Contradiction et correction : permettre une réponse, documenter les désaccords et corriger publiquement une erreur démontrée.",
        "Protection : limiter les données personnelles, ne pas publier un dossier privé, ne pas harceler ni accuser sans preuves.",
        "Engagement maîtrisé : chaque envoi, publication, enregistrement ou représentation exige une autorisation adaptée.",
        "Résultats vérifiables : compter les réponses utiles, informations corrigées et démarches abouties, pas seulement les vues ou messages envoyés."],
      "workflow":["Besoin exprimé ou manque documenté","Faits, contradictions et personnes concernées","Action proportionnée et mandat","Réponse et suivi","Résultat vérifié ou blocage explicite"],
      "limits":"Outil indépendant, pas une institution publique, un tribunal, un avocat ni un porte-parole élu. Aucun résultat juridique ou administratif n’est garanti.",
      "public_feedback":"Dialogue local ; fil GitHub public uniquement après relecture et consentement, sans données privées.",
      "current_execution":"Préparation et vérification ; envoi administratif et publication média non raccordés.",
      "outcomes_verified":0, "outcomes_scope":"Aucun résultat de défense individuelle n’est revendiqué par cette version."
    }

def build_initiatives(live):
    """Three explicit preparation rules in the existing pulse, not autonomous authority."""
    shared={"state":"DRAFT_READY", "external_action":"NOT_EXECUTED", "mandate":"NOT_CONFIGURED",
            "approval_required":"Identité, destinataire/canal, texte exact, périmètre, durée et limite de relances/publications.",
            "no_public_auto_adoption":True, "political_recommendation":"NONE", "cost_eur":0,
            "source_snapshot_id":live.get("snapshot_id"), "automatic_publication":False}
    subject="Proposition d’échange factuel sur les informations publiques de Nogent-sur-Oise"
    body="\n".join([
        "Bonjour,", "",
        "Je développe La Bête / ojO, un outil exploratoire qui relie des informations publiques à leurs sources, à leurs dates et à leurs limites. Il ne recommande aucun choix politique et ne note pas les élus.", "",
        "Nous souhaitons proposer un premier échange avec le service municipal compétent, ou avec le cabinet de la mairie, pour choisir ensemble un sujet utile à documenter : accès aux informations sur les équipements, projets publiés, démarches ou jeux de données municipaux.", "",
        "Pourriez-vous nous indiquer un référent et les publications officielles à consulter ? Notre première étape serait de vérifier les informations déjà publiques et de vous soumettre les questions encore ouvertes, sans présenter une hypothèse comme un fait.", "",
        "Aucune participation, validation ou collaboration de la commune n’est présumée. Un éventuel entretien enregistré, podcast ou vidéo ferait l’objet d’un accord distinct sur l’enregistrement, les citations et les modalités de diffusion. Nous ne sollicitons aucune donnée personnelle non publique.", "",
        "Si cette proposition n’entre pas dans vos priorités, un simple retour suffit ; aucune relance automatique n’est prévue à ce stade.", "",
        "Cordialement,", "[Identité, qualité et coordonnées de l’expéditeur à valider dans l’espace privé]"])
    outreach={**shared,"id":"LA_BETE_MUNICIPAL_DIALOGUE_60463_V1","kind":"OUTREACH",
      "title":"Explorer un sujet avec la mairie de Nogent-sur-Oise",
      "purpose":"Choisir un sujet local avec un interlocuteur volontaire et fiabiliser des informations publiques.",
      "trigger":"Les fiches territoriales ne décrivent pas encore les besoins, publications et sujets proposés par leurs services municipaux.",
      "channel":"EMAIL_DRAFT_ONLY","territory_code":"60463",
      "contact":{"organization":"Mairie de Nogent-sur-Oise","email":"contact@nogentsuroise.fr",
        "source_url":"https://lannuaire.service-public.gouv.fr/hauts-de-france/oise/d4afbbbd-a0db-474f-bfc3-273448b566ad",
        "official_website":"https://www.nogentsuroise.fr/","verified_on":"2026-10-03","recheck_before_send":True},
      "subject":subject,"draft":body,"draft_sha256":digest({"subject":subject,"body":body}),
      "next_action":"Revoir le brouillon et définir un mandat privé pour un premier envoi unique. Aucun maire nommé ni contacté automatiquement.",
      "success_evidence":"Réponse réelle, interlocuteur volontaire, sujet et sources définis ; pas seulement un mail envoyé."}
    transcript="\n\n".join([
      "La Bête — comprendre avant de conclure. Ceci est un projet de capsule pédagogique, pas une prise de position politique.",
      "Une fiche de commune donne des repères : son nom, son code géographique, son département et son intercommunalité. Les données disponibles peuvent aussi inclure une population, des codes postaux et un centre géographique. Il faut toujours examiner la source et le millésime : la date de récupération d’une réponse informatique n’est pas nécessairement la date de la mesure.",
      "Une donnée manquante n’autorise pas à inventer une réponse. Le taux d’intérêt national ne permet pas de déduire la situation financière d’une commune. Pour examiner un sujet local, il faut les documents du territoire, leur période et leur périmètre.",
      "La démarche proposée est simple : identifier le document utile, vérifier les publications accessibles, puis adresser une question précise au service compétent lorsqu’un mandat l’autorise. Une réponse reçue n’est pas automatiquement une information validée ; il faut encore en vérifier la provenance, la date et la portée.",
      "Un échange avec une mairie peut aider à choisir un sujet utile. Il ne vaut ni soutien politique, ni approbation de notre outil. Tout entretien enregistré et toute diffusion de paroles doivent être organisés séparément avec les participants.",
      "Dans La Bête, vous pouvez ouvrir un territoire, suivre ses relations, consulter les sources et proposer une question. Les propositions restent des propositions. Les choix et les engagements restent humains."])
    audio={**shared,"id":"LA_BETE_EDITORIAL_COMMUNE_AUDIO_V1","kind":"EDITORIAL",
      "title":"Podcast proposé · Lire une commune sans inventer ses réponses",
      "purpose":"Expliquer les sources, millésimes et limites d’une fiche territoriale.",
      "trigger":"L’ouverture des fiches territoriales appelle une explication accessible de leurs limites.",
      "channel":"PODCAST_SCRIPT_ONLY","transcript":transcript,"transcript_sha256":digest(transcript),
      "sources":[{"url":"https://geo.api.gouv.fr/decoupage-administratif/communes","label":"API Découpage administratif — champs des communes"},
        {"url":"https://www.insee.fr/fr/information/8740222","label":"Code officiel géographique 2026"}],
      "production":{"audio_file":None,"voice":"À choisir ; aucune imitation d’élu ou de participant","music":"Aucune musique tierce prévue","release":"Non publié"},
      "next_action":"Valider le texte, produire une voix autorisée, écouter le rendu puis approuver un canal de publication.",
      "success_evidence":"Fichier audio contrôlé, transcription et sources accessibles, autorisation et reçu de publication."}
    video={**shared,"id":"LA_BETE_EDITORIAL_EXPLORER_VIDEO_V1","kind":"EDITORIAL",
      "title":"Vidéo proposée · D’un territoire à une démarche vérifiable",
      "purpose":"Montrer l’exploration réelle plutôt que simuler une action extérieure réussie.",
      "trigger":"L’Atlas, les fiches et les démarches forment maintenant un parcours démontrable.",
      "channel":"VIDEO_STORYBOARD_ONLY","transcript":transcript,"transcript_sha256":digest(transcript),
      "storyboard":[
        {"shot":1,"scene":"La Bête au centre de l’Atlas","caption":"Explorer sans perdre le fil"},
        {"shot":2,"scene":"France → région → département → commune","caption":"Identifiants et périmètre réels"},
        {"shot":3,"scene":"Fiche communale et date de collecte","caption":"Population : millésime à distinguer de la date de collecte"},
        {"shot":4,"scene":"Source officielle et limite non documentée","caption":"Aucune situation locale déduite d’un taux national"},
        {"shot":5,"scene":"Brouillon d’initiative municipale","caption":"Préparé, pas envoyé"},
        {"shot":6,"scene":"Retour à la commune puis dialogue","caption":"Questions, preuves et accord avant publication"}],
      "sources":audio["sources"],"production":{"video_file":None,"voice":"À valider","participant_recording":False,"release":"Non publié"},
      "next_action":"Capturer le parcours réel, monter une version de revue avec sous-titres et sources, puis approuver sa diffusion.",
      "success_evidence":"Vidéo relue, sources datées, consentements éventuels et reçu du canal de diffusion."}
    for proposal in (outreach,audio,video):
        proposal["civic_contract"]={
          "mission_id":"LA_BETE_CIVIC_MISSION_V1",
          "beneficiaries":"Habitants, usagers et personnes cherchant à comprendre les informations publiques ; aucun groupe exclu selon ses opinions.",
          "need_status":"PROPOSITION_DU_CONCEPTEUR_A_CONFIRMER_AVEC_LES_PERSONNES",
          "benefit_to_verify":proposal["success_evidence"],
          "costs_and_tradeoffs":"Temps des interlocuteurs et des participants ; utilité et périmètre à confirmer avant sollicitation ou diffusion.",
          "contradiction":"Les personnes et organismes concernés peuvent apporter une correction, un désaccord ou refuser l’échange.",
          "verified_result":"NONE", "representation_mandate":"NONE"}
    return [outreach,audio,video]



def build_scic_institutional_blueprint():
    """Non-binding institutional design for a future SCIC.
    It encodes legal guardrails and an anti-capture constitution without
    creating the entity, adopting statutes or granting external authority.
    """
    return {
        "schema": "LA_BETE_SCIC_INSTITUTIONAL_BLUEPRINT_V1",
        "state": "CONSTITUTIONAL_DESIGN_PROPOSAL_NOT_ADOPTED",
        "binding_effect": False,
        "adoption": "HUMAN_GATE_REQUIRED",
        "legal_form": {
            "state": "UNDECIDED_HUMAN_GATE",
            "eligible_forms": ["SAS_A_CAPITAL_VARIABLE", "SARL_A_CAPITAL_VARIABLE", "SA_A_CAPITAL_VARIABLE"],
            "preferred_form": None,
            "reason": "La forme finale doit être choisie avec les statuts, le financement, les organes et une revue juridique/comptable.",
        },
        "membership": {
            "minimum_categories_required": 3,
            "mandatory_categories": [
                "BENEFICIARIES_OR_REGULAR_USERS",
                "EMPLOYEES_OR_IF_NONE_PRODUCERS_OF_GOODS_OR_SERVICES",
            ],
            "open_contributor_types": [
                "citoyens et usagers",
                "salariés et producteurs",
                "bénévoles et contributeurs",
                "associations et acteurs de l’ESS",
                "personnes publiques et territoires",
                "partenaires contribuant réellement au projet",
            ],
            "admission_and_exit_rules": "TO_DEFINE_IN_STATUTES",
        },
        "colleges": [
            {"id":"CITIZENS_USERS","label":"Citoyens & usagers","vote_weight_pct":30,"purpose":"Porter l’expérience des bénéficiaires, l’accessibilité, la correction et l’utilité concrète."},
            {"id":"WORKERS_PRODUCERS","label":"Travailleurs & producteurs","vote_weight_pct":20,"purpose":"Porter l’exécution, la soutenabilité du travail, la qualité de service et la faisabilité."},
            {"id":"CONTRIBUTORS_CIVIL_SOCIETY","label":"Contributeurs & société civile","vote_weight_pct":20,"purpose":"Porter les compétences, associations, communs, recherche, médiation et contradiction indépendante."},
            {"id":"PUBLIC_TERRITORIES","label":"Acteurs publics & territoires","vote_weight_pct":15,"purpose":"Porter l’intérêt territorial, l’interopérabilité publique et l’accès aux besoins collectifs sans tutelle politique."},
            {"id":"MISSION_PARTNERS_ESS","label":"Partenaires de mission & ESS","vote_weight_pct":15,"purpose":"Porter la pérennité économique et les coopérations sans acheter la vérité ni le contrôle."},
        ],
        "voting_guardrails": {
            "one_member_one_vote_within_college": True,
            "capital_may_weight_votes": False,
            "minimum_college_weight_pct": 10,
            "maximum_college_weight_pct": 50,
            "design_maximum_college_weight_pct": 30,
            "total_weight_pct": 100,
            "founder_supervote": False,
            "commercial_customer_vote_purchase": False,
        },
        "institutions": [
            {"id":"GENERAL_ASSEMBLY","label":"Assemblée générale des sociétaires","role":"Souveraineté coopérative, élections, comptes, grandes orientations et modifications statutaires selon les règles adoptées.","authority":"PROPOSED_NOT_CONSTITUTED"},
            {"id":"COOPERATIVE_COUNCIL","label":"Conseil coopératif","role":"Surveillance stratégique, arbitrage des priorités, contrôle de l’exécutif et préparation des décisions collectives.","authority":"PROPOSED_NOT_CONSTITUTED"},
            {"id":"PROOF_INTEGRITY_COUNCIL","label":"Conseil de preuve & d’intégrité","role":"Contrôle des sources, conflits d’intérêts, vie privée, non-partisanerie et respect des engagements protégés. Peut suspendre et renvoyer à réexamen, jamais réécrire un fait.","authority":"PROPOSED_NOT_CONSTITUTED"},
            {"id":"CITIZEN_FORUM","label":"Forum citoyen ouvert","role":"Questions, propositions, contradictions et auditions publiques. Consultatif : il ne prétend pas représenter juridiquement la population.","authority":"ADVISORY_PROPOSAL"},
            {"id":"EXECUTIVE","label":"Exécutif opérationnel","role":"Opérations quotidiennes, produits, partenariats et exécution des décisions dans les limites des mandats et Human Gates.","authority":"PROPOSED_NOT_CONSTITUTED"},
        ],
        "decision_constitution": {
            "verified_facts": "NOT_DECIDED_BY_VOTE",
            "ordinary_decisions": "PROPOSED_SIMPLE_MAJORITY_SUBJECT_TO_FINAL_STATUTES",
            "mission_or_constitutional_changes": "PROPOSED_TWO_THIRDS_AND_CROSS_COLLEGE_MAJORITY_SUBJECT_TO_FINAL_STATUTES",
            "truth_source_or_claim_changes": "EVIDENCE_PROTOCOL_PLUS_HUMAN_GATE_NOT_POPULAR_VOTE",
            "external_action_for_a_person": "EXPLICIT_MANDATE_REQUIRED",
            "commercial_framework": "CONFLICT_REVIEW_TRANSPARENCY_AND_COOPERATIVE_APPROVAL_REQUIRED",
        },
        "protected_commitments": [
            "Le bien commun public, ses sources, ses preuves et ses limites restent gratuitement accessibles.",
            "Aucun paiement, apport en capital, sponsor ou client ne peut acheter une vérité, un classement ou une recommandation politique.",
            "Un vote ne peut pas transformer une hypothèse en fait vérifié ni supprimer une contradiction documentée.",
            "Les données privées réelles restent séparées de l’origine publique et sont traitées sous minimisation et mandat.",
            "Aucune représentation, démarche externe ou engagement au nom d’une personne sans mandat explicite.",
            "La Bête reste indépendante des partis et ne devient ni service de l’État, ni porte-parole élu, ni tribunal.",
            "Les corrections démontrées, conflits d’intérêts et limites significatives doivent être traçables.",
            "La structure commerciale éventuelle ne peut contrôler le noyau public par simple puissance financière.",
        ],
        "anti_capture": [
            "Aucun collège ne dépasse 30 % dans cette proposition, plus strict que le plafond légal applicable aux collèges pondérés.",
            "Le capital ne pondère pas les droits de vote.",
            "Aucun super-vote permanent du fondateur n’est créé par ce modèle.",
            "Toute relation économique significative doit déclarer bénéficiaire, montant, objet, conflit potentiel et contrepartie.",
            "Le conseil de preuve & d’intégrité peut demander suspension et réexamen d’une décision incompatible avec les engagements protégés.",
            "Les changements constitutionnels proposés exigent une majorité transversale et restent soumis aux statuts et au droit applicables.",
        ],
        "economics": {
            "statutory_reserve_min_after_legal_reserve_pct": 50,
            "public_core": "FREE_COMMON_GOOD",
            "private_services": "OPTIONAL_SEPARATE_OR_INTERNAL_ECONOMIC_ACTIVITY_TO_VALIDATE",
            "commercial_bridge": "AGREEMENT_OR_STRUCTURE_TO_VALIDATE_BEFORE_EXECUTION",
            "contribution_rate_to_common_good": "TO_BE_VOTED_NOT_PRECOMMITTED",
            "exclusive_transfer_of_public_truth_control": "FORBIDDEN_BY_DESIGN",
            "financial_flows_publication": "PROPOSED_TRANSPARENCY_RULE",
        },
        "transparency": [
            "Rapport annuel sur l’évolution du projet coopératif.",
            "Publication des collèges, règles de vote et composition des organes après constitution.",
            "Registre public des décisions structurantes, résultats de vote et réserves d’intégrité, sous protection des données personnelles.",
            "Publication des financements, subventions, conventions et flux significatifs entre bien commun et activité commerciale.",
            "Journal public des corrections majeures, changements de politique de preuve et incidents affectant le bien commun.",
        ],
        "formation_path": [
            {"step":1,"label":"Valider la charte de mission et les engagements protégés","state":"PROPOSAL_READY_HUMAN_GATE"},
            {"step":2,"label":"Choisir la forme juridique SCIC et le schéma économique","state":"NOT_EXECUTED_HUMAN_GATE"},
            {"step":3,"label":"Identifier les associés fondateurs dans au moins trois catégories conformes","state":"NOT_EXECUTED_HUMAN_GATE"},
            {"step":4,"label":"Arbitrer collèges, pondérations, admission, sortie et organes","state":"NOT_EXECUTED_HUMAN_GATE"},
            {"step":5,"label":"Rédiger statuts, pactes/conventions utiles et règles de conflit d’intérêts","state":"NOT_EXECUTED_HUMAN_GATE"},
            {"step":6,"label":"Faire relire le montage juridique, fiscal, social, comptable, données et assurances","state":"NOT_EXECUTED_HUMAN_GATE"},
            {"step":7,"label":"Tenir l’assemblée constitutive et réaliser les formalités d’immatriculation","state":"NOT_EXECUTED_EXTERNAL_ACTION"},
            {"step":8,"label":"Activer le registre public de gouvernance et les contrôles institutionnels","state":"AFTER_VERIFIED_REGISTRATION_ONLY"},
        ],
        "legal_basis": [
            {"article":"Loi 47-1775 · art. 19 quinquies","rule":"Une SCIC peut prendre la forme SA, SAS ou SARL à capital variable et poursuit un intérêt collectif à utilité sociale.","url":"https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000029321359"},
            {"article":"Loi 47-1775 · art. 19 septies","rule":"Au moins trois catégories d’associés ; bénéficiaires obligatoires et salariés, ou producteurs en l’absence de salariés.","url":"https://www.legifrance.gouv.fr/codes/section_lc/JORFTEXT000000684004/LEGISCTA000006084034/"},
            {"article":"Loi 47-1775 · art. 19 octies","rule":"Collèges possibles à trois ou plus ; pondération 10–50 % par collège et capital non utilisé comme critère de pondération.","url":"https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000025559897"},
            {"article":"Loi 47-1775 · art. 19 nonies","rule":"Réserve statutaire annuelle au moins égale à 50 % des sommes disponibles après réserve légale.","url":"https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000049720082"},
            {"article":"Loi 47-1775 · art. 19 terdecies","rule":"Le rapport de gestion ou rapport annuel rend compte de l’évolution du projet coopératif.","url":"https://www.legifrance.gouv.fr/codes/section_lc/JORFTEXT000000684004/LEGISCTA000006084034/"},
        ],
    }


def tally_scic_ballot(blueprint, ballot, decision_class="ORDINARY"):
    """Pure tally. Ballots cannot target facts or execute anything.
    Counts are aggregate inputs; voter identities never belong in public truth.
    """
    rules = {
        "ORDINARY": {"support_pct": 50.0, "positive_colleges": 3, "college_quorum_pct": 20.0},
        "CONSTITUTIONAL": {"support_pct": 66.6667, "positive_colleges": 4, "college_quorum_pct": 33.3333},
    }
    if decision_class not in rules:
        raise ValueError("DECISION_CLASS_NOT_VOTABLE")
    colleges = {x["id"]: x for x in blueprint.get("colleges", [])}
    rows = ballot.get("colleges", {})
    if set(rows) != set(colleges):
        raise ValueError("BALLOT_COLLEGE_SET_MISMATCH")
    threshold = rules[decision_class]
    weighted_support = 0.0
    positive = 0
    quorum_failures = []
    public_rows = []
    for college_id, college in colleges.items():
        row = rows[college_id]
        eligible = int(row.get("eligible", 0))
        yes = int(row.get("yes", 0))
        no = int(row.get("no", 0))
        abstain = int(row.get("abstain", 0))
        if min(eligible, yes, no, abstain) < 0 or yes + no + abstain > eligible:
            raise ValueError("INVALID_BALLOT_COUNTS")
        turnout = (yes + no + abstain) / eligible * 100.0 if eligible else 0.0
        decisive = yes + no
        support = yes / decisive * 100.0 if decisive else 0.0
        quorum_met = turnout + 1e-9 >= threshold["college_quorum_pct"]
        if not quorum_met:
            quorum_failures.append(college_id)
        if quorum_met and support > 50.0:
            positive += 1
        weighted_support += college["vote_weight_pct"] * support / 100.0
        public_rows.append({
            "college_id": college_id,
            "label": college["label"],
            "weight_pct": college["vote_weight_pct"],
            "eligible": eligible,
            "turnout_pct": round(turnout, 2),
            "yes": yes,
            "no": no,
            "abstain": abstain,
            "support_pct": round(support, 2),
            "quorum_met": quorum_met,
        })
    passed = (
        not quorum_failures
        and weighted_support + 1e-9 >= threshold["support_pct"]
        and positive >= threshold["positive_colleges"]
    )
    return {
        "schema": "LA_BETE_SCIC_BALLOT_TALLY_V1",
        "decision_class": decision_class,
        "passed": passed,
        "weighted_support_pct": round(weighted_support, 2),
        "positive_colleges": positive,
        "required_positive_colleges": threshold["positive_colleges"],
        "required_support_pct": threshold["support_pct"],
        "college_quorum_pct": threshold["college_quorum_pct"],
        "quorum_failures": quorum_failures,
        "colleges": public_rows,
        "identity_data_published": False,
        "capital_weighting_used": False,
    }



def build_production_privacy_gate_projection():
    """Public projection of the fail-closed production privacy gate.

    Cryptographic primitive conformance and executable runtime adapters are proven
    in CI. Production remains blocked until the independent network, anonymity
    policy, HSM custody and external review gates are satisfied.
    """
    return {
        "schema":"LA_BETE_SCIC_PRODUCTION_PRIVACY_GATE_V1",
        "state":"IMPLEMENTED_FAIL_CLOSED",
        "production_activation":False,
        "current_verdict":"BLOCKED",
        "cryptographic_gate":{
            "state":"RFC9474_RFC9578_CI_PASS_RUNTIME_BOUND",
            "profile":"RFC9578_PUBLICLY_VERIFIABLE_BLIND_RSA_TOKEN_TYPE_0x0002",
            "variant":"RSABSSA-SHA384-PSS-Deterministic",
            "backend":"CLOUDFLARE_CIRCL",
            "backend_version":"v1.6.5",
            "project_ci":"PASS",
            "upstream_rfc9474_vectors":"PASS",
            "standard_rsa_pss_crosscheck":"PASS",
            "runtime_binding":"PROVEN_CI_SIDECAR",
            "workflow":".github/workflows/scic-production-privacy-gate.yml",
            "go_module":"privacy/rfc9474_gate",
        },
        "network_gate":{
            "profile":"RFC9458_OHTTP_OR_EQUIVALENT_INDEPENDENT_RELAY",
            "state":"RFC9458_RUNTIME_PROVEN_DEPLOYMENT_NOT_CONFIGURED",
            "runtime_binding":"PROVEN_CI_THREE_PROCESS_RFC9458",
            "backend":"MARTINTHOMSON_OHTTP",
            "backend_version":"0.8.0",
            "relay_plaintext_probe":False,
            "relay_gateway_same_operator_allowed":False,
            "https_both_hops_required":True,
            "relay_may_forward_identifying_headers":False,
            "fresh_hpke_context_per_request_required":True,
            "padding_policy":"NOT_APPROVED",
        },
        "anonymity_gate":{
            "state":"PERSISTENT_RUNTIME_PROVEN_POLICY_NOT_APPROVED",
            "mechanism":"FIXED_WINDOW_OPAQUE_ENVELOPE_BATCH",
            "runtime_binding":"PROVEN_PERSISTENT_SQLITE_OPAQUE_BATCHER",
            "persistence_restart_proven":True,
            "small_set_behavior":"ROLL_FORWARD",
            "production_minimum_set_size":"UNSET_REQUIRES_PRIVACY_REVIEW",
            "production_window_seconds":"UNSET_REQUIRES_PRIVACY_REVIEW",
            "small_set_release":"FORBIDDEN",
            "individual_public_timestamps":False,
            "synthetic_batch_mechanics":"SUPERSEDED_BY_PERSISTENT_RUNTIME_PROOF",
        },
        "key_gate":{
            "state":"CONTRACT_IMPLEMENTED_CURRENT_PROVIDER_BLOCKED",
            "contract":"LA_BETE_SCIC_KEY_CUSTODY_GATE_V1",
            "current_provider":"FILE_TEST_ONLY",
            "custody_verdict":"BLOCKED",
            "issuer_private_key_non_exportable_required":True,
            "rotation_policy":"NOT_APPROVED",
            "compromise_runbook":"NOT_APPROVED",
        },
        "review_gate":{
            "internal_threat_model":"V1_COMPLETE",
            "audit_pack":"READY_FOR_EXTERNAL_REVIEW",
            "external_cryptographic_review":"NOT_COMPLETED",
            "privacy_threat_model_review":"NOT_COMPLETED",
            "independent_relay_operator":"NOT_VERIFIED",
        },
        "blocking_reasons":[
            "OHTTP_INDEPENDENT_RELAY_NOT_DEPLOYED",
            "OHTTP_REAL_HTTPS_HOPS_NOT_PROVEN",
            "OHTTP_HEADER_MINIMIZATION_NOT_DEPLOYMENT_PROVEN",
            "OHTTP_PADDING_POLICY_NOT_APPROVED",
            "ANONYMITY_SET_POLICY_NOT_APPROVED",
            "BATCH_WINDOW_NOT_APPROVED",
            "HSM_KEY_CUSTODY_NOT_PROVEN",
            "KEY_ROTATION_AND_DESTRUCTION_DRILLS_NOT_PROVEN",
            "EXTERNAL_CRYPTO_REVIEW_NOT_COMPLETED",
            "PRIVACY_THREAT_MODEL_EXTERNAL_REVIEW_NOT_COMPLETED",
        ],
        "standards":[
            "RFC9474_RSA_BLIND_SIGNATURES",
            "RFC9578_PRIVACY_PASS_ISSUANCE_PUBLICLY_VERIFIABLE_BLIND_RSA",
            "RFC9576_PRIVACY_PASS_ARCHITECTURE",
            "RFC9458_OBLIVIOUS_HTTP",
        ],
    }

def build_scic_democracy(blueprint):
    """Operational democratic protocol in pre-constitution dry-run mode.
    It reuses the hybrid projection and existing public contribution channel.
    No legal membership, binding vote, external mandate or execution is created.
    """
    fixture_ballot = {
        "kind": "TEST_FIXTURE_NOT_REAL_PEOPLE",
        "colleges": {
            "CITIZENS_USERS": {"eligible": 10, "yes": 7, "no": 2, "abstain": 1},
            "WORKERS_PRODUCERS": {"eligible": 10, "yes": 6, "no": 3, "abstain": 1},
            "CONTRIBUTORS_CIVIL_SOCIETY": {"eligible": 10, "yes": 8, "no": 1, "abstain": 1},
            "PUBLIC_TERRITORIES": {"eligible": 10, "yes": 6, "no": 2, "abstain": 2},
            "MISSION_PARTNERS_ESS": {"eligible": 10, "yes": 7, "no": 2, "abstain": 1},
        },
    }
    tally = tally_scic_ballot(blueprint, fixture_ballot, "ORDINARY")
    lifecycle = [
        {"order":1,"state":"DRAFT","label":"Proposition","gate":"AUTHOR_IDENTIFIED_OR_PUBLIC_PSEUDONYM"},
        {"order":2,"state":"ADMISSIBILITY_REVIEW","label":"Recevabilité","gate":"VOTABLE_DOMAIN_AND_CONSTITUTION_CHECK"},
        {"order":3,"state":"OPEN_DEBATE","label":"Débat contradictoire","gate":"ARGUMENTS_AND_CONFLICTS_VISIBLE"},
        {"order":4,"state":"AMENDMENT_WINDOW","label":"Amendements","gate":"NORMATIVE_TEXT_ONLY"},
        {"order":5,"state":"BALLOT_FROZEN","label":"Texte figé","gate":"FINAL_TEXT_HASH_AND_EVIDENCE_SNAPSHOT"},
        {"order":6,"state":"VOTING_OPEN","label":"Vote par collèges","gate":"VERIFIED_MEMBER_ONE_VOTE_WITHIN_COLLEGE"},
        {"order":7,"state":"DECIDED","label":"Décision","gate":"QUORUM_THRESHOLD_AND_INTEGRITY_REVIEW"},
        {"order":8,"state":"MANDATE_PENDING","label":"Mandat","gate":"EXPLICIT_SCOPE_BUDGET_DURATION_RESPONSIBLE"},
        {"order":9,"state":"EXECUTING","label":"Exécution","gate":"AUTHORITY_RECEIPT_IF_EXTERNAL_ACTION"},
        {"order":10,"state":"RESULT_RECORDED","label":"Résultat public","gate":"EVIDENCE_OUTCOME_INCIDENTS_AND_CORRECTIONS"},
        {"order":11,"state":"REVIEW_CLOSED","label":"Réexamen","gate":"POST_RESULT_REVIEW"},
    ]
    pilot = {
        "id": "SCIC_DEMOCRACY_DRY_RUN_001",
        "state": "RESULT_RECORDED",
        "binding": False,
        "title": "Publier un registre public des décisions et de leurs résultats pendant la phase pré-constitution",
        "decision_class": "ORDINARY",
        "votable_domain": "GOVERNANCE_PROCEDURE",
        "author": "SYSTEM_TEST_FIXTURE_NOT_A_SOCIATE",
        "problem": "Prouver qu’une décision coopérative peut être instruite, débattue, amendée, comptée et suivie sans soumettre la vérité au vote.",
        "requested_decision": "Adopter le protocole de registre public comme règle expérimentale non contraignante jusqu’à la constitution juridique.",
        "evidence_snapshot": [
            "Loi 47-1775 art. 1 : gouvernance démocratique et voix des membres.",
            "Loi 47-1775 art. 19 octies : voix, collèges et pondération hors capital.",
            "Blueprint LA_BETE_SCIC_INSTITUTIONAL_BLUEPRINT_V1 : vérité hors vote et Human Gates.",
        ],
        "debate": {
            "state": "DRY_RUN_FIXTURE",
            "arguments_for": [
                "Rendre visibles le texte décidé, les seuils, les conflits et le résultat.",
                "Permettre un contrôle après exécution au lieu de s’arrêter au vote.",
            ],
            "arguments_against": [
                "Un registre public peut devenir lourd si chaque micro-décision y entre.",
                "La transparence doit préserver les données personnelles et les discussions confidentielles légitimes.",
            ],
            "questions": [
                "Quelles décisions méritent une publication intégrale ?",
                "Quel délai de réexamen appliquer après le résultat ?",
            ],
        },
        "amendments": [
            {
                "id":"A1",
                "kind":"NORMATIVE_CHANGE",
                "text":"Limiter le registre aux décisions structurantes et publier les résultats sous forme agrégée lorsque des données personnelles sont en jeu.",
                "state":"ACCEPTED_IN_DRY_RUN",
                "changes_evidence":False,
            }
        ],
        "ballot": fixture_ballot,
        "tally": tally,
        "decision": {
            "state": "DRY_RUN_PASSED" if tally["passed"] else "DRY_RUN_NOT_PASSED",
            "binding": False,
            "legal_effect": "NONE",
            "text_hash_required_for_real_vote": True,
        },
        "mandate": {
            "state":"NOT_GRANTED_DRY_RUN",
            "responsible":"NONE",
            "scope":"NONE",
            "budget_cap_eur":0,
            "duration":"NONE",
            "external_action":"NOT_AUTHORIZED",
        },
        "execution": {
            "state":"NOT_EXECUTED",
            "external_action_performed":False,
            "reason":"Dry-run institutionnel uniquement.",
        },
        "result": {
            "state":"DRY_RUN_PIPELINE_PROVEN",
            "outcome":"Le mécanisme de décision est calculable et traçable ; aucun vote réel de sociétaire ni acte externe n’est revendiqué.",
            "evidence":["30+ tests métier/SCIC attendus","navigateur réel attendu","registre public agrégé"],
            "correction_open":True,
        },
    }
    return {
        "schema":"LA_BETE_SCIC_DEMOCRACY_V1",
        "mode":"PRE_CONSTITUTION_OPERATIONAL_DRY_RUN",
        "state":"OPERABLE_NON_BINDING",
        "binding_effect":False,
        "legal_activation":"AFTER_VERIFIED_SCIC_REGISTRATION_AND_ADOPTED_STATUTES",
        "same_runtime":True,
        "second_registry":False,
        "public_record_location":"hybrid_model.cooperative_direction.democracy.public_result_registry",
        "membership":{
            "current_legal_societaires":0,
            "preconstitution_participant_status":"PARTICIPANT_NOT_LEGAL_ASSOCIATE",
            "states":["APPLICANT","ELIGIBILITY_REVIEW","ADMISSION_DECISION","CREDENTIAL_ISSUED","ACTIVE","SUSPENDED","EXITED"],
            "identity_verification":"EXISTING_PRIVATE_CITIZEN_PILOT_WEBAUTHN_PLUS_SEPARATE_IDENTITY_VERIFIER",
            "eligibility_verification":"PRIVATE_EVIDENCE_ENCRYPTED_NEVER_PUBLIC",
            "admission_authority":"SEPARATE_PRIVATE_AUTHORITY_REQUIRED_NOT_SELF_SERVICE",
            "public_identity":"KEYED_PSEUDONYMOUS_MEMBER_RECEIPT_NO_PII",
            "one_member_one_vote_within_college":True,
            "college_assignment":"VERIFIED_RULE_BASED_NOT_SELF_SELECTED_FOR_VOTE",
            "real_enrollment_open":False,
            "pilot_state":"SYNTHETIC_PRIVATE_MEMBERSHIP_PIPELINE_IMPLEMENTED",
            "public_receipt_fields":["member_public_id","college","status","issued_at","review_due","eligibility_attestation"],
            "public_receipt_forbidden_fields":["name","address","email","civil_identity","eligibility_evidence","passkey_id"],
        },
        "truth_firewall":{
            "principle":"THE_MAJORITY_CHOOSES_ACTIONS_NOT_FACTS",
            "votable_classes":["NORMATIVE_CHOICE","RESOURCE_ALLOCATION","GOVERNANCE_RULE","SERVICE_PRIORITY","MANDATE_POLICY"],
            "never_votable_classes":["OBSERVED_FACT","SOURCE_PROVENANCE","EVIDENCE_STATUS","DATE","IDENTITY_FACT","CONFIDENCE_SCORE","LEGAL_FACT"],
            "evidence_correction_route":"EXISTING_PROOF_AND_CANONICAL_VERIFICATION_PIPELINE",
            "ballot_may_change_evidence":False,
            "amendment_may_change_evidence":False,
            "integrity_council_may_rewrite_truth":False,
        },
        "lifecycle":lifecycle,
        "debate_protocol":{
            "argument_types":["FOR","AGAINST","QUESTION","CONFLICT_OF_INTEREST","EVIDENCE_LINK"],
            "required_before_ballot":["FINAL_TEXT","CONTRADICTIONS","AFFECTED_GROUPS","ESTIMATED_COSTS","CONFLICTS","EVIDENCE_SNAPSHOT"],
            "personal_attacks":"FORBIDDEN_BY_MODERATION_RULE",
            "private_data":"FORBIDDEN_ON_PUBLIC_ORIGIN",
            "minority_position_preserved":True,
        },
        "amendment_protocol":{
            "types":["NORMATIVE_CHANGE","SCOPE_CHANGE","BUDGET_CHANGE","TIMING_CHANGE"],
            "fact_or_source_change":"REDIRECT_TO_EVIDENCE_CORRECTION_NOT_AMENDMENT",
            "final_text_hash_required":True,
        },
        "ballot_protocol":{
            "secret_ballot_for_real_members":True,
            "public_output":"AGGREGATED_BY_COLLEGE",
            "identity_publication":False,
            "member_public_id_in_ballot":False,
            "one_time_private_ballot_token":True,
            "token_replay":"REJECTED",
            "direct_membership_server_ballot_token_route":"CLOSED",
            "anonymous_credential":{
                "schema":"LA_BETE_SCIC_BLIND_BALLOT_ARCHITECTURE_V1",
                "state":"SYNTHETIC_CRYPTOGRAPHIC_PROOF_IMPLEMENTED",
                "production_activation":False,
                "architecture":["MEMBERSHIP_AUTHORITY","BLIND_ISSUER","BALLOT_BOX"],
                "separate_processes_proven":True,
                "separate_stores_proven":True,
                "membership_authority_output":"SIGNED_RANDOM_ENTITLEMENT_NO_IDENTITY",
                "blind_issuer_input":"ELECTION_COLLEGE_ENTITLEMENT_PLUS_BLINDED_MESSAGE",
                "ballot_box_input":"ELECTION_COLLEGE_UNBLINDED_TOKEN_PLUS_CHOICE",
                "issuer_receives_member_identity":False,
                "issuer_receives_member_public_id":False,
                "issuer_receives_ballot_serial":False,
                "ballot_box_receives_entitlement":False,
                "ballot_box_receives_member_identity":False,
                "ballot_box_receives_member_public_id":False,
                "same_college_anonymity_set_proven":2,
                "transcript_token_matching":"UNDETERMINED_BY_BLIND_SIGNATURE_RELATION_IN_SYNTHETIC_PROOF",
                "compatibility_matrix":"ALL_ISSUANCE_TRANSCRIPTS_COMPATIBLE_WITH_ALL_VALID_SAME_KEY_TOKENS",
                "scheme":"CHAUM_STYLE_RAW_RSA_RESEARCH_PROOF",
                "rfc9474_reference":"RFC_9474_RSA_BLIND_SIGNATURES",
                "rfc9474_conformance":False,
                "standard_backend_target":"CLOUDFLARE_CIRCL_V1_6_5",
                "standard_backend_ci":"PASS_RFC9474_RFC9578",
                "standard_backend_runtime_binding":"PROVEN_CI_SIDECAR_NOT_PRODUCTION_ACTIVATED",
                "privacy_pass_reference":"RFC_9576_ISSUANCE_REDEMPTION_SEPARATION",
                "metadata_unlinkability":"NOT_PROVEN_TIMING_IP_TLS_FINGERPRINT_AND_SMALL_ANONYMITY_SETS_REMAIN",
                "production_requirement":"AUDITED_RFC_GRADE_BLIND_SIGNATURE_OR_ANONYMOUS_CREDENTIAL_PLUS_METADATA_SEPARATION",
                "selective_revocation_after_issue":False,
                "revocation_model":"SHORT_LIVED_ELECTION_SPECIFIC_CREDENTIALS_AND_FUTURE_ISSUANCE_BLOCK",
            },
            "public_registry_unlinkability":"PROVEN_IN_SYNTHETIC_PRIVATE_PILOT",
            "issuer_level_cryptographic_unlinkability":"PROVEN_FOR_SIGNATURE_TRANSCRIPT_MATCHING_IN_SYNTHETIC_MULTI_MEMBER_SAME_COLLEGE_PROOF",
            "issuer_level_metadata_unlinkability":"NOT_PROVEN",
            "ordinary":{"support_pct":50.0,"positive_colleges":3,"college_quorum_pct":20.0},
            "constitutional":{"support_pct":66.6667,"positive_colleges":4,"college_quorum_pct":33.3333},
            "protected_commitments_overrideable_by_ballot":False,
            "capital_weighting":False,
        },
        "production_privacy_gate":build_production_privacy_gate_projection(),
        "decision_to_execution":{
            "vote_is_execution":False,
            "mandate_required":True,
            "mandate_fields":["decision_id","responsible","scope","budget_cap","start","expiry","external_action_permissions"],
            "external_action_requires_authority_receipt":True,
            "budget_payment_or_contract_requires_separate_human_gate":True,
            "automatic_external_action":False,
        },
        "public_result_registry":[
            {
                "decision_id":pilot["id"],
                "kind":"DRY_RUN_NOT_REAL_MEMBER_VOTE",
                "decision_state":pilot["decision"]["state"],
                "execution_state":pilot["execution"]["state"],
                "result_state":pilot["result"]["state"],
                "binding":False,
                "correction_open":True,
            }
        ],
        "participation":{
            "public_proposal_channel":"EXISTING_GITHUB_ISSUES_AFTER_USER_CONSENT",
            "proposal_template":".github/ISSUE_TEMPLATE/scic-proposal.yml",
            "proposal_url":"https://github.com/Nicolason84/nova-trust/issues/new?template=scic-proposal.yml",
            "public_debate":"ISSUE_THREAD_WITH_MODERATION_AND_NO_PRIVATE_DATA",
            "binding_vote_channel":"NOT_OPEN_UNTIL_VERIFIED_MEMBERSHIP_AND_SCIC_ACTIVATION",
            "contextual_dialogue":"PREPARE_AND_CLARIFY_ONLY_NOT_A_BALLOT",
        },
        "pilot":pilot,
    }


def build_hybrid_model(live, acquisition):
    """Project the SCIC/common-good + optional private-service model inside the
    existing verified evolution. It creates no legal entity, payment rail,
    customer account, private datastore or second autonomous runtime.
    """
    if live.get("schema") != "OJO_FRANCE_DEBT_RATE_LIVE_V1":
        raise ValueError("CANONICAL_POLICY_MISMATCH")
    if acquisition.get("schema") != SCHEMA or acquisition.get("source_snapshot_id") != live.get("snapshot_id"):
        raise ValueError("ACQUISITION_SNAPSHOT_MISMATCH")
    if acquisition.get("automatic_truth_change") is not False:
        raise ValueError("AUTOMATIC_TRUTH_CHANGE_FORBIDDEN")

    gap_count = len(acquisition.get("requests", []))
    initiative_count = len(acquisition.get("initiatives", []))
    warnings = int(live.get("summary", {}).get("warnings", 0) or 0)
    if gap_count:
        next_move = {
            "id": "PUBLIC_ACTION_PATH",
            "state": "PROPOSAL_ONLY",
            "reason": f"{gap_count} démarche(s) publique(s) préparée(s) restent sans envoi ni mandat.",
            "action": "Rendre la chaîne preuve → manque → démarche → résultat plus lisible et mesurable, sans exécuter l’action extérieure.",
        }
    elif warnings:
        next_move = {
            "id": "EVIDENCE_STRENGTHENING",
            "state": "PROPOSAL_ONLY",
            "reason": f"{warnings} source(s) demandent encore une attention explicite.",
            "action": "Renforcer les preuves, limites et voies de correction avant toute extension de service.",
        }
    else:
        next_move = {
            "id": "CIVIC_FEEDBACK_LEARNING",
            "state": "PROPOSAL_ONLY",
            "reason": "Aucun manque de source prioritaire n’est actuellement préparé.",
            "action": "Observer les retours citoyens consentis et proposer des améliorations bornées sans déduire une demande commerciale des simples visites.",
        }

    blueprint = build_scic_institutional_blueprint()
    democracy = build_scic_democracy(blueprint)
    return {
        "schema": "LA_BETE_HYBRID_COMMON_GOOD_SERVICE_MODEL_V1",
        "source_snapshot_id": live.get("snapshot_id"),
        "mode": "PUBLIC_COMMON_GOOD_PLUS_OPTIONAL_PRIVATE_SERVICES",
        "public_common_good": {
            "access": "FREE",
            "always_free": True,
            "paywall": False,
            "scope": [
                "Information publique sourcée et niveaux de confiance",
                "Atlas, sources, preuves, chronologies et limites",
                "Dialogue, contradiction, correction et participation citoyenne publique",
                "Préparation de démarches portant sur des informations et services publics",
            ],
            "saleable_public_truth": False,
            "saleable_political_influence": False,
            "commercial_priority_may_reorder_truth": False,
        },
        "cooperative_direction": {
            "label": "Direction coopérative de type SCIC",
            "state": "TO_FORMALIZE_NOT_A_VERIFIED_REGISTERED_ENTITY",
            "mission": "Protéger durablement le bien commun public, la pluralité des parties prenantes et la capacité de correction.",
            "governance_direction": "Gouvernance multi-parties à formaliser juridiquement avant tout engagement.",
            "public_asset_transfer": "NOT_EXECUTED",
            "statutes": "NOT_ADOPTED_BY_THIS_RUNTIME",
            "institutional_blueprint": blueprint,
            "democracy": democracy,
        },
        "private_services": {
            "state": "DESIGN_ONLY_NOT_FOR_SALE",
            "customer_onboarding": "NOT_OPEN",
            "pricing": None,
            "payment": "NOT_CONNECTED",
            "real_private_documents": "NOT_ACCEPTED_ON_PUBLIC_ORIGIN",
            "requires_separate_private_boundary": True,
            "families": [
                {
                    "id": "BANK_INSURANCE_MEDIATION_SUPPORT",
                    "label": "Banque, assurance et médiation",
                    "scope": "Organisation des faits et pièces, chronologie, brouillons, réclamations et suivi documentaire sous mandat.",
                },
                {
                    "id": "ADMINISTRATIVE_CASE_SUPPORT",
                    "label": "Dossiers administratifs",
                    "scope": "Préparation, vérification de complétude et suivi d’un dossier autorisé par la personne.",
                },
                {
                    "id": "DOCUMENTARY_LEGAL_LIGHT",
                    "label": "Information juridique et préparation documentaire",
                    "scope": "Information générale, chronologie, pièces et brouillons; aucun acte réservé n’est revendiqué.",
                },
                {
                    "id": "QUALIFIED_PROFESSIONAL_HANDOFF",
                    "label": "Relais vers professionnel qualifié",
                    "scope": "Lorsque la matière exige un professionnel réglementé, préparer le dossier et transmettre uniquement avec accord.",
                },
            ],
            "reserved_legal_acts": "EXCLUDED_UNLESS_HANDLED_BY_A_QUALIFIED_PROFESSIONAL",
            "external_action": "HUMAN_MANDATE_REQUIRED",
        },
        "economic_bridge": {
            "state": "DIRECTION_NOT_EXECUTED",
            "principle": "Des revenus de services privés pourront contribuer à la pérennité du bien commun public, sous séparation juridique, comptable et de gouvernance à formaliser.",
            "public_information_remains_free": True,
            "commercial_customer_may_buy_public_truth": False,
            "commercial_customer_may_buy_political_output": False,
            "conflict_disclosure_required": True,
        },
        "autoevolution": {
            "engine": "EXISTING_OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1",
            "second_runtime": False,
            "cycle": ["observer", "détecter un manque documenté", "compiler une proposition bornée", "tester la non-régression", "exposer sans auto-autorisation"],
            "signals": {
                "documented_public_requests": gap_count,
                "prepared_civic_initiatives": initiative_count,
                "source_warnings": warnings,
                "private_service_demand": "UNPROVEN_UNTIL_EXPLICIT_PRIVATE_OPT_IN",
            },
            "next_best_move": next_move,
            "may_autonomously": [
                "Réévaluer les manques déjà documentés",
                "Préparer des propositions et parcours publics réversibles",
                "Adapter la présentation à l’incertitude",
                "Tester puis rejeter une évolution en cas de non-régression échouée",
            ],
            "may_not_autonomously": [
                "Créer ou déclarer une entité juridique",
                "Fixer un prix ou encaisser un paiement",
                "Ouvrir un compte citoyen ou accepter des données privées réelles",
                "Donner un mandat, envoyer une démarche ou représenter une personne",
                "Changer la vérité canonique, une source ou une affirmation sans Human Gate",
            ],
            "human_gates": [
                "truth", "sources", "claims", "security", "privacy", "pricing", "payments",
                "customer_onboarding", "legal_scope", "external_action", "governance_commitment",
            ],
        },
        "separation_guards": [
            "Le bien commun public ne devient pas un produit payant.",
            "Les besoins privés ne sont pas inférés depuis la navigation publique.",
            "Les données privées réelles ne sont pas stockées sur l’origine publique.",
            "Le chiffre d’affaires ne peut ni acheter une vérité, ni un classement, ni une recommandation politique.",
            "Tout résultat privé réinjecté dans le public doit être anonymisé, vérifié et autorisé avant exposition.",
        ],
    }

def build_acquisition(live, previous=None):
    if live.get("schema") != "OJO_FRANCE_DEBT_RATE_LIVE_V1" or live.get("policy", {}).get("political_recommendation") != "NONE":
        raise ValueError("CANONICAL_POLICY_MISMATCH")
    sources = sorted((s for s in live.get("sources", []) if s.get("id") in PILOT_IDS and s.get("health") in BAD_STATES), key=lambda s: s["id"])
    records = []
    if sources:
        for s in sources:
            u = urlparse(s.get("url", ""))
            if u.scheme != "https" or u.hostname != "www.aft.gouv.fr" or u.username or u.password:
                raise ValueError("OFFICIAL_SOURCE_ORIGIN_MISMATCH")
        source_ids = [s["id"] for s in sources]
        # Stable across pulse timestamps, different failing subsets and page refreshes.
        request_id = "LA_BETE_AFT_PUBLIC_DATA_ACCESS_V1"
        subject = "Accès aux publications et aux encours détaillés de la dette négociable"
        lines = ["Madame, Monsieur,", "", "Je souhaite identifier un accès officiel et autorisé aux publications suivantes de l’Agence France Trésor :", ""]
        lines += ["- " + s["label"] + " : " + s["url"] for s in sources]
        lines += ["", "Les vérifications enregistrées par notre outil signalent un accès indisponible sur ces ressources. Il ne s’agit pas d’affirmer que ces documents sont indisponibles pour tous les visiteurs.", "", "Pourriez-vous indiquer les liens ou modalités d’accès actuellement recommandés et, s’ils existent déjà, les exports structurés disponibles (CSV, XLSX, XML ou équivalent) ? Pour les encours, nous recherchons les identifiants des titres, leur échéance, l’encours et la date de situation ; pour les publications, le flux ou catalogue officiel.", "", "L’objectif est de documenter correctement la dette et les horizons de refinancement, en conservant les dates, périmètres, sources et limites, sans en déduire de recommandation politique.", "", "Nous ne demandons ni création d’un nouveau document, ni accès à des données non publiques. Merci de préciser les conditions de réutilisation ou les éventuels frais avant toute démarche payante. À défaut de compétence de votre service, pourriez-vous indiquer le service compétent ?", "", "Cordialement,", "[Identité et qualité de l’expéditeur à valider dans l’espace privé]"]
        body = "\n".join(lines)
        records.append({
            "id": request_id, "organization": "Agence France Trésor", "source_ids": source_ids,
            "state": "DRAFT_READY", "external_action": "NOT_EXECUTED", "mandate": "NOT_CONFIGURED",
            "contact": {"status": "OFFICIAL_FORM_VERIFIED", "official_home": "https://www.aft.gouv.fr/fr", "url": "https://www.aft.gouv.fr/fr/contact", "verified_on": "2026-10-03", "requires_human_captcha": True, "email": None},
            "purpose": "Obtenir un accès officiel aux ressources manquantes, sans changer la vérité ni contourner les restrictions d’accès.",
            "subject": subject, "draft": body, "draft_sha256": digest({"subject": subject, "body": body}),
            "evidence": [{"source_id": s["id"], "url": s["url"], "health": s["health"], "checked_at": s.get("checked_at"), "error": s.get("error")} for s in sources],
            "next_action": "Valider l’identité et le mandat dans SUPRA privé ; le formulaire officiel AFT comporte une validation CAPTCHA humaine.",
            "verification_required": ["Provenance officielle", "Périmètre et millésime explicites", "Complétude et cohérence", "Validation dans le circuit canonique existant"],
            "source_snapshot_id": live.get("snapshot_id"),
            "steps": [
                {"name": "Repérer et regrouper le manque", "state": "DONE"},
                {"name": "Préparer une demande écrite", "state": "DONE"},
                {"name": "Vérifier contact, identité et mandat", "state": "BLOCKED"},
                {"name": "Envoyer et conserver la référence", "state": "NOT_EXECUTED"},
                {"name": "Suivre la réponse et vérifier les pièces", "state": "WAITING"},
                {"name": "Intégrer après validation", "state": "WAITING"}],
        })
    return {"schema": SCHEMA, "source_snapshot_id": live.get("snapshot_id"), "requests": records, "initiatives": build_initiatives(live), "civic_mission": civic_mission(),
            "execution": "PREPARATION_ACTIVE_DISPATCH_NOT_CONNECTED", "private_dispatch_required": True,
            "public_users_may_authorize": False, "automatic_truth_change": False,
            "dialogue": {"mode": "LOCAL_STRUCTURED_NO_LLM", "shared_store": "EXISTING_GITHUB_ISSUES", "adoption": "HUMAN_GATE", "political_recommendation": "NONE"}}


def dispatch_once(request, *, authorizer, provider, mission_store, at):
    """Use ONLY authenticated private adapters. No default adapter grants permission.

    authorizer is the existing Authority validator, not input from a contribution.
    mission_store.claim_once atomically persists SENDING before provider I/O; a crash
    or timeout therefore blocks replay until provider-side reconciliation proves state.
    These adapter protocols are integration points, NOT claims of live deployment.
    """
    if authorizer is None or provider is None or mission_store is None:
        raise ValueError("PRIVATE_ADAPTERS_NOT_CONNECTED")
    now = stamp(at)
    permit = authorizer.authorize(request, now)
    if not isinstance(permit, dict) or permit.get("action") != "SEND_PUBLIC_INFORMATION_REQUEST":
        raise PermissionError("EXPLICIT_AUTHORITY_REQUIRED")
    if permit.get("revoked") is not False or not (stamp(permit["not_before"]) <= now < stamp(permit["expires_at"])):
        raise PermissionError("MANDATE_EXPIRED_OR_REVOKED")
    if request.get("purpose_class") != "PUBLIC_INFORMATION_REQUEST" or request.get("attachments") or request.get("cost_eur") != 0:
        raise PermissionError("OUTSIDE_PUBLIC_ZERO_COST_SCOPE")
    actual_digest = digest({k: request.get(k) for k in ("from", "to", "subject", "body", "purpose_class", "cost_eur", "attachments")})
    if permit.get("request_sha256") != actual_digest or permit.get("recipient") != request.get("to"):
        raise PermissionError("MANDATE_CONTENT_OR_RECIPIENT_MISMATCH")
    if not permit.get("authority_receipt_id") or not permit.get("contact_evidence_id"):
        raise PermissionError("AUTHORITY_AND_CONTACT_PROOF_REQUIRED")
    for key in ("from", "to", "subject"):
        if not isinstance(request.get(key), str) or not request[key] or any(x in request[key] for x in ("\r", "\n")):
            raise ValueError("INVALID_MAIL_HEADER")
    key = digest({"request_id": request["id"], "authority_receipt_id": permit["authority_receipt_id"], "request_sha256": actual_digest})
    claim = mission_store.claim_once(request["id"], key, permit, now)
    if not claim:
        return {"state": "RECONCILIATION_REQUIRED", "sent_now": False, "key": key}
    try:
        receipt = provider.send(request, idempotency_key=key)
        if not isinstance(receipt, dict) or not receipt.get("message_id"):
            raise ValueError("NO_PROVIDER_RECEIPT")
    except Exception:
        mission_store.record(request["id"], key, {"state": "DELIVERY_UNCERTAIN", "retry_allowed": False})
        return {"state": "DELIVERY_UNCERTAIN", "sent_now": None, "key": key}
    mission_store.record(request["id"], key, {"state": "SENT", "provider_receipt": receipt, "retry_allowed": False})
    return {"state": "SENT", "sent_now": True, "key": key, "provider_receipt": receipt}


def verify_received_document(document, *, trusted_verifier):
    if trusted_verifier is None:
        raise ValueError("CANONICAL_VERIFIER_NOT_CONNECTED")
    # A sender's assertion that their own document is verified is never a proof.
    result = trusted_verifier.verify(document)
    required = ("official_provenance", "same_scope", "dated", "complete", "coherent", "canonical_gate_passed")
    return {"state": "VERIFIED" if all(result.get(k) is True for k in required) else "NEEDS_REVIEW",
            "canonical_write_performed": False, "checks": {k: result.get(k) is True for k in required}}
