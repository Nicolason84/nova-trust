from __future__ import annotations
import hashlib,json,subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'audits/scic_privacy/SCIC_PRIVACY_AUDIT_PACK_V1.json'
CRITICAL=[
 '.github/workflows/scic-production-privacy-gate.yml',
 'privacy/rfc9474_gate/go.mod','privacy/rfc9474_gate/go.sum','privacy/rfc9474_gate/rfc9474_gate_test.go','privacy/rfc9474_gate/cmd/scic-circl-runtime/main.go',
 'privacy/ohttp_runtime/Cargo.toml','privacy/ohttp_runtime/Cargo.lock','privacy/ohttp_runtime/src/main.rs',
 'app/scic_circl_runtime.py','app/scic_ohttp_runtime.py','app/scic_batch_runtime.py','app/scic_key_custody.py','app/scic_privacy_gate.py',
 'scripts/test_scic_circl_runtime.py','scripts/test_scic_ohttp_runtime.py','scripts/test_scic_batch_runtime.py','scripts/test_scic_ohttp_batch_pipeline.py','scripts/test_scic_key_custody.py','scripts/test_scic_privacy_gate.py',
 'scripts/build_scic_privacy_audit_pack.py','scripts/test_scic_privacy_audit_pack.py',
 'scripts/la_bete_acquisition.py','scripts/verify_la_bete_evolution.py','docs/assets/la-bete-explorer.js','scripts/test_la_bete_explorer.cjs','scripts/test_la_bete_explorer_browser.cjs','audits/scic_privacy/THREAT_MODEL.md'
]

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True).strip()
def build():
 missing=[x for x in CRITICAL if not (ROOT/x).is_file()]
 if missing:raise RuntimeError('MISSING_AUDIT_FILES '+repr(missing))
 status=git('status','--porcelain')
 pack={
  'schema':'LA_BETE_SCIC_PRIVACY_AUDIT_PACK_V1',
  'purpose':'INDEPENDENT_REVIEW_INPUT_NOT_AN_AUDIT_VERDICT',
  'source_commit':git('rev-parse','HEAD'),
  'source_dirty':bool(status),
  'critical_files':{x:{'sha256':sha(ROOT/x),'bytes':(ROOT/x).stat().st_size} for x in CRITICAL},
  'standards':['RFC9474','RFC9578','RFC9576','RFC9458','RFC9292'],
  'pinned_components':{'cloudflare_circl':'v1.6.5','martinthomson_ohttp':'0.8.0','go':'1.26.x','rust':'1.86.0'},
  'trust_domains':['MEMBERSHIP_AUTHORITY','BLIND_ISSUER','OHTTP_CLIENT','OHTTP_RELAY','OHTTP_GATEWAY_BALLOT_BOX','PERSISTENT_BATCHER','PUBLIC_REGISTRY'],
  'required_invariants':[
   'ONE_ELIGIBLE_MEMBER_ONE_ENTITLEMENT_PER_ELECTION',
   'BLIND_ISSUER_NO_MEMBER_IDENTITY',
   'RELAY_NO_BALLOT_PLAINTEXT',
   'BALLOT_BOX_NO_MEMBERSHIP_IDENTITY',
   'SMALL_ANONYMITY_SET_NEVER_RELEASED',
   'NO_INDIVIDUAL_PUBLIC_CAST_TIMESTAMP',
   'PRODUCTION_ISSUER_KEY_NON_EXPORTABLE',
   'TRUTH_NOT_DECIDED_BY_BALLOT',
  ],
  'reproduction_commands':[
   'PYTHONPATH=. python3 scripts/test_scic_privacy_gate.py',
   'PYTHONPATH=. python3 scripts/test_scic_batch_runtime.py',
   'PYTHONPATH=. python3 scripts/test_scic_key_custody.py',
   'SCIC_CIRCL_RUNTIME_BIN=<built-sidecar> PYTHONPATH=. python3 scripts/test_scic_circl_runtime.py',
   'SCIC_OHTTP_RUNTIME_BIN=<built-runtime> PYTHONPATH=. python3 scripts/test_scic_ohttp_runtime.py',
   'SCIC_OHTTP_RUNTIME_BIN=<built-runtime> PYTHONPATH=. python3 scripts/test_scic_ohttp_batch_pipeline.py',
   'go test -v ./...  # privacy/rfc9474_gate',
   'go test -v github.com/cloudflare/circl/blindsign/blindrsa',
   'cargo test --locked  # privacy/ohttp_runtime',
  ],
  'production_blockers':['INDEPENDENT_OHTTP_RELAY_NOT_DEPLOYED','REAL_HTTPS_HOPS_NOT_PROVEN','ANONYMITY_POLICY_NOT_EXTERNALLY_APPROVED','HSM_KEY_CUSTODY_NOT_PROVEN','KEY_ROTATION_AND_DESTRUCTION_DRILLS_NOT_PROVEN','EXTERNAL_CRYPTO_AUDIT_NOT_COMPLETED','EXTERNAL_PRIVACY_REVIEW_NOT_COMPLETED'],
  'external_review_required':True,
  'audit_verdict':'NOT_PERFORMED',
  'contains_private_state':False,
 }
 return pack
if __name__=='__main__':
 p=build();OUT.write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n');print('SCIC_PRIVACY_AUDIT_PACK_WRITTEN',OUT,p['source_commit'],p['source_dirty'])
