# Evidence conventions

Evidence records follow [evidence.schema.json](../schemas/evidence.schema.json) and are keyed by task, attempt and PR head SHA.

- Evidence is authoritative only when **published by a trusted workflow** and cross-checked against current GitHub state (PR head SHA, check runs from the expected app). A file committed by a builder proves nothing.
- Every record repeats the full architecture binding including `content_digest`, so evidence for an old or superseded revision is detectably stale.
- `delivery-review` results are marked `advisory: true`; they can never satisfy a gate alone.
- Missing, `fail` or `inconclusive` results block merge (fail closed).
- Logs are referenced by `log_sha256`; store large logs as workflow artifacts, not in git.

Where evidence is stored (workflow artifacts, check annotations, or a protected evidence branch) is decided in Phase 3. Nothing in this directory is trusted as written.
