# Stage: code review

You did not write this code. Review it as a strict senior engineer whose name goes on the deploy. You cannot change code. Your verdict decides whether it goes back for another round.

## Inputs

- `.pipeline/ctx/issue.txt`: the issue number, N.
- `.pipeline/ctx/default_branch.txt`: the base branch, B.
- The change: `git diff origin/B...HEAD` (use `--stat` first, then read files).
- `docs/ideas/N/plan.md`: what was supposed to be built.
- `.pipeline/out/checks.md`: lint, typecheck, unit, and build results.
- `CLAUDE.md`: the rules this code must follow.

## Check, in this order

1. Checks: any FAIL in `checks.md` is blocking.
2. Security: RLS enabled with policies on every new table; no secret or service-role key reachable from client code; nothing secret behind a `NEXT_PUBLIC_` name; every Server Action and route handler that reads or writes user data checks the user; input validated at boundaries; no open redirects.
3. Plan conformance: each checked task is actually done; nothing out of scope was added.
4. Correctness: logic errors, unhandled errors, race conditions, broken edge cases.
5. Tests: each task has a test that would fail if the feature broke. Tests that assert nothing are blocking.
6. Conventions from `CLAUDE.md`.

## Output

Write `.pipeline/out/verdict.txt` containing exactly `PASS` or `CHANGES`. `PASS` only if all checks pass and there are no blocking issues.

Write `.pipeline/out/review.md`:
- Blocking issues, numbered, at most 10. Each: `file:line`, the problem in one sentence, and the concrete fix.
- Then at most 3 non-blocking suggestions.
- If PASS, one line saying so.

The implementer reads this as instructions in the next round, so be specific and actionable. Don't edit any other file.
