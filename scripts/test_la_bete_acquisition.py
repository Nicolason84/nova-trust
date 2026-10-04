import copy
import json
import unittest
from pathlib import Path
from la_bete_acquisition import build_acquisition, build_hybrid_model, build_initiatives, build_scic_institutional_blueprint, tally_scic_ballot, civic_mission, dispatch_once, digest, verify_received_document

ROOT = Path(__file__).resolve().parents[1]
LIVE = json.loads((ROOT / 'docs/data/france-debt-rate-live.json').read_text())
# Controlled source-health fixture, independent of future live recoveries.
for source in LIVE['sources']:
    if source['id'] in ('AFT_RSS','AFT_MATURITY_OAT','AFT_MATURITY_OATI','AFT_MATURITY_OATEI'):
        source['health'] = 'UNAVAILABLE'
AT = '2026-10-03T20:00:00+00:00'

class Authority:
    def __init__(self, request):
        self.permit = {'action': 'SEND_PUBLIC_INFORMATION_REQUEST', 'revoked': False, 'not_before': '2026-10-03T00:00:00Z', 'expires_at': '2026-10-04T00:00:00Z', 'authority_receipt_id': 'TEST_ONLY_OWNER_APPROVAL', 'contact_evidence_id': 'TEST_ONLY_OFFICIAL_CONTACT', 'recipient': request['to'], 'request_sha256': digest({k: request.get(k) for k in ('from','to','subject','body','purpose_class','cost_eur','attachments')})}
    def authorize(self, request, now): return self.permit

class Store:
    """Fixture ONLY: deployed integrations must use the existing durable MissionStore."""
    def __init__(self): self.rows = {}
    def claim_once(self, request_id, key, permit, now):
        if request_id in self.rows: return False
        self.rows[request_id] = {'state': 'SENDING', 'key': key}
        return True
    def record(self, request_id, key, state): self.rows[request_id].update(state)

class Provider:
    def __init__(self, fail=False): self.count = 0; self.fail = fail
    def send(self, request, idempotency_key):
        self.count += 1
        if self.fail: raise TimeoutError('fixture')
        return {'message_id': 'TEST_ONLY_MESSAGE'}

class AcquisitionTests(unittest.TestCase):
    def setUp(self):
        self.request = {'id': 'TEST_REQUEST', 'from': 'sender@example.test', 'to': 'recipient@example.test', 'subject': 'Test only', 'body': 'Public information request fixture', 'purpose_class': 'PUBLIC_INFORMATION_REQUEST', 'cost_eur': 0, 'attachments': []}
        self.authority = Authority(self.request); self.provider = Provider(); self.store = Store()
    def send(self):
        return dispatch_once(self.request, authorizer=self.authority, provider=self.provider, mission_store=self.store, at=AT)
    def test_one_group_for_four_source_gaps(self):
        a = build_acquisition(LIVE)
        self.assertEqual(len(a['requests']), 1)
        self.assertEqual(len(a['requests'][0]['source_ids']), 4)
        self.assertEqual(a['requests'][0]['external_action'], 'NOT_EXECUTED')
        self.assertIsNone(a['requests'][0]['contact']['email'])
    def test_no_fake_recovery_or_send(self):
        r = build_acquisition(LIVE)['requests'][0]
        self.assertEqual(r['state'], 'DRAFT_READY')
        self.assertNotIn('SENT', json.dumps(r))
    def test_stable_request_identity_and_draft_across_pulses(self):
        other = copy.deepcopy(LIVE); other['updated_at'] = '2026-10-04T00:00:00Z'
        for s in other['sources']: s['checked_at'] = '2026-10-04T00:00:00Z'
        a, b = build_acquisition(LIVE)['requests'][0], build_acquisition(other)['requests'][0]
        self.assertEqual(a['id'], b['id']); self.assertEqual(a['draft_sha256'], b['draft_sha256'])
    def test_no_stale_draft_when_all_sources_recover(self):
        other = copy.deepcopy(LIVE)
        for s in other['sources']: s['health'] = 'LIVE_VERIFIED'
        self.assertEqual(build_acquisition(other)['requests'], [])
    def test_untrusted_source_origin_blocks(self):
        other = copy.deepcopy(LIVE)
        next(s for s in other['sources'] if s['id'] == 'AFT_RSS')['url'] = 'https://attacker.example/collect'
        with self.assertRaises(ValueError): build_acquisition(other)
    def test_policy_mismatch_blocks(self):
        other = copy.deepcopy(LIVE); other['policy']['political_recommendation'] = 'YES'
        with self.assertRaises(ValueError): build_acquisition(other)
    def test_private_adapter_missing_blocks(self):
        with self.assertRaises(ValueError): dispatch_once(self.request, authorizer=None, provider=None, mission_store=None, at=AT)
    def test_send_once_with_receipt(self):
        self.assertEqual(self.send()['state'], 'SENT')
        self.assertEqual(self.send()['state'], 'RECONCILIATION_REQUIRED')
        self.assertEqual(self.provider.count, 1)
    def test_timeout_does_not_resend(self):
        self.provider = Provider(fail=True)
        self.assertEqual(self.send()['state'], 'DELIVERY_UNCERTAIN')
        self.assertEqual(self.send()['state'], 'RECONCILIATION_REQUIRED')
        self.assertEqual(self.provider.count, 1)
    def test_request_mutation_invalidates_permission(self):
        self.request['body'] += 'changed'
        with self.assertRaises(PermissionError): self.send()
        self.assertEqual(self.provider.count, 0)
    def test_recipient_mutation_blocks(self):
        self.request['to'] = 'other@example.test'
        with self.assertRaises(PermissionError): self.send()
    def test_expired_or_revoked_blocks(self):
        for key, value in [('expires_at', AT), ('revoked', True)]:
            with self.subTest(key=key):
                self.authority = Authority(self.request); self.authority.permit[key] = value
                with self.assertRaises(PermissionError): self.send()
    def test_cost_and_private_attachment_block(self):
        self.request['cost_eur'] = 1
        with self.assertRaises(PermissionError): self.send()
        self.request['cost_eur'] = 0; self.request['attachments'] = ['private.pdf']
        with self.assertRaises(PermissionError): self.send()
    def test_mail_header_injection_blocks(self):
        self.request['subject'] = 'Test\r\nBcc: attacker@example.test'; self.authority = Authority(self.request)
        with self.assertRaises(ValueError): self.send()
    def test_sender_self_verification_is_not_trusted(self):
        with self.assertRaises(ValueError): verify_received_document({'verified': True}, trusted_verifier=None)
    def test_receipt_is_not_automatic_canonical_promotion(self):
        class Verifier:
            def verify(self, doc): return {k: True for k in ('official_provenance','same_scope','dated','complete','coherent','canonical_gate_passed')}
        r = verify_received_document({}, trusted_verifier=Verifier())
        self.assertEqual(r['state'], 'VERIFIED'); self.assertFalse(r['canonical_write_performed'])
    def test_partial_evidence_keeps_review(self):
        class Verifier:
            def verify(self, doc): return {'official_provenance': True}
        self.assertEqual(verify_received_document({}, trusted_verifier=Verifier())['state'], 'NEEDS_REVIEW')

class InitiativeTests(unittest.TestCase):
    def test_civic_purpose_does_not_grant_external_authority(self):
        mission=civic_mission();self.assertFalse(mission['external_authority_granted']);self.assertEqual(mission['outcomes_verified'],0)
        self.assertEqual(mission['id'],'LA_BETE_CIVIC_MISSION_V1')
    def test_civic_benefit_is_to_verify_not_claimed(self):
        for x in build_initiatives(LIVE):
            contract=x['civic_contract'];self.assertEqual(contract['verified_result'],'NONE');self.assertEqual(contract['representation_mandate'],'NONE')
            self.assertIn('A_CONFIRMER',contract['need_status'])
    def test_unique_and_stable_preparations(self):
        a=build_initiatives(LIVE);b=build_initiatives(LIVE)
        self.assertEqual(a,b);self.assertEqual(len({x['id'] for x in a}),3)
    def test_no_outbound_claim_or_automatic_publication(self):
        for x in build_initiatives(LIVE):
            self.assertEqual(x['state'],'DRAFT_READY');self.assertEqual(x['external_action'],'NOT_EXECUTED');self.assertFalse(x['automatic_publication'])
    def test_contact_is_institutional_and_needs_reverification(self):
        x=build_initiatives(LIVE)[0]
        self.assertTrue(x['contact']['recheck_before_send']);self.assertIn('lannuaire.service-public.gouv.fr',x['contact']['source_url'])
        self.assertNotIn('Jean-François',x['draft'])
    def test_media_are_scripts_not_completed_productions(self):
        for x in build_initiatives(LIVE)[1:]:
            self.assertEqual(x['production']['release'],'Non publié');self.assertGreater(len(x['transcript']),100)


class HybridModelTests(unittest.TestCase):
    def setUp(self):
        self.acquisition = build_acquisition(LIVE)
        self.hybrid = build_hybrid_model(LIVE, self.acquisition)

    def test_public_common_good_is_free_and_not_saleable(self):
        public = self.hybrid['public_common_good']
        self.assertEqual(public['access'], 'FREE')
        self.assertTrue(public['always_free'])
        self.assertFalse(public['paywall'])
        self.assertFalse(public['saleable_public_truth'])
        self.assertFalse(public['saleable_political_influence'])

    def test_private_services_are_design_only(self):
        private = self.hybrid['private_services']
        self.assertEqual(private['state'], 'DESIGN_ONLY_NOT_FOR_SALE')
        self.assertEqual(private['customer_onboarding'], 'NOT_OPEN')
        self.assertIsNone(private['pricing'])
        self.assertEqual(private['payment'], 'NOT_CONNECTED')
        self.assertEqual(private['real_private_documents'], 'NOT_ACCEPTED_ON_PUBLIC_ORIGIN')
        self.assertIn('QUALIFIED_PROFESSIONAL', private['reserved_legal_acts'])

    def test_cooperative_direction_is_not_false_legal_entity_claim(self):
        cooperative = self.hybrid['cooperative_direction']
        self.assertEqual(cooperative['state'], 'TO_FORMALIZE_NOT_A_VERIFIED_REGISTERED_ENTITY')
        self.assertEqual(cooperative['statutes'], 'NOT_ADOPTED_BY_THIS_RUNTIME')

    def test_scic_institutional_blueprint_is_non_binding_and_anti_capture(self):
        blueprint = self.hybrid['cooperative_direction']['institutional_blueprint']
        self.assertEqual(blueprint['schema'], 'LA_BETE_SCIC_INSTITUTIONAL_BLUEPRINT_V1')
        self.assertEqual(blueprint['state'], 'CONSTITUTIONAL_DESIGN_PROPOSAL_NOT_ADOPTED')
        self.assertFalse(blueprint['binding_effect'])
        self.assertEqual(blueprint['adoption'], 'HUMAN_GATE_REQUIRED')
        weights = [x['vote_weight_pct'] for x in blueprint['colleges']]
        self.assertEqual(sum(weights), 100)
        self.assertTrue(all(10 <= x <= 50 for x in weights))
        self.assertEqual(max(weights), 30)
        self.assertFalse(blueprint['voting_guardrails']['capital_may_weight_votes'])
        self.assertFalse(blueprint['voting_guardrails']['founder_supervote'])
        self.assertEqual(blueprint['decision_constitution']['verified_facts'], 'NOT_DECIDED_BY_VOTE')
        self.assertGreaterEqual(blueprint['economics']['statutory_reserve_min_after_legal_reserve_pct'], 50)
        self.assertEqual(blueprint['economics']['exclusive_transfer_of_public_truth_control'], 'FORBIDDEN_BY_DESIGN')

    def test_scic_membership_and_formation_remain_explicit_human_gates(self):
        blueprint = self.hybrid['cooperative_direction']['institutional_blueprint']
        self.assertGreaterEqual(blueprint['membership']['minimum_categories_required'], 3)
        mandatory = set(blueprint['membership']['mandatory_categories'])
        self.assertIn('BENEFICIARIES_OR_REGULAR_USERS', mandatory)
        self.assertIn('EMPLOYEES_OR_IF_NONE_PRODUCERS_OF_GOODS_OR_SERVICES', mandatory)
        self.assertEqual(len(blueprint['institutions']), 5)
        self.assertEqual(len(blueprint['formation_path']), 8)
        self.assertTrue(all(x['state'] != 'DONE' for x in blueprint['formation_path']))

    def test_democracy_is_operable_but_non_binding_before_registration(self):
        democracy = self.hybrid['cooperative_direction']['democracy']
        self.assertEqual(democracy['schema'], 'LA_BETE_SCIC_DEMOCRACY_V1')
        self.assertEqual(democracy['state'], 'OPERABLE_NON_BINDING')
        self.assertFalse(democracy['binding_effect'])
        self.assertTrue(democracy['same_runtime'])
        self.assertFalse(democracy['second_registry'])
        self.assertEqual(democracy['membership']['current_legal_societaires'], 0)
        self.assertEqual(democracy['participation']['binding_vote_channel'], 'NOT_OPEN_UNTIL_VERIFIED_MEMBERSHIP_AND_SCIC_ACTIVATION')

    def test_membership_verification_stays_private_and_real_enrollment_closed(self):
        membership = self.hybrid['cooperative_direction']['democracy']['membership']
        self.assertEqual(membership['pilot_state'], 'SYNTHETIC_PRIVATE_MEMBERSHIP_PIPELINE_IMPLEMENTED')
        self.assertFalse(membership['real_enrollment_open'])
        self.assertIn('EXISTING_PRIVATE_CITIZEN_PILOT_WEBAUTHN', membership['identity_verification'])
        self.assertEqual(membership['eligibility_verification'], 'PRIVATE_EVIDENCE_ENCRYPTED_NEVER_PUBLIC')
        self.assertEqual(membership['admission_authority'], 'SEPARATE_PRIVATE_AUTHORITY_REQUIRED_NOT_SELF_SERVICE')
        forbidden = set(membership['public_receipt_forbidden_fields'])
        self.assertTrue({'name','address','email','civil_identity','eligibility_evidence','passkey_id'} <= forbidden)

    def test_ballot_public_registry_never_contains_member_identity(self):
        ballot = self.hybrid['cooperative_direction']['democracy']['ballot_protocol']
        self.assertFalse(ballot['identity_publication'])
        self.assertFalse(ballot['member_public_id_in_ballot'])
        self.assertTrue(ballot['one_time_private_ballot_token'])
        self.assertEqual(ballot['token_replay'], 'REJECTED')
        self.assertEqual(ballot['public_registry_unlinkability'], 'PROVEN_IN_SYNTHETIC_PRIVATE_PILOT')
        self.assertIn('PROVEN_FOR_SIGNATURE_TRANSCRIPT_MATCHING', ballot['issuer_level_cryptographic_unlinkability'])
        self.assertEqual(ballot['issuer_level_metadata_unlinkability'], 'NOT_PROVEN')
        anon = ballot['anonymous_credential']
        self.assertEqual(anon['state'], 'SYNTHETIC_CRYPTOGRAPHIC_PROOF_IMPLEMENTED')
        self.assertFalse(anon['production_activation'])
        self.assertTrue(anon['separate_processes_proven'])
        self.assertTrue(anon['separate_stores_proven'])
        self.assertFalse(anon['issuer_receives_member_identity'])
        self.assertFalse(anon['issuer_receives_member_public_id'])
        self.assertFalse(anon['issuer_receives_ballot_serial'])
        self.assertFalse(anon['ballot_box_receives_entitlement'])
        self.assertFalse(anon['rfc9474_conformance'])
        self.assertEqual(anon['standard_backend_target'], 'CLOUDFLARE_CIRCL_V1_6_5')
        self.assertEqual(anon['standard_backend_ci'], 'PASS_RFC9474_RFC9578')
        self.assertEqual(anon['standard_backend_runtime_binding'], 'PROVEN_CI_SIDECAR_NOT_PRODUCTION_ACTIVATED')
        self.assertEqual(anon['same_college_anonymity_set_proven'], 2)
        self.assertIn('NOT_PROVEN', anon['metadata_unlinkability'])

    def test_production_privacy_gate_proves_standard_primitive_but_remains_closed(self):
        gate = self.hybrid['cooperative_direction']['democracy']['production_privacy_gate']
        self.assertEqual(gate['schema'], 'LA_BETE_SCIC_PRODUCTION_PRIVACY_GATE_V1')
        self.assertEqual(gate['state'], 'IMPLEMENTED_FAIL_CLOSED')
        self.assertFalse(gate['production_activation'])
        self.assertEqual(gate['current_verdict'], 'BLOCKED')
        crypto = gate['cryptographic_gate']
        self.assertEqual(crypto['state'], 'RFC9474_RFC9578_CI_PASS_RUNTIME_BOUND')
        self.assertEqual(crypto['backend'], 'CLOUDFLARE_CIRCL')
        self.assertEqual(crypto['backend_version'], 'v1.6.5')
        self.assertEqual(crypto['project_ci'], 'PASS')
        self.assertEqual(crypto['upstream_rfc9474_vectors'], 'PASS')
        self.assertEqual(crypto['standard_rsa_pss_crosscheck'], 'PASS')
        self.assertEqual(crypto['runtime_binding'], 'PROVEN_CI_SIDECAR')
        self.assertNotIn('CRYPTO_RUNTIME_BINDING_NOT_PROVEN', gate['blocking_reasons'])
        self.assertIn('OHTTP_INDEPENDENT_RELAY_NOT_DEPLOYED', gate['blocking_reasons'])
        self.assertIn('EXTERNAL_CRYPTO_REVIEW_NOT_COMPLETED', gate['blocking_reasons'])

    def test_production_privacy_gate_has_ohttp_and_batch_fail_closed_targets(self):
        gate = self.hybrid['cooperative_direction']['democracy']['production_privacy_gate']
        network = gate['network_gate']
        self.assertEqual(network['profile'], 'RFC9458_OHTTP_OR_EQUIVALENT_INDEPENDENT_RELAY')
        self.assertEqual(network['state'], 'RFC9458_RUNTIME_PROVEN_DEPLOYMENT_NOT_CONFIGURED')
        self.assertEqual(network['runtime_binding'], 'PROVEN_CI_THREE_PROCESS_RFC9458')
        self.assertEqual(network['backend_version'], '0.8.0')
        self.assertFalse(network['relay_plaintext_probe'])
        self.assertFalse(network['relay_gateway_same_operator_allowed'])
        self.assertFalse(network['relay_may_forward_identifying_headers'])
        self.assertTrue(network['fresh_hpke_context_per_request_required'])
        batch = gate['anonymity_gate']
        self.assertEqual(batch['state'], 'PERSISTENT_RUNTIME_PROVEN_POLICY_NOT_APPROVED')
        self.assertEqual(batch['runtime_binding'], 'PROVEN_PERSISTENT_SQLITE_OPAQUE_BATCHER')
        self.assertTrue(batch['persistence_restart_proven'])
        self.assertEqual(batch['small_set_behavior'], 'ROLL_FORWARD')
        self.assertEqual(batch['production_minimum_set_size'], 'UNSET_REQUIRES_PRIVACY_REVIEW')
        self.assertEqual(batch['production_window_seconds'], 'UNSET_REQUIRES_PRIVACY_REVIEW')
        self.assertEqual(batch['small_set_release'], 'FORBIDDEN')
        self.assertFalse(batch['individual_public_timestamps'])
        self.assertEqual(gate['key_gate']['state'], 'CONTRACT_IMPLEMENTED_CURRENT_PROVIDER_BLOCKED')
        self.assertEqual(gate['key_gate']['current_provider'], 'FILE_TEST_ONLY')
        self.assertEqual(gate['key_gate']['custody_verdict'], 'BLOCKED')
        self.assertEqual(gate['review_gate']['internal_threat_model'], 'V1_COMPLETE')
        self.assertEqual(gate['review_gate']['audit_pack'], 'READY_FOR_EXTERNAL_REVIEW')

    def test_truth_is_never_a_ballot_target(self):
        democracy = self.hybrid['cooperative_direction']['democracy']
        firewall = democracy['truth_firewall']
        self.assertEqual(firewall['principle'], 'THE_MAJORITY_CHOOSES_ACTIONS_NOT_FACTS')
        self.assertFalse(firewall['ballot_may_change_evidence'])
        self.assertFalse(firewall['amendment_may_change_evidence'])
        self.assertFalse(firewall['integrity_council_may_rewrite_truth'])
        self.assertIn('OBSERVED_FACT', firewall['never_votable_classes'])
        self.assertIn('LEGAL_FACT', firewall['never_votable_classes'])

    def test_ballot_tally_is_college_weighted_not_capital_weighted(self):
        democracy = self.hybrid['cooperative_direction']['democracy']
        tally = democracy['pilot']['tally']
        self.assertTrue(tally['passed'])
        self.assertAlmostEqual(tally['weighted_support_pct'], 77.36, places=2)
        self.assertEqual(tally['positive_colleges'], 5)
        self.assertFalse(tally['capital_weighting_used'])
        self.assertFalse(tally['identity_data_published'])

    def test_ballot_rejects_missing_college_and_invalid_decision_class(self):
        blueprint = build_scic_institutional_blueprint()
        ballot = copy.deepcopy(self.hybrid['cooperative_direction']['democracy']['pilot']['ballot'])
        ballot['colleges'].pop('MISSION_PARTNERS_ESS')
        with self.assertRaises(ValueError):
            tally_scic_ballot(blueprint, ballot, 'ORDINARY')
        with self.assertRaises(ValueError):
            tally_scic_ballot(blueprint, self.hybrid['cooperative_direction']['democracy']['pilot']['ballot'], 'FACT')

    def test_vote_never_executes_or_grants_mandate(self):
        democracy = self.hybrid['cooperative_direction']['democracy']
        flow = democracy['decision_to_execution']
        self.assertFalse(flow['vote_is_execution'])
        self.assertTrue(flow['mandate_required'])
        self.assertTrue(flow['external_action_requires_authority_receipt'])
        self.assertFalse(flow['automatic_external_action'])
        pilot = democracy['pilot']
        self.assertEqual(pilot['mandate']['state'], 'NOT_GRANTED_DRY_RUN')
        self.assertEqual(pilot['execution']['state'], 'NOT_EXECUTED')
        self.assertFalse(pilot['execution']['external_action_performed'])

    def test_public_result_registry_is_aggregate_and_correctable(self):
        democracy = self.hybrid['cooperative_direction']['democracy']
        ledger = democracy['public_result_registry']
        self.assertEqual(len(ledger), 1)
        self.assertFalse(ledger[0]['binding'])
        self.assertTrue(ledger[0]['correction_open'])
        self.assertEqual(democracy['ballot_protocol']['public_output'], 'AGGREGATED_BY_COLLEGE')
        self.assertFalse(democracy['ballot_protocol']['identity_publication'])

    def test_autoevolution_reuses_existing_runtime_and_only_proposes(self):
        auto = self.hybrid['autoevolution']
        self.assertEqual(auto['engine'], 'EXISTING_OJO_LA_BETE_VIRTUOUS_EVOLUTION_V1')
        self.assertFalse(auto['second_runtime'])
        self.assertEqual(auto['next_best_move']['state'], 'PROPOSAL_ONLY')
        self.assertEqual(auto['signals']['private_service_demand'], 'UNPROVEN_UNTIL_EXPLICIT_PRIVATE_OPT_IN')
        self.assertEqual(auto['signals']['documented_public_requests'], len(self.acquisition['requests']))

    def test_hybrid_model_is_snapshot_bound(self):
        wrong = copy.deepcopy(self.acquisition)
        wrong['source_snapshot_id'] = 'OJO-WRONG'
        with self.assertRaises(ValueError):
            build_hybrid_model(LIVE, wrong)


if __name__ == '__main__': unittest.main(verbosity=2)
