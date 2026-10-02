"""Health history derived from the existing pulse. No scheduler or source truth."""
from copy import deepcopy
from datetime import datetime
import hashlib
import json

SCHEMA = "OJO_LA_BETE_HEALTH_MEMORY_V1"
BAD = {"UNAVAILABLE", "DEGRADED", "CONTRADICTED", "RETAINED_LAST_GOOD"}
GOOD = {"LIVE_VERIFIED", "CROSSCHECKED"}
CHRONIC_CYCLES = 12
RECOVERY_CYCLES = 2
HISTORY_LIMIT = 120


def validate_memory(memory):
    if memory.get("schema") != SCHEMA:
        raise ValueError("Invalid health memory schema; refusing to erase history")
    if not isinstance(memory.get("issues"), dict):
        raise ValueError("Invalid health issue registry")
    cycles = memory.get("total_cycles", 0)
    if not isinstance(cycles, int) or cycles < 0:
        raise ValueError("Invalid health cycle counter")
    history = memory.get("history", [])
    if len(history) > HISTORY_LIMIT or len({x["cycle_id"] for x in history}) != len(history):
        raise ValueError("Invalid or duplicate health history")
    if cycles:
        policy = memory.get("policy", {})
        if policy.get("may_change_truth") is not False or policy.get("causal_effect_claim") is not False or policy.get("plan_is_not_execution") is not True:
            raise ValueError("Health memory authority invariant broken")
        if not history or history[-1]["cycle"] != cycles:
            raise ValueError("Health memory lineage broken")
    for key, issue in memory["issues"].items():
        for field in ("affected_cycles", "consecutive_cycles", "episodes", "recoveries", "good_streak"):
            value = issue.get(field, 0)
            if not isinstance(value, int) or value < 0 or value > cycles:
                raise ValueError("Invalid health counter: " + key + ":" + field)
        if issue.get("id") != key or issue.get("episodes", 0) > issue.get("affected_cycles", 0) or issue.get("recoveries", 0) > issue.get("episodes", 0):
            raise ValueError("Invalid issue identity or recovery lineage")
        treatment = issue.get("treatment", {})
        for field in ("attempts", "no_recovery", "recovery_observed", "inconclusive", "failure_streak"):
            value = treatment.get(field, 0)
            if not isinstance(value, int) or value < 0 or value > cycles:
                raise ValueError("Invalid treatment counter")
        if treatment.get("attempts", 0) != sum(treatment.get(x, 0) for x in ("no_recovery", "recovery_observed", "inconclusive")):
            raise ValueError("Unaccounted treatment outcome")
        learning = issue.get("care_learning")
        if learning:
            if learning.get("schema") != "OJO_LA_BETE_CARE_EVALUATION_V1" or len(learning.get("trials", [])) > 8:
                raise ValueError("Invalid care evaluation schema or size")
            if learning.get("strategy") not in {"WAITING_FOR_EXECUTION", "WAITING_FOR_EVIDENCE", "EVALUATING", "MAINTAIN_OBSERVATION", "REVIEW_STRATEGY", "RECOVERY_AFTER_WINDOW"}:
                raise ValueError("Invalid care learning strategy")
            for outcome in ("GOAL_MET", "NOT_MET"):
                count = learning.get("counts", {}).get(outcome)
                if not isinstance(count, int) or not 0 <= count <= cycles:
                    raise ValueError("Invalid care learning aggregate")
                if count < sum(t.get("result") == outcome for t in learning["trials"]):
                    raise ValueError("Care learning aggregate lost evidence")
            if len({t["id"] for t in learning["trials"]}) != len(learning["trials"]):
                raise ValueError("Duplicate prospective care goal")
            for trial in learning["trials"]:
                if trial.get("causal_effect_proven") is not False or trial.get("result") not in {"PENDING", "GOAL_MET", "NOT_MET"}:
                    raise ValueError("Invalid care evaluation result or authority")
                if not 1 <= trial["opened_cycle"] <= cycles or trial["observed_cycles"] < 0 or trial["observed_cycles"] > 3:
                    raise ValueError("Invalid prospective evaluation lineage")
                if trial["result"] == "GOAL_MET" and trial["healthy_streak"] < RECOVERY_CYCLES:
                    raise ValueError("Recovery goal lacks confirming evidence")
                if trial["result"] == "NOT_MET" and trial["observed_cycles"] < 3:
                    raise ValueError("Care goal failed before its observation window")
    return True


def evaluate_care(memory, samples, executed, cycle_id):
    """Prospective goals for observed refreshes, never retrospective experiments."""
    cycle = memory["total_cycles"]
    decisions = []
    for key, issue in memory["issues"].items():
        learning = issue.setdefault("care_learning", {
            "schema": "OJO_LA_BETE_CARE_EVALUATION_V1", "trials": [],
            "counts": {"GOAL_MET": 0, "NOT_MET": 0}, "strategy": "WAITING_FOR_EXECUTION",
        })
        trials = learning["trials"]
        trial = trials[-1] if trials else None
        sample = samples.get(key, {})
        checked_at = sample.get("checked_at")
        fresh = issue.get("source_id") in executed and checked_at and (not trial or checked_at != trial.get("last_checked_at"))
        known = sample.get("state") in BAD | GOOD
        treatment = issue["treatment"]
        if trial and trial["result"] == "PENDING" and cycle > trial["opened_cycle"]:
            if not fresh or not known:
                trial["healthy_streak"] = 0
                trial["unobserved_cycles"] += 1
                learning["strategy"] = "WAITING_FOR_EVIDENCE"
            else:
                trial["observed_cycles"] += 1
                trial["last_checked_at"] = checked_at
                trial["healthy_streak"] = trial["healthy_streak"] + 1 if sample["state"] in GOOD else 0
                trial["observed_result"] = sample["state"]
                trial["last_evaluated_cycle"] = cycle
                learning["strategy"] = "EVALUATING"
                if trial["healthy_streak"] >= RECOVERY_CYCLES:
                    trial["result"] = "GOAL_MET"
                elif trial["observed_cycles"] >= trial["window_observations"]:
                    trial["result"] = "NOT_MET"
                if trial["result"] != "PENDING":
                    trial["closed_cycle"] = cycle
                    learning["counts"][trial["result"]] += 1
                    learning["strategy"] = "MAINTAIN_OBSERVATION" if trial["result"] == "GOAL_MET" else "REVIEW_STRATEGY"
                    decisions.append({"issue_id": key, "care_goal": trial["result"], "causal_effect_proven": False})
        # A failed window remains failed even if recovery is confirmed later.
        if trial and trial["result"] == "NOT_MET" and issue["status"] == "RECOVERED":
            trial.setdefault("late_recovery_cycle", cycle)
            learning["strategy"] = "RECOVERY_AFTER_WINDOW"
        new_episode = not trial or issue["episodes"] > trial["episode"]
        if new_episode and treatment.get("last_cycle_id") == cycle_id and treatment.get("last_outcome") == "NO_RECOVERY":
            trial = {
                "id": key + ":care:" + str(cycle), "action": "SOURCE_REFRESH", "episode": issue["episodes"],
                "opened_cycle": cycle, "opened_at": memory["last_observed_at"],
                "baseline_attempts": treatment["attempts"], "last_checked_at": checked_at,
                "expected_result": "Deux observations saines consécutives parmi les trois prochaines observations fraîches de cette source.",
                "window_observations": 3, "observed_cycles": 0, "unobserved_cycles": 0, "healthy_streak": 0,
                "result": "PENDING", "observed_result": sample.get("state"), "causal_effect_proven": False,
            }
            learning["trials"] = (trials + [trial])[-8:]
            learning["strategy"] = "EVALUATING"
            decisions.append({"issue_id": key, "care_goal": "OPENED_PROSPECTIVELY", "causal_effect_proven": False})
        if trial:
            trial["attempts_since_goal_opened"] = treatment["attempts"] - trial["baseline_attempts"]
        if learning["strategy"] == "REVIEW_STRATEGY":
            for plan in memory["care_plan"]:
                if plan["issue_id"] == key:
                    plan.update(action="RECONCILE_SOURCE_ACCESS", human_gate=True)
                    plan["priority"] += 25
                    plan["reason"] += " L'objectif de récupération n'a pas été atteint dans la fenêtre observée."
                    plan["care"] = "Réviser la stratégie d'accès aux sources officielles; maintenir le dernier bon état et la surveillance existante."
    memory["care_plan"].sort(key=lambda x: (-x["priority"], x["issue_id"]))
    memory["care_learning_summary"] = {
        "goals_met": sum(x["care_learning"]["counts"]["GOAL_MET"] for x in memory["issues"].values()),
        "goals_not_met": sum(x["care_learning"]["counts"]["NOT_MET"] for x in memory["issues"].values()),
        "pending": sum(bool(x["care_learning"]["trials"]) and x["care_learning"]["trials"][-1]["result"] == "PENDING" for x in memory["issues"].values()),
        "origin": "PROSPECTIVE_GOALS_ONLY", "causal_effect_proven": False,
    }
    return decisions


def build_health_memory(live, model, previous=None, observation=None):
    memory = deepcopy(previous) if previous else {
        "schema": SCHEMA, "total_cycles": 0, "issues": {}, "history": [],
        "origin": "NEW_OBSERVATIONS_ONLY_NO_BACKFILL", "started_at": None,
    }
    validate_memory(memory)
    sources = (observation or {}).get("sources", live.get("sources", []))
    at = (observation or {}).get("observed_at") or live.get("updated_at")
    if not at:
        raise ValueError("Health observation timestamp missing")
    cycle_id = (observation or {}).get("cycle_id")
    if observation:
        if observation.get("schema") != "OJO_LA_BETE_PULSE_OBSERVATION_V1" or not cycle_id:
            raise ValueError("Invalid pulse observation")
        if observation.get("source_snapshot_id") != live.get("snapshot_id"):
            raise ValueError("Pulse observation is not bound to the canonical snapshot")
    if not cycle_id:
        # Bootstrap is evidence of a snapshot, never an executed treatment.
        cycle_id = "snapshot:" + hashlib.sha256(json.dumps({
            "snapshot": live.get("snapshot_id"), "at": at,
            "checks": [(s.get("id"), s.get("checked_at"), s.get("health")) for s in sources],
        }, sort_keys=True).encode()).hexdigest()[:24]
    if cycle_id == memory.get("last_cycle_id") or any(x["cycle_id"] == cycle_id for x in memory["history"]):
        return memory
    if memory.get("last_observed_at") and datetime.fromisoformat(at.replace("Z", "+00:00")) <= datetime.fromisoformat(memory["last_observed_at"].replace("Z", "+00:00")):
        return memory
    memory["total_cycles"] += 1
    cycle = memory["total_cycles"]
    memory["started_at"] = memory["started_at"] or at
    memory["last_cycle_id"] = cycle_id
    memory["last_observed_at"] = at
    executed = set((observation or {}).get("executed_source_ids", []))
    samples = {}
    for source in sources:
        sid = source.get("id")
        if not sid or sid.endswith("_RETAINED") or sid == "AFT_SNAPSHOT":
            continue
        samples["source:" + sid] = {
            "label": source.get("label", sid), "state": source.get("health", "UNKNOWN"),
            "kind": "SOURCE", "source_id": sid,
            "checked_at": source.get("checked_at"), "evidence": source.get("health", "UNKNOWN"),
        }
    for dim in model["wellbeing"]["dimensions"]:
        if dim["id"] in {"truth_integrity", "resilience", "maturity_coverage"}:
            samples["dimension:" + dim["id"]] = {
                "label": dim["label"], "state": "LIVE_VERIFIED" if dim["state"] == "HEALTHY" else dim["state"],
                "kind": "DIMENSION", "source_id": None, "evidence": dim["evidence"],
            }
    transitions = []
    for key in sorted(set(samples) | set(memory["issues"])):
        sample = samples.get(key)
        issue = memory["issues"].get(key)
        if not sample or sample["state"] not in BAD | GOOD | {"ATTENTION", "CRITICAL"}:
            if issue:
                issue["observation_status"] = "UNOBSERVED"
                issue["consecutive_cycles"] = 0
                issue["good_streak"] = 0
            continue
        bad = sample["state"] not in GOOD
        if issue is None:
            if not bad:
                continue
            issue = memory["issues"][key] = {
                "id": key, "label": sample["label"], "kind": sample["kind"], "source_id": sample["source_id"],
                "first_seen_at": at, "affected_cycles": 0, "consecutive_cycles": 0,
                "episodes": 0, "recoveries": 0, "good_streak": 0, "status": "NEW",
                "treatment": {"id": "SOURCE_REFRESH" if sample["kind"] == "SOURCE" else "EVIDENCE_RECONCILIATION",
                    "attempts": 0, "no_recovery": 0, "recovery_observed": 0, "inconclusive": 0, "failure_streak": 0},
            }
        old_status = issue["status"]
        previously_bad = issue.get("last_state") in BAD | {"ATTENTION", "CRITICAL"}
        issue.update(last_observed_at=at, last_state=sample["state"], evidence=sample["evidence"], observation_status="OBSERVED")
        if bad:
            if old_status in {"NEW", "RECOVERED"}:
                issue["episodes"] += 1
            issue["affected_cycles"] += 1
            issue["consecutive_cycles"] += 1
            issue["good_streak"] = 0
            issue["last_bad_at"] = at
            issue["status"] = "CHRONIC" if issue["consecutive_cycles"] >= CHRONIC_CYCLES or issue["episodes"] >= 3 else "ACTIVE"
        else:
            issue["good_streak"] += 1
            issue["consecutive_cycles"] = 0
            issue["status"] = "RECOVERED" if issue["good_streak"] >= RECOVERY_CYCLES else "RECOVERING"
            if issue["status"] == "RECOVERED" and old_status != "RECOVERED":
                issue["recoveries"] += 1
                issue["recovered_at"] = at
        treatment = issue["treatment"]
        attempted = sample["source_id"] in executed and sample.get("checked_at") and sample.get("checked_at") != treatment.get("last_checked_at") and (bad or previously_bad)
        if attempted:
            outcome = "NO_RECOVERY" if bad else "RECOVERY_OBSERVED"
            treatment["attempts"] += 1
            treatment["no_recovery" if bad else "recovery_observed"] += 1
            treatment["failure_streak"] = treatment["failure_streak"] + 1 if bad else 0
            treatment.update(last_outcome=outcome, last_cycle_id=cycle_id, last_checked_at=sample.get("checked_at"), last_attempt_at=at)
            transitions.append({"issue_id": key, "action": "SOURCE_REFRESH", "outcome": outcome, "causal_effect_proven": False})
        if issue["status"] != old_status:
            transitions.append({"issue_id": key, "from": old_status, "to": issue["status"]})
    plan = []
    for key, issue in memory["issues"].items():
        if issue["status"] == "RECOVERED":
            continue
        treatment = issue["treatment"]
        escalation = treatment["failure_streak"] >= 3 or issue["status"] == "CHRONIC" or issue["last_state"] in {"CRITICAL", "CONTRADICTED"}
        severity = {"CRITICAL": 100, "CONTRADICTED": 90, "DEGRADED": 70, "UNAVAILABLE": 50}.get(issue["last_state"], 30)
        priority = severity + (20 if issue["status"] == "CHRONIC" else 0) + min(15, treatment["failure_streak"] * 5)
        action = "RECONCILE_SOURCE_ACCESS" if escalation else "VERIFY_RECOVERY" if issue["status"] == "RECOVERING" else "CONTINUE_BOUNDED_OBSERVATION"
        plan.append({"issue_id": key, "label": issue["label"], "priority": priority,
            "action": action, "status": "PROPOSED", "human_gate": escalation,
            "reason": f"{issue['consecutive_cycles']} cycle(s) consécutifs; {issue['episodes']} épisode(s); {treatment['failure_streak']} tentative(s) consécutive(s) sans récupération.",
            "care": "Examiner l'accès et réconcilier une preuve officielle; conserver le dernier bon état et le heartbeat." if escalation else "Continuer le heartbeat existant; confirmer la récupération par deux observations saines consécutives.",
            "expected_result": "Deux observations saines consécutives de même portée; aucune estimation substituée.",
            "previous_recovery_observed": treatment["recovery_observed"], "causal_effect_proven": False,
        })
    memory["care_plan"] = sorted(plan, key=lambda x: (-x["priority"], x["issue_id"]))
    transitions.extend(evaluate_care(memory, samples, executed, cycle_id))
    memory["history"] = (memory["history"] + [{
        "cycle": cycle, "cycle_id": cycle_id, "at": at, "source_snapshot_id": live.get("snapshot_id"),
        "health": model["wellbeing"]["state"], "transitions": transitions,
        "source_checks": [{"id": x.get("id"), "state": x.get("health"), "checked_at": x.get("checked_at"), "executed": x.get("id") in executed} for x in sources],
        "active_issues": [k for k, v in memory["issues"].items() if v["status"] != "RECOVERED"],
        "observation_kind": "EXECUTED_PULSE" if observation else "SNAPSHOT_BOOTSTRAP",
    }])[-HISTORY_LIMIT:]
    memory["policy"] = {"chronic_after_consecutive_cycles": CHRONIC_CYCLES, "recovery_confirmation_cycles": RECOVERY_CYCLES,
        "escalation_after_failed_attempts": 3, "history_limit": HISTORY_LIMIT,
        "cycle_is_not_page_poll": True, "causal_effect_claim": False, "may_change_truth": False,
        "missed_cycles_backfilled": False, "plan_is_not_execution": True}
    validate_memory(memory)
    return memory
