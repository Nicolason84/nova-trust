"""Local, synthetic-only proof of a private citizen boundary. NOT production.
No real enrolment, upload, public listener, administrative connector, or recovery.
Uses py_webauthn verification and cryptography AEAD; reuses dispatch_once.
Secrets, database and TLS material must be outside the repository.
"""
from __future__ import annotations
import base64, hashlib, json, os, secrets, sqlite3, ssl, threading, time
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
 'test-citizen-a':{'name':'Citoyen fictif A','address':'Adresse de démonstration A','reference':'SYNTHETIC_A_NO_REAL_PERSON'},
 'test-citizen-b':{'name':'Citoyen fictif B','address':'Adresse de démonstration B','reference':'SYNTHETIC_B_NO_REAL_PERSON'}}
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
            s=self.session(session_token);subject=s['subject'];j={**FIXTURES[subject],'mode':MODE,'revision':1}
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
            s=self.session(session_token);u=s['subject'];self.db.execute('UPDATE subjects SET epoch=epoch+1 WHERE id=?',(u,));self.db.execute('UPDATE sessions SET revoked=1 WHERE subject=?',(u,));self.db.execute('UPDATE credentials SET revoked=1 WHERE subject=?',(u,));self.db.execute('UPDATE mandates SET revoked=1 WHERE subject=?',(u,));self.audit(u,'ALL_ACCESS_REVOKED');return {'state':'ALL_ACCESS_REVOKED','recovery':'UNAVAILABLE_IN_PILOT'}
    def logout(self,session_token):
        with self.tx():
            s=self.session(session_token);self.db.execute('UPDATE sessions SET revoked=1 WHERE hash=?',(s['hash'],));return {'state':'LOGGED_OUT'}
    def overview(self,session_token):
        with self.tx():
            s=self.session(session_token);u=s['subject'];return {'mode':MODE,'subject':u,'identity_verified':False,'documents':[dict(x) for x in self.db.execute('SELECT id,version,digest FROM documents WHERE subject=?',(u,))],'mandates':[dict(x) for x in self.db.execute('SELECT id,document,expires,revoked FROM mandates WHERE subject=?',(u,))],'receipts':[dict(x) for x in self.db.execute('SELECT id,request_id,payload_digest FROM fixture_receipts WHERE subject=?',(u,))],'audit':[dict(x) for x in self.db.execute('SELECT event,at,ref FROM audit WHERE subject=? ORDER BY seq DESC LIMIT 50',(u,))]}

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
            fields={'/api/register/options':{'invite'},'/api/register/verify':{'ceremony_id','credential'},'/api/login/options':{'subject'},'/api/login/verify':{'ceremony_id','credential'},'/api/documents':set(),'/api/documents/replace-fixture':{'document'},'/api/mandates/options':{'document','templates'},'/api/mandates/verify':{'ceremony_id','credential'},'/api/prepare':{'mandate','template'},'/api/submit-fixture':{'mandate','template'},'/api/revoke':{'mandate'},'/api/revoke-all':set(),'/api/logout':set()}
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
