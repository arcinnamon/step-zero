# delivery/

Machine-readable delivery contracts. `plan.yaml` and `schemas/**` are **protected paths**.

- `plan.yaml` - the active task DAG, materialized from an approved sealed revision. Currently empty (`architecture: null`).
- `schemas/` - JSON Schema (draft 2020-12): [task](schemas/task.schema.json), [plan](schemas/plan.schema.json), [architecture revision](schemas/architecture-revision.schema.json), [evidence](schemas/evidence.schema.json), [common](schemas/common.schema.json).
- `evidence/` - evidence conventions; see [evidence/README.md](evidence/README.md).

## Task contract

Each task has: `id`, `architecture_binding` (architecture and revision), `requirement_ids`, `depends_on`, `scope.allowed_paths`, `acceptance_criteria`, `commands`, `retries.max_attempts` (1-5) and required `evidence`. Runtime state (ready, dispatched, ...) is **not** stored here; it lives in GitHub issues/PRs and is reconciled against current GitHub state.

## Digest binding

A snapshot's `plan.yaml` has `architecture.content_digest: null`, because a digest cannot cover itself. The active `delivery/plan.yaml` is identical except that it carries the revision's `content_digest`. `scripts/policy/revision.mjs` verifies the active plan against the sealed revision, so editing either one invalidates delivery eligibility.

## Validation

```sh
cd scripts && npm ci && npm run validate   # structure and integrity only
cd scripts && npm test                     # schema and policy tests
```

Passing validation is not approval. Approval comes only from trusted GitHub review/merge provenance.

## Allowed paths

Tasks cannot list paths that overlap protected paths (`scripts/policy/protected-paths.json`). The overlap test is deliberately conservative: a whole-repo glob such as `**` is rejected.
