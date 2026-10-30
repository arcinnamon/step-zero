# Agent pipeline template

Write a short idea as a GitHub issue. Agents review it, plan it, build it, and deploy it, and you approve each step by replying on the issue from your phone.

```
Idea issue ─► Adversarial review ─► Plan ─► Build ⇄ Code review ─► Staging ─► Production
                  you: APPROVED      you: APPROVED    (up to 3 rounds)     you: APPROVED
```

Stack: Next.js on Vercel, Supabase for the database and auth, Claude Code GitHub Action for the agents.

## How you use it

1. Open an issue with the **Idea** template. A few sentences is enough, just enough to set up an MVP.
2. The pipeline replies in the same issue when it needs you. Every prompt ends with what to do next.
3. Reply with one of:
   - `APPROVED` to move to the next stage. It must be the whole comment.
   - `STOP` to pause. Nothing runs until you reply again.
   - Anything else is feedback. The current stage reruns with your feedback. After a STOP or a failure, any feedback resumes the pipeline.

You never change labels, paste commit hashes, or link PRs. The pipeline keeps track of all of it. The `needs-you` label marks issues waiting on you, which makes a handy filter in the GitHub app.

Your APPROVED applies to exactly what you were shown. If the idea is edited or the branch gets new commits after a prompt, the pipeline asks again instead of acting.

### What happens at each stage

| Stage | Agent | Ends with |
|---|---|---|
| Idea review | Four critics (product, security, architecture, cost) | Verdict, concerns with proposed fixes. You approve or reply. |
| Plan | Planner | `docs/ideas/<n>/plan.md` on a branch and a PR. You approve or reply. |
| Build | Implementer, then a separate reviewer | Checks plus review. Failing rounds retry automatically, up to 3. |
| Staging | No agent | Vercel preview, staging migrations, e2e tests. You approve or reply. |
| Production | No agent | Merge, production migrations, deploy, issue closed. |

Feedback on staging goes back to the build stage, since it means the code should change.

## Setup

You need: a GitHub repo created from this template, a Claude subscription that includes Claude Code, a Vercel account, and optionally two Supabase projects.

**1. Repository settings**

- Settings → Actions → General → Workflow permissions: choose **Read and write permissions** and tick **Allow GitHub Actions to create and approve pull requests**.
- Actions → **Pipeline setup** → Run workflow. This creates the labels.
- Optional: add a ruleset on `main` that requires a pull request (0 approvals) and blocks force pushes.

**2. Claude**

Run `claude setup-token` locally and save the token as the repository secret `CLAUDE_CODE_OAUTH_TOKEN`.

**3. Vercel**

- Create a Vercel project for this repo. `vercel.json` turns off Vercel's own Git deploys so only the pipeline deploys.
- Repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (the last two are in `.vercel/project.json` after `vercel link`).
- In Vercel project settings, set environment variables from `.env.example`: Preview points at your staging Supabase project, Production at your production one.
- If Deployment Protection is on, create a Protection Bypass for Automation secret and save it as the repository secret `VERCEL_AUTOMATION_BYPASS_SECRET` so e2e tests can reach previews.

**4. Supabase (optional until an idea needs a database)**

- Create two projects: staging and production.
- Repository secret: `SUPABASE_ACCESS_TOKEN` (from your Supabase account settings).
- Settings → Environments: create `staging` and `production`. In each, add `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD` for that project.

Without these, the migration steps are skipped and say so in the prompt.

**5. Production approval gate**

- In the `production` environment, add yourself under Required reviewers. GitHub then asks you to approve each production deploy, with an Approve button in the mobile app.
- Optional, to approve once instead of twice: create a fine-grained personal access token for this repo with Actions and Deployments read and write permissions, and save it as `APPROVER_PAT`. Your APPROVED comment then approves the gate for you.

**6. Lockfile**

Run `npm install` locally and commit `package-lock.json`. Dependency ranges in `package.json` are loose; the lockfile is what pins them.

### Optional repository variables

| Variable | Default | Purpose |
|---|---|---|
| `PIPELINE_APPROVER` | repo owner | GitHub username whose comments count |
| `CLAUDE_MODEL` | Claude Code default | Model for all agents, for example `opus` or `sonnet` |
| `MAX_REVIEW_ROUNDS` | 3 | Build and review rounds before it asks you |

## How it works

- `orchestrator.yml` reacts to new issues and to your comments. It reads the pipeline state, decides what your reply means, and dispatches a stage workflow. Logic is in `.github/scripts/pipeline.js`, with tests in `pipeline.test.js`.
- State is stored in a hidden marker inside each pipeline comment on the issue. The newest one wins. Labels mirror it.
- Stage workflows load their scripts and prompts from the default branch, never from the branch agents write to. Edits agents make to `.github/`, `.claude/`, or `CLAUDE.md` are undone before each commit.
- Agents only get the Claude token and the workflow's GitHub token. Supabase and Vercel credentials live in jobs that run no agent. Staging and production builds happen on Vercel's servers, not next to the tokens.
- Only your issues and comments are passed to agents. Comments from anyone else are ignored.

Agent instructions are in `.github/prompts/`, reviewer personas in `.claude/agents/`, and project conventions in `CLAUDE.md`. Edit those to change how the agents behave.

## Known limits

- **Subscription limits.** Agents run on your Claude subscription, so a long pipeline run shares limits with your own use of Claude. If you hit them, add an `anthropic_api_key` to the workflows instead.
- **Private repos.** On GitHub Free, environments and required reviewers aren't available for private repositories. Use GitHub Pro or a public repo, or accept that your APPROVED comment is the only production gate.
- **CI on pipeline PRs.** Commits made with the workflow token don't trigger other workflows, so `ci.yml` doesn't run on pipeline branches. The build stage runs the same checks itself. If you add required status checks to `main`, the pipeline's merge will be blocked.
- **Stuck stage.** If a stage never reports back, reply `STOP`, then any feedback to rerun it.
- **Migrations run before code.** Production migrations apply before the new code deploys. Keep them backward-compatible, as `CLAUDE.md` says.

## Roadmap

- Local Supabase in Docker (`supabase start`) in CI for integration and RLS tests, with seed data
- A devcontainer so your machine, Codespaces, and CI match
