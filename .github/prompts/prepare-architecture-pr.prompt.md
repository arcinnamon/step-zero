---
description: Prepare the protected architecture PR (branch, summary, artifact links). Does not approve or merge.
agent: architect
argument-hint: Revision ID, e.g. my-app-r1
---

Prepare an architecture pull request for the revision named in the chat input.

1. Confirm `architecture/revisions/<id>/` is sealed (`node scripts/seal-revision.mjs`) and `cd scripts && npm run validate` passes.
2. Confirm an adversarial review exists and list every finding with its current disposition. If any critical/high finding is open, state that the revision is **not approval-ready** and stop.
3. Draft the PR (branch `architecture/<id>`) with: summary, revision ID and `content_digest`, links to requirements, design, each ADR, the review and the task DAG, remaining risks, and what the human reviewer must verify.
4. Request review from the authorized human reviewers listed in `.github/CODEOWNERS` once it exists.

You must not approve, merge, enable auto-merge on, or otherwise self-approve this PR, and must not edit workflows, policy or agent files. The architecture PR needs verifiable approval from an authorized human.
