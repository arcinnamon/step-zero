import { strict as assert } from 'node:assert';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { checkDeliveryEligibility } from '../policy/eligibility.mjs';
import { classifyChange, protectedOverlaps } from '../policy/paths.mjs';
import { validatePlan } from '../policy/plan.mjs';
import { approvalReadiness, loadRevision } from '../policy/revision.mjs';
import { validateSchema } from '../policy/schemas.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (...p) => join(here, 'fixtures', ...p);
const approvedDir = fx('approved', 'demo-notes-r1');
const unapprovedDir = fx('unapproved', 'demo-links-r1');
const attestation = JSON.parse(readFileSync(fx('approved', 'attestation.example.json'), 'utf8'));
const trusted = { allowedReviewers: ['example-maintainer'] };

const clone = (dir) => {
  const tmp = mkdtempSync(join(tmpdir(), 'rev-'));
  const dest = join(tmp, 'demo-notes-r1');
  cpSync(dir, dest, { recursive: true });
  return dest;
};
const activePlanFor = (rev) => ({ ...rev.plan, architecture: { ...rev.plan.architecture, content_digest: rev.computedDigest } });
const eligible = (over = {}) => {
  const revision = loadRevision(approvedDir);
  return checkDeliveryEligibility({ revision, activePlan: activePlanFor(revision), attestation, trusted, ...over });
};

test('committed empty plan and fixtures are structurally valid', () => {
  assert.deepEqual(loadRevision(approvedDir).problems, []);
  assert.deepEqual(loadRevision(unapprovedDir).problems, []);
  assert.deepEqual(validatePlan(parse(readFileSync(join(here, '..', '..', 'delivery', 'plan.yaml'), 'utf8'))), []);
});

test('G1: valid human approval of the exact revision makes delivery eligible', () => {
  const r = eligible();
  assert.deepEqual(r.reasons, []);
  assert.equal(r.eligible, true);
});

test('governance case 1: a fake approved:true field does not unlock delivery', () => {
  const dir = clone(approvedDir);
  const mp = join(dir, 'manifest.json');
  writeFileSync(mp, JSON.stringify({ ...JSON.parse(readFileSync(mp, 'utf8')), approved: true }));
  const rev = loadRevision(dir);
  assert.ok(rev.problems.some((p) => p.includes('approved')));
  assert.equal(checkDeliveryEligibility({ revision: rev, activePlan: null, attestation: undefined, trusted }).eligible, false);
});

test('no approval attestation -> denied, even for a structurally perfect revision', () => {
  const r = eligible({ attestation: undefined });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes('no trusted approval attestation'));
});

test('governance case 2: bot approval is denied', () => {
  for (const bot of [{ reviewer_type: 'Bot' }, { reviewer_login: 'copilot-pull-request-reviewer[bot]' }]) {
    const r = eligible({ attestation: { ...attestation, ...bot }, trusted: { allowedReviewers: ['example-maintainer', 'copilot-pull-request-reviewer[bot]'] } });
    assert.equal(r.eligible, false, JSON.stringify(bot));
    assert.ok(r.reasons.includes('approval is not from a human user'));
  }
});

test('reviewer outside the trusted allowlist or without permission is denied', () => {
  assert.equal(eligible({ trusted: { allowedReviewers: ['someone-else'] } }).eligible, false);
  assert.equal(eligible({ attestation: { ...attestation, reviewer_permission: 'write' } }).eligible, false);
  assert.equal(eligible({ trusted: undefined }).eligible, false);
});

test('governance case 3: content edited after approval is denied', () => {
  const dir = clone(approvedDir);
  writeFileSync(join(dir, 'design.md'), `${readFileSync(join(dir, 'design.md'), 'utf8')}\nSneaky change.\n`);
  const rev = loadRevision(dir);
  assert.ok(rev.problems.some((p) => p.includes('hash mismatch')));
  const r = checkDeliveryEligibility({ revision: rev, activePlan: activePlanFor(rev), attestation, trusted });
  assert.equal(r.eligible, false);
});

test('stale attestation (digest differs from sealed content) is denied', () => {
  const r = eligible({ attestation: { ...attestation, content_digest: `sha256:${'a'.repeat(64)}` } });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.some((x) => x.includes('stale or altered')));
});

test('review that does not cover the PR head commit or an unmerged PR is denied', () => {
  assert.equal(eligible({ attestation: { ...attestation, review_commit_id: '3'.repeat(40) } }).eligible, false);
  assert.equal(eligible({ attestation: { ...attestation, merge_commit_sha: null } }).eligible, false);
  assert.equal(eligible({ attestation: { ...attestation, review_state: 'COMMENTED' } }).eligible, false);
});

test('unlisted and missing files in a snapshot are detected', () => {
  const dir = clone(approvedDir);
  writeFileSync(join(dir, 'extra.md'), 'x');
  assert.ok(loadRevision(dir).problems.some((p) => p.startsWith('unlisted file')));
});

test('unapproved revision: open blocking finding denies approval-readiness and delivery', () => {
  const rev = loadRevision(unapprovedDir);
  assert.equal(approvalReadiness(rev.manifest).ready, false);
  const r = checkDeliveryEligibility({ revision: rev, activePlan: activePlanFor(rev), attestation: { ...attestation, architecture_id: 'demo-links', revision_id: 'demo-links-r1', content_digest: rev.computedDigest }, trusted });
  assert.equal(r.eligible, false);
  assert.ok(r.reasons.includes('open blocking finding: f-001'));
});

test('a resolved finding requires a documented human disposition', () => {
  const manifest = JSON.parse(readFileSync(join(approvedDir, 'manifest.json'), 'utf8'));
  delete manifest.reviewer_findings[0].disposition_by;
  assert.ok(validateSchema('revision', manifest).length > 0);
});

test('active plan that diverges from the approved snapshot is denied', () => {
  const rev = loadRevision(approvedDir);
  const tampered = activePlanFor(rev);
  tampered.tasks[0].scope.allowed_paths = ['src/**'];
  assert.equal(eligible({ activePlan: tampered }).eligible, false);
  const noDigest = { ...rev.plan };
  assert.equal(eligible({ activePlan: noDigest }).eligible, false);
});

test('plan validation rejects cycles, unknown deps, duplicate ids and mismatched bindings', () => {
  const base = () => parse(readFileSync(join(approvedDir, 'plan.yaml'), 'utf8'));
  let p = base();
  p.tasks[0].depends_on = ['add-notes-list'];
  assert.ok(validatePlan(p).some((x) => x.startsWith('dependency cycle')));
  p = base();
  p.tasks[1].depends_on = ['ghost-task'];
  assert.ok(validatePlan(p).some((x) => x.includes('unknown dependency')));
  p = base();
  p.tasks[1].id = p.tasks[0].id;
  assert.ok(validatePlan(p).some((x) => x.startsWith('duplicate task id')));
  p = base();
  p.tasks[0].architecture_binding.revision_id = 'demo-notes-r2';
  assert.ok(validatePlan(p).some((x) => x.includes('architecture_binding')));
  p = base();
  p.architecture = null;
  assert.ok(validatePlan(p).length > 0);
});

test('task schema rejects missing acceptance criteria, evidence and excess retries', () => {
  const task = parse(readFileSync(join(approvedDir, 'plan.yaml'), 'utf8')).tasks[0];
  assert.deepEqual(validateSchema('task', task), []);
  assert.ok(validateSchema('task', { ...task, acceptance_criteria: [] }).length);
  assert.ok(validateSchema('task', { ...task, evidence: { required: [] } }).length);
  assert.ok(validateSchema('task', { ...task, retries: { max_attempts: 50 } }).length);
  assert.ok(validateSchema('task', { ...task, extra: true }).length);
});

test('governance cases 5/6: tasks and PRs touching protected paths are rejected or classified protected', () => {
  assert.ok(protectedOverlaps(['.github/workflows/**']).length);
  assert.ok(protectedOverlaps(['**']).length);
  assert.ok(protectedOverlaps(['scripts/policy/**']).length);
  assert.deepEqual(protectedOverlaps(['src/api/**']), []);
  assert.equal(classifyChange(['.github/workflows/release.yml']).class, 'architecture-control');
  assert.equal(classifyChange(['scripts/policy/paths.mjs']).class, 'architecture-control');
  assert.equal(classifyChange(['src/api/notes/route.ts', 'delivery/schemas/task.schema.json']).class, 'architecture-control');
  assert.equal(classifyChange(['src/api/notes/route.ts']).class, 'delivery');

  const p = parse(readFileSync(join(approvedDir, 'plan.yaml'), 'utf8'));
  p.tasks[0].scope.allowed_paths.push('.github/workflows/release.yml');
  assert.ok(validatePlan(p).some((x) => x.includes('overlaps protected path')));
});

test('classification uses the caller-supplied trusted list, not PR content', () => {
  const trustedList = ['src/secret/**'];
  assert.equal(classifyChange(['src/secret/a.ts'], trustedList).class, 'architecture-control');
  assert.equal(classifyChange(['src/secret/a.ts'], []).class, 'delivery');
});

test('evidence schema requires trusted-publisher fields', () => {
  const ev = {
    schema_version: 1,
    task_id: 'add-note-api',
    architecture_binding: { architecture_id: 'demo-notes', revision_id: 'demo-notes-r1', content_digest: attestation.content_digest },
    attempt: 1,
    pull_request: { number: 7, head_sha: 'a'.repeat(40) },
    publisher: { workflow: 'delivery-ci', run_id: 42 },
    results: [{ kind: 'ci-results', command_id: 'unit-tests', outcome: 'pass' }],
    created_at: '2026-01-01T00:00:00Z',
  };
  assert.deepEqual(validateSchema('evidence', ev), []);
  const { publisher, ...noPublisher } = ev;
  assert.ok(validateSchema('evidence', noPublisher).length);
  assert.ok(validateSchema('evidence', { ...ev, results: [{ kind: 'ci-results', outcome: 'maybe' }] }).length);
});

test('stringify round-trip sanity for yaml fixtures', () => {
  const p = parse(readFileSync(join(approvedDir, 'plan.yaml'), 'utf8'));
  assert.deepEqual(parse(stringify(p)), p);
});
