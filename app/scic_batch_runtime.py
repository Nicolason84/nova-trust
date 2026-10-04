"""Persistent privacy batcher for opaque OHTTP ballot envelopes.

No ballot plaintext or member identity is accepted. Small anonymity sets are
rolled into the next window rather than released. Production threshold/window
values remain externally reviewed policy inputs; this module does not invent them.
"""
from __future__ import annotations
import hashlib, os, sqlite3, threading
from pathlib import Path

SCHEMA='LA_BETE_SCIC_PERSISTENT_BATCH_RUNTIME_V1'

class BatchRuntimeError(RuntimeError):
    pass

class PersistentBatchRuntime:
    def __init__(self,root:Path,minimum_set_size:int,window_seconds:int):
        if minimum_set_size<2:raise ValueError('MINIMUM_ANONYMITY_SET_TOO_SMALL')
        if window_seconds<=0:raise ValueError('INVALID_BATCH_WINDOW')
        self.root=Path(root).resolve()
        self.root.mkdir(parents=True,exist_ok=True,mode=0o700)
        os.chmod(self.root,0o700)
        self.minimum_set_size=minimum_set_size
        self.window_seconds=window_seconds
        self.lock=threading.RLock()
        dbpath=self.root/'batch.sqlite'
        self.db=sqlite3.connect(dbpath,check_same_thread=False,isolation_level=None)
        os.chmod(dbpath,0o600)
        self.db.row_factory=sqlite3.Row
        self.db.executescript("""
CREATE TABLE IF NOT EXISTS envelopes(
 digest TEXT PRIMARY KEY,
 college TEXT NOT NULL,
 original_bucket INTEGER NOT NULL,
 effective_bucket INTEGER NOT NULL,
 payload BLOB NOT NULL,
 received_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'QUEUED'
);
CREATE TABLE IF NOT EXISTS releases(
 release_id TEXT PRIMARY KEY,
 college TEXT NOT NULL,
 bucket INTEGER NOT NULL,
 count INTEGER NOT NULL,
 released_at INTEGER NOT NULL
);
""")

    def close(self):
        self.db.close()

    def bucket(self,timestamp:int):
        if not isinstance(timestamp,int) or timestamp<0:raise ValueError('INVALID_TIMESTAMP')
        return timestamp//self.window_seconds

    def submit(self,envelope:bytes,college:str,timestamp:int):
        if not isinstance(envelope,bytes) or len(envelope)<32:raise ValueError('OPAQUE_OHTTP_ENVELOPE_REQUIRED')
        if not isinstance(college,str) or not college:raise ValueError('COLLEGE_REQUIRED')
        digest=hashlib.sha256(envelope).hexdigest()
        b=self.bucket(timestamp)
        with self.lock:
            try:
                self.db.execute('INSERT INTO envelopes(digest,college,original_bucket,effective_bucket,payload,received_at) VALUES(?,?,?,?,?,?)',(digest,college,b,b,envelope,timestamp))
            except sqlite3.IntegrityError:
                raise BatchRuntimeError('DUPLICATE_ENVELOPE') from None
        return {'schema':SCHEMA,'digest':digest,'college':college,'bucket':b,'queued':True,'plaintext_stored':False,'identity_stored':False}

    def pending_count(self,college:str,bucket:int):
        return self.db.execute("SELECT COUNT(*) FROM envelopes WHERE college=? AND effective_bucket=? AND state='QUEUED'",(college,bucket)).fetchone()[0]

    def release(self,college:str,bucket:int,now:int):
        if self.bucket(now)<=bucket:
            return {'released':False,'reason':'WINDOW_OPEN','college':college,'bucket':bucket}
        with self.lock:
            self.db.execute('BEGIN IMMEDIATE')
            try:
                rows=self.db.execute("SELECT digest,payload FROM envelopes WHERE college=? AND effective_bucket=? AND state='QUEUED' ORDER BY digest",(college,bucket)).fetchall()
                if len(rows)<self.minimum_set_size:
                    next_bucket=bucket+1
                    self.db.execute("UPDATE envelopes SET effective_bucket=? WHERE college=? AND effective_bucket=? AND state='QUEUED'",(next_bucket,college,bucket))
                    self.db.execute('COMMIT')
                    return {'released':False,'reason':'ROLLED_FORWARD_SMALL_SET','college':college,'bucket':bucket,'next_bucket':next_bucket,'count':len(rows),'individual_timestamps':False}
                material='|'.join(r['digest'] for r in rows).encode()
                release_id='batch_'+hashlib.sha256(college.encode()+b'|'+str(bucket).encode()+b'|'+material).hexdigest()[:24]
                self.db.execute("UPDATE envelopes SET state='RELEASED' WHERE college=? AND effective_bucket=? AND state='QUEUED'",(college,bucket))
                self.db.execute('INSERT INTO releases VALUES(?,?,?,?,?)',(release_id,college,bucket,len(rows),now))
                self.db.execute('COMMIT')
                return {'released':True,'release_id':release_id,'college':college,'bucket':bucket,'count':len(rows),'envelopes':[bytes(r['payload']) for r in rows],'individual_timestamps':False}
            except Exception:
                self.db.execute('ROLLBACK')
                raise

    def public_receipt(self,result):
        return {'schema':'LA_BETE_SCIC_BATCH_PUBLIC_RECEIPT_V1','released':bool(result.get('released')),'reason':result.get('reason'),'release_id':result.get('release_id'),'college':result.get('college'),'bucket':result.get('bucket'),'count':result.get('count',0),'individual_timestamps':False,'envelopes_public':False,'digests_public':False}

    def health(self):
        return {'schema':SCHEMA,'queued':self.db.execute("SELECT COUNT(*) FROM envelopes WHERE state='QUEUED'").fetchone()[0],'released':self.db.execute("SELECT COUNT(*) FROM envelopes WHERE state='RELEASED'").fetchone()[0],'release_batches':self.db.execute('SELECT COUNT(*) FROM releases').fetchone()[0],'minimum_set_size':self.minimum_set_size,'window_seconds':self.window_seconds}
