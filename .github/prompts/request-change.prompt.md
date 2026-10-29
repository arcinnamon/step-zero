---
description: Draft an architecture-change request when work needs to deviate from the approved architecture.
agent: architect
argument-hint: Task ID and why the approved design is insufficient
---

Work from the task and reason given in the chat input.

1. Identify the original task and the approved revision it is bound to.
2. Write a change request containing: the proposed delta, alternatives considered, consequences, affected requirements/ADRs/interfaces, and every downstream task that must pause.
3. Propose the next revision (`supersedes` the current one) as a new sealed snapshot. Do not modify the approved snapshot.

The change request is a proposal. It pauses impacted tasks only through the trusted process, resumes only after a new human-approved revision, and never lets the requester proceed under the old approval. Do not edit protected workflow, policy or agent files.
