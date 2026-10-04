# SCIC Trusted Third Parties — Outreach Drafts

**Status:** DRAFTS ONLY — NOT SENT  
**Date:** 2026-10-04

These drafts are intentionally concise. The technical annex is
`SCIC_TRUSTED_THIRD_PARTIES_RFP_20261004.md`.

---

## A. Fastly — OHTTP Relay

### Subject

Independent OHTTP Relay for privacy-preserving cooperative voting

### Draft

Hello,

We are preparing a privacy-preserving voting architecture for a future French
SCIC (cooperative of collective interest). The internal implementation already
passes RFC 9474 / RFC 9578 Blind RSA, RFC 9458 OHTTP, RFC 9292 Binary HTTP,
three-process client/relay/gateway separation, persistent anonymity batching and
a fail-closed production privacy gate.

We are looking for an **independent OHTTP Relay operator**, separate from our
gateway/ballot-box operator.

Fastly is our primary relay candidate because of its published OHTTP work and
documented use as an Oblivious Relay in privacy-sensitive systems.

We would like to confirm:

1. current availability of Fastly OHTTP Relay for a new privacy-oriented
   service;
2. RFC 9458 compatibility and supported request/response media types;
3. header stripping / allow-list behavior before relay-to-gateway forwarding;
4. client-IP and raw request logging, access and retention;
5. ability to restrict relay forwarding to one nominated gateway;
6. padding / traffic-analysis mitigation capabilities;
7. DPA/GDPR processing locations and subprocessors;
8. whether customer tooling exposes any raw client-identifying metadata.

We can provide a reproducible public audit pack and threat model.

Please let us know the appropriate technical/commercial contact and whether a
small pilot can be scoped before production procurement.

Regards,

Nicolas Alonso  
La Bête / SCIC project

---

## B. Cloudflare — OHTTP Relay

### Subject

OHTTP Relay closed-beta inquiry — privacy-preserving cooperative voting

### Draft

Hello,

We are evaluating Cloudflare OHTTP Relay as the independent relay layer for a
privacy-preserving voting architecture for a future French SCIC.

Our current stack already proves RFC 9474 / RFC 9578 Blind RSA, RFC 9458 OHTTP,
RFC 9292 Binary HTTP, two-hop TLS in CI, relay header minimization, persistent
batching and a fail-closed production privacy gate.

Cloudflare's current documentation describes OHTTP Relay as an Enterprise-only
closed beta for selected privacy-oriented companies and partners.

We would like to know whether our project is eligible for a technical pilot and,
if so, to receive details on:

- RFC 9458 support and gateway mapping;
- header forwarding/removal policy;
- client-IP/raw request logging and retention;
- customer access to relay-side metadata;
- padding or other traffic-analysis mitigations;
- DPA/GDPR processing terms and regions;
- operational independence requirements between relay and gateway.

We can share a reproducible public audit pack and threat model.

Regards,

Nicolas Alonso  
La Bête / SCIC project

---

## C. AWS — CloudHSM technical validation

### Subject

AWS CloudHSM validation for non-exportable Blind RSA issuer key

### Draft

Hello,

We are validating AWS CloudHSM for the production key of an RFC 9474 / RFC 9578
Blind RSA credential issuer.

The application requires an RSA-2048 private key generated inside the HSM,
non-exportable, used through PKCS #11 for the raw RSA private operation over an
already encoded/blinded representative.

Before procurement we need technical confirmation and a pilot covering:

- RSA-2048 key generation inside CloudHSM;
- `CKA_EXTRACTABLE=false`;
- `CKM_RSA_X_509` sign support for this usage;
- ability to restrict the key to signing and disable unrelated private-key
  operations where supported;
- Crypto Officer / Crypto User separation;
- auditable key usage;
- rotation and destruction procedures;
- multi-node/failover implications;
- evidence suitable for an independent security audit.

No real production key or ballot exists yet.

Could you route this request to a CloudHSM security specialist familiar with
PKCS #11 and non-extractable RSA keys?

Regards,

Nicolas Alonso  
La Bête / SCIC project

---

## D. NCC Group — cryptographic/protocol audit

### Subject

RFP — Blind RSA + OHTTP privacy-preserving voting protocol security review

### Draft

Hello,

We are seeking an independent cryptographic/protocol security review of a
privacy-preserving voting architecture for a future French SCIC.

The current implementation has a reproducible audit pack covering:

- RFC 9474 / RFC 9578 Blind RSA using Cloudflare CIRCL;
- RFC 9458 OHTTP;
- RFC 9292 Binary HTTP;
- client / relay / gateway process separation;
- two-hop TLS and relay header minimization in CI;
- persistent anonymity batching;
- HSM key-custody contract;
- public/private boundary and fail-closed production gating.

No real ballot is open. Production remains blocked until external review,
independent relay deployment, reviewed anonymity parameters and HSM-backed key
custody are proven.

We are looking for a review that includes both protocol design and
implementation, operator-collusion analysis, metadata privacy, HSM integration
and a remediation retest.

Our proposed scope and acceptance criteria are in the attached/public technical
RFP. We can provide a frozen source commit and audit pack with hashes for all
critical files.

Please let us know whether NCC Group Cryptography Services can scope this
engagement, expected review team, prerequisites, calendar and commercial
process.

Regards,

Nicolas Alonso  
La Bête / SCIC project

---

## E. Cure53 — independent privacy architecture review

### Subject

RFP — independent privacy and metadata review for OHTTP voting architecture

### Draft

Hello,

We are looking for an independent privacy/security architecture review separate
from our primary cryptographic protocol audit.

The system uses Blind RSA credentials, RFC 9458 OHTTP, Binary HTTP, an
independent relay boundary, persistent anonymity batching and a public aggregate
result registry.

We specifically want an adversarial review of:

- IP/timing correlation;
- TLS/network metadata;
- relay/gateway collusion;
- logs and operator access;
- header minimization;
- minimum anonymity set;
- batch window;
- padding policy;
- forced-small-set and DoS attacks;
- HSM administration boundaries;
- incident/recovery behavior without deanonymization.

The two policy values that will control real release are intentionally unset
until an independent reviewer recommends them:

```
minimum_set_size = UNSET_REQUIRES_PRIVACY_REVIEW
window_seconds   = UNSET_REQUIRES_PRIVACY_REVIEW
```

We can provide a reproducible public audit pack and frozen commit.

Please let us know whether Cure53 can scope this architecture/privacy review and
retest.

Regards,

Nicolas Alonso  
La Bête / SCIC project

---

## F. Trail of Bits — fallback / second cryptographic opinion

### Subject

Cryptographic design and implementation review inquiry — Blind RSA / OHTTP

### Draft

Hello,

We are preparing a privacy-preserving voting protocol for a future French SCIC
and would like to explore a cryptographic design/implementation review.

The stack uses RFC 9474 / RFC 9578 Blind RSA, RFC 9458 OHTTP, RFC 9292 Binary
HTTP, an HSM-bound issuer design and anonymity batching. A reproducible audit
pack and threat model are ready.

We are interested in a review covering protocol assumptions, implementation,
randomness/serialization boundaries, HSM provisioning and key ceremony,
side-channel/misuse risk, metadata privacy and remediation retest.

No real production vote is enabled; the gate is fail-closed pending external
evidence.

Please let us know whether this fits Trail of Bits' Cryptography practice and
what material you would require for scoping.

Regards,

Nicolas Alonso  
La Bête / SCIC project

---

## G. URSCOP Hauts-de-France — SCIC governance/legal

### Call / contact form text

Bonjour,

Je prépare un projet de future SCIC autour d'un bien commun numérique
d'information vérifiée et d'une gouvernance coopérative.

Nous avons déjà formalisé une proposition de gouvernance avec collèges de vote,
admission des sociétaires, séparation entre faits vérifiés et choix soumis au
vote, ainsi qu'un mécanisme de scrutin secret.

Avant toute création juridique ou tout vote contraignant, je souhaite faire
relire avec l'URSCOP Hauts-de-France :

- la forme juridique SCIC la plus adaptée ;
- les catégories de sociétaires ;
- les collèges et leurs pondérations ;
- les règles d'admission, suspension et sortie ;
- les pouvoirs respectifs AG / conseil coopératif / exécutif ;
- la compatibilité du vote secret et du mandat d'exécution avec les statuts ;
- les clauses de protection du bien commun.

L'objectif est d'identifier le chemin formel entre notre constitution
institutionnelle actuelle (non adoptée) et des statuts juridiquement
opérationnels.

Je souhaite organiser un premier échange de cadrage sans engagement de
constitution immédiate.

Nicolas Alonso
