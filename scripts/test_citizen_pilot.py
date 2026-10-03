"""Synthetic unit tests only. Fixture sessions below do NOT claim authentication proof;
the separate browser test proves the actual WebAuthn ceremonies."""
import json, os, shutil, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from app.citizen_pilot import Pilot,Denied,FIXTURES,FixtureAuthority,raw,token_hash
from cryptography.exceptions import InvalidTag

class PilotTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.now=[1801500000.0];self.env=patch.dict(os.environ,{'OJO_CITIZEN_SYNTHETIC_ONLY':'1'});self.env.start();self.p=Pilot(self.root,'https://localhost:44339',clock=lambda:self.now[0]);self.tokens={}
  with self.p.tx():
   for u in FIXTURES:
    kid=u+'-unit-fixture';self.p.db.execute('INSERT INTO credentials(id,subject,pub,counter) VALUES(?,?,?,0)',(kid,u,b'UNIT_FIXTURE_NOT_A_REAL_PUBLIC_KEY'));self.tokens[u]=self.p.new_session(u,kid)
  self.a=self.tokens['test-citizen-a'];self.b=self.tokens['test-citizen-b'];self.doc=self.p.create_document(self.a)
 def tearDown(self):self.p.db.close();self.env.stop();self.tmp.cleanup()
 def mandate(self,templates=None,expiry=None):
  mid='unit-mandate-'+str(self.p.db.execute('SELECT COUNT(*) FROM mandates').fetchone()[0]);self.p.db.execute('INSERT INTO mandates VALUES(?,?,?,?,?,?,0,?)',(mid,'test-citizen-a',self.doc['id'],self.doc['digest'],json.dumps(templates or ['information','suivi']),expiry or self.now[0]+600,self.now[0]));return mid
 def test_explicit_synthetic_flag_required(self):
  with patch.dict(os.environ,{'OJO_CITIZEN_SYNTHETIC_ONLY':'0'}):self.assertRaises(RuntimeError,Pilot,self.root,'https://localhost:44339')
 def test_public_or_plaintext_origin_forbidden(self):
  for origin in ['http://localhost:44339','https://example.com:44339','https://localhost:44339/path','https://localhost:44339?x=1']:
   self.assertRaises(RuntimeError,Pilot,self.root,origin)
 def test_repo_storage_forbidden(self):self.assertRaises(RuntimeError,Pilot,Path(__file__).resolve().parents[1]/'runtime-private','https://localhost:44339')
 def test_documents_are_not_stored_in_plaintext(self):
  blob=(self.root/'data/synthetic.sqlite').read_bytes();self.assertNotIn(b'SYNTHETIC_A_NO_REAL_PERSON',blob);self.assertNotIn('Adresse de démonstration A'.encode(),blob)
 def test_ciphertext_tamper_is_rejected(self):
  r=self.p.db.execute('SELECT cipher FROM documents WHERE id=?',(self.doc['id'],)).fetchone()[0];self.p.db.execute('UPDATE documents SET cipher=? WHERE id=?',(r[:-1]+bytes([r[-1]^1]),self.doc['id']));self.assertRaises(InvalidTag,self.p.read_document,self.a,self.doc['id'])
 def test_owner_key_is_separate(self):self.assertNotEqual(self.p.user_key('test-citizen-a'),self.p.user_key('test-citizen-b'))
 def test_cipher_rebinding_to_other_user_is_rejected(self):
  r=self.p.db.execute('SELECT cipher FROM documents WHERE id=?',(self.doc['id'],)).fetchone()[0];self.assertRaises(InvalidTag,self.p.unseal,self.p.user_key('test-citizen-b'),r,('doc:test-citizen-b:'+self.doc['id']+':1').encode())
 def test_user_b_cannot_read_a(self):
  with self.assertRaises(Denied) as r:self.p.read_document(self.b,self.doc['id'])
  self.assertEqual(r.exception.status,404)
 def test_user_b_cannot_mutate_a(self):self.assertRaises(Denied,self.p.replace_fixture,self.b,self.doc['id'])
 def test_user_b_cannot_authorize_a(self):self.assertRaises(Denied,self.p.begin_mandate,self.b,self.doc['id'],['information'])
 def test_user_b_cannot_prepare_a(self):self.assertRaises(Denied,self.p.prepare,self.b,self.mandate(),'information')
 def test_user_b_cannot_revoke_a(self):self.assertRaises(Denied,self.p.revoke_mandate,self.b,self.mandate())
 def test_session_is_server_validated(self):self.assertRaises(Denied,self.p.overview,'connected=true:'+self.a)
 def test_logout_invalidates_session(self):self.p.logout(self.a);self.assertRaises(Denied,self.p.overview,self.a)
 def test_session_absolute_expiry(self):self.now[0]+=901;self.assertRaises(Denied,self.p.overview,self.a)
 def test_idle_session_expiry(self):self.now[0]+=301;self.assertRaises(Denied,self.p.overview,self.a)
 def test_revocation_of_all_access(self):
  mid=self.mandate();self.p.revoke_all(self.a);self.assertRaises(Denied,self.p.overview,self.a);self.assertRaises(Denied,self.p.begin_login,'test-citizen-a');self.assertEqual(self.p.overview(self.b)['subject'],'test-citizen-b');self.assertEqual(self.p.db.execute('SELECT revoked FROM mandates WHERE id=?',(mid,)).fetchone()[0],1)
 def test_mandate_expiry(self):mid=self.mandate(expiry=self.now[0]+1);self.now[0]+=2;self.assertRaises(Denied,self.p.prepare,self.a,mid,'information')
 def test_mandate_revocation(self):mid=self.mandate();self.p.revoke_mandate(self.a,mid);self.assertRaises(Denied,self.p.prepare,self.a,mid,'information');self.assertRaises(Denied,self.p.submit_fixture,self.a,mid,'information')
 def test_document_change_invalidates_mandate(self):mid=self.mandate();self.p.replace_fixture(self.a,self.doc['id']);self.assertRaises(Denied,self.p.prepare,self.a,mid,'information')
 def test_scope_no_signature_payment_or_publish(self):
  for action in ['pay','sign','publish','mailto:mayor@example.com']:
   self.assertRaises(Denied,self.p.begin_mandate,self.a,self.doc['id'],[action])
 def test_scope_does_not_expand_template(self):self.assertRaises(Denied,self.p.prepare,self.a,self.mandate(['information']),'suivi')
 def test_same_document_reused_in_two_preparations(self):
  mid=self.mandate();a=self.p.prepare(self.a,mid,'information');b=self.p.prepare(self.a,mid,'suivi');self.assertEqual(a['document_digest'],b['document_digest']);self.assertEqual(a['body'],b['body']);self.assertEqual(self.p.db.execute('SELECT COUNT(*) FROM documents').fetchone()[0],1)
 def test_fixture_receipt_is_not_real_delivery(self):
  r=self.p.submit_fixture(self.a,self.mandate(),'information');self.assertEqual(r['state'],'SENT');self.assertFalse(r['real_external_action']);self.assertFalse(r['provider_receipt']['external_delivery']);self.assertEqual(r['provider_receipt']['provider'],'LOCAL_SYNTHETIC_RECEIVER')
 def test_replay_cannot_duplicate_fixture_delivery(self):
  mid=self.mandate();self.p.submit_fixture(self.a,mid,'information');r=self.p.submit_fixture(self.a,mid,'information');self.assertEqual(r['state'],'RECONCILIATION_REQUIRED');self.assertEqual(self.p.db.execute('SELECT COUNT(*) FROM fixture_receipts').fetchone()[0],1)
 def test_uncertain_delivery_never_retried(self):
  from app.citizen_pilot import LocalReceiptFixture
  mid=self.mandate()
  with patch.object(LocalReceiptFixture,'send',side_effect=TimeoutError):self.assertEqual(self.p.submit_fixture(self.a,mid,'information')['state'],'DELIVERY_UNCERTAIN')
  self.assertEqual(self.p.submit_fixture(self.a,mid,'information')['state'],'RECONCILIATION_REQUIRED')
 def test_exact_content_rechecked_before_dispatch(self):
  mid=self.mandate();s=self.p.session(self.a);m,r=self.p.request(s,mid,'information');r['body']='Changed';auth=FixtureAuthority(self.p,s,mid,'information');self.assertRaises(Denied,auth.authorize,r,None)
 def test_exact_recipient_rechecked_before_dispatch(self):
  mid=self.mandate();s=self.p.session(self.a);m,r=self.p.request(s,mid,'information');r['to']='outside@real.invalid';self.assertRaises(Denied,FixtureAuthority(self.p,s,mid,'information').authorize,r,None)
 def test_ceremony_one_use(self):
  with self.p.tx():cid,c=self.p.ceremony('test-citizen-a','LOGIN',{},'binding')
  self.p.consume(cid,'LOGIN','binding');self.assertRaises(Denied,self.p.consume,cid,'LOGIN','binding')
 def test_ceremony_purpose_and_browser_bound(self):
  with self.p.tx():cid,c=self.p.ceremony('test-citizen-a','LOGIN',{},'binding')
  self.assertRaises(Denied,self.p.consume,cid,'MANDATE','binding');self.assertRaises(Denied,self.p.consume,cid,'LOGIN','wrong')
 def test_ceremony_expiry(self):
  with self.p.tx():cid,c=self.p.ceremony('test-citizen-a','LOGIN',{},'binding')
  self.now[0]+=91;self.assertRaises(Denied,self.p.consume,cid,'LOGIN','binding')
 def test_audit_does_not_copy_document_content(self):
  self.p.read_document(self.a,self.doc['id']);j=json.dumps(self.p.overview(self.a)['audit']);self.assertNotIn('SYNTHETIC_A_NO_REAL_PERSON',j)
 def test_b_audit_and_receipts_exclude_a(self):
  self.p.submit_fixture(self.a,self.mandate(),'information');b=self.p.overview(self.b);self.assertEqual(b['documents'],[]);self.assertEqual(b['receipts'],[]);self.assertFalse(any(x['ref']==self.doc['id'] for x in b['audit']))
 def test_encrypted_backup_and_restore(self):
  self.p.db.execute('PRAGMA wal_checkpoint(FULL)');backup=self.root/'snapshot.sqlite';import sqlite3
  target=sqlite3.connect(backup);self.p.db.backup(target);target.close();self.assertNotIn(b'SYNTHETIC_A_NO_REAL_PERSON',backup.read_bytes());self.p.db.close();shutil.copyfile(backup,self.root/'data/synthetic.sqlite');self.p=Pilot(self.root,'https://localhost:44339',clock=lambda:self.now[0]);self.assertEqual(self.p.read_document(self.a,self.doc['id'])['document']['reference'],'SYNTHETIC_A_NO_REAL_PERSON')
 def test_wrong_key_fails_without_resetting_data(self):
  self.p.db.close();self.p.keyfile.write_bytes(os.urandom(32));self.p=Pilot(self.root,'https://localhost:44339',clock=lambda:self.now[0]);self.assertRaises(InvalidTag,self.p.read_document,self.a,self.doc['id'])
 def test_missing_wrapping_key_blocks_restart(self):
  self.p.keyfile.unlink();self.assertRaises(RuntimeError,Pilot,self.root,'https://localhost:44339')
 def test_private_key_files_have_restrictive_permissions(self):self.assertEqual(self.p.keyfile.stat().st_mode & 0o777,0o600)

if __name__=='__main__':unittest.main(verbosity=2)
