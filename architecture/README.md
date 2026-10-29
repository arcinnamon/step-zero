# architecture/

Versioned architecture artifacts. Everything here is a **protected path**: changes need a human-reviewed architecture PR.

| Path | Purpose |
| --- | --- |
| `idea.md` | The raw product idea and non-goals (human-authored or reviewed) |
| `requirements.md` | Facts, assumptions, questions, `REQ-NNN` requirements and acceptance criteria |
| `design.md` | Current design draft: alternatives, tradeoffs, interfaces, risks |
| `decisions/` | ADRs, `ADR-NNNN-<slug>.md` |
| `reviews/` | Adversarial review outputs (advisory), `review-N.md` |
| `revisions/<architecture-id>-rN/` | Immutable sealed snapshots: copies of the above plus `plan.yaml` and `manifest.json` |

## Sealing a revision

1. Copy the working documents and the snapshot plan into `revisions/<architecture-id>-rN/` (decisions under `decisions/`, reviews under `reviews/`).
2. Write `manifest.json` per [architecture-revision.schema.json](../delivery/schemas/architecture-revision.schema.json).
3. Run `node scripts/seal-revision.mjs architecture/revisions/<id>` to record file hashes and `content_digest`.
4. Run `cd scripts && npm run validate`.

A sealed snapshot is never edited. A change is a new revision whose `supersedes` names the old one.

## Approval is not stored here

The manifest has no approval field, and schema validation rejects one. Approval is derived by a trusted check from the protected PR's GitHub review and merge records for the exact `content_digest`. See [docs/governance.md](../docs/governance.md).

No revision has been created yet. Until a human-approved revision exists, `delivery/plan.yaml` stays empty and delivery is denied.
