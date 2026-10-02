#!/usr/bin/env python3
"""Behavioral tests: persistent evidence, retries, hysteresis and replay."""
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import json
import unittest
from la_bete_health_memory import build_health_memory, validate_memory

class HealthMemoryTests(unittest.TestCase):
    def observe(self, cycle, state="UNAVAILABLE", memory=None, executed=True, omit=False):
        at=(datetime(2026, 10, 2, tzinfo=timezone.utc)+timedelta(minutes=cycle*5)).isoformat().replace("+00:00", "Z")
        source={"id":"AFT_MATURITY_OAT", "label":"Échéancier OAT", "health":state, "checked_at":at}
        live={"snapshot_id":"OJO-FIXED", "updated_at":"2026-10-02T00:00:00Z", "sources":[source]}
        model={"wellbeing":{"state":"ATTENTION" if state!="LIVE_VERIFIED" else "HEALTHY", "dimensions":[]}}
        receipt={"schema":"OJO_LA_BETE_PULSE_OBSERVATION_V1", "cycle_id":"test:"+str(cycle), "observed_at":at,
            "source_snapshot_id":"OJO-FIXED", "sources":[] if omit else [source], "executed_source_ids":[source["id"]] if executed else []}
        return build_health_memory(live, model, memory, receipt)

    def test_17_real_cycles_and_no_page_poll_inflation(self):
        m=None
        for c in range(1,18):m=self.observe(c,memory=m)
        i=m["issues"]["source:AFT_MATURITY_OAT"]
        self.assertEqual(i["consecutive_cycles"],17)
        self.assertEqual(i["status"],"CHRONIC")
        self.assertEqual(i["treatment"]["no_recovery"],17)
        before=json.dumps(m,sort_keys=True)
        self.assertEqual(json.dumps(self.observe(17,memory=m),sort_keys=True),before)
        self.assertEqual(json.dumps(self.observe(3,memory=m),sort_keys=True),before)
        self.assertEqual(m["total_cycles"],17)

    def test_three_failed_attempts_escalate_proposal(self):
        m=None
        for c in range(1,4):m=self.observe(c,memory=m)
        p=m["care_plan"][0]
        self.assertEqual(p["action"],"RECONCILE_SOURCE_ACCESS")
        self.assertTrue(p["human_gate"])
        self.assertEqual(p["status"],"PROPOSED")
        self.assertFalse(p["causal_effect_proven"])

    def test_recovery_is_confirmed_then_relapse_remembered(self):
        m=self.observe(1)
        m=self.observe(2,"LIVE_VERIFIED",m)
        self.assertEqual(m["issues"]["source:AFT_MATURITY_OAT"]["status"],"RECOVERING")
        m=self.observe(3,"LIVE_VERIFIED",m)
        i=m["issues"]["source:AFT_MATURITY_OAT"]
        self.assertEqual(i["status"],"RECOVERED")
        self.assertEqual(i["recoveries"],1)
        self.assertEqual(i["treatment"]["recovery_observed"],1)
        self.assertEqual(m["care_plan"],[])
        m=self.observe(4,memory=m)
        self.assertEqual(m["issues"]["source:AFT_MATURITY_OAT"]["episodes"],2)
        self.assertEqual(m["care_plan"][0]["previous_recovery_observed"],1)

    def test_flicker_does_not_claim_recovery(self):
        m=self.observe(1)
        m=self.observe(2,"LIVE_VERIFIED",m)
        m=self.observe(3,memory=m)
        self.assertEqual(m["issues"]["source:AFT_MATURITY_OAT"]["recoveries"],0)

    def test_missing_and_retained_are_not_cures(self):
        m=self.observe(1)
        m=self.observe(2,"RETAINED_LAST_GOOD",m)
        self.assertEqual(m["issues"]["source:AFT_MATURITY_OAT"]["status"],"ACTIVE")
        m=self.observe(3,memory=m,omit=True)
        i=m["issues"]["source:AFT_MATURITY_OAT"]
        self.assertEqual(i["observation_status"],"UNOBSERVED")
        self.assertEqual(i["recoveries"],0)
        self.assertEqual(i["consecutive_cycles"],0)
        self.assertEqual(i["treatment"]["attempts"],2)

    def test_proposed_care_is_not_an_attempt(self):
        m=self.observe(1,executed=False)
        self.assertEqual(m["issues"]["source:AFT_MATURITY_OAT"]["treatment"]["attempts"],0)

    def test_history_is_bounded_aggregates_survive_restart(self):
        m=None
        for c in range(1,141):m=self.observe(c,memory=json.loads(json.dumps(m)))
        self.assertEqual(len(m["history"]),120)
        self.assertEqual(m["total_cycles"],140)
        self.assertEqual(m["issues"]["source:AFT_MATURITY_OAT"]["affected_cycles"],140)
        self.assertTrue(validate_memory(m))

    def test_corruption_is_not_silently_reset(self):
        m=self.observe(1);m["issues"]["source:AFT_MATURITY_OAT"]["affected_cycles"]=-1
        with self.assertRaises(ValueError):self.observe(2,memory=m)

    def test_critical_problem_outranks_chronic_attention(self):
        m=self.observe(1)
        model={"wellbeing":{"state":"CRITICAL", "dimensions":[{"id":"truth_integrity","label":"Intégrité","state":"CRITICAL","evidence":"Invariant rompu"}]}}
        at="2026-10-02T00:10:00Z"
        live={"snapshot_id":"OJO-FIXED", "updated_at":at, "sources":[]}
        m=build_health_memory(live,model,m)
        self.assertEqual(m["care_plan"][0]["issue_id"],"dimension:truth_integrity")
        self.assertTrue(m["care_plan"][0]["human_gate"])
        self.assertFalse(m["policy"]["may_change_truth"])

if __name__=="__main__":unittest.main()
