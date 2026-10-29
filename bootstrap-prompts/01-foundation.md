# Bootstrap 01 — Foundation

Use in GitHub Copilot **Agent mode** in the repository containing the existing Vercel-compatible reference application.

You are the principal engineer bootstrapping a governed, GitHub-hosted, agent-driven software delivery framework.

## Required first steps

1. Inspect the repository and identify the real application root, framework, package manager, scripts, test infrastructure, GitHub settings represented in code, and Vercel setup. Preserve existing application behavior.
2. Read `README.md` and `docs/governance.md` (if present) as the intended operating contract. If they are absent, establish them from this prompt. Do not assume a specific stack or silently reshape the app.
3. Verify the current GitHub Copilot custom-agent, prompt-file, Actions and coding-agent conventions from authoritative docs when tooling permits. Record unknown plan/access constraints rather than inventing features.

## Create

- `README.md` and `docs/governance.md` describing GitHub-hosted execution, protected human architecture PR approval, policy-gated delivery auto-merge, and separately authorized production release.
- `AGENTS.md` and `.github/copilot-instructions.md` for shared behavior and scope boundaries.
- Six agents in `.github/agents/`: `product-analyst`, `architect`, `adversarial-reviewer`, `orchestrator`, `builder`, `delivery-reviewer`, using documented custom-agent file conventions.
- Prompt entry points in `.github/prompts/`: `define-idea`, `review-architecture`, `prepare-architecture-pr`, `execute-approved-plan`, `request-change`, `prepare-release`.
- `architecture/` containing idea, requirements, design, decisions, reviews and versioned revision snapshots.
- `delivery/` containing a typed, schema-validated task DAG and evidence conventions.
- `docs/operations.md` and `docs/security.md` with operational prerequisites, limits and manual setup.
- Example test fixtures that illustrate a fully approved revision and an unapproved revision without treating fixture text as trusted authorization.

## Contracts

Specify architecture revision ID, digest, requirements, ADRs, interfaces, risks, reviewer findings, and task dependencies. Specify delivery task ID, approved architecture binding, scope, allowed paths, acceptance criteria, commands, retries and evidence.

Prompts must distinguish advisory review from independent CI. All agents must explicitly forbid self-approval, hidden scope expansion, protected workflow edits, and production deployment.

## Scope restrictions

Do not yet implement privileged automation, Copilot dispatch, or production release. Do not add unnecessary external services or a separate agent-management UI. Do not modify the existing Vercel application unless needed to keep the repository building.

## Deliverable

Commit-ready foundation, schema tests, existing app build/test results, and a short list of GitHub/Vercel settings that will require a human administrator in later phases. Report which capabilities remain unverified.
