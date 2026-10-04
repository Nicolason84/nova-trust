# SCIC RFC9474 / RFC9578 cryptographic gate

This directory is an independently runnable cryptographic conformance gate for the future SCIC voting credential.

It does **not** activate voting in production.

The gate pins `github.com/cloudflare/circl v1.6.5` and exercises the RFC 9474 Blind RSA primitive in the exact deterministic SHA-384/PSS variant used by RFC 9578 publicly verifiable Privacy Pass tokens.

The CI gate proves:

1. 2048-bit Blind RSA token request/response sizes;
2. RFC 9578 token input shape: `0x0002 || nonce || SHA256(challenge) || token_key_id`;
3. CIRCL blind/finalize verification;
4. independent verification of the finalized signature with Go standard `rsa.VerifyPSS` using SHA-384 and a 48-byte PSS salt;
5. upstream CIRCL `blindrsa` RFC 9474 tests, including RFC test vectors.

This is a cryptographic implementation gate only. Production remains blocked until the deployment-privacy gate separately proves network separation, batching/anonymity policy, key operations, incident handling, and independent security review.
