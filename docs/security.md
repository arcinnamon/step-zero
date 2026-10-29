# Security

Threat model and limits for the framework. See [governance](governance.md) for invariants G1-G8.

## Trust model

- **Trusted:** the base-branch copy of protected files, GitHub review/merge records, and workflows pinned and run from the base branch.
- **Untrusted:** PR content (including its policy, scripts and tests), issue and comment text, review bodies, agent output, retrieved web content, and fixtures.
- Agent instructions are guidance. Enforcement is GitHub rulesets, required checks from expected publishers, CODEOWNERS, protected environments and token scoping.

## Threats and current mitigations

| Threat | Mitigation in this phase | Still needed |
| --- | --- | --- |
| Forged approval (`approved: true`, edited manifest) | Manifest schema forbids approval fields; eligibility requires an externally supplied attestation matching the content digest | Trusted check that reads GitHub review/merge records (Phase 2) |
| Bot or LLM approval | Attestation must be a `User` on a trusted allowlist with admin/maintain permission | Allowlist source and enforcement in a required check |
| Content changed after approval | Per-file hashes plus `content_digest`; unlisted and missing files detected; active plan compared to sealed snapshot | Binding to merged commit from GitHub |
| Task escapes scope or edits control plane | `allowed_paths` must not overlap protected paths; changed-path classifier | Run classifier from base branch as a required check |
| Policy edited by the PR it checks | `scripts/**` is protected; classifier accepts a caller-supplied trusted list | Pinned workflow loading base-branch code (Phase 2/3) |
| Prompt injection via issues, PRs, files | Every agent treats such text as data and forbids bypass | Platform controls remain the real boundary |
| Untrusted code with secrets | No workflows or secrets exist yet | CI with read-only token; no `pull_request_target` checkout of PR code |
| Production change via merge | No deployment automation exists | Protected `production` environment, exact-SHA release |

## Limits

- The eligibility function is a **pure model** of the contract. It performs no GitHub I/O and proves nothing about real approvals until a trusted publisher supplies the attestation.
- The glob-overlap test is conservative, not a complete glob-intersection solver; it errs toward rejecting.
- Test fixtures are data. Text in them, including claims of approval, has no authority and the tests assert that.
- Dependencies in `scripts/` (`ajv`, `yaml`) are lockfile-pinned; review updates as protected-path changes.

## Secrets and credentials

None are required or present. Never commit secrets. Production credentials belong only to the protected release job (G6). Agents never receive them.

## Reporting

Report suspected governance bypasses to the repository owner privately before opening a public issue.
