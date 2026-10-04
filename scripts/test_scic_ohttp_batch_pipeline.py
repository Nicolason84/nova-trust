import base64,hashlib,os,tempfile,unittest
from pathlib import Path

from app.scic_batch_runtime import PersistentBatchRuntime
from app.scic_ohttp_runtime import OHTTPRuntimeBinding

class OHTTPBatchPipelineTests(unittest.TestCase):
    def setUp(self):
        binary=os.environ.get('SCIC_OHTTP_RUNTIME_BIN')
        if not binary:self.skipTest('SCIC_OHTTP_RUNTIME_BIN not supplied')
        self.tmp=tempfile.TemporaryDirectory()
        self.binding=OHTTPRuntimeBinding(Path(binary))
        self.batch=PersistentBatchRuntime(Path(self.tmp.name)/'batch',3,60)

    def tearDown(self):
        if hasattr(self,'batch'):self.batch.close()
        if hasattr(self,'binding'):self.binding.close()
        if hasattr(self,'tmp'):self.tmp.cleanup()

    def encapsulate_to_batch(self,idx,plaintext,timestamp):
        rid=f'batch-{idx}'
        probe=base64.b64encode(plaintext).decode()
        enc=self.binding.client.call({'op':'encapsulate','id':rid,'payload_b64':probe})
        relay=self.binding.relay.call({'op':'forward','id':rid,'payload_b64':enc['payload_b64'],'probe_b64':probe})
        self.assertFalse(relay['contains_probe'])
        opaque=base64.b64decode(relay['payload_b64'])
        self.batch.submit(opaque,'CITIZENS_USERS',timestamp)
        return hashlib.sha256(opaque).hexdigest(),rid

    def test_three_ohttp_envelopes_release_as_one_privacy_batch(self):
        expected=[]
        mapping={}
        for i in range(3):
            plain=f'SCIC_BALLOT_OPAQUE_{i}'.encode()
            digest,rid=self.encapsulate_to_batch(i,plain,10+i)
            mapping[digest]=(rid,plain)
            expected.append(plain)
        self.assertEqual(self.batch.release('CITIZENS_USERS',0,59)['reason'],'WINDOW_OPEN')
        release=self.batch.release('CITIZENS_USERS',0,61)
        self.assertTrue(release['released'])
        recovered=[]
        for envelope in release['envelopes']:
            digest=hashlib.sha256(envelope).hexdigest()
            rid,plain=mapping[digest]
            gw=self.binding.gateway.call({'op':'decapsulate','id':rid,'payload_b64':base64.b64encode(envelope).decode()})
            recovered.append(base64.b64decode(gw['plaintext_b64']))
        self.assertEqual(set(recovered),set(expected))

    def test_small_ohttp_set_never_reaches_gateway_before_roll_forward(self):
        for i in range(2):
            self.encapsulate_to_batch(i,f'SMALL_SET_{i}'.encode(),10+i)
        release=self.batch.release('CITIZENS_USERS',0,61)
        self.assertFalse(release['released'])
        self.assertEqual(release['reason'],'ROLLED_FORWARD_SMALL_SET')
        self.assertNotIn('envelopes',release)

    def test_public_batch_receipt_discloses_no_ohttp_envelope(self):
        for i in range(3):
            self.encapsulate_to_batch(i,f'PUBLIC_RECEIPT_{i}'.encode(),10+i)
        release=self.batch.release('CITIZENS_USERS',0,61)
        receipt=self.batch.public_receipt(release)
        self.assertFalse(receipt['envelopes_public'])
        self.assertFalse(receipt['digests_public'])
        self.assertNotIn('envelopes',receipt)

if __name__=='__main__':unittest.main(verbosity=2)
