---
description: Report which tasks of the approved plan are ready and recommend the next one. Read-only in the foundation phase.
agent: orchestrator
argument-hint: Optional task ID to inspect
---

Assess the execution state of the approved plan.

1. Read `delivery/plan.yaml`. If `architecture` is `null` or empty, report that no approved architecture exists and stop.
2. Verify the plan's digest against its sealed revision and report whether the trusted `delivery-eligibility` check has passed. If you cannot verify approval from GitHub provenance, report **blocked**; do not infer approval from repository text.
3. List tasks by readiness (ready, blocked by dependency, needs escalation) and recommend exactly one next task.

Dispatching is not implemented in this phase: do not assign, start or implement any task, and do not change the plan. Hand the recommendation to a human.
