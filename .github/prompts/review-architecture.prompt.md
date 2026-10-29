---
description: Run an adversarial review of a sealed architecture revision (advisory only).
agent: adversarial-reviewer
argument-hint: Revision ID, e.g. my-app-r1
---

Review the sealed architecture revision named in the chat input under `architecture/revisions/`.

1. Run `cd scripts && npm ci && npm run validate`. If the revision fails integrity checks, report that and stop.
2. Challenge the revision on feasibility, correctness, security, permissions, operability, cost, maintainability, migration, testability and deployment safety, verifying claims against the real repository.
3. Write `architecture/reviews/review-N.md` listing each finding with id, severity, evidence and remediation.
4. End with a verdict: blocking findings open => **not ready for approval**.

This review is **advisory**. It is not approval, does not resolve findings, and does not replace the independent CI checks or the required human review. Do not edit the revision.
