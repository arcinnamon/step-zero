import { approvalReadiness, checkActivePlanMatchesRevision } from './revision.mjs';

// Pure model of the delivery-eligibility contract (G1, G3, G8). It performs NO GitHub I/O.
//
// `attestation` and `trusted` MUST come from a trusted publisher that read GitHub review/merge
// records (Phase 2). Never populate them from files in the PR under evaluation. Absent or
// inconclusive input always denies.
//
//   attestation: { architecture_id, revision_id, content_digest, source_pr, source_head_sha,
//                  merge_commit_sha, reviewer_login, reviewer_type, reviewer_permission,
//                  review_id, review_state, review_commit_id, approved_at }
//   trusted:     { allowedReviewers: string[] }
export function checkDeliveryEligibility({ revision, activePlan, attestation, trusted }) {
  const reasons = [];
  if (!revision || !revision.manifest) return { eligible: false, reasons: ['no architecture revision'] };
  if (revision.problems.length) reasons.push(...revision.problems.map((p) => `revision invalid: ${p}`));

  const readiness = revision.manifest.reviewer_findings ? approvalReadiness(revision.manifest) : { ready: false, reasons: ['no findings'] };
  if (!readiness.ready) reasons.push(...readiness.reasons);

  if (!attestation) {
    reasons.push('no trusted approval attestation');
  } else if (!trusted || !Array.isArray(trusted.allowedReviewers)) {
    reasons.push('no trusted reviewer allowlist');
  } else {
    const m = revision.manifest;
    if (attestation.architecture_id !== m.architecture_id || attestation.revision_id !== m.revision_id) reasons.push('attestation is for a different revision');
    if (attestation.content_digest !== revision.computedDigest) reasons.push('attestation digest does not match current content (stale or altered)');
    if (attestation.reviewer_type !== 'User' || /\[bot\]$/i.test(attestation.reviewer_login ?? '')) reasons.push('approval is not from a human user');
    if (!trusted.allowedReviewers.includes(attestation.reviewer_login)) reasons.push('reviewer is not on the trusted allowlist');
    if (!['admin', 'maintain'].includes(attestation.reviewer_permission)) reasons.push('reviewer lacks required repository permission');
    if (attestation.review_state !== 'APPROVED') reasons.push('review state is not APPROVED');
    if (!attestation.source_head_sha || attestation.review_commit_id !== attestation.source_head_sha) reasons.push('review does not cover the PR head commit');
    if (!attestation.merge_commit_sha) reasons.push('architecture PR was not merged');
  }

  if (activePlan) reasons.push(...checkActivePlanMatchesRevision(activePlan, revision).map((p) => `active plan: ${p}`));
  else reasons.push('no active plan');

  return { eligible: reasons.length === 0, reasons };
}
