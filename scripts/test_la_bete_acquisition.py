import copy
import json
import unittest
from pathlib import Path
from la_bete_acquisition import build_acquisition, build_initiatives, dispatch_once, digest, verify_received_document

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

if __name__ == '__main__': unittest.main(verbosity=2)
