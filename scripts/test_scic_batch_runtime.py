import json,tempfile,unittest
from pathlib import Path
from app.scic_batch_runtime import PersistentBatchRuntime,BatchRuntimeError

class PersistentBatchRuntimeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.b=PersistentBatchRuntime(self.root,3,60)
    def tearDown(self):
        self.b.close()
        self.tmp.cleanup()
    def envelope(self,n):
        return (b'OHTTP-CIPHERTEXT-'+str(n).encode()).ljust(64,b'x')
    def test_persists_opaque_envelopes_across_restart(self):
        self.b.submit(self.envelope(1),'CITIZENS_USERS',10)
        self.b.close()
        self.b=PersistentBatchRuntime(self.root,3,60)
        self.assertEqual(self.b.pending_count('CITIZENS_USERS',0),1)
        blob=(self.root/'batch.sqlite').read_bytes()
        self.assertNotIn(b'YES',blob)
        self.assertNotIn(b'test-citizen',blob)
    def test_duplicate_ciphertext_rejected(self):
        e=self.envelope(1)
        self.b.submit(e,'CITIZENS_USERS',10)
        self.assertRaises(BatchRuntimeError,self.b.submit,e,'CITIZENS_USERS',11)
    def test_window_open_blocks_release(self):
        for i in range(3):self.b.submit(self.envelope(i),'CITIZENS_USERS',10+i)
        self.assertEqual(self.b.release('CITIZENS_USERS',0,59)['reason'],'WINDOW_OPEN')
    def test_small_set_rolls_forward_instead_of_release(self):
        for i in range(2):self.b.submit(self.envelope(i),'CITIZENS_USERS',10+i)
        r=self.b.release('CITIZENS_USERS',0,61)
        self.assertFalse(r['released'])
        self.assertEqual(r['reason'],'ROLLED_FORWARD_SMALL_SET')
        self.assertEqual(self.b.pending_count('CITIZENS_USERS',1),2)
    def test_rolled_votes_can_join_next_window_and_release(self):
        self.b.submit(self.envelope(1),'CITIZENS_USERS',10)
        self.b.submit(self.envelope(2),'CITIZENS_USERS',11)
        self.b.release('CITIZENS_USERS',0,61)
        self.b.submit(self.envelope(3),'CITIZENS_USERS',70)
        r=self.b.release('CITIZENS_USERS',1,121)
        self.assertTrue(r['released'])
        self.assertEqual(r['count'],3)
        self.assertEqual(len(r['envelopes']),3)
    def test_release_is_atomic_and_not_repeatable(self):
        for i in range(3):self.b.submit(self.envelope(i),'CITIZENS_USERS',10+i)
        r=self.b.release('CITIZENS_USERS',0,61)
        self.assertTrue(r['released'])
        r2=self.b.release('CITIZENS_USERS',0,62)
        self.assertFalse(r2['released'])
        self.assertEqual(r2['count'],0)
    def test_public_receipt_has_no_envelope_digest_or_timestamp(self):
        for i in range(3):self.b.submit(self.envelope(i),'CITIZENS_USERS',10+i)
        receipt=self.b.public_receipt(self.b.release('CITIZENS_USERS',0,61))
        raw=json.dumps(receipt)
        self.assertFalse(receipt['individual_timestamps'])
        self.assertFalse(receipt['envelopes_public'])
        self.assertFalse(receipt['digests_public'])
        self.assertNotIn('sha256',raw)
    def test_colleges_do_not_mix(self):
        for i in range(2):self.b.submit(self.envelope(i),'CITIZENS_USERS',10+i)
        self.b.submit(self.envelope(9),'WORKERS_PRODUCERS',12)
        self.b.release('CITIZENS_USERS',0,61)
        self.assertEqual(self.b.pending_count('WORKERS_PRODUCERS',0),1)

if __name__=='__main__':unittest.main(verbosity=2)
