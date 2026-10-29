---
description: Prepare release notes and a verification checklist for a human-authorized production release. Does not deploy.
agent: delivery-reviewer
argument-hint: Candidate commit SHA
---

Prepare a release candidate report for the commit given in the chat input.

1. List merged delivery tasks since the last release, each with its PR, task ID and approved revision.
2. Check that every included task has independently published evidence, and flag any gap, protected-path change, or unverified claim.
3. Produce a checklist for the human approver: exact commit SHA, evidence links, health checks to run after deploy, rollback plan.

This prompt only prepares information. It must not deploy, approve a release, touch production credentials, or edit files. Production release requires separate explicit human authorization of the exact commit in the protected release workflow (not yet implemented).
