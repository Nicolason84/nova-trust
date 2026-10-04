import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.citizen_pilot import (
    Pilot, FIXTURES, FixtureIdentityVerifier, FixtureAdmissionAuthority, Denied,
)
from app.scic_blind_ballot import (
    BlindClient, BlindIssuer, BallotBox, transcript_compatibility,
)


class BlindBallotTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.member_root = root / "membership-authority"
        self.issuer_root = root / "blind-issuer"
        self.box_root = root / "ballot-box"
        self.now = [1801500000.0]
        self.env = patch.dict(os.environ, {"OJO_CITIZEN_SYNTHETIC_ONLY": "1"})
        self.env.start()
        self.p = Pilot(self.member_root, "https://localhost:44339", clock=lambda: self.now[0])
        self.tokens = {}
        with self.p.tx():
            for user in FIXTURES:
                kid = user + "-blind-unit-fixture"
                self.p.db.execute(
                    "INSERT INTO credentials(id,subject,pub,counter) VALUES(?,?,?,0)",
                    (kid, user, b"UNIT_FIXTURE_NOT_A_REAL_PUBLIC_KEY"),
                )
                self.tokens[user] = self.p.new_session(user, kid)
        self.admit("test-citizen-a")
        self.admit("test-citizen-c")
        self.pubkey = self.p.anonymous_ballot_entitlement_public_key()
        self.issuer = BlindIssuer(
            self.issuer_root,
            self.pubkey,
            ["CITIZENS_USERS", "CONTRIBUTORS_CIVIL_SOCIETY"],
            clock=lambda: self.now[0],
        )
        self.box = BallotBox(self.box_root, self.issuer.public_manifest(), clock=lambda: self.now[0])
        self.election = "SCIC-ELECTION-SYNTHETIC-001"

    def tearDown(self):
        self.box.close()
        self.issuer.close()
        self.p.db.close()
        self.env.stop()
        self.tmp.cleanup()

    def admit(self, subject):
        token = self.tokens[subject]
        app = self.p.apply_membership_fixture(token)
        return self.p.review_membership_fixture(
            app["id"],
            identity_verifier=FixtureIdentityVerifier(),
            admission_authority=FixtureAdmissionAuthority(),
            statutes_version="SYNTHETIC_STATUTES_V1",
        )

    def issue_for(self, subject):
        token = self.tokens[subject]
        entitlement = self.p.issue_blind_ballot_entitlement(token, self.election)
        college = entitlement["entitlement"]["college"]
        key = self.issuer.public_manifest()["keys"][college]
        client = BlindClient(self.election, college, key)
        request = client.request()
        response = self.issuer.issue(
            entitlement["entitlement"],
            entitlement["signature"],
            request,
        )
        final = client.unblind(response["blind_signature"])
        return entitlement, request, response, final

    def test_three_authorities_have_separate_stores(self):
        self.assertNotEqual(self.member_root, self.issuer_root)
        self.assertNotEqual(self.member_root, self.box_root)
        self.assertNotEqual(self.issuer_root, self.box_root)
        self.assertTrue((self.member_root / "data/synthetic.sqlite").exists())
        self.assertTrue((self.issuer_root / "issuer.sqlite").exists())
        self.assertTrue((self.box_root / "ballot.sqlite").exists())

    def test_membership_entitlement_contains_no_member_identity_or_public_id(self):
        receipt = self.p.public_membership_receipt(self.tokens["test-citizen-a"])
        ent = self.p.issue_blind_ballot_entitlement(self.tokens["test-citizen-a"], self.election)
        raw = json.dumps(ent, ensure_ascii=False)
        self.assertFalse(ent["membership_authority_identity_disclosed_to_issuer"])
        self.assertFalse(ent["public_member_id_disclosed_to_issuer"])
        self.assertNotIn("test-citizen-a", raw)
        self.assertNotIn(receipt["member_public_id"], raw)
        self.assertNotIn("Citoyen fictif A", raw)

    def test_one_anonymous_entitlement_per_member_per_election(self):
        self.p.issue_blind_ballot_entitlement(self.tokens["test-citizen-a"], self.election)
        with self.assertRaises(Denied):
            self.p.issue_blind_ballot_entitlement(self.tokens["test-citizen-a"], self.election)

    def test_blind_issuer_never_receives_member_identity_or_serial(self):
        receipt = self.p.public_membership_receipt(self.tokens["test-citizen-a"])
        entitlement, request, response, final = self.issue_for("test-citizen-a")
        issued = json.dumps({"entitlement": entitlement["entitlement"], "request": request, "response": response}, ensure_ascii=False)
        self.assertFalse(request["serial_disclosed"])
        self.assertFalse(request["member_identity_disclosed"])
        self.assertFalse(response["member_identity_seen"])
        self.assertFalse(response["serial_seen"])
        self.assertNotIn("test-citizen-a", issued)
        self.assertNotIn(receipt["member_public_id"], issued)
        self.assertNotIn(final["serial"], issued)

    def test_entitlement_replay_at_issuer_is_rejected(self):
        entitlement = self.p.issue_blind_ballot_entitlement(self.tokens["test-citizen-a"], self.election)
        college = entitlement["entitlement"]["college"]
        client = BlindClient(self.election, college, self.issuer.public_manifest()["keys"][college])
        req = client.request()
        self.issuer.issue(entitlement["entitlement"], entitlement["signature"], req)
        with self.assertRaises(ValueError):
            self.issuer.issue(entitlement["entitlement"], entitlement["signature"], req)

    def test_ballot_box_records_no_member_entitlement_or_public_id(self):
        member = self.p.public_membership_receipt(self.tokens["test-citizen-a"])
        _, _, _, final = self.issue_for("test-citizen-a")
        receipt = self.box.cast(final, "YES")
        self.assertFalse(receipt["member_identity_recorded"])
        self.assertFalse(receipt["member_public_id_recorded"])
        self.assertFalse(receipt["membership_entitlement_recorded"])
        cols = [r[1] for r in self.box.db.execute("PRAGMA table_info(ballots)")]
        for forbidden in ("subject", "member", "public_id", "entitlement", "signature"):
            self.assertNotIn(forbidden, cols)
        db = json.dumps([dict(r) for r in self.box.db.execute("SELECT * FROM ballots")])
        self.assertNotIn("test-citizen-a", db)
        self.assertNotIn(member["member_public_id"], db)

    def test_redeemed_token_cannot_be_replayed(self):
        _, _, _, final = self.issue_for("test-citizen-a")
        self.box.cast(final, "YES")
        with self.assertRaises(ValueError):
            self.box.cast(final, "NO")

    def test_forged_signature_is_rejected(self):
        _, _, _, final = self.issue_for("test-citizen-a")
        final["signature"] = str(int(final["signature"]) + 1)
        with self.assertRaises(ValueError):
            self.box.cast(final, "YES")

    def test_two_same_college_members_create_nontrivial_anonymity_set(self):
        a = self.issue_for("test-citizen-a")
        c = self.issue_for("test-citizen-c")
        self.assertEqual(a[3]["college"], "CITIZENS_USERS")
        self.assertEqual(c[3]["college"], "CITIZENS_USERS")
        self.assertNotEqual(a[3]["serial"], c[3]["serial"])
        self.assertEqual(len(self.issuer.transcripts(self.election, "CITIZENS_USERS")), 2)

    def test_blind_signature_transcripts_do_not_determine_token_matching(self):
        a = self.issue_for("test-citizen-a")
        c = self.issue_for("test-citizen-c")
        pairs = [a, c]
        key = self.issuer.keys["CITIZENS_USERS"]
        matrix = []
        for issuance in pairs:
            request, response = issuance[1], issuance[2]
            row = []
            for final in (a[3], c[3]):
                row.append(
                    transcript_compatibility(
                        key["n"],
                        key["e"],
                        int(request["blinded_message"]),
                        int(response["blind_signature"]),
                        final,
                    )
                )
            matrix.append(row)
        self.assertEqual(matrix, [[True, True], [True, True]])

    def test_separate_issuer_and_ballot_stores_cannot_directly_join(self):
        a = self.issue_for("test-citizen-a")
        c = self.issue_for("test-citizen-c")
        self.box.cast(a[3], "YES")
        self.box.cast(c[3], "NO")
        issuer_cols = {r[1] for r in self.issuer.db.execute("PRAGMA table_info(issuances)")}
        ballot_cols = {r[1] for r in self.box.db.execute("PRAGMA table_info(ballots)")}
        self.assertFalse({"token_hash", "choice"} & issuer_cols)
        self.assertFalse({"entitlement_hash", "blinded_hash"} & ballot_cols)

    def test_tally_is_aggregate_only(self):
        a = self.issue_for("test-citizen-a")
        c = self.issue_for("test-citizen-c")
        self.box.cast(a[3], "YES")
        self.box.cast(c[3], "NO")
        tally = self.box.tally(self.election)
        self.assertEqual(tally["colleges"]["CITIZENS_USERS"]["YES"], 1)
        self.assertEqual(tally["colleges"]["CITIZENS_USERS"]["NO"], 1)
        raw = json.dumps(tally)
        self.assertNotIn("soc_", raw)
        self.assertNotIn("test-citizen", raw)
        self.assertFalse(tally["identity_fields_exposed"])
        self.assertFalse(tally["member_public_ids_exposed"])
        self.assertFalse(tally["issuer_entitlements_exposed"])

    def test_revocation_after_issuance_does_not_selectively_revoke_anonymous_token(self):
        _, _, _, final = self.issue_for("test-citizen-a")
        self.p.revoke_all(self.tokens["test-citizen-a"])
        # Privacy tradeoff: the already-issued unlinkable credential remains valid until
        # its election/credential lifetime expires. Future issuance is blocked.
        self.box.cast(final, "YES")
        with self.assertRaises(Denied):
            self.p.issue_blind_ballot_entitlement(self.tokens["test-citizen-a"], "SCIC-ELECTION-SYNTHETIC-002")

    def test_mode_is_explicitly_not_rfc9474_conformance(self):
        manifest = self.issuer.public_manifest()
        self.assertIn("NOT_RFC9474_CONFORMANT", manifest["mode"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
