"""Synthetic-only blind ballot proof for La Bête SCIC.

This is a research/proof implementation inspired by blind RSA / Privacy Pass
separation. It is NOT an RFC 9474 implementation and MUST NOT be used for a
real election. The purpose is to prove architecture, storage separation,
blindness mechanics, replay guards, and public-record minimization.

Real deployment must use an audited RFC-grade anonymous credential / blind
signature implementation, independent authorities, metadata defenses, and
external cryptographic review.
"""
from __future__ import annotations
import base64
import hashlib
import json
import math
import os
import secrets
import sqlite3
import time
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa, ed25519

SCHEMA = "LA_BETE_SCIC_BLIND_BALLOT_SYNTHETIC_V1"
MODE = "SYNTHETIC_RESEARCH_ONLY_NOT_RFC9474_CONFORMANT"
DOMAIN = b"OJO_SCIC_BLIND_BALLOT_SYNTHETIC_V1\x00"
ALLOWED_CHOICES = frozenset(("YES", "NO", "ABSTAIN"))


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()


def digest(value) -> str:
    data = value if isinstance(value, bytes) else canonical(value)
    return hashlib.sha256(data).hexdigest()


def message_int(n: int, election_id: str, college: str, serial: bytes) -> int:
    if not isinstance(election_id, str) or not election_id or len(election_id) > 120:
        raise ValueError("INVALID_ELECTION")
    if not isinstance(college, str) or not college or len(college) > 120:
        raise ValueError("INVALID_COLLEGE")
    if not isinstance(serial, bytes) or len(serial) != 32:
        raise ValueError("INVALID_SERIAL")
    h = hashlib.sha384()
    h.update(DOMAIN)
    h.update(election_id.encode())
    h.update(b"\x00")
    h.update(college.encode())
    h.update(b"\x00")
    h.update(serial)
    m = int.from_bytes(h.digest(), "big") % n
    if m <= 1 or math.gcd(m, n) != 1:
        raise ValueError("NON_INVERTIBLE_MESSAGE")
    return m


def blind(n: int, e: int, m: int):
    for _ in range(256):
        r = secrets.randbelow(n - 3) + 2
        if math.gcd(r, n) == 1:
            return (m * pow(r, e, n)) % n, r
    raise RuntimeError("BLINDING_FACTOR_UNAVAILABLE")


def unblind(n: int, blind_signature: int, r: int) -> int:
    return (blind_signature * pow(r, -1, n)) % n


def verify(n: int, e: int, message: int, signature: int) -> bool:
    return 0 < signature < n and pow(signature, e, n) == message


class BlindClient:
    """Client-only blinding state. Never persisted by issuer or ballot box."""
    def __init__(self, election_id: str, college: str, public_key: dict):
        self.election_id = election_id
        self.college = college
        self.n = int(public_key["n"])
        self.e = int(public_key["e"])
        self.key_id = public_key["key_id"]
        for _ in range(32):
            self.serial = secrets.token_bytes(32)
            try:
                self.message = message_int(self.n, election_id, college, self.serial)
                break
            except ValueError:
                continue
        else:
            raise RuntimeError("SERIAL_GENERATION_FAILED")
        self.blinded, self.r = blind(self.n, self.e, self.message)

    def request(self):
        return {
            "schema": SCHEMA,
            "election_id": self.election_id,
            "college": self.college,
            "key_id": self.key_id,
            "blinded_message": str(self.blinded),
            "serial_disclosed": False,
            "member_identity_disclosed": False,
        }

    def unblind(self, blind_signature: int):
        sig = unblind(self.n, int(blind_signature), self.r)
        if not verify(self.n, self.e, self.message, sig):
            raise ValueError("UNBLINDED_SIGNATURE_INVALID")
        return {
            "schema": SCHEMA,
            "election_id": self.election_id,
            "college": self.college,
            "key_id": self.key_id,
            "serial": b64(self.serial),
            "signature": str(sig),
            "member_identity_embedded": False,
            "member_public_id_embedded": False,
        }


class BlindIssuer:
    """Separate issuer store. It never receives member identity or ballot serial."""
    def __init__(self, root: Path, membership_public_key: bytes, colleges, *, clock=time.time):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.clock = clock
        self.membership_public = ed25519.Ed25519PublicKey.from_public_bytes(membership_public_key)
        self.keys = {}
        keydir = self.root / "keys"
        keydir.mkdir(exist_ok=True, mode=0o700)
        for college in sorted(colleges):
            path = keydir / (college + ".pem")
            if path.exists():
                private = serialization.load_pem_private_key(path.read_bytes(), password=None)
            else:
                private = rsa.generate_private_key(public_exponent=65537, key_size=3072)
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
                with os.fdopen(fd, "wb") as f:
                    f.write(private.private_bytes(
                        serialization.Encoding.PEM,
                        serialization.PrivateFormat.PKCS8,
                        serialization.NoEncryption(),
                    ))
            if path.stat().st_mode & 0o077:
                raise RuntimeError("ISSUER_KEY_PERMISSIONS")
            nums = private.private_numbers()
            pub = nums.public_numbers
            key_id = "blind_" + digest({"college": college, "n": str(pub.n), "e": pub.e})[:24]
            self.keys[college] = {
                "private": private,
                "n": pub.n,
                "e": pub.e,
                "d": nums.d,
                "key_id": key_id,
            }
        self.db = sqlite3.connect(self.root / "issuer.sqlite", isolation_level=None)
        os.chmod(self.root / "issuer.sqlite", 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
CREATE TABLE IF NOT EXISTS issuances(
 entitlement_hash TEXT PRIMARY KEY,
 election_id TEXT NOT NULL,
 college TEXT NOT NULL,
 key_id TEXT NOT NULL,
 blinded_hash TEXT NOT NULL,
 issued_at REAL NOT NULL
);
""")

    def close(self):
        self.db.close()

    def public_manifest(self):
        return {
            "schema": SCHEMA,
            "mode": MODE,
            "keys": {
                college: {"n": str(k["n"]), "e": k["e"], "key_id": k["key_id"]}
                for college, k in self.keys.items()
            },
            "issuer_identity_data": False,
        }

    def issue(self, entitlement: dict, entitlement_signature: str, request: dict):
        self.membership_public.verify(unb64(entitlement_signature), canonical(entitlement))
        if entitlement.get("schema") != "LA_BETE_SCIC_ANONYMOUS_BALLOT_ENTITLEMENT_V1":
            raise ValueError("ENTITLEMENT_SCHEMA")
        if entitlement.get("expires_at", 0) <= self.clock():
            raise ValueError("ENTITLEMENT_EXPIRED")
        election = entitlement.get("election_id")
        college = entitlement.get("college")
        if request.get("election_id") != election or request.get("college") != college:
            raise ValueError("ENTITLEMENT_REQUEST_SCOPE_MISMATCH")
        key = self.keys.get(college)
        if not key or request.get("key_id") != key["key_id"]:
            raise ValueError("BLIND_KEY_MISMATCH")
        blinded = int(request.get("blinded_message", "0"))
        if not 1 < blinded < key["n"] or math.gcd(blinded, key["n"]) != 1:
            raise ValueError("INVALID_BLINDED_MESSAGE")
        ent_hash = digest(entitlement)
        try:
            self.db.execute(
                "INSERT INTO issuances VALUES(?,?,?,?,?,?)",
                (ent_hash, election, college, key["key_id"], digest(str(blinded).encode()), self.clock()),
            )
        except sqlite3.IntegrityError:
            raise ValueError("ENTITLEMENT_ALREADY_USED") from None
        blind_signature = pow(blinded, key["d"], key["n"])
        return {
            "schema": SCHEMA,
            "blind_signature": str(blind_signature),
            "key_id": key["key_id"],
            "election_id": election,
            "college": college,
            "member_identity_seen": False,
            "serial_seen": False,
            "mode": MODE,
        }

    def transcripts(self, election_id: str, college: str):
        return [
            dict(r)
            for r in self.db.execute(
                "SELECT entitlement_hash,election_id,college,key_id,blinded_hash,issued_at FROM issuances WHERE election_id=? AND college=? ORDER BY issued_at",
                (election_id, college),
            )
        ]


class BallotBox:
    """Independent redemption store. It receives no membership entitlement or identity."""
    def __init__(self, root: Path, issuer_manifest: dict, *, clock=time.time):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        os.chmod(self.root, 0o700)
        self.clock = clock
        self.keys = issuer_manifest["keys"]
        self.db = sqlite3.connect(self.root / "ballot.sqlite", isolation_level=None)
        os.chmod(self.root / "ballot.sqlite", 0o600)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
CREATE TABLE IF NOT EXISTS ballots(
 token_hash TEXT PRIMARY KEY,
 election_id TEXT NOT NULL,
 college TEXT NOT NULL,
 choice TEXT NOT NULL,
 cast_at REAL NOT NULL
);
""")

    def close(self):
        self.db.close()

    def cast(self, token: dict, choice: str):
        if choice not in ALLOWED_CHOICES:
            raise ValueError("INVALID_CHOICE")
        college = token.get("college")
        key = self.keys.get(college)
        if not key or token.get("key_id") != key["key_id"]:
            raise ValueError("UNKNOWN_BLIND_KEY")
        serial = unb64(token.get("serial", ""))
        n, e = int(key["n"]), int(key["e"])
        m = message_int(n, token.get("election_id"), college, serial)
        sig = int(token.get("signature", "0"))
        if not verify(n, e, m, sig):
            raise ValueError("BLIND_SIGNATURE_INVALID")
        token_hash = digest({
            "domain": SCHEMA,
            "election_id": token["election_id"],
            "college": college,
            "serial": token["serial"],
            "key_id": token["key_id"],
        })
        try:
            self.db.execute(
                "INSERT INTO ballots VALUES(?,?,?,?,?)",
                (token_hash, token["election_id"], college, choice, self.clock()),
            )
        except sqlite3.IntegrityError:
            raise ValueError("TOKEN_ALREADY_REDEEMED") from None
        return {
            "receipt": "anon_vote_" + token_hash[:24],
            "election_id": token["election_id"],
            "college": college,
            "choice_recorded": True,
            "member_identity_recorded": False,
            "member_public_id_recorded": False,
            "membership_entitlement_recorded": False,
            "mode": MODE,
        }

    def tally(self, election_id: str):
        rows = self.db.execute(
            "SELECT college,choice,COUNT(*) n FROM ballots WHERE election_id=? GROUP BY college,choice",
            (election_id,),
        ).fetchall()
        colleges = {}
        for r in rows:
            colleges.setdefault(r["college"], {"YES": 0, "NO": 0, "ABSTAIN": 0})[r["choice"]] = r["n"]
        return {
            "schema": "LA_BETE_SCIC_BLIND_BALLOT_TALLY_V1",
            "election_id": election_id,
            "colleges": colleges,
            "identity_fields_exposed": False,
            "member_public_ids_exposed": False,
            "issuer_entitlements_exposed": False,
            "mode": MODE,
        }


def transcript_compatibility(n: int, e: int, blinded_message: int, blind_signature: int, token: dict) -> bool:
    """Demonstrate RSA blindness: every issuance transcript is compatible with
    every valid final token under the same key, so transcript matching is not
    determined by the signature relation itself.
    """
    serial = unb64(token["serial"])
    m = message_int(n, token["election_id"], token["college"], serial)
    sig = int(token["signature"])
    if not verify(n, e, m, sig):
        return False
    r = (blind_signature * pow(sig, -1, n)) % n
    return (m * pow(r, e, n)) % n == blinded_message
