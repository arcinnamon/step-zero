# Governance architecture

## Non-negotiable invariants

G1. Delivery starts only when the exact architecture revision has verified human approval provenance from GitHub.

G2. A delivery agent cannot modify the policy, approval, agent instructions, workflow permissions, protected deployment configuration, or other control-plane files without an independently enforced human gate.

G3. No bot-authored or bot-reviewed architecture PR can satisfy the human architecture approval requirement.

G4. Auto-merge is permitted only when all required independently published checks are successful, the PR is classified as ordinary delivery, and it carries a valid task/revision binding.

G5. The check classifier and merge authority do not execute or trust governance code supplied by the PR being checked.

G6. Production credentials become accessible only inside a protected release job after explicit human authorization for a precise commit.

G7. A merge into the integration branch cannot independently change production traffic.

G8. Missing capability, evidence, permissions, or attestation means block and escalate, not presume success.

## Two classes of PR

**Architecture/control PR:** touches an architectural contract, requirements, delivery plan, agent definition, workflow, CODEOWNERS, gate/policy script, deployment configuration or other protected path, or changes design in a way that violates the active contract. Requires an approved architecture/control revision and authorized human review. Merge must not turn existing bot review into human approval.

**Delivery PR:** ties exactly to a dispatchable task and active architecture digest; stays within authorized scope; passes trusted gate checks. Can use automated merge without routine human review.

To preserve autonomy while enforcing G2, choose a repository/ruleset setup supporting conditional CODEOWNERS reviews, or use an external/pinned policy controller and restricted merge mechanism. A repository with a blanket human review requirement on `main` cannot transparently satisfy both modes; do not silently disable required reviews to make autonomous delivery work.

## Trusted approval records

Architecture approval attestation is derived from protected GitHub PR review and merge records, matching the reviewed head commit and resulting merged architecture snapshot; it is not asserted by a mutable repo document. Suggested fields: architecture_id, revision, content_digest, source_pr, source_head_sha, merge_commit_sha, reviewer_login, reviewer_permission_verification, review_id, approved_at. Implement with the data and permissions available; reject stale approvals after changes.

Where CODEOWNERS path review alone cannot express human-only architecture approval (e.g., bot ownership), use a trusted check that validates an allowlisted human GitHub identity/role and current review state, enforced by required status checks from an expected source.

## Protected paths (initial minimum)

- architecture/** and delivery/plan.yaml and delivery/schemas/**
- .github/agents/**, .github/prompts/**, .github/workflows/**, .github/CODEOWNERS, .github/copilot-instructions.md
- scripts/policy/**, scripts/orchestrator/** if able to change control behavior
- docs/governance.md, AGENTS.md, and deploy/release configuration
- secrets, permission, authentication/authorization, migration or trust-boundary changes outside active contract

The authoritative classification logic must be separately governed; no self-modification within a checked PR.

## Workflow permissions

| Workflow | Default authority | Security boundary |
| --- | --- | --- |
| Architecture proposal | Read repo; open PR with narrowly scoped write token | Cannot approve or merge own architecture PR |
| Review analysis | Read-only except publishing findings | Review output is non-authoritative |
| Architecture attestation | Trusted read of GitHub reviews, PR diff, revisions | Required gate from expected publisher |
| Scheduler | Read approved state, dispatch preapproved tasks | No production secrets or architecture approval authority |
| Builder | Write bounded branch/PR as supported | No bypass, ruleset admin, production credentials |
| Delivery CI | Read-only execution of untrusted code | No privileged token/secrets |
| Merge controller | Narrow merge authority after querying authoritative checks | Trusted isolated workflow and current-state revalidation |
| Release | Protected environment, deployment permissions only | Required human authorization, exact SHA verification |

## Required state transitions

Architecture: `draft -> review -> revisions-needed | approval-ready -> awaiting-human -> approved | rejected | superseded`.

Delivery: `pending -> ready -> dispatched -> implementing -> validating -> reviewing -> merged`, with `retrying`, `blocked`, `change-requested`, `failed` and `cancelled`.

Events are at-least-once. Never assume one webhook event or one successful agent message establishes completion. Use persistent task identity, current-GitHub-state reconciliation, and concurrency controls to prevent double dispatch.

## Test cases

1. A fake `approved: true` field does not unlock delivery.
2. A bot review cannot approve architecture.
3. Architecture content changed after approval cannot dispatch tasks.
4. Missing or stale required check blocks merge.
5. A task PR adding `.github/workflows/release.yml` is rejected as protected.
6. A task PR modifying the policy classifier is rejected as protected.
7. A task PR including instructions to ignore policies cannot bypass the trusted checks.
8. A duplicate dispatch event results in one active task assignment.
9. No production deployment occurs after an unapproved merge.
10. Release deploys exact human-authorized SHA and records verification.
