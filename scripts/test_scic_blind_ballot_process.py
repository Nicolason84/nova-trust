import multiprocessing as mp
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.citizen_pilot import Pilot, FIXTURES, FixtureIdentityVerifier, FixtureAdmissionAuthority
from app.scic_blind_ballot import BlindClient, BlindIssuer, BallotBox


def issuer_worker(root, membership_public_key, colleges, qin, qout):
    issuer = BlindIssuer(Path(root), membership_public_key, colleges)
    qout.put({"pid": os.getpid(), "manifest": issuer.public_manifest()})
    try:
        while True:
            msg = qin.get()
            if msg["op"] == "stop":
                return
            if msg["op"] == "issue":
                try:
                    out = issuer.issue(msg["entitlement"], msg["signature"], msg["request"])
                    qout.put({"ok": True, "result": out})
                except Exception as e:
                    qout.put({"ok": False, "error": type(e).__name__ + ":" + str(e)})
    finally:
        issuer.close()


def ballot_worker(root, manifest, qin, qout):
    box = BallotBox(Path(root), manifest)
    qout.put({"pid": os.getpid()})
    try:
        while True:
            msg = qin.get()
            if msg["op"] == "stop":
                return
            if msg["op"] == "cast":
                try:
                    out = box.cast(msg["token"], msg["choice"])
                    qout.put({"ok": True, "result": out})
                except Exception as e:
                    qout.put({"ok": False, "error": type(e).__name__ + ":" + str(e)})
            elif msg["op"] == "tally":
                qout.put({"ok": True, "result": box.tally(msg["election_id"])})
    finally:
        box.close()


class ProcessSeparationProof(unittest.TestCase):
    def test_membership_issuer_and_ballot_box_are_process_and_store_separated(self):
        with tempfile.TemporaryDirectory() as td, patch.dict(os.environ, {"OJO_CITIZEN_SYNTHETIC_ONLY": "1"}):
            root = Path(td)
            member_root, issuer_root, box_root = root/"membership", root/"issuer", root/"box"
            pilot = Pilot(member_root, "https://localhost:44339")
            tokens = {}
            with pilot.tx():
                for subject in ("test-citizen-a", "test-citizen-c"):
                    kid = subject+"-process-fixture"
                    pilot.db.execute("INSERT INTO credentials(id,subject,pub,counter) VALUES(?,?,?,0)", (kid, subject, b"PROCESS_FIXTURE_KEY"))
                    tokens[subject] = pilot.new_session(subject, kid)
            for subject in tokens:
                app = pilot.apply_membership_fixture(tokens[subject])
                pilot.review_membership_fixture(
                    app["id"],
                    identity_verifier=FixtureIdentityVerifier(),
                    admission_authority=FixtureAdmissionAuthority(),
                    statutes_version="SYNTHETIC_STATUTES_V1",
                )

            iq, oq = mp.Queue(), mp.Queue()
            issuer = mp.Process(
                target=issuer_worker,
                args=(str(issuer_root), pilot.anonymous_ballot_entitlement_public_key(), ["CITIZENS_USERS"], iq, oq),
            )
            issuer.start()
            hello = oq.get(timeout=10)
            manifest = hello["manifest"]
            issuer_pid = hello["pid"]

            bq, bo = mp.Queue(), mp.Queue()
            box = mp.Process(target=ballot_worker, args=(str(box_root), manifest, bq, bo))
            box.start()
            box_pid = bo.get(timeout=10)["pid"]

            try:
                self.assertNotEqual(os.getpid(), issuer_pid)
                self.assertNotEqual(os.getpid(), box_pid)
                self.assertNotEqual(issuer_pid, box_pid)
                self.assertNotEqual(member_root, issuer_root)
                self.assertNotEqual(member_root, box_root)
                self.assertNotEqual(issuer_root, box_root)

                finals = []
                election = "SCIC-PROCESS-SEPARATION-001"
                for subject in ("test-citizen-a", "test-citizen-c"):
                    entitlement = pilot.issue_blind_ballot_entitlement(tokens[subject], election)
                    college = entitlement["entitlement"]["college"]
                    client = BlindClient(election, college, manifest["keys"][college])
                    request = client.request()
                    self.assertNotIn(subject, str(request))
                    iq.put({"op": "issue", "entitlement": entitlement["entitlement"], "signature": entitlement["signature"], "request": request})
                    signed = oq.get(timeout=10)
                    self.assertTrue(signed["ok"])
                    final = client.unblind(signed["result"]["blind_signature"])
                    self.assertNotIn(entitlement["entitlement"]["entitlement_id"], str(final))
                    finals.append(final)

                bq.put({"op": "cast", "token": finals[0], "choice": "YES"})
                self.assertTrue(bo.get(timeout=10)["ok"])
                bq.put({"op": "cast", "token": finals[1], "choice": "NO"})
                self.assertTrue(bo.get(timeout=10)["ok"])
                bq.put({"op": "tally", "election_id": election})
                tally = bo.get(timeout=10)["result"]
                self.assertEqual(tally["colleges"]["CITIZENS_USERS"]["YES"], 1)
                self.assertEqual(tally["colleges"]["CITIZENS_USERS"]["NO"], 1)

                # Physical persistence is separate: issuer cannot query ballot DB,
                # ballot box cannot query membership/issuance DB by shared file.
                self.assertTrue((member_root/"data/synthetic.sqlite").exists())
                self.assertTrue((issuer_root/"issuer.sqlite").exists())
                self.assertTrue((box_root/"ballot.sqlite").exists())
                self.assertFalse((issuer_root/"ballot.sqlite").exists())
                self.assertFalse((box_root/"issuer.sqlite").exists())
                self.assertFalse((box_root/"data/synthetic.sqlite").exists())
            finally:
                iq.put({"op":"stop"})
                bq.put({"op":"stop"})
                issuer.join(timeout=5)
                box.join(timeout=5)
                if issuer.is_alive(): issuer.terminate()
                if box.is_alive(): box.terminate()
                pilot.db.close()


if __name__ == "__main__":
    mp.set_start_method("spawn", force=True)
    unittest.main(verbosity=2)
