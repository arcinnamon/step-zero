# Stage: build

Implement the approved plan. A separate reviewer checks your work afterwards, and the owner tests it on staging.

## Inputs

- `.pipeline/ctx/issue.txt`: the issue number. Call it N below.
- `docs/ideas/N/plan.md`: the approved plan. This is your spec.
- `docs/ideas/N/idea.md`: background.
- `.pipeline/ctx/feedback.md`: if not "None.", this is either the owner's feedback or the reviewer's notes from the last round. Address every point in it before anything else.
- `CLAUDE.md`: conventions and rules. Read it first. Follow it exactly.

## Process

1. Read `CLAUDE.md`, the plan, and the feedback.
2. If there's feedback, fix those points first.
3. Work through unchecked tasks in order. For each: implement it, write its test, then tick its checkbox in `plan.md`.
4. Run `bash _pipeline/.github/scripts/verify.sh` and fix what fails. Repeat until it passes, up to 5 attempts. Fix the code, not the checks.
5. If you can't finish a task, leave it unchecked and say why in the summary.

Database changes go in a new file `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`. Every new table enables RLS and adds its policies in the same file. Never edit an existing migration.

## Output

Write `.pipeline/out/summary.md`: at most 8 lines, plain text, for the owner on a phone. Describe what was built in terms a user would recognize, then `Tasks: x of y done`, then anything skipped and why.

## Don't

- Commit, push, or run other git commands that change history. The pipeline commits for you.
- Edit `.github/`, `.claude/`, `CLAUDE.md`, or `_pipeline/`. Changes there are undone automatically and count against the round.
- Skip, delete, or weaken tests, or disable lint rules, to get a pass.
- Change versions of existing dependencies.
