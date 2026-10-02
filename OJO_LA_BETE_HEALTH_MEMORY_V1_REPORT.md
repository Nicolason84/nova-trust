# La Bête — Persistent health memory V1

The existing public self-model now remembers source health, persistence, relapses,
executed refresh attempts and observed outcomes. A deterministic care plan ranks
current issues by severity, chronicity and consecutive unsuccessful attempts.

## Binding and evidence

- One existing pulse and one canonical debt feed remain in use.
- Memory lives in `self_model.health_memory` inside the existing evolution JSON.
- A transient updater receipt records a real pulse even on `NO_MATERIAL_CHANGE`.
- A cycle is a recorded observation, not a page poll, elapsed five-minute interval,
  or evolution generation. No prior cycles are reconstructed.
- Run IDs deduplicate retries; timestamps reject stale observations.
- Snapshot bootstrap records zero executed treatments.
- Source refresh counts require executed-source evidence and a new check timestamp.
- A last-good value, missing source or unknown state never proves recovery.
- Two consecutive healthy observations confirm recovery. Three consecutive refreshes
  without recovery propose source-access reconciliation through the existing Human Gate.
- Twelve consecutive affected observations or three confirmed recurrence episodes
  mark an issue chronic. These are explicit operational thresholds, not medical rules.
- An observed recovery following a retry does not establish treatment causality.
- Prioritization produces a proposal; it does not execute source replacement or change
  truth, policy, security, privacy, permissions or code. The existing heartbeat continues.
- The latest 120 cycle records are retained; lifetime issue/treatment aggregates survive
  pruning and restart. Malformed memory blocks promotion instead of erasing history.

## Validation

Nine dedicated memory tests pass: 17-cycle persistence, duplicate/stale replay,
three-failure escalation, two-observation recovery, relapse, flicker, missing/retained
observations, proposal-versus-execution, bounded history/restart, corruption rejection
and critical-issue priority. Existing evolution, nine convergence tests, resonance,
hydration and distribution checks pass. Hydration also verifies memory rendering,
missing-memory fallback and escaped labels.

A real official-source refresh returned `NO_MATERIAL_CHANGE`, then added one
`EXECUTED_PULSE` to the bootstrap memory. Each of four unavailable sources recorded
one executed retry. Replaying that receipt was byte-identical. Canonical live JSON
SHA-256 stayed `b6a9ea3c9578da2dd2c2d065d7b92f7b49f9c924045c38dbb4f8a5aa4b2606cb`.

## Limits

No successful real-source recovery is claimed at release. Recovery and relapse
paths are tested with fixtures. The current inaccessible sources remain unresolved.
A proposed reconciliation does not stop the existing refresh loop or claim a cure.
Scheduled execution depends on GitHub Actions; missed or rejected runs do not create
synthetic cycles. This is operational homeostasis, without subjective-consciousness claims.

## Prospective care evaluation — 02 October extension

The same health memory now declares a checkable recovery goal after an executed
source refresh: two consecutive healthy checks within the next three fresh source
observations. Outcome is recorded as PENDING, GOAL_MET or NOT_MET. Missing, unknown,
or unexecuted observations defer evaluation and cannot establish success or failure.
A missed goal increases reconciliation priority and proposes strategy review through
the existing Human Gate. Ordinary retries do not repeatedly open identical experiments.
A confirmed new episode can open a new goal. A recovery after the window is labelled
late and does not rewrite the original failed goal.

Eight recent goal records per issue are retained; lifetime result counts remain.
No retrospective goals or causal treatment effects are invented. The public voice
and expected/observed/revision cards expose the current learning state. Sixteen memory
and care tests pass, including bounded goal history, migration, missing evidence,
late recovery and recurrence, with existing convergence and distribution checks.
The real migration opened four pending goals at health cycle 4 and preserved all
three preceding observations and all prior treatment counters.

## Progression and propagation speed — 02 October extension

Independent BDF HTML, Webstat, AFT RSS, DGFiP and AFT maturity groups now collect
concurrently with five bounded workers; reconciliation and canonical writes remain
serial. Source order, fallback rules, care thresholds and proof gates are preserved.
Actual collection duration is recorded in the transient pulse receipt and its health
history row. Historical measurements are not backfilled. The UI reports measured
collection duration and cadence from real executed observations.

The existing page polling is consolidated into one non-overlapping pulse. Successful
visible-page checks wait 10 seconds instead of 30 between refreshes; hidden pages wait
120 seconds. Failures back off to 20/40/80/120 seconds. Returning to visibility checks
immediately. Feed and evolution requests can revalidate cached responses; the GitHub
runner API remains limited to one check per minute. Requests abort after 15 seconds.
Identical verified feed/evolution payloads skip full redraws. A fetched evolution must
refer to the displayed canonical snapshot before it can be applied.

Tests cover actual five-way overlap with a barrier, retained-source behavior,
visible/hidden polling, backoff/recovery, no overlapping requests, timeout, stale canon
binding and unchanged-state redraw suppression. The real local parallel collection
measured 254.6 ms; this is a single measurement, not a promised speedup factor.
The canonical feed stayed byte-identical. GitHub's scheduled server heartbeat remains
five minutes and can be delayed; faster page checks do not manufacture observations
or accelerate official publication. No additional scheduler or runtime is created.

## SUPRA know-how communication — 2026-10-02

Extended the existing one-shot `publish_france_beast_impulse.py` observer, invoked by the existing 300-second watchdog. No additional daemon or execution engine.

Five methods are transferred: evidenced health history, prospective care evaluation, strategy revision after failures, bounded parallel collection, and adaptive propagation. Each package has a method digest and immutable code/test links. Changing only a pulse commit or embedded observation does not produce another knowledge event. Canonical feed and evolution must agree.

The existing Megabus routes the knowledge envelope to `supra.megabus`. Only after an actual `ROUTED` outbox record, the adapter upserts `LEARN_LA_BETE_HOMEOSTASIS` into the existing `LEARNING_LOOP_REGISTRY_V1`, preserving unrelated entries and backing up the previous file. It sends `SUPRA_KNOW_HOW_RECEIVED` back to `ojo.la_bete`; the receipt reaches `ROUND_TRIP_CONFIRMED` only after that return envelope is actually routed. All payload values are strings, compatible with the native projection.

The package is received, not automatically applied to other organs. Its thresholds, cadence and resource limits require organ-specific calibration and measured validation. Routing and registration do not prove application or causality.

The host Megabus channel paths were reversibly bound to the single already-running sandbox bus (six symlinks including the same lock inode). Prior host channels were moved intact into a dated recovery directory, not replayed. The native nervous projection subsequently reported `LIVE` instead of `STALE`.

Validation: eight dedicated transfer tests cover actual routing before registration, the return route, deduplication, unrelated registry preservation, canonical mismatch, changed methods, stable heartbeat identity, registry identity and exclusion of capability execution. Existing convergence (10), health memory (16), evolution verifier and hydration checks pass.

Runtime routing and projection evidence is recorded after installation below.
