import copy, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
import update_france_debt_rate_live as feed
from la_bete_health_memory import build_health_memory

class SourceAccessTests(unittest.TestCase):
    def denied(self, sid, url):
        return {"id":sid,"url":url,"label":sid,"health":"UNAVAILABLE",
                "checked_at":"2026-10-09T11:34:53Z","error":"HTTPError: HTTP Error 403: Forbidden"}

    def test_prior_refusal_suspends_request_and_preserves_evidence_time(self):
        old=self.denied("AFT_RSS",feed.AFT_RSS)
        with patch.object(feed,"req") as request:
            s=feed.fetch_watch("AFT_RSS","AFT","RSS",feed.AFT_RSS,"application/xml",{"sources":[old]})
        request.assert_not_called();self.assertFalse(s["executed"])
        self.assertEqual(s["checked_at"],old["checked_at"])
        self.assertEqual(s["automatic_refresh"],"SUSPENDED_UNTIL_ACCESS_REVIEW")
        self.assertEqual(s["http_status"],403);self.assertEqual(s["health"],"UNAVAILABLE")

    def test_new_explicit_refusal_is_one_attempt_then_suspended(self):
        with patch.object(feed,"req",side_effect=HTTPError(feed.AFT_RSS,403,"Forbidden",{},None)) as request:
            first=feed.fetch_watch("AFT_RSS","AFT","RSS",feed.AFT_RSS,"application/xml")
            second=feed.fetch_watch("AFT_RSS","AFT","RSS",feed.AFT_RSS,"application/xml",{"sources":[first]})
        self.assertEqual(request.call_count,1);self.assertTrue(first["executed"]);self.assertFalse(second["executed"])

    def test_all_maturity_refusals_keep_exact_last_good_values(self):
        ladder={"as_of":"2026-10-02","years":[{"year":2027,"oat_nominal_bne":50,"oati_bne":1,"oatei_bne":2}],"mode":"RETAINED_LAST_GOOD"}
        previous={"sources":[self.denied("AFT_MATURITY_"+k.upper(),u) for k,u in feed.AFT_MATURITY_URLS.items()],"maturity_ladder":ladder}
        before=copy.deepcopy(previous)
        with patch.object(feed,"req") as request:retained,sources=feed.fetch_aft_maturity(previous)
        request.assert_not_called();self.assertEqual(retained["years"],ladder["years"])
        self.assertEqual(previous,before);self.assertEqual(len(sources),3)
        self.assertTrue(all(s["executed"] is False for s in sources))

    def test_transient_failure_keeps_existing_retry_behavior(self):
        old=self.denied("AFT_RSS",feed.AFT_RSS);old["error"]="TimeoutError: timed out"
        with patch.object(feed,"req",return_value=(200,b"<rss/>",None,None,"utf-8")) as request:
            s=feed.fetch_watch("AFT_RSS","AFT","RSS",feed.AFT_RSS,"application/xml",{"sources":[old]})
        request.assert_called_once();self.assertEqual(s["health"],"OK")

    def test_refusal_is_bound_to_exact_source_and_url(self):
        previous={"sources":[self.denied("AFT_RSS",feed.AFT_RSS)]}
        self.assertIsNone(feed.paused_source(previous,"BDF_TEC",feed.AFT_RSS))
        self.assertIsNone(feed.paused_source(previous,"AFT_RSS","https://example.invalid/reviewed-export"))

    def test_other_sources_continue_during_access_review(self):
        previous={"sources":[self.denied("AFT_RSS",feed.AFT_RSS)]+[self.denied("AFT_MATURITY_"+k.upper(),u) for k,u in feed.AFT_MATURITY_URLS.items()]}
        with patch.object(feed,"req") as request, patch.object(feed,"fetch_bdf_html",return_value=({},{})) as bdf, patch.object(feed,"fetch_bdf_csv",return_value=({},{})) as csv, patch.object(feed,"fetch_dgfip_execution",return_value=({},{})) as budget:
            result=feed.collect_sources(previous)
        request.assert_not_called();bdf.assert_called_once();csv.assert_called_once();budget.assert_called_once()
        self.assertEqual(len(result),5)

    def test_paused_source_does_not_count_an_attempt_or_recovery(self):
        source=self.denied("AFT_RSS",feed.AFT_RSS)
        model={"wellbeing":{"state":"ATTENTION","dimensions":[]}}
        live={"snapshot_id":"OJO-TEST","updated_at":"2026-10-09T11:35:00Z","sources":[source]}
        receipt={"schema":"OJO_LA_BETE_PULSE_OBSERVATION_V1","cycle_id":"test:before","observed_at":"2026-10-09T11:35:00Z","source_snapshot_id":"OJO-TEST","sources":[source],"executed_source_ids":["AFT_RSS"]}
        before=build_health_memory(live,model,observation=receipt)
        paused=feed.suspend_denied_source(source);receipt.update(cycle_id="test:after",observed_at="2026-10-09T11:40:00Z",sources=[paused],executed_source_ids=[])
        after=build_health_memory(live,model,before,receipt)
        issue=after["issues"]["source:AFT_RSS"]
        self.assertEqual(issue["treatment"]["attempts"],1);self.assertEqual(issue["recoveries"],0)
        self.assertEqual(after["care_plan"][0]["status"],"BLOCKED_SOURCE_ACCESS")
        self.assertFalse(after["history"][-1]["source_checks"][0]["executed"])
        self.assertEqual(before["issues"]["source:AFT_RSS"]["treatment"]["attempts"],1)

if __name__=="__main__":unittest.main()
