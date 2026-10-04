package rfc9474gate

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/binary"
	"testing"

	"github.com/cloudflare/circl/blindsign/blindrsa"
)

const (
	tokenTypeBlindRSA uint16 = 0x0002
	nonceSize                = 32
	keyIDSize                = 32
)

// RFC 9578 Section 6.1 token_input:
// concat(0x0002, nonce, SHA256(challenge), token_key_id)
func tokenInput(t *testing.T) []byte {
	t.Helper()
	nonce := make([]byte, nonceSize)
	if _, err := rand.Read(nonce); err != nil {
		t.Fatal(err)
	}
	challenge := []byte("SCIC election challenge / synthetic RFC gate")
	challengeDigest := sha256.Sum256(challenge)
	tokenKeyID := make([]byte, keyIDSize)
	if _, err := rand.Read(tokenKeyID); err != nil {
		t.Fatal(err)
	}

	out := make([]byte, 2+nonceSize+len(challengeDigest)+keyIDSize)
	binary.BigEndian.PutUint16(out[:2], tokenTypeBlindRSA)
	copy(out[2:34], nonce)
	copy(out[34:66], challengeDigest[:])
	copy(out[66:], tokenKeyID)
	return out
}

func TestRFC9578BlindRSARoundTripWithCIRCL(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	if key.N.BitLen() != 2048 {
		t.Fatalf("expected 2048-bit modulus, got %d", key.N.BitLen())
	}

	client, err := blindrsa.NewClient(blindrsa.SHA384PSSDeterministic, &key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	signer := blindrsa.NewSigner(key)
	input := tokenInput(t)

	prepared, err := client.Prepare(rand.Reader, input)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(prepared, input) {
		t.Fatal("deterministic PrepareIdentity changed token_input")
	}

	blinded, state, err := client.Blind(rand.Reader, prepared)
	if err != nil {
		t.Fatal(err)
	}
	if len(blinded) != 256 {
		t.Fatalf("RFC9578 Blind RSA request must be 256 bytes, got %d", len(blinded))
	}

	blindSig, err := signer.BlindSign(blinded)
	if err != nil {
		t.Fatal(err)
	}
	if len(blindSig) != 256 {
		t.Fatalf("RFC9578 Blind RSA response must be 256 bytes, got %d", len(blindSig))
	}

	sig, err := client.Finalize(state, blindSig)
	if err != nil {
		t.Fatal(err)
	}
	if err := client.Verify(prepared, sig); err != nil {
		t.Fatalf("CIRCL RFC9474 verify failed: %v", err)
	}

	digest := sha512.Sum384(prepared)
	if err := rsa.VerifyPSS(
		&key.PublicKey,
		crypto.SHA384,
		digest[:],
		sig,
		&rsa.PSSOptions{Hash: crypto.SHA384, SaltLength: crypto.SHA384.Size()},
	); err != nil {
		t.Fatalf("standard RSA-PSS verification failed: %v", err)
	}
}

func TestRFC9578TokenInputIsHighEntropyPerIssuance(t *testing.T) {
	a := tokenInput(t)
	b := tokenInput(t)
	if bytes.Equal(a, b) {
		t.Fatal("two token_input values unexpectedly matched")
	}
	if binary.BigEndian.Uint16(a[:2]) != tokenTypeBlindRSA {
		t.Fatal("wrong token type")
	}
	if len(a) != 98 {
		t.Fatalf("unexpected token_input size %d", len(a))
	}
}

func TestWrongMessageDoesNotVerify(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	client, err := blindrsa.NewClient(blindrsa.SHA384PSSDeterministic, &key.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	signer := blindrsa.NewSigner(key)

	msg := tokenInput(t)
	prepared, err := client.Prepare(rand.Reader, msg)
	if err != nil {
		t.Fatal(err)
	}
	blinded, state, err := client.Blind(rand.Reader, prepared)
	if err != nil {
		t.Fatal(err)
	}
	blindSig, err := signer.BlindSign(blinded)
	if err != nil {
		t.Fatal(err)
	}
	sig, err := client.Finalize(state, blindSig)
	if err != nil {
		t.Fatal(err)
	}
	tampered := append([]byte{}, prepared...)
	tampered[len(tampered)-1] ^= 1
	if client.Verify(tampered, sig) == nil {
		t.Fatal("signature verified against tampered token input")
	}
}
