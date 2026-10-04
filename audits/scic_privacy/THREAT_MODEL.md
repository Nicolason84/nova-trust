# SCIC Privacy Threat Model V1

## Security objective

Permit an eligible sociétaire to cast one ballot in the correct collège while preventing the public registry, ballot box, relay and blind issuer from learning more identity information than their role requires. Facts and evidence remain outside voting.

## Trust domains

1. **Membership Authority** — knows the member and statutory college; issues a one-election entitlement without embedding identity in the entitlement.
2. **CIRCL Blind Issuer** — holds the Blind RSA signing key; receives a signed entitlement and blinded message, never member identity or final ballot serial.
3. **OHTTP Client** — creates the RFC 9458 envelope and retains client response state.
4. **OHTTP Relay** — sees client network metadata in a future deployment but must not see plaintext or gateway private key.
5. **OHTTP Gateway / Ballot Box** — decrypts the opaque envelope and validates/redeems anonymous credentials; must not receive membership identity or entitlement linkage.
6. **Persistent Batcher** — stores only opaque OHTTP envelopes; releases only closed windows meeting the anonymity threshold, otherwise rolls them forward.
7. **Public Registry** — receives aggregate results and coarse batch receipts only.

## Protected assets

- civil identity and private membership evidence;
- member_public_id ↔ ballot linkage;
- blind issuer private key;
- OHTTP gateway private key;
- blinding client state;
- ballot plaintext before the gateway;
- individual cast timestamps;
- individual OHTTP envelope digests in public output.

## Adversaries

- curious or compromised relay;
- curious or compromised blind issuer;
- curious ballot-box operator;
- database reader of one trust domain;
- passive network observer;
- replay/double-spend attacker;
- malicious eligible voter;
- operator collusion across trust domains;
- insider with key-administration access.

## Proven properties in the synthetic/CI environment

- membership authority, blind issuer and ballot box can be separated by process and storage;
- CIRCL RFC 9474 / RFC 9578 primitive and Python runtime binding pass in CI;
- RFC 9458 OHTTP client, relay and gateway pass as three processes;
- the relay does not contain the known ballot plaintext probe in forwarded request/response envelopes;
- persistent batching blocks open windows and small anonymity sets;
- small anonymity sets roll forward rather than release or disappear;
- file-backed test keys are explicitly rejected by the production key-custody gate;
- public receipts omit individual timestamps and envelope identifiers.

## Residual blockers before a real ballot

- an independent OHTTP relay operator is not deployed or contractually separated from the gateway operator;
- HTTPS on both real network hops, header stripping, fresh HPKE context and padding policy are not deployment-proven;
- production anonymity threshold/window values have not been approved by independent privacy review;
- CIRCL issuer key is not yet held in a non-exportable HSM/KMS provider;
- key rotation, destruction and compromise drills are not production-proven;
- external cryptographic audit is not completed;
- external privacy threat-model review is not completed;
- traffic analysis, timing correlation, TLS fingerprinting and operator collusion require deployment controls beyond cryptography.

## Fail-closed rule

No missing proof may be interpreted as PASS. `production_activation` remains false until every production gate has explicit evidence and independent review where required.
