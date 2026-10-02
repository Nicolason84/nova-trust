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
