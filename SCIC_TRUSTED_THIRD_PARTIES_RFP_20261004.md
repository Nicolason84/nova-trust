# La Bête / SCIC — Trusted Third Parties RFP V1

**State:** PREPARED — NO EXTERNAL COMMITMENT  
**Date:** 2026-10-04  
**Production voting:** CLOSED  
**Canonical public generation:** G188 / NON_REGRESSION_PASS  
**Privacy stack baseline:** `b7f7b24d2d02c52a189f2e7f3a01f7c6eb4cb0e3`  
**Current main descendant:** `d68c6b494a26b09b1900eabdebc766484f147b51`

## 1. Purpose

La Bête is preparing a privacy-preserving cooperative voting architecture.

The internal machine chain is already proven in synthetic/CI conditions:

```
verified membership
→ RFC 9474 / RFC 9578 blind credential
→ independent OHTTP relay boundary
→ RFC 9458 OHTTP
→ RFC 9292 Binary HTTP
→ persistent anonymity batching
→ ballot gateway / public aggregate result
```

The objective of this RFP is **not** to ask a vendor to validate our own claims.
It is to obtain independently verifiable external evidence for the remaining
production gates.

No real member enrollment or binding ballot may open before all mandatory gates
pass.

## 2. Non-negotiable separation model

No single actor may simultaneously control or observe enough information to link
a legal member identity to ballot plaintext.

Required trust domains:

1. Membership Authority
2. Blind Credential Issuer
3. OHTTP Relay
4. OHTTP Gateway / Ballot Box
5. Persistent Privacy Batcher
6. Public Aggregate Registry
7. Independent Security Reviewer

At minimum, the OHTTP Relay operator must be operationally independent from the
Gateway / Ballot Box operator.

## 3. Current internal proof package

The selected reviewers will receive the public audit input pack:

- `audits/scic_privacy/SCIC_PRIVACY_AUDIT_PACK_V1.json`
- `audits/scic_privacy/THREAT_MODEL.md`
- `receipts/LA_BETE_SCIC_PRODUCTION_PRIVACY_GATE_PROOF.json`
- `LA_BETE_SCIC_PRODUCTION_PRIVACY_GATE_20261004_REPORT.md`

The audit pack is deliberately **not** an audit verdict:

```
audit_verdict = NOT_PERFORMED
contains_private_state = false
```

The pack hashes the critical implementation and test files required for a
reproducible review.

## 4. Lot A — Independent OHTTP Relay

### Candidate order

1. **Fastly OHTTP Relay — primary contact**
2. **Cloudflare OHTTP Relay — fallback contact**

Selection is conditional on current availability and contractual evidence.

### Mandatory technical evidence

The bidder must provide or contractually commit to:

- RFC 9458 OHTTP compatibility.
- HTTPS client → relay.
- HTTPS relay → gateway.
- Fixed/nominated gateway mapping controlled by La Bête / SCIC.
- No capability to decrypt OHTTP application plaintext.
- Removal of client-identifying or stable pseudonymous metadata before
  relay → gateway forwarding.
- Explicit behavior for:
  - `Forwarded`
  - `X-Forwarded-For`
  - `Via`
  - `User-Agent`
  - `Cookie`
  - `Authorization`
  - custom unknown headers.
- Raw-request logging policy.
- Client-IP retention period and access model.
- Separation of customer access from relay operator raw network data.
- Padding / request-size normalization capabilities.
- Rate-limiting behavior that does not introduce stable per-client identifiers.
- Service-level observability available to La Bête without raw client metadata.
- Incident response and disclosure procedure.
- DPA / GDPR processing role, processing locations, subprocessors and retention.

### Independence evidence

The relay vendor must attest that:

- it does not operate or administer the La Bête Gateway / Ballot Box;
- La Bête cannot access raw relay-side client-IP logs through ordinary customer
  tooling;
- relay operator personnel cannot access gateway plaintext or gateway private
  keys;
- gateway operators cannot access relay-side raw client identity/network logs.

### Automatic rejection

- Same operator controls relay and gateway.
- Relay forwards identifying headers.
- Relay provides raw client-IP/request logs to the gateway operator.
- Retention/access policy is undocumented.
- Vendor requires stable per-voter identifiers at the relay.

## 5. Lot B — Blind RSA production key custody

### Candidate order

1. **AWS CloudHSM — primary technical validation**
2. **Entrust nShield — fallback validation**

### Required cryptographic capability

The production issuer key must support the blind-signing path without exporting
private key material.

Mandatory:

- RSA 2048-bit.
- Key generated inside the HSM.
- Non-exportable private key.
- PKCS #11 or equivalent production API.
- Raw RSA private operation compatible with Blind RSA encoded representative
  processing, e.g. `CKM_RSA_X_509` or an independently validated equivalent.
- `SIGN=true`.
- Decrypt / unwrap / wrap / generic encryption disabled where the HSM policy
  permits.
- No software copy of private key material.

### Required operational evidence

- HSM/key identifier.
- Key attributes evidence.
- Provider / cluster / partition identity.
- Separation of administrative and signing roles.
- Dual-control procedure for key administration.
- Rotation procedure and successful rotation drill.
- Destruction/revocation procedure and successful drill.
- Key-usage logs with tamper-evident or immutable retention.
- Incident procedure for suspected key compromise.
- Business-continuity/failover procedure.
- Explicit proof that a file-backed fallback cannot silently activate production.

### Acceptance test

The selected HSM must pass a real integration test:

```
CIRCL-compatible client
→ blinded representative
→ HSM-backed raw RSA blind-sign operation
→ unblind
→ RFC 9474 / RFC 9578 verification
→ independent RSA-PSS verification
```

Private material must remain inside the HSM throughout.

## 6. Lot C — Independent cryptographic/protocol audit

### Primary

**NCC Group — Cryptography Services**

### Required scope

Review must include:

- RFC 9474 / RFC 9578 Blind RSA design and implementation.
- CIRCL integration.
- Entitlement issuance and one-member/one-election semantics.
- Blind issuer / member unlinkability.
- RFC 9458 OHTTP implementation.
- RFC 9292 BHTTP serialization boundary.
- HPKE configuration, context lifecycle and key rotation.
- Relay/gateway metadata separation.
- Header minimization.
- Traffic-analysis assumptions.
- Batch timing and anonymity-set logic.
- Persistent storage and restart behavior.
- Small-set roll-forward behavior.
- HSM / PKCS #11 raw-RSA integration.
- Key ceremony.
- Operator-collusion analysis.
- Revocation semantics after anonymous credential issuance.
- Public receipt minimization.
- Failure/recovery paths.
- Supply-chain and pinned dependency review.

### Required deliverables

- Written findings report.
- Severity and exploitability for each finding.
- Threat-model assumption list.
- Concrete reproduction steps / PoCs where applicable.
- Clear production blockers.
- Remediation recommendations.
- Retest after fixes.
- Final disposition for each finding.
- Explicit statement whether the reviewed commit may be used for a real ballot
  under the reviewed deployment assumptions.

A marketing letter is not sufficient.

## 7. Lot D — Independent privacy architecture review

### Primary

**Cure53**

### Fallback / second opinion

**Trail of Bits**

This review is independent from the main cryptographic implementation review.

Required focus:

- IP/timing correlation.
- Relay/gateway collusion.
- Logging and observability.
- Operator access.
- TLS fingerprints and endpoint metadata.
- Anonymity-set definition.
- Minimum release threshold.
- Batch window policy.
- Padding policy.
- Failure-mode privacy.
- DoS and forced-small-anonymity attacks.
- Public/private boundary.
- Data minimization.
- GDPR-relevant metadata flows.
- HSM operational separation.
- Incident response.
- Recovery without deanonymization.

### Required output

The reviewer must recommend or reject:

- production `minimum_set_size`;
- production `window_seconds`;
- padding rules;
- release/roll-forward rules;
- metadata retention rules;
- operator-separation controls.

Until these values are externally reviewed they remain:

```
UNSET_REQUIRES_PRIVACY_REVIEW
```

## 8. Parallel cooperative/legal gate

### Organization

**URSCOP Hauts-de-France**

This is not a cryptographic reviewer. It is the parallel cooperative/legal
adviser required before any legally binding member admission or ballot.

Requested review:

- proposed SCIC form;
- member categories;
- colleges and voting weights;
- admission/suspension/exit process;
- secret ballot process;
- decision vs mandate separation;
- governance bodies;
- protected commitments;
- public-interest purpose;
- statutes required to make the democratic mechanism legally effective.

No technical privacy vendor may substitute for this gate.

## 9. Evaluation method

Technical/privacy qualification is evaluated **before** price.

Each bidder must answer every mandatory requirement with one of:

- `PROVEN_NOW`
- `PROVABLE_IN_PILOT`
- `CONTRACTUAL_COMMITMENT`
- `UNSUPPORTED`
- `NOT_APPLICABLE`

For every `PROVEN_NOW`, provide evidence.

For every `PROVABLE_IN_PILOT`, provide the pilot plan and acceptance criterion.

Any mandatory item marked `UNSUPPORTED` is a disqualifier unless La Bête's
external reviewer explicitly accepts an equivalent control.

## 10. Conflict-of-interest disclosure

Every security reviewer must disclose:

- commercial relationship with the selected relay;
- commercial relationship with the selected HSM provider;
- prior participation in La Bête implementation;
- any other conflict affecting independence.

## 11. Production activation rule

The production gate remains:

```
production_activation = false
```

until all of the following are evidenced:

1. independent relay operator contract;
2. public relay/gateway TLS endpoints;
3. production operator attestation;
4. reviewed anonymity-set policy;
5. reviewed batch window;
6. approved padding policy;
7. HSM-backed non-exportable issuer key;
8. successful key rotation and destruction drills;
9. independent cryptographic audit with retest;
10. independent privacy architecture review;
11. SCIC legal/governance activation prerequisites.

## 12. External-action status

At preparation time:

- no RFP has been sent;
- no form has been submitted;
- no account has been purchased;
- no contract has been signed;
- no production key exists;
- no production relay exists;
- no external audit verdict exists.

This document is authorization material, not an external commitment.
