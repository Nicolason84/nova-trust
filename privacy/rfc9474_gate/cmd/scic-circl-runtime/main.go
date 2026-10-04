package main

import (
	"bufio"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cloudflare/circl/blindsign/blindrsa"
)

const variantName = "RSABSSA-SHA384-PSS-Deterministic"

type request struct {
	Op                 string `json:"op"`
	ID                 string `json:"id,omitempty"`
	PublicKeyPEMBase64 string `json:"public_key_pem_b64,omitempty"`
	MessageBase64      string `json:"message_b64,omitempty"`
	BlindedBase64      string `json:"blinded_b64,omitempty"`
	BlindSigBase64     string `json:"blind_signature_b64,omitempty"`
}

type response struct {
	OK                    bool   `json:"ok"`
	Op                    string `json:"op"`
	ID                    string `json:"id,omitempty"`
	Error                 string `json:"error,omitempty"`
	PID                   int    `json:"pid"`
	Backend               string `json:"backend"`
	BackendVersion        string `json:"backend_version"`
	Variant               string `json:"variant"`
	PublicKeyPEMBase64    string `json:"public_key_pem_b64,omitempty"`
	BlindedBase64         string `json:"blinded_b64,omitempty"`
	BlindSigBase64        string `json:"blind_signature_b64,omitempty"`
	SignatureBase64       string `json:"signature_b64,omitempty"`
	PreparedMessageBase64 string `json:"prepared_message_b64,omitempty"`
	Verified              bool   `json:"verified,omitempty"`
	StandardPSSVerified   bool   `json:"standard_pss_verified,omitempty"`
}

type clientState struct {
	state    blindrsa.State
	prepared []byte
}

func main() {
	mode := flag.String("mode", "", "client or issuer")
	keyFile := flag.String("key-file", "", "issuer RSA private key path")
	flag.Parse()

	switch *mode {
	case "issuer":
		if *keyFile == "" {
			fatal("issuer requires --key-file")
		}
		runIssuer(*keyFile)
	case "client":
		runClient()
	default:
		fatal("mode must be client or issuer")
	}
}

func baseResponse(op, id string) response {
	return response{
		OK:             true,
		Op:             op,
		ID:             id,
		PID:            os.Getpid(),
		Backend:        "cloudflare/circl",
		BackendVersion: "v1.6.5",
		Variant:        variantName,
	}
}

func writeResponse(w *bufio.Writer, v response) {
	if err := json.NewEncoder(w).Encode(v); err != nil {
		fatal(err.Error())
	}
	if err := w.Flush(); err != nil {
		fatal(err.Error())
	}
}

func runIssuer(keyPath string) {
	key, err := loadOrCreateRSAKey(keyPath)
	if err != nil {
		fatal(err.Error())
	}
	signer := blindrsa.NewSigner(key)
	pubDER, err := x509.MarshalPKIXPublicKey(&key.PublicKey)
	if err != nil {
		fatal(err.Error())
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubDER})
	w := bufio.NewWriter(os.Stdout)
	hello := baseResponse("ready", "")
	hello.PublicKeyPEMBase64 = base64.StdEncoding.EncodeToString(pubPEM)
	writeResponse(w, hello)

	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024), 1024*1024)
	for sc.Scan() {
		var req request
		if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
			r := baseResponse("error", "")
			r.OK = false
			r.Error = "INVALID_JSON"
			writeResponse(w, r)
			continue
		}
		r := baseResponse(req.Op, req.ID)
		switch req.Op {
		case "sign":
			blinded, err := base64.StdEncoding.DecodeString(req.BlindedBase64)
			if err != nil {
				r.OK = false
				r.Error = "INVALID_BLINDED_BASE64"
				break
			}
			sig, err := signer.BlindSign(blinded)
			if err != nil {
				r.OK = false
				r.Error = "BLIND_SIGN_FAILED:" + err.Error()
				break
			}
			r.BlindSigBase64 = base64.StdEncoding.EncodeToString(sig)
		case "ping":
		default:
			r.OK = false
			r.Error = "UNKNOWN_OPERATION"
		}
		writeResponse(w, r)
	}
	if err := sc.Err(); err != nil {
		fatal(err.Error())
	}
}

func runClient() {
	var pub *rsa.PublicKey
	var client blindrsa.Client
	states := map[string]clientState{}
	w := bufio.NewWriter(os.Stdout)
	writeResponse(w, baseResponse("ready", ""))

	sc := bufio.NewScanner(os.Stdin)
	sc.Buffer(make([]byte, 1024), 1024*1024)
	for sc.Scan() {
		var req request
		if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
			r := baseResponse("error", "")
			r.OK = false
			r.Error = "INVALID_JSON"
			writeResponse(w, r)
			continue
		}
		r := baseResponse(req.Op, req.ID)
		switch req.Op {
		case "init":
			keyBytes, err := base64.StdEncoding.DecodeString(req.PublicKeyPEMBase64)
			if err != nil {
				r.OK = false
				r.Error = "INVALID_PUBLIC_KEY_BASE64"
				break
			}
			parsed, err := parseRSAPublicKeyPEM(keyBytes)
			if err != nil {
				r.OK = false
				r.Error = "INVALID_PUBLIC_KEY:" + err.Error()
				break
			}
			c, err := blindrsa.NewClient(blindrsa.SHA384PSSDeterministic, parsed)
			if err != nil {
				r.OK = false
				r.Error = "CLIENT_INIT_FAILED:" + err.Error()
				break
			}
			pub = parsed
			client = c
			r.PublicKeyPEMBase64 = req.PublicKeyPEMBase64
		case "blind":
			if pub == nil {
				r.OK = false
				r.Error = "CLIENT_NOT_INITIALIZED"
				break
			}
			if req.ID == "" {
				r.OK = false
				r.Error = "REQUEST_ID_REQUIRED"
				break
			}
			if _, exists := states[req.ID]; exists {
				r.OK = false
				r.Error = "REQUEST_ID_ALREADY_EXISTS"
				break
			}
			message, err := base64.StdEncoding.DecodeString(req.MessageBase64)
			if err != nil {
				r.OK = false
				r.Error = "INVALID_MESSAGE_BASE64"
				break
			}
			prepared, err := client.Prepare(rand.Reader, message)
			if err != nil {
				r.OK = false
				r.Error = "PREPARE_FAILED:" + err.Error()
				break
			}
			blinded, state, err := client.Blind(rand.Reader, prepared)
			if err != nil {
				r.OK = false
				r.Error = "BLIND_FAILED:" + err.Error()
				break
			}
			states[req.ID] = clientState{state: state, prepared: prepared}
			r.BlindedBase64 = base64.StdEncoding.EncodeToString(blinded)
			r.PreparedMessageBase64 = base64.StdEncoding.EncodeToString(prepared)
		case "finalize":
			if pub == nil {
				r.OK = false
				r.Error = "CLIENT_NOT_INITIALIZED"
				break
			}
			st, ok := states[req.ID]
			if !ok {
				r.OK = false
				r.Error = "UNKNOWN_REQUEST_ID"
				break
			}
			blindSig, err := base64.StdEncoding.DecodeString(req.BlindSigBase64)
			if err != nil {
				r.OK = false
				r.Error = "INVALID_BLIND_SIGNATURE_BASE64"
				break
			}
			sig, err := client.Finalize(st.state, blindSig)
			if err != nil {
				r.OK = false
				r.Error = "FINALIZE_FAILED:" + err.Error()
				delete(states, req.ID)
				break
			}
			if err := client.Verify(st.prepared, sig); err != nil {
				r.OK = false
				r.Error = "CIRCL_VERIFY_FAILED:" + err.Error()
				delete(states, req.ID)
				break
			}
			digest := sha512.Sum384(st.prepared)
			err = rsa.VerifyPSS(
				pub,
				crypto.SHA384,
				digest[:],
				sig,
				&rsa.PSSOptions{Hash: crypto.SHA384, SaltLength: crypto.SHA384.Size()},
			)
			if err != nil {
				r.OK = false
				r.Error = "STANDARD_PSS_VERIFY_FAILED:" + err.Error()
				delete(states, req.ID)
				break
			}
			r.SignatureBase64 = base64.StdEncoding.EncodeToString(sig)
			r.PreparedMessageBase64 = base64.StdEncoding.EncodeToString(st.prepared)
			r.Verified = true
			r.StandardPSSVerified = true
			delete(states, req.ID)
		case "ping":
		default:
			r.OK = false
			r.Error = "UNKNOWN_OPERATION"
		}
		writeResponse(w, r)
	}
	if err := sc.Err(); err != nil {
		fatal(err.Error())
	}
}

func loadOrCreateRSAKey(path string) (*rsa.PrivateKey, error) {
	if info, err := os.Lstat(path); err == nil {
		if info.Mode()&os.ModeSymlink != 0 {
			return nil, errors.New("issuer key may not be a symlink")
		}
		if info.Mode().Perm()&0o077 != 0 {
			return nil, fmt.Errorf("issuer key permissions too broad: %o", info.Mode().Perm())
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		block, _ := pem.Decode(raw)
		if block == nil {
			return nil, errors.New("invalid issuer key PEM")
		}
		if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
			rsaKey, ok := key.(*rsa.PrivateKey)
			if !ok {
				return nil, errors.New("issuer key is not RSA")
			}
			return rsaKey, rsaKey.Validate()
		}
		return nil, errors.New("invalid PKCS8 issuer key")
	} else if !os.IsNotExist(err) {
		return nil, err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return nil, err
	}
	raw := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return nil, err
	}
	if _, err := f.Write(raw); err != nil {
		_ = f.Close()
		return nil, err
	}
	if err := f.Close(); err != nil {
		return nil, err
	}
	return key, nil
}

func parseRSAPublicKeyPEM(raw []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(raw)
	if block == nil {
		return nil, errors.New("missing PEM block")
	}
	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaKey, ok := key.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not RSA public key")
	}
	if rsaKey.N.BitLen() != 2048 {
		return nil, fmt.Errorf("unexpected RSA modulus size %d", rsaKey.N.BitLen())
	}
	return rsaKey, nil
}

func fatal(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(2)
}
