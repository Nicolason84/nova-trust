"""Local, synthetic-only proof of a private citizen boundary. NOT production.
No real enrolment, upload, public listener, administrative connector, or recovery.
Uses py_webauthn verification and cryptography AEAD; reuses dispatch_once.
Secrets, database and TLS material must be outside the repository.
"""
from __future__ import annotations
import base64, hashlib, hmac, json, os, secrets, sqlite3, ssl, threading, time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from webauthn import (generate_registration_options, verify_registration_response,
                      generate_authentication_options, verify_authentication_response, options_to_json)
from webauthn.helpers.structs import AuthenticatorSelectionCriteria, ResidentKeyRequirement, UserVerificationRequirement, PublicKeyCredentialDescriptor
from scripts.la_bete_acquisition import dispatch_once, digest

MODE='SYNTHETIC_ONLY_NOT_PRODUCTION'
SESSION='__Host-ojo_pilot_session'
PREAUTH='__Host-ojo_pilot_ceremony'
FIXTURES={
 'test-citizen-a':{'name':'Citoyen fictif A','address':'Adresse de démonstration A','reference':'SYNTHETIC_A_NO_REAL_PERSON',
                   'membership_basis':'BENEFICIARY_OR_REGULAR_USER','membership_college':'CITIZENS_USERS',
                   'membership_evidence':'SYNTHETIC_BENEFICIARY_EVIDENCE_NO_REAL_PERSON'},
 'test-citizen-b':{'name':'Citoyen fictif B','address':'Adresse de démonstration B','reference':'SYNTHETIC_B_NO_REAL_PERSON',
                   'membership_basis':'VOLUNTEER_CONTRIBUTOR','membership_college':'CONTRIBUTORS_CIVIL_SOCIETY',
                   'membership_evidence':'SYNTHETIC_CONTRIBUTOR_EVIDENCE_NO_REAL_PERSON'}}
SERVICES={'information':'information@service-test.invalid','suivi':'suivi@service-test.invalid'}

def encoded(b):return base64.urlsafe_b64encode(b).rstrip(b'=').decode()
def decoded(s):return base64.urlsafe_b64decode(s+'='*(-len(s)%4))
def token_hash(s):return hashlib.sha256(s.encode()).hexdigest()
def raw(j):return json.dumps(j,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
def iso(t):return datetime.fromtimestamp(t,timezone.utc).isoformat()

class Denied(Exception):
    def __init__(self,code='DENIED',status=403):self.code=code;self.status=status

class Pilot:
    """Proof store only; not a substitute for the private SUPRA MissionStore."""
    def __init__(self,root:Path,origin:str,*,clock=time.time):
        if os.environ.get('OJO_CITIZEN_SYNTHETIC_ONLY')!='1':raise RuntimeError('SYNTHETIC_MODE_REQUIRED')
        u=urlsplit(origin)
        if u.scheme!='https' or u.hostname!='localhost' or not u.port or u.path or u.query or u.fragment or u.username:raise RuntimeError('LOOPBACK_TLS_ORIGIN_REQUIRED')
        self.origin=origin;self.host=u.netloc;self.clock=clock;self.lock=threading.RLock();self.repo=Path(__file__).resolve().parents[1]
        self.root=root.resolve()
        if self.root.is_relative_to(self.repo):raise RuntimeError('PRIVATE_STATE_MUST_BE_OUTSIDE_REPOSITORY')
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700);os.chmod(self.root,0o700)
        keydir=self.root/'keys';keydir.mkdir(exist_ok=True,mode=0o700)
        self.keyfile=keydir/'wrapping.key'
        dbfile=self.root/'data'/'synthetic.sqlite';dbfile.parent.mkdir(exist_ok=True,mode=0o700)
        if not self.keyfile.exists():
            if dbfile.exists():raise RuntimeError('KEY_MISSING_NO_SILENT_REPLACEMENT')
            fd=os.open(self.keyfile,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'wb') as f:f.write(AESGCM.generate_key(bit_length=256))
        if self.keyfile.is_symlink() or self.keyfile.stat().st_mode & 0o077:raise RuntimeError('PRIVATE_KEY_PERMISSIONS')
        self.kek=self.keyfile.read_bytes()
        if len(self.kek)!=32:raise RuntimeError('INVALID_KEY')
        self.db=sqlite3.connect(dbfile,check_same_thread=False,isolation_level=None)
        os.chmod(dbfile,0o600);self.db.row_factory=sqlite3.Row;self.db.execute('PRAGMA foreign_keys=ON')
        self.db.executescript('''
CREATE TABLE IF NOT EXISTS subjects(id TEXT PRIMARY KEY,epoch INTEGER NOT NULL DEFAULT 0,wrapped_key BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS invitations(hash TEXT PRIMARY KEY,subject TEXT NOT NULL UNIQUE,expires REAL NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS credentials(id TEXT PRIMARY KEY,subject TEXT NOT NULL,pub BLOB NOT NULL,counter INTEGER NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,subject TEXT NOT NULL,credential TEXT NOT NULL,epoch INTEGER NOT NULL,expires REAL NOT NULL,last_seen REAL NOT NULL,authenticated_at REAL NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ceremonies(id TEXT PRIMARY KEY,binding TEXT NOT NULL,subject TEXT NOT NULL,purpose TEXT NOT NULL,challenge BLOB NOT NULL,payload TEXT NOT NULL,session_hash TEXT,expires REAL NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,subject TEXT NOT NULL,version INTEGER NOT NULL,cipher BLOB NOT NULL,digest TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mandates(id TEXT PRIMARY KEY,subject TEXT NOT NULL,document TEXT NOT NULL,document_digest TEXT NOT NULL,templates TEXT NOT NULL,expires REAL NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,approved_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(request_id TEXT PRIMARY KEY,subject TEXT NOT NULL,mandate TEXT NOT NULL,claim_key TEXT NOT NULL,state TEXT NOT NULL,receipt TEXT);
CREATE TABLE IF NOT EXISTS fixture_receipts(id TEXT PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,subject TEXT NOT NULL,payload_digest TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS membership_applications(id TEXT PRIMARY KEY,subject TEXT NOT NULL UNIQUE,basis TEXT NOT NULL,evidence_cipher BLOB NOT NULL,evidence_digest TEXT NOT NULL,state TEXT NOT NULL,applied_at REAL NOT NULL,reviewed_at REAL,verifier_receipt TEXT,admission_receipt TEXT,college TEXT);
CREATE TABLE IF NOT EXISTS member_credentials(id TEXT PRIMARY KEY,subject TEXT NOT NULL UNIQUE,application TEXT NOT NULL,public_id TEXT NOT NULL UNIQUE,college TEXT NOT NULL,status TEXT NOT NULL,issued_at REAL NOT NULL,review_due REAL NOT NULL,eligibility_attestation TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ballot_entitlements(member_credential TEXT NOT NULL,election_id TEXT NOT NULL,issued_at REAL NOT NULL,PRIMARY KEY(member_credential,election_id));
CREATE TABLE IF NOT EXISTS ballot_tokens(hash TEXT PRIMARY KEY,election_id TEXT NOT NULL,college TEXT NOT NULL,expires REAL NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS secret_ballots(receipt TEXT PRIMARY KEY,election_id TEXT NOT NULL,college TEXT NOT NULL,choice TEXT NOT NULL,cast_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY AUTOINCREMENT,subject TEXT NOT NULL,event TEXT NOT NULL,at REAL NOT NULL,ref TEXT);
''')
        # Invitations provision only fixed fictional identities. They are never printed.
        invites={}
        with self.tx():
            for subject in FIXTURES:
                if not self.db.execute('SELECT id FROM subjects WHERE id=?',(subject,)).fetchone():
                    self.db.execute('INSERT INTO subjects(id,wrapped_key) VALUES(?,?)',(subject,self.seal(self.kek,AESGCM.generate_key(bit_length=256),('key:'+subject).encode())))
                    invite=secrets.token_urlsafe(32);invites[subject]=invite
                    self.db.execute('INSERT INTO invitations(hash,subject,expires) VALUES(?,?,?)',(token_hash(invite),subject,self.clock()+900))
        if invites:
            p=self.root/'test-invitations.json';fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as f:json.dump(invites,f)
        self.attempts=[]
    @contextmanager
    def tx(self):
        with self.lock:
            self.db.execute('BEGIN IMMEDIATE')
            try:yield
            except Exception:self.db.execute('ROLLBACK');raise
            else:self.db.execute('COMMIT')
    @staticmethod
    def seal(key,plaintext,aad):
        nonce=os.urandom(12);return nonce+AESGCM(key).encrypt(nonce,plaintext,aad)
    @staticmethod
    def unseal(key,cipher,aad):return AESGCM(key).decrypt(cipher[:12],cipher[12:],aad)
    def user_key(self,subject):
        r=self.db.execute('SELECT wrapped_key FROM subjects WHERE id=?',(subject,)).fetchone()
        if not r:raise Denied('NOT_FOUND',404)
        return self.unseal(self.kek,r['wrapped_key'],('key:'+subject).encode())
    def audit(self,subject,event,ref=None):self.db.execute('INSERT INTO audit(subject,event,at,ref) VALUES(?,?,?,?)',(subject,event,self.clock(),ref))
    def session(self,value):
        if not isinstance(value,str) or not 30<=len(value)<=160:raise Denied('AUTH_REQUIRED',401)
        r=self.db.execute('''SELECT s.*,u.epoch AS current_epoch,c.revoked AS key_revoked FROM sessions s JOIN subjects u ON u.id=s.subject JOIN credentials c ON c.id=s.credential WHERE s.hash=?''',(token_hash(value),)).fetchone()
        if not r or r['revoked'] or r['key_revoked'] or r['epoch']!=r['current_epoch'] or r['expires']<=self.clock() or r['last_seen']+300<=self.clock():raise Denied('AUTH_REQUIRED',401)
        self.db.execute('UPDATE sessions SET last_seen=? WHERE hash=?',(self.clock(),r['hash']));return dict(r)
    def new_session(self,subject,credential):
        value=secrets.token_urlsafe(32);epoch=self.db.execute('SELECT epoch FROM subjects WHERE id=?',(subject,)).fetchone()[0]
        self.db.execute('INSERT INTO sessions(hash,subject,credential,epoch,expires,last_seen,authenticated_at) VALUES(?,?,?,?,?,?,?)',(token_hash(value),subject,credential,epoch,self.clock()+900,self.clock(),self.clock()))
        self.audit(subject,'PASSKEY_AUTHENTICATED');return value
    def ceremony(self,subject,purpose,payload,binding,session_hash=None):
        challenge=os.urandom(32);cid=secrets.token_urlsafe(24)
        self.db.execute('INSERT INTO ceremonies(id,binding,subject,purpose,challenge,payload,session_hash,expires) VALUES(?,?,?,?,?,?,?,?)',(cid,token_hash(binding),subject,purpose,challenge,json.dumps(payload),session_hash,self.clock()+90))
        return cid,challenge
    def consume(self,cid,purpose,binding,session_hash=None):
        # Commit challenge consumption even if crypto verification subsequently fails.
        with self.tx():
            r=self.db.execute('SELECT * FROM ceremonies WHERE id=?',(cid,)).fetchone()
            if not r or r['used'] or r['expires']<=self.clock() or r['purpose']!=purpose or not secrets.compare_digest(r['binding'],token_hash(binding or '')) or r['session_hash']!=session_hash:raise Denied('CEREMONY_INVALID')
            self.db.execute('UPDATE ceremonies SET used=1 WHERE id=?',(cid,));return dict(r)
    def begin_registration(self,invite):
        with self.tx():
            r=self.db.execute('SELECT * FROM invitations WHERE hash=?',(token_hash(invite),)).fetchone()
            if not r or r['used'] or r['expires']<=self.clock():raise Denied('INVITATION_INVALID')
            binding=secrets.token_urlsafe(32);cid,challenge=self.ceremony(r['subject'],'REGISTER',{'invitation_hash':r['hash']},binding)
            opts=generate_registration_options(rp_id='localhost',rp_name='ojO · essai fictif uniquement',user_name=r['subject'],user_id=r['subject'].encode(),challenge=challenge,authenticator_selection=AuthenticatorSelectionCriteria(resident_key=ResidentKeyRequirement.REQUIRED,user_verification=UserVerificationRequirement.REQUIRED))
            return {'ceremony_id':cid,'options':json.loads(options_to_json(opts))},binding
    def finish_registration(self,cid,credential,binding):
        c=self.consume(cid,'REGISTER',binding)
        try:v=verify_registration_response(credential=credential,expected_challenge=c['challenge'],expected_rp_id='localhost',expected_origin=self.origin,require_user_verification=True)
        except Exception:raise Denied('PASSKEY_VERIFICATION_FAILED') from None
        with self.tx():
            invite=json.loads(c['payload'])['invitation_hash'];r=self.db.execute('SELECT * FROM invitations WHERE hash=?',(invite,)).fetchone()
            if not r or r['used'] or r['expires']<=self.clock():raise Denied('INVITATION_INVALID')
            if self.db.execute('SELECT 1 FROM credentials WHERE subject=?',(c['subject'],)).fetchone():raise Denied('RECOVERY_NOT_AVAILABLE')
            self.db.execute('UPDATE invitations SET used=1 WHERE hash=?',(invite,));kid=encoded(v.credential_id)
            self.db.execute('INSERT INTO credentials(id,subject,pub,counter) VALUES(?,?,?,?)',(kid,c['subject'],v.credential_public_key,v.sign_count))
            return self.new_session(c['subject'],kid)
    def authentication_options(self,subject,purpose,payload,binding,session_hash=None):
        creds=self.db.execute('SELECT id FROM credentials WHERE subject=? AND revoked=0',(subject,)).fetchall()
        if not creds:raise Denied('ACCOUNT_UNAVAILABLE')
        cid,challenge=self.ceremony(subject,purpose,payload,binding,session_hash)
        opts=generate_authentication_options(rp_id='localhost',challenge=challenge,user_verification=UserVerificationRequirement.REQUIRED,allow_credentials=[PublicKeyCredentialDescriptor(id=decoded(r['id'])) for r in creds])
        return {'ceremony_id':cid,'options':json.loads(options_to_json(opts))}
    def begin_login(self,subject):
        if subject not in FIXTURES:raise Denied('ACCOUNT_UNAVAILABLE')
        with self.tx():
            binding=secrets.token_urlsafe(32);return self.authentication_options(subject,'LOGIN',{},binding),binding
    def verify_auth(self,c,credential):
        kid=credential.get('id','');r=self.db.execute('SELECT * FROM credentials WHERE id=? AND subject=? AND revoked=0',(kid,c['subject'])).fetchone()
        if not r:raise Denied('PASSKEY_VERIFICATION_FAILED')
        try:
            handle=credential.get('response',{}).get('userHandle')
            if handle and decoded(handle)!=c['subject'].encode():raise ValueError('USER_HANDLE')
            v=verify_authentication_response(credential=credential,expected_challenge=c['challenge'],expected_rp_id='localhost',expected_origin=self.origin,credential_public_key=r['pub'],credential_current_sign_count=r['counter'],require_user_verification=True)
        except Exception:raise Denied('PASSKEY_VERIFICATION_FAILED') from None
        self.db.execute('UPDATE credentials SET counter=? WHERE id=?',(v.new_sign_count,kid));return kid
    def finish_login(self,cid,credential,binding):
        c=self.consume(cid,'LOGIN',binding)
        with self.tx():return self.new_session(c['subject'],self.verify_auth(c,credential))
    def create_document(self,session_token):
        with self.tx():
            s=self.session(session_token);subject=s['subject'];fixture=FIXTURES[subject];j={k:fixture[k] for k in ('name','address','reference')};j.update(mode=MODE,revision=1)
            did=secrets.token_urlsafe(18);cipher=self.seal(self.user_key(subject),raw(j),('doc:'+subject+':'+did+':1').encode())
            self.db.execute('INSERT INTO documents VALUES(?,?,?,?,?)',(did,subject,1,cipher,digest(j)));self.audit(subject,'SYNTHETIC_DOCUMENT_CREATED',did)
            return {'id':did,'version':1,'document':j,'digest':digest(j)}
    def document(self,subject,did):
        r=self.db.execute('SELECT * FROM documents WHERE id=? AND subject=?',(did,subject)).fetchone()
        if not r:raise Denied('NOT_FOUND',404)
        d=json.loads(self.unseal(self.user_key(subject),r['cipher'],('doc:'+subject+':'+did+':'+str(r['version'])).encode()))
        if digest(d)!=r['digest']:raise Denied('INTEGRITY_FAILURE',409)
        return dict(r),d
    def read_document(self,session_token,did):
        with self.tx():
            s=self.session(session_token);r,d=self.document(s['subject'],did);self.audit(s['subject'],'SYNTHETIC_DOCUMENT_READ',did)
            return {'id':did,'version':r['version'],'document':d,'digest':r['digest']}
    def replace_fixture(self,session_token,did):
        with self.tx():
            s=self.session(session_token);r,d=self.document(s['subject'],did);version=r['version']+1;d['revision']=version
            cipher=self.seal(self.user_key(s['subject']),raw(d),('doc:'+s['subject']+':'+did+':'+str(version)).encode())
            self.db.execute('UPDATE documents SET version=?,cipher=?,digest=? WHERE id=? AND subject=?',(version,cipher,digest(d),did,s['subject']));self.audit(s['subject'],'SYNTHETIC_DOCUMENT_REVISED',did);return {'version':version}
    def begin_mandate(self,session_token,did,templates):
        if not isinstance(templates,list) or not 1<=len(templates)<=2 or len(set(templates))!=len(templates) or any(t not in SERVICES for t in templates):raise Denied('SCOPE_NOT_ALLOWED')
        with self.tx():
            s=self.session(session_token);r,_=self.document(s['subject'],did)
            scope={'document':did,'document_digest':r['digest'],'templates':sorted(templates),'expires':self.clock()+600,'actions':['PREPARE','SUBMIT_TO_LOCAL_FIXTURE_ONLY'],'fee_eur':0,'signature':False,'publish':False,'recipient_scope':'service-test.invalid','mode':MODE}
            options=self.authentication_options(s['subject'],'MANDATE',scope,session_token,s['hash']);options['scope']=scope;return options
    def finish_mandate(self,session_token,cid,credential):
        with self.tx():s=self.session(session_token)
        c=self.consume(cid,'MANDATE',session_token,s['hash'])
        with self.tx():
            s=self.session(session_token);self.verify_auth(c,credential);scope=json.loads(c['payload']);r,_=self.document(s['subject'],scope['document'])
            if scope['expires']<=self.clock() or scope['document_digest']!=r['digest']:raise Denied('SCOPE_CHANGED',409)
            mid=secrets.token_urlsafe(18);self.db.execute('INSERT INTO mandates VALUES(?,?,?,?,?,?,0,?)',(mid,s['subject'],scope['document'],r['digest'],json.dumps(scope['templates']),scope['expires'],self.clock()));self.audit(s['subject'],'LIMITED_MANDATE_APPROVED',mid)
            return {'id':mid,'scope':scope,'representation_of_real_citizen':False}
    def request(self,s,mid,template):
        m=self.db.execute('SELECT * FROM mandates WHERE id=? AND subject=?',(mid,s['subject'])).fetchone()
        if not m:raise Denied('NOT_FOUND',404)
        if m['revoked'] or m['expires']<=self.clock():raise Denied('MANDATE_EXPIRED_OR_REVOKED')
        if template not in json.loads(m['templates']):raise Denied('SCOPE_NOT_ALLOWED')
        r,d=self.document(s['subject'],m['document'])
        if r['digest']!=m['document_digest']:raise Denied('DOCUMENT_CHANGED_REAUTHORIZE',409)
        request={'id':mid+':'+template,'from':'citizen@fixture.invalid','to':SERVICES[template],'subject':'[TEST FICTIF] '+template,'body':json.dumps(d,ensure_ascii=False),'purpose_class':'PUBLIC_INFORMATION_REQUEST','cost_eur':0,'attachments':[]}
        return dict(m),request
    def prepare(self,session_token,mid,template):
        with self.tx():
            s=self.session(session_token);m,r=self.request(s,mid,template);self.audit(s['subject'],'FIXTURE_REQUEST_PREPARED',r['id']);return {'request_id':r['id'],'document_digest':m['document_digest'],'template':template,'destination':r['to'],'body':r['body'],'state':'PREPARED_NOT_SENT','mode':MODE}
    def submit_fixture(self,session_token,mid,template):
        # Entire fixture transaction shares the authority lock: revoke cannot interleave.
        with self.tx():
            s=self.session(session_token);m,request=self.request(s,mid,template)
            authority=FixtureAuthority(self,s,mid,template);store=FixtureMissionStore(self,s['subject'],mid);provider=LocalReceiptFixture(self,s['subject'])
            result=dispatch_once(request,authorizer=authority,provider=provider,mission_store=store,at=iso(self.clock()))
            self.audit(s['subject'],'LOCAL_FIXTURE_ATTEMPT',request['id']);result.update(mode=MODE,real_external_action=False,signature=False);return result
    def revoke_mandate(self,session_token,mid):
        with self.tx():
            s=self.session(session_token);r=self.db.execute('SELECT id FROM mandates WHERE id=? AND subject=?',(mid,s['subject'])).fetchone()
            if not r:raise Denied('NOT_FOUND',404)
            self.db.execute('UPDATE mandates SET revoked=1 WHERE id=?',(mid,));self.audit(s['subject'],'MANDATE_REVOKED',mid);return {'state':'REVOKED','past_receipts_erased':False}
    def revoke_all(self,session_token):
        with self.tx():
            s=self.session(session_token);u=s['subject'];self.db.execute('UPDATE subjects SET epoch=epoch+1 WHERE id=?',(u,));self.db.execute('UPDATE sessions SET revoked=1 WHERE subject=?',(u,));self.db.execute('UPDATE credentials SET revoked=1 WHERE subject=?',(u,));self.db.execute('UPDATE mandates SET revoked=1 WHERE subject=?',(u,));self.db.execute('UPDATE member_credentials SET revoked=1,status=? WHERE subject=?',('REVOKED_SYNTHETIC',u));self.audit(u,'ALL_ACCESS_REVOKED');return {'state':'ALL_ACCESS_REVOKED','membership_revoked':True,'past_secret_ballots_erased':False,'recovery':'UNAVAILABLE_IN_PILOT'}
    def logout(self,session_token):
        with self.tx():
            s=self.session(session_token);self.db.execute('UPDATE sessions SET revoked=1 WHERE hash=?',(s['hash'],));return {'state':'LOGGED_OUT'}
    def member_public_id(self,subject):
        mac=hmac.new(self.kek,b'member-public-v1:'+subject.encode(),hashlib.sha256).digest()
        return 'soc_'+encoded(mac)[:24]

    def apply_membership_fixture(self,session_token):
        """Synthetic-only private application. No real identity verification claim."""
        with self.tx():
            sess=self.session(session_token);subject=sess['subject'];fixture=FIXTURES.get(subject)
            if not fixture:raise Denied('FIXTURE_MEMBERSHIP_UNAVAILABLE')
            existing=self.db.execute('SELECT id,state FROM membership_applications WHERE subject=?',(subject,)).fetchone()
            if existing:return {'id':existing['id'],'state':existing['state'],'mode':MODE,'real_identity_verified':False}
            evidence={'basis':fixture['membership_basis'],'evidence':fixture['membership_evidence'],'reference':fixture['reference'],'synthetic_only':True}
            aid=secrets.token_urlsafe(18);plain=raw(evidence);dig=digest(evidence)
            cipher=self.seal(self.user_key(subject),plain,('membership:'+subject+':'+aid).encode())
            self.db.execute('INSERT INTO membership_applications(id,subject,basis,evidence_cipher,evidence_digest,state,applied_at) VALUES(?,?,?,?,?,?,?)',(aid,subject,fixture['membership_basis'],cipher,dig,'ELIGIBILITY_REVIEW',self.clock()))
            self.audit(subject,'SYNTHETIC_MEMBERSHIP_APPLICATION_CREATED',aid)
            return {'id':aid,'state':'ELIGIBILITY_REVIEW','mode':MODE,'real_identity_verified':False,'public_identity_written':False}

    def membership_evidence(self,application_id):
        r=self.db.execute('SELECT * FROM membership_applications WHERE id=?',(application_id,)).fetchone()
        if not r:raise Denied('NOT_FOUND',404)
        evidence=json.loads(self.unseal(self.user_key(r['subject']),r['evidence_cipher'],('membership:'+r['subject']+':'+application_id).encode()))
        if digest(evidence)!=r['evidence_digest']:raise Denied('INTEGRITY_FAILURE',409)
        return dict(r),evidence

    def review_membership_fixture(self,application_id,*,identity_verifier,admission_authority,statutes_version):
        """Admission is authority-controlled, never self-approved by the applicant."""
        if identity_verifier is None or admission_authority is None or not statutes_version:
            raise Denied('MEMBERSHIP_PRIVATE_AUTHORITIES_REQUIRED')
        with self.tx():
            row,evidence=self.membership_evidence(application_id)
            if row['state']!='ELIGIBILITY_REVIEW':raise Denied('APPLICATION_NOT_REVIEWABLE',409)
            verification=identity_verifier.verify(row['subject'],evidence)
            if verification.get('identity_verified') is not True or verification.get('eligibility_verified') is not True:
                raise Denied('IDENTITY_OR_ELIGIBILITY_NOT_VERIFIED')
            decision=admission_authority.decide(row['subject'],verification,statutes_version)
            if decision.get('approved') is not True:raise Denied('ADMISSION_NOT_APPROVED')
            expected=FIXTURES[row['subject']]['membership_college']
            if decision.get('college')!=expected:raise Denied('COLLEGE_ASSIGNMENT_MISMATCH')
            public_id=self.member_public_id(row['subject'])
            cid=secrets.token_urlsafe(18)
            attestation=digest({'application':application_id,'evidence_digest':row['evidence_digest'],'verifier_receipt':verification.get('verifier_receipt_id'),'admission_receipt':decision.get('admission_receipt_id'),'college':decision['college'],'statutes_version':statutes_version})
            self.db.execute('UPDATE membership_applications SET state=?,reviewed_at=?,verifier_receipt=?,admission_receipt=?,college=? WHERE id=?',('ADMITTED_SYNTHETIC',self.clock(),verification.get('verifier_receipt_id'),decision.get('admission_receipt_id'),decision['college'],application_id))
            self.db.execute('INSERT INTO member_credentials(id,subject,application,public_id,college,status,issued_at,review_due,eligibility_attestation) VALUES(?,?,?,?,?,?,?,?,?)',(cid,row['subject'],application_id,public_id,decision['college'],'ACTIVE_SYNTHETIC',self.clock(),self.clock()+365*86400,attestation))
            self.audit(row['subject'],'SYNTHETIC_MEMBERSHIP_ADMITTED',cid)
            return self.public_membership_receipt_by_subject(row['subject'])

    def public_membership_receipt_by_subject(self,subject):
        r=self.db.execute('SELECT public_id,college,status,issued_at,review_due,eligibility_attestation,revoked FROM member_credentials WHERE subject=?',(subject,)).fetchone()
        if not r:return None
        return {'schema':'LA_BETE_PUBLIC_MEMBERSHIP_RECEIPT_V1','member_public_id':r['public_id'],'college':r['college'],'status':'REVOKED' if r['revoked'] else r['status'],'issued_at':iso(r['issued_at']),'review_due':iso(r['review_due']),'eligibility':'VERIFIED_IN_PRIVATE_SYNTHETIC_PILOT','eligibility_attestation':r['eligibility_attestation'],'identity_fields_exposed':False,'legal_societaire_claim':False,'mode':MODE}

    def public_membership_receipt(self,session_token):
        with self.tx():
            sess=self.session(session_token)
            receipt=self.public_membership_receipt_by_subject(sess['subject'])
            if not receipt:raise Denied('MEMBERSHIP_NOT_ACTIVE',404)
            return receipt

    def issue_secret_ballot_token(self,session_token,election_id,ttl=300):
        """One entitlement per election. Token store carries college, never member identity/public id.
        Public unlinkability is proven; issuer-level cryptographic unlinkability is NOT claimed.
        """
        if not isinstance(election_id,str) or not 4<=len(election_id)<=120 or ttl<30 or ttl>900:raise Denied('INVALID_ELECTION')
        with self.tx():
            sess=self.session(session_token);m=self.db.execute('SELECT * FROM member_credentials WHERE subject=? AND revoked=0',(sess['subject'],)).fetchone()
            if not m or m['status']!='ACTIVE_SYNTHETIC' or m['review_due']<=self.clock():raise Denied('VOTING_RIGHTS_NOT_ACTIVE')
            try:self.db.execute('INSERT INTO ballot_entitlements(member_credential,election_id,issued_at) VALUES(?,?,?)',(m['id'],election_id,self.clock()))
            except sqlite3.IntegrityError:raise Denied('BALLOT_TOKEN_ALREADY_ISSUED',409) from None
            token=secrets.token_urlsafe(32)
            self.db.execute('INSERT INTO ballot_tokens(hash,election_id,college,expires) VALUES(?,?,?,?)',(token_hash(token),election_id,m['college'],self.clock()+ttl))
            self.audit(sess['subject'],'SECRET_BALLOT_TOKEN_ISSUED',election_id)
            return {'token':token,'election_id':election_id,'expires_at':iso(self.clock()+ttl),'member_identity_embedded':False,'member_public_id_embedded':False,'college_disclosed_to_ballot_box':True,'issuer_unlinkability':'NOT_PROVEN_IN_SYNTHETIC_PILOT','mode':MODE}

    def cast_secret_ballot_fixture(self,token,election_id,choice):
        if choice not in ('YES','NO','ABSTAIN'):raise Denied('INVALID_BALLOT_CHOICE')
        with self.tx():
            r=self.db.execute('SELECT * FROM ballot_tokens WHERE hash=? AND election_id=?',(token_hash(token),election_id)).fetchone()
            if not r or r['used'] or r['expires']<=self.clock():raise Denied('BALLOT_TOKEN_INVALID_OR_USED')
            self.db.execute('UPDATE ballot_tokens SET used=1 WHERE hash=?',(r['hash'],))
            receipt='vote_'+secrets.token_urlsafe(18)
            self.db.execute('INSERT INTO secret_ballots(receipt,election_id,college,choice,cast_at) VALUES(?,?,?,?,?)',(receipt,election_id,r['college'],choice,self.clock()))
            return {'receipt':receipt,'election_id':election_id,'college':r['college'],'choice_recorded':True,'member_identity_recorded':False,'member_public_id_recorded':False,'mode':MODE}

    def secret_ballot_tally(self,election_id):
        rows=self.db.execute('SELECT college,choice,COUNT(*) n FROM secret_ballots WHERE election_id=? GROUP BY college,choice',(election_id,)).fetchall()
        out={}
        for r in rows:out.setdefault(r['college'],{'YES':0,'NO':0,'ABSTAIN':0})[r['choice']]=r['n']
        return {'schema':'LA_BETE_PRIVATE_BALLOT_TALLY_V1','election_id':election_id,'colleges':out,'identity_fields_exposed':False,'public_member_ids_exposed':False,'mode':MODE}

    def overview(self,session_token):
        with self.tx():
            s=self.session(session_token);u=s['subject'];return {'mode':MODE,'subject':u,'identity_verified':False,'documents':[dict(x) for x in self.db.execute('SELECT id,version,digest FROM documents WHERE subject=?',(u,))],'mandates':[dict(x) for x in self.db.execute('SELECT id,document,expires,revoked FROM mandates WHERE subject=?',(u,))],'membership':self.public_membership_receipt_by_subject(u),'receipts':[dict(x) for x in self.db.execute('SELECT id,request_id,payload_digest FROM fixture_receipts WHERE subject=?',(u,))],'audit':[dict(x) for x in self.db.execute('SELECT event,at,ref FROM audit WHERE subject=? ORDER BY seq DESC LIMIT 50',(u,))]}

class FixtureIdentityVerifier:
    """Synthetic proof adapter. It never verifies a real-world identity."""
    def verify(self,subject,evidence):
        fixture=FIXTURES.get(subject)
        if not fixture or evidence.get('reference')!=fixture['reference'] or evidence.get('evidence')!=fixture['membership_evidence']:
            return {'identity_verified':False,'eligibility_verified':False}
        return {'identity_verified':True,'eligibility_verified':True,'basis':fixture['membership_basis'],'verifier_receipt_id':'FIXTURE_IDV_'+token_hash(subject)[:16],'real_world_identity':False}

class FixtureAdmissionAuthority:
    """Synthetic admission authority; real admission must follow adopted statutes."""
    def decide(self,subject,verification,statutes_version):
        fixture=FIXTURES.get(subject)
        if not fixture or verification.get('identity_verified') is not True or verification.get('eligibility_verified') is not True:
            return {'approved':False}
        return {'approved':True,'college':fixture['membership_college'],'admission_receipt_id':'FIXTURE_ADMISSION_'+token_hash(subject+statutes_version)[:16],'binding_legal_admission':False}

class FixtureAuthority:
    def __init__(self,pilot,session,mid,template):self.p=pilot;self.s=session;self.mid=mid;self.template=template
    def authorize(self,request,now):
        m,expected=self.p.request(self.s,self.mid,self.template)
        if raw(request)!=raw(expected):raise Denied('REQUEST_CHANGED')
        return {'action':'SEND_PUBLIC_INFORMATION_REQUEST','revoked':False,'not_before':iso(m['approved_at']),'expires_at':iso(m['expires']),'recipient':expected['to'],'authority_receipt_id':m['id'],'contact_evidence_id':'LOCAL_FIXTURE_NOT_OFFICIAL_ORGANISM','request_sha256':digest({k:expected.get(k) for k in ('from','to','subject','body','purpose_class','cost_eur','attachments')})}
class FixtureMissionStore:
    def __init__(self,pilot,subject,mid):self.p=pilot;self.subject=subject;self.mid=mid
    def claim_once(self,request_id,key,permit,now):
        r=self.p.db.execute('INSERT OR IGNORE INTO attempts(request_id,subject,mandate,claim_key,state) VALUES(?,?,?,?,?)',(request_id,self.subject,self.mid,key,'SENDING'));return bool(r.rowcount)
    def record(self,request_id,key,state):self.p.db.execute('UPDATE attempts SET state=?,receipt=? WHERE request_id=? AND subject=? AND claim_key=?',(state['state'],json.dumps(state),request_id,self.subject,key))
class LocalReceiptFixture:
    """No sockets, email API or HTTP call: a test receipt, never a delivery claim."""
    def __init__(self,pilot,subject):self.p=pilot;self.subject=subject
    def send(self,request,idempotency_key):
        if request['to'] not in SERVICES.values():raise Denied('DESTINATION_FORBIDDEN')
        rid='FIXTURE-'+secrets.token_hex(12);self.p.db.execute('INSERT INTO fixture_receipts VALUES(?,?,?,?)',(rid,request['id'],self.subject,digest(request)))
        return {'message_id':rid,'provider':'LOCAL_SYNTHETIC_RECEIVER','external_delivery':False,'request_digest':digest(request)}

class PilotHandler(BaseHTTPRequestHandler):
    server_version='OJO-Synthetic-Pilot';sys_version='';protocol_version='HTTP/1.0'
    def log_message(self,*args):pass
    def setup(self):super().setup();self.connection.settimeout(8)
    def headers_ok(self,write=False):
        p=self.server.pilot
        if self.headers.get('Host')!=p.host:raise Denied('HOST_REJECTED')
        if self.headers.get('Origin') not in (None,p.origin):raise Denied('ORIGIN_REJECTED')
        if self.headers.get('Sec-Fetch-Site') in ('cross-site','same-site'):raise Denied('CROSS_SITE_REJECTED')
        if write:
            if self.headers.get('Origin')!=p.origin:raise Denied('ORIGIN_REQUIRED')
            if self.headers.get_content_type()!='application/json':raise Denied('JSON_REQUIRED',415)
            if self.headers.get('Transfer-Encoding'):raise Denied('TRANSFER_ENCODING_REJECTED',400)
    def cookies(self):
        try:c=SimpleCookie();c.load(self.headers.get('Cookie',''));return {k:v.value for k,v in c.items()}
        except Exception:return {}
    def respond(self,data,status=200,cookies=None,content_type='application/json; charset=utf-8'):
        body=raw(data) if not isinstance(data,bytes) else data
        self.send_response(status);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store, private');self.send_header('Pragma','no-cache');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Frame-Options','DENY');self.send_header('Permissions-Policy','camera=(), microphone=(), geolocation=()');self.send_header('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for name,value in (cookies or {}).items():self.send_header('Set-Cookie',f'{name}={value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age={900 if value else 0}')
        self.end_headers();self.wfile.write(body)
    def do_GET(self):
        try:
            self.headers_ok();u=urlsplit(self.path)
            if u.query or u.fragment:raise Denied('URL_PARAMETERS_REJECTED',400)
            assets={'/':('citizen_pilot.html','text/html; charset=utf-8'),'/pilot.js':('citizen_pilot.js','text/javascript; charset=utf-8'),'/pilot.css':('citizen_pilot.css','text/css; charset=utf-8')}
            if u.path in assets:
                name,mime=assets[u.path];return self.respond((Path(__file__).parent/'private_pilot_ui'/name).read_bytes(),content_type=mime)
            token=self.cookies().get(SESSION,'')
            if u.path=='/api/session':return self.respond(self.server.pilot.overview(token))
            if u.path=='/api/membership':return self.respond(self.server.pilot.public_membership_receipt(token))
            if u.path.startswith('/api/documents/') and u.path.count('/')==3:return self.respond(self.server.pilot.read_document(token,u.path.split('/')[-1]))
            raise Denied('NOT_FOUND',404)
        except Denied as e:self.respond({'error':e.code,'mode':MODE},e.status)
        except Exception:self.respond({'error':'INTERNAL_FAILURE','mode':MODE},500)
    def do_POST(self):
        try:
            self.headers_ok(True);u=urlsplit(self.path)
            if u.query or u.fragment:raise Denied('URL_PARAMETERS_REJECTED',400)
            size=int(self.headers.get('Content-Length','0'))
            if not 2<=size<=24000:raise Denied('BODY_SIZE_REJECTED',413)
            j=json.loads(self.rfile.read(size))
            if not isinstance(j,dict):raise Denied('OBJECT_REQUIRED',400)
            fields={'/api/register/options':{'invite'},'/api/register/verify':{'ceremony_id','credential'},'/api/login/options':{'subject'},'/api/login/verify':{'ceremony_id','credential'},'/api/documents':set(),'/api/documents/replace-fixture':{'document'},'/api/mandates/options':{'document','templates'},'/api/mandates/verify':{'ceremony_id','credential'},'/api/prepare':{'mandate','template'},'/api/submit-fixture':{'mandate','template'},'/api/membership/apply':set(),'/api/ballot/token':{'election_id'},'/api/ballot/cast':{'token','election_id','choice'},'/api/revoke':{'mandate'},'/api/revoke-all':set(),'/api/logout':set()}
            if u.path not in fields:raise Denied('NOT_FOUND',404)
            if set(j)!=fields[u.path]:raise Denied('FIELDS_NOT_ALLOWED',400)
            # All endpoints accept only protocol fields or fixed synthetic selectors. No upload.
            p=self.server.pilot;c=self.cookies();t=c.get(SESSION,'');binding=c.get(PREAUTH,'')
            if u.path.endswith('/options') and '/mandates/' not in u.path:
                with p.lock:
                    now=p.clock();p.attempts[:]=[x for x in p.attempts if now-x<60]
                    if len(p.attempts)>=20:raise Denied('RATE_LIMITED',429)
                    p.attempts.append(now)
            if u.path=='/api/register/options':r,b=p.begin_registration(j['invite']);return self.respond(r,cookies={PREAUTH:b})
            if u.path=='/api/register/verify':s=p.finish_registration(j['ceremony_id'],j['credential'],binding);return self.respond({'state':'AUTHENTICATED','mode':MODE},cookies={SESSION:s,PREAUTH:''})
            if u.path=='/api/login/options':r,b=p.begin_login(j['subject']);return self.respond(r,cookies={PREAUTH:b})
            if u.path=='/api/login/verify':s=p.finish_login(j['ceremony_id'],j['credential'],binding);return self.respond({'state':'AUTHENTICATED','mode':MODE},cookies={SESSION:s,PREAUTH:''})
            if u.path=='/api/documents':return self.respond(p.create_document(t))
            if u.path=='/api/documents/replace-fixture':return self.respond(p.replace_fixture(t,j['document']))
            if u.path=='/api/mandates/options':return self.respond(p.begin_mandate(t,j['document'],j['templates']))
            if u.path=='/api/mandates/verify':return self.respond(p.finish_mandate(t,j['ceremony_id'],j['credential']))
            if u.path=='/api/prepare':return self.respond(p.prepare(t,j['mandate'],j['template']))
            if u.path=='/api/submit-fixture':return self.respond(p.submit_fixture(t,j['mandate'],j['template']))
            if u.path=='/api/membership/apply':return self.respond(p.apply_membership_fixture(t))
            if u.path=='/api/ballot/token':return self.respond(p.issue_secret_ballot_token(t,j['election_id']))
            if u.path=='/api/ballot/cast':return self.respond(p.cast_secret_ballot_fixture(j['token'],j['election_id'],j['choice']))
            if u.path=='/api/revoke':return self.respond(p.revoke_mandate(t,j['mandate']))
            if u.path=='/api/revoke-all':return self.respond(p.revoke_all(t),cookies={SESSION:'',PREAUTH:''})
            if u.path=='/api/logout':return self.respond(p.logout(t),cookies={SESSION:''})
        except Denied as e:self.respond({'error':e.code,'mode':MODE},e.status)
        except (TypeError,ValueError,KeyError):self.respond({'error':'INVALID_REQUEST','mode':MODE},400)
        except Exception:self.respond({'error':'INTERNAL_FAILURE','mode':MODE},500)

def run_fixture_server(root:Path,port=0):
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes,serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import NameOID
    if os.environ.get('OJO_CITIZEN_SYNTHETIC_ONLY')!='1':raise RuntimeError('SYNTHETIC_MODE_REQUIRED')
    root=root.resolve();repo=Path(__file__).resolve().parents[1]
    if root.is_relative_to(repo):raise RuntimeError('PRIVATE_STATE_MUST_BE_OUTSIDE_REPOSITORY')
    root.mkdir(mode=0o700,parents=True,exist_ok=True);os.chmod(root,0o700)
    server=HTTPServer(('127.0.0.1',port),PilotHandler);origin='https://localhost:'+str(server.server_port);server.pilot=Pilot(root,origin)
    key=ec.generate_private_key(ec.SECP256R1());name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'localhost')]);now=datetime.now(timezone.utc)
    cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=1)).not_valid_after(now+timedelta(days=1)).add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost')]),critical=False).sign(key,hashes.SHA256())
    tls=root/'tls';tls.mkdir(mode=0o700,exist_ok=True)
    for name,data in [('certificate.pem',cert.public_bytes(serialization.Encoding.PEM)),('key.pem',key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))]:
        fd=os.open(tls/name,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
        with os.fdopen(fd,'wb') as f:f.write(data)
    context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.minimum_version=ssl.TLSVersion.TLSv1_2;context.load_cert_chain(tls/'certificate.pem',tls/'key.pem');server.socket=context.wrap_socket(server.socket,server_side=True)
    spki=base64.b64encode(hashlib.sha256(key.public_key().public_bytes(serialization.Encoding.DER,serialization.PublicFormat.SubjectPublicKeyInfo)).digest()).decode()
    info={'origin':origin,'tls_spki_sha256_b64':spki,'mode':MODE,'publicly_trusted_certificate':False,'real_data_allowed':False}
    fd=os.open(root/'fixture-server.json',os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as f:json.dump(info,f)
    print('LOCAL_SYNTHETIC_PILOT_READY',flush=True)
    try:server.serve_forever()
    finally:server.server_close();server.pilot.db.close()
