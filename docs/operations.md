# Operations

Operational prerequisites, limits and manual setup. Items marked **(human)** need a repository/organization administrator or a Vercel project owner. Items marked **(unverified)** have not been confirmed on the target account.

## Current state (Phase 1: foundation)

Present: agent definitions, prompts, contracts, schemas, validation tooling and tests. Absent: workflows, CODEOWNERS, rulesets, dispatch automation and release automation. No agent in this repository can dispatch work, approve, merge or deploy.

## Local commands

```sh
cd scripts && npm ci
npm test            # schema, digest, eligibility and path-policy tests
npm run validate    # validate delivery/plan.yaml and architecture/revisions/*
```

Requires Node.js 20 or newer (developed on Node 24). `scripts/` is a self-contained tool root with its own `package.json`, so it does not interfere with the application's package manager.

## The application

This repository currently contains **no application**: no `package.json` at the root, no framework, no Vercel configuration. Before Phase 2, add the reference Vercel-compatible app and verify it builds and tests unchanged ([README](../README.md#getting-started), step 1). Do not restructure it to match illustrative layouts.

## Manual setup required in later phases

1. **(human)** Branch protection or rulesets on `main`: required PRs, required status checks from expected publishers, no bypass for agents or bots.
2. **(human)** `.github/CODEOWNERS` naming human owners for protected paths, with conditional review enforced as described in [governance](governance.md). If conditional human review cannot be enforced on this plan/ownership, **disable delivery auto-merge** rather than weaken architecture governance.
3. **(human)** Actions settings: default workflow token read-only; approval required for workflow runs from outside collaborators and bots; pin third-party actions to commit SHAs.
4. **(human)** Copilot settings: enable Copilot cloud agent and custom agents for the repo; confirm agent firewall and MCP settings. **(unverified)** availability depends on plan.
5. **(human)** Create the protected `production` environment with required human reviewers and no bypass; store deployment credentials only there.
6. **(human)** Vercel: disable or isolate automatic production promotion from `main`, keep previews on PRs, restrict who can change project settings. **(unverified)** options depend on Vercel plan.
7. **(human)** Decide the allowlist of human architecture approvers consumed by the trusted check (loaded from the trusted base branch or organization configuration, never from a PR).

## Unverified capabilities

- Whether Copilot cloud agent can be assigned tasks unattended on this account (README: if not demonstrable, stop at manual dispatch).
- Whether conditional CODEOWNERS review, rulesets and required-check source pinning are available on this plan.
- Whether `.agent.md` agents and `.prompt.md` prompts in `.github/` load in the user's current Copilot clients. File conventions were checked against GitHub's custom-agent reference and the VS Code prompt-file docs, but nothing was exercised at runtime.
- Vercel production-isolation options on the target project.

## Failure handling

If a capability, permission or attestation is missing, stop and escalate (G8). Record the finding in the task or architecture PR instead of working around it.
