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
    return [outreach,audio,video]

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
    return {"schema": SCHEMA, "source_snapshot_id": live.get("snapshot_id"), "requests": records, "initiatives": build_initiatives(live),
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
