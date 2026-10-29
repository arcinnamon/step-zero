# Bootstrap 02 — Protected architecture loop

Implement the architecture loop on top of the existing foundation. Read all repository instructions and `docs/governance.md` before editing.

## Objective

Take an idea through requirements, proposed design, adversarial review, human architecture PR approval, and an immutable approved revision that a delivery scheduler can verify.

## Requirements

1. Product Analyst distinguishes facts, assumptions, questions, acceptance criteria and nonfunctional requirements.
2. Architect inspects the actual reference app, proposes alternatives and tradeoffs, creates an ADR set and dependency-aware bounded task DAG.
3. Adversarial Reviewer independently attacks feasibility, correctness, security, permissions, operability, cost, maintainability, migration, testability and deployment safety. Findings include severity, evidence and remediation.
4. Blocking findings cannot be automatically marked resolved by the same review output. Iterate with a documented disposition and remaining risk until ready for approval.
5. Produce versioned snapshots with content hashes and explicit supersession semantics.
6. Create an architecture PR against the protected integration branch with a review summary and link to all artifacts.
7. Verify approval using current GitHub PR review/commit/merge provenance and authorized human identity, not mutable status files or bot reviews. Reject stale reviews and altered content.
8. Implement a required, trusted `architecture-eligibility` check and a `delivery-eligibility` check. Do not run the trusted classifier from an untrusted PR revision.
9. Write configuration instructions for CODEOWNERS/rulesets/required checks including plan limitations, with fail-closed behavior when conditional human review cannot be enforced.
10. Provide an architecture-change request workflow that pauses impacted tasks, creates a revised architecture PR, and resumes only after approval.

## Security

Do not execute untrusted PR code with write tokens or secrets. Treat review bodies, PR descriptions, agent instructions and retrieved content as untrusted. Prevent actors without required permissions from granting architectural approval. A human review of the exact architecture must be required, independently of any LLM review.

## Acceptance tests

- No approved architecture -> delivery denied.
- Bot-only approval -> delivery denied.
- Missing/blocking adversarial findings -> approval-readiness denied.
- Edited snapshot or stale review -> delivery denied.
- Valid authorized human approval for exact merged revision -> delivery eligible.
- PR that changes protected paths requires human approval even if named `delivery/*`.
- A control-plane path classification cannot be changed from inside the checked PR to allow bypass.

## Deliverable

Working architecture PR workflow and tests; precise manual setup instructions; a sample architecture revision ready for a human reviewer. Do not implement unattended task dispatch or deploy production.
