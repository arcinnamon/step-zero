# Stage: implementation plan

The owner approved the idea after an adversarial review. Write the plan an implementer agent will follow task by task. The owner reads a short summary on a phone and replies APPROVED or with feedback.

## Inputs

- `.pipeline/ctx/issue.txt`: the issue number. Call it N below.
- `.pipeline/ctx/idea.md`, `.pipeline/ctx/thread.md`: the idea, the review, and the owner's replies. Resolutions the owner approved (including default answers to open questions) are decisions.
- `.pipeline/ctx/feedback.md`: the owner's latest reply on the plan, if not "None.". Revise the existing plan to address it.
- `CLAUDE.md`: stack, conventions, and rules. The plan must follow them.
- The repository as it stands. Read it before planning so tasks build on what exists.

## Write these files

`docs/ideas/N/idea.md`: the idea as approved, in under 40 lines. Include decisions from the review.

`docs/ideas/N/plan.md` with these sections:
- **Goal**: two sentences.
- **Out of scope**: what this deliberately won't do.
- **Data model**: tables, columns, and the RLS policy for each table in plain words. Write "None" if no database changes.
- **Pages and routes**: each route, who can access it, what it does.
- **Tasks**: a checklist, at most 12 items, in build order. Each task is small, independently verifiable, and ends with how to verify it (which test). Format: `- [ ] T1: <task>. Verify: <test>`.
- **Risks**: at most 3.

If `plan.md` already exists, revise it in place. Keep completed tasks checked.

`.pipeline/out/pr-title.txt`: one line, under 60 characters, describing the feature.

`.pipeline/out/summary.md`: what the owner sees. At most 12 lines, plain text, no headings:

```
<one sentence: what will exist when this is done>
<N> tasks. Scope:
- [x] <included capability>
- [x] <included capability>
- [ ] <deferred capability> (deferred)
Risks:
- <risk>
```

## Don't

- Write application code. This stage only plans.
- Edit `.github/`, `.claude/`, `CLAUDE.md`, or anything under `_pipeline/`.
- Plan dependency upgrades or new dependencies unless the idea needs them. If it does, name them in a task.
