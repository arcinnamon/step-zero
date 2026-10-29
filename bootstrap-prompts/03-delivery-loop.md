# Bootstrap 03 — GitHub-hosted autonomous delivery and release gates

Read README, AGENTS, governance contract, trusted policy implementation and actual GitHub/Vercel configuration. Do not bypass incomplete prerequisite controls.

## Objective

Implement a durable GitHub-hosted delivery loop. Architecture changes require a protected human-reviewed architecture PR. Ordinary feature work should be agent-implemented, independently validated, and auto-merged. Production deployments require explicit human approval for an exact commit.

## Investigate capabilities first

Verify current GitHub Copilot coding-agent and automations support for issue assignment, programmatic dispatch, agentic workflows and Actions execution **on the user's actual repository/account**. Different APIs, enablement, GitHub plans, agent permissions and billing apply. Use supported documented integration; do not fabricate an endpoint. If fully automated dispatch is unavailable, implement the rest of the system and expose a manual-dispatch adapter with an explicit capability gap.

## Implementation

1. Represent approved architecture and task DAG with typed machine-validated contracts.
2. Use Issues/PRs for durable state and an Actions scheduler to reconcile pending, ready, dispatched, implementing, validating, reviewing, retrying, blocked and merged tasks.
3. Use stable identifiers, idempotency keys, concurrency rules and live GitHub state checks to prevent duplicated dispatch on repeated events or retries.
4. Dispatch one or more dependency-ready tasks according to configurable concurrency, with one isolated implementation branch/PR per task.
5. Capture PR-to-task and approved revision bindings in trustworthy checks; reject stale revisions, out-of-scope diffs and unauthorized protected-path changes.
6. Run application build, lint, typecheck, unit/integration tests and relevant security checks in unprivileged environments. Ensure agent-written status reports do not stand in for check evidence.
7. Run Delivery Reviewer for substantive review and request fixes; allow bounded self-repair for failing tests or review findings.
8. Allow automatic merge only through current trusted gates, expected check publishers, approved task binding, no protected paths and adequate review policy. A mandatory human approval rule for every PR defeats autonomous merging; document and test the actual conditional enforcement architecture.
9. Route protected-path, schema, API contract, infrastructure, authentication or production deployment changes through an architecture-change PR. Pause affected dependent tasks until approval.
10. Maintain actionable failure reports and replay-safe recovery after scheduler interruption.
11. Implement preview deployment behavior, a separately protected production release job, release approval evidence for the exact SHA, post-deployment health checks and documented rollback.

## Mandatory Vercel isolation

Inspect Vercel's automatic production branch deployment and promotion behavior before enabling auto-merge. Ensure merging to `main` cannot automatically change production traffic. Choose a tested supported configuration to keep previews while blocking unapproved production promotion. Use manual GitHub protected-environment approval for release and isolate production secrets from untrusted PRs. If Vercel integration cannot satisfy this directly, use explicit preview CLI/API deployments and independently approved production CLI/API deployments. Confirm with a live safe test or clearly document any unverified requirement.

## Security invariants

- Workflow/policy/agent modifications are independently human-gated.
- Builders and untrusted tests have no production credentials or administrative ruleset rights.
- Trusted checks and merge controller cannot be redefined by a feature PR.
- Approval and eligibility come from verified GitHub review/check provenance, not labels or editable YAML alone.
- Required checks are configured with trusted publishers wherever supported.
- Missing information or unavailable capabilities block rather than infer approval.

## Proof of operation

Demonstrate in a harmless example project or sandbox branch: approved architecture unlocks tasks; autonomous task dispatch; implementation PR; repair of a failing test; independent validation; permitted auto-merge; blocked protected-file change; duplicate event replay; manual release approval; exact-commit deployment and verification. Avoid deploying to a real production project without separate user authorization.

## Deliverable

Commit-ready workflows, orchestrator, tests, configuration documentation, security threat model, operational runbook, and an evidence table distinguishing implemented, configured, demonstrated, and unsupported capabilities. Never describe the system as fully autonomous until a real GitHub-hosted end-to-end path has passed.
