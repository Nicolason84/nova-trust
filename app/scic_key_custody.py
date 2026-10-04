"""Fail-closed key custody contract for the Blind RSA issuer.

The current CIRCL CI sidecar uses a 0600 file-backed key only to prove runtime
binding. It can never satisfy this production custody contract.
"""
from __future__ import annotations
import os
from pathlib import Path

SCHEMA='LA_BETE_SCIC_KEY_CUSTODY_GATE_V1'
ALLOWED_PROVIDERS={'PKCS11_HSM','MANAGED_HSM','CLOUDHSM_PKCS11'}

def inspect_file_test_key(path:Path):
    p=Path(path)
    st=p.lstat()
    return {
        'schema':SCHEMA,
        'provider_type':'FILE_TEST_ONLY',
        'path_permissions':oct(st.st_mode & 0o777),
        'symlink':p.is_symlink(),
        'non_exportable':False,
        'hardware_backed':False,
        'attestation_id':None,
        'dual_control':False,
        'usage_policy':'TEST_ONLY',
        'rotation_test':'NOT_APPLICABLE',
        'destruction_test':'NOT_APPLICABLE',
        'immutable_audit_log':False,
    }

def evaluate_key_custody(evidence:dict):
    failures=[]
    if evidence.get('provider_type') not in ALLOWED_PROVIDERS:failures.append('HSM_PROVIDER_NOT_PROVEN')
    if evidence.get('algorithm')!='RSA-2048':failures.append('RSA2048_KEY_NOT_PROVEN')
    if evidence.get('non_exportable') is not True:failures.append('KEY_NON_EXPORTABILITY_NOT_PROVEN')
    if evidence.get('hardware_backed') is not True:failures.append('HARDWARE_BACKING_NOT_PROVEN')
    if not evidence.get('attestation_id'):failures.append('KEY_ATTESTATION_MISSING')
    if evidence.get('dual_control') is not True:failures.append('DUAL_CONTROL_NOT_PROVEN')
    if evidence.get('usage_policy')!='BLIND_RSA_SIGN_ONLY':failures.append('KEY_USAGE_NOT_RESTRICTED')
    if evidence.get('rotation_test')!='PASS':failures.append('ROTATION_TEST_NOT_PASS')
    if evidence.get('destruction_test')!='PASS':failures.append('DESTRUCTION_TEST_NOT_PASS')
    if evidence.get('immutable_audit_log') is not True:failures.append('IMMUTABLE_KEY_AUDIT_LOG_NOT_PROVEN')
    if evidence.get('issuer_operator') and evidence.get('ballot_box_operator') and evidence.get('issuer_operator')==evidence.get('ballot_box_operator'):failures.append('ISSUER_BALLOT_OPERATOR_SEPARATION_NOT_PROVEN')
    return {'schema':SCHEMA,'verdict':'PASS' if not failures else 'BLOCKED','production_key_custody':not failures,'failures':failures}

def production_contract():
    return {
        'schema':SCHEMA,
        'state':'IMPLEMENTED_FAIL_CLOSED',
        'current_provider':'FILE_TEST_ONLY',
        'current_verdict':'BLOCKED',
        'required_provider_types':sorted(ALLOWED_PROVIDERS),
        'requirements':[
            'RSA-2048 blind-sign issuer key',
            'non-exportable hardware-backed private key',
            'provider attestation identifier',
            'dual-control administration',
            'BLIND_RSA_SIGN_ONLY usage policy',
            'tested rotation with overlapping verification window',
            'tested destruction/revocation procedure',
            'immutable key-usage audit log',
            'issuer operator separated from ballot-box operator',
        ],
        'production_activation':False,
    }
