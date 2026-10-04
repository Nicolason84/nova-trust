# SCIC Trusted Third Parties — Evidence Matrix V1

**Prepared:** 2026-10-04  
**State:** PRE-CONTACT / NO EXTERNAL COMMITMENT

| Role | Candidate | Publicly verified now | Still requires vendor evidence | Selection status |
| --- | --- | --- | --- | --- |
| Independent OHTTP relay | Fastly OHTTP Relay | Public Fastly material describes OHTTP relay behavior; NCC Group publicly documents Fastly acting as an Oblivious Relay in Meta/WhatsApp private processing. | Current 2026 commercial availability, exact RFC9458 profile, logs/retention, padding, DPA, customer metadata access, pilot eligibility. | **Primary contact** |
| Independent OHTTP relay | Cloudflare OHTTP Relay | Current Cloudflare docs describe managed OHTTP Relay implementing IETF OHTTP; Enterprise-only, closed beta/select partners. | Eligibility, contract, logs/retention, DPA, padding, customer metadata visibility. | **Fallback contact** |
| HSM | AWS CloudHSM | PKCS#11 SDK supports RSA 2048–4096 and `CKM_RSA_X_509`; non-extractable keys are supported when configured. | Exact Blind RSA integration, key template, sign-only restrictions, operational dual control, audit-log evidence, rotation/destruction drill. | **Primary technical validation** |
| HSM | Entrust nShield | PKCS#11 docs support RSA, `CKM_RSA_X_509`, RSA 2048+ and non-extractable controls. | Blind RSA interoperability, operational model, audit evidence, commercial fit. | **Fallback validation** |
| Crypto/protocol audit | NCC Group Cryptography Services | Public reports cover cryptographic protocol reviews, HSM-backed privacy systems, IP-blinding relay analysis and private-processing architectures. | Team availability, scope, person-days, price, retest terms, publication/confidentiality terms. | **Primary RFP** |
| Privacy architecture audit | Cure53 | Recent public work includes white-box cryptography, key-management, TEE/privacy architecture and infrastructure reviews. | Availability, exact privacy threat-model scope, metadata analysis, retest terms. | **Second independent RFP** |
| Crypto audit fallback | Trail of Bits Cryptography | Dedicated cryptography practice; public 2026 cryptography and HSM provisioning reviews; design + implementation + retest model. | Availability, scope, calendar, price. | **Fallback / second opinion** |
| SCIC legal/governance | URSCOP Hauts-de-France | Regional network explicitly accompanies Scop/Scic creation and development and provides governance/legal support. | Assignment of adviser, engagement terms, statute review timetable. | **Parallel contact** |

## Public evidence URLs

### Fastly

- https://www.fastly.com/blog/enabling-privacy-on-the-internet-with-oblivious-http
- https://www.nccgroup.com/research/public-report-meta-whatsapp-message-summarization-service/

### Cloudflare

- https://developers.cloudflare.com/ohttp-relay/

### AWS CloudHSM

- https://docs.aws.amazon.com/cloudhsm/latest/userguide/pkcs11-key-types.html
- https://docs.aws.amazon.com/cloudhsm/latest/userguide/pkcs11-mechanisms.html
- https://docs.aws.amazon.com/cloudhsm/latest/userguide/bp-hsm-key-management.html

### Entrust nShield

- https://nshielddocs.entrust.com/security-world-docs/v13.6.12/api-pkcs11/mechanisms.html
- https://nshielddocs.entrust.com/security-world-docs/v13.4.5/api-pkcs11/attributes.html

### NCC Group

- https://www.nccgroup.com/research/public-report-google-private-ai-compute-review/
- https://www.nccgroup.com/research/public-report-meta-whatsapp-message-summarization-service/
- https://www.nccgroup.com/research/public-report-vetkeys-cryptography-review/

### Cure53

- https://cure53.de/
- https://cure53.de/pentest-report_expressvpn-ai_2026.pdf

### Trail of Bits

- https://trailofbits.com/services/cryptography
- https://trailofbits.com/reports/

### URSCOP Hauts-de-France

- https://les-scop-hautsdefrance.coop/10/contactez-nous
- https://les-scop-hautsdefrance.coop/13/nos-missions

## Important qualification notes

### Fastly

The strongest public signal is **demonstrated operation**, not a claim that the
service is generally available to every new customer. Current availability must
therefore be reconfirmed before selection.

### Cloudflare

The current OHTTP Relay documentation states **Enterprise-only / closed beta**.
This makes Cloudflare a strong technical fallback but an availability risk.

### AWS CloudHSM

AWS documentation warns that some key-generation/import paths create extractable
keys. The production acceptance criterion is therefore not simply “CloudHSM”:
the key must be generated and evidenced as **non-exportable/non-extractable**.

The Blind RSA issuer needs a raw RSA private operation over an already
encoded/blinded representative. The selected integration must prove the required
PKCS#11 mechanism rather than assuming a normal RSA-PSS API is equivalent.

### External audits

No vendor is allowed to convert an audit proposal into a production PASS.
The gate changes only after:

1. review against a frozen commit;
2. findings delivered;
3. required remediation applied;
4. retest completed;
5. final external disposition recorded.

## Decision rule

The preferred path is:

```
Fastly relay
+ La Bête/SCIC gateway
+ AWS CloudHSM issuer key
+ NCC Group cryptographic/protocol audit
+ Cure53 independent privacy review
+ URSCOP Hauts-de-France cooperative/legal review
```

Fallback substitutions are allowed only if they preserve the same trust
separation and satisfy the same evidence contract.

No vendor is selected solely because it is the cheapest or fastest.
