import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parse } from 'yaml';
import { computeRevisionDigest, sha256Hex } from './digest.mjs';
import { validatePlan } from './plan.mjs';
import { validateSchema } from './schemas.mjs';

function listFiles(root, dir = root) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(root, p) : [relative(root, p).split('\\').join('/')];
  });
}

const stable = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));

// Loads a revision directory and verifies it is internally consistent. This proves integrity
// only; it says nothing about approval, which must come from trusted GitHub provenance.
export function loadRevision(dir) {
  const problems = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch (e) {
    return { dir, manifest: null, computedDigest: null, problems: [`manifest.json unreadable: ${e.message}`] };
  }
  problems.push(...validateSchema('revision', manifest));
  if (problems.length) return { dir, manifest, computedDigest: null, problems };

  if (basename(dir) !== manifest.revision_id) problems.push(`directory name ${basename(dir)} != revision_id ${manifest.revision_id}`);
  if (!manifest.revision_id.endsWith(`-r${manifest.revision}`) || !manifest.revision_id.startsWith(`${manifest.architecture_id}-r`)) {
    problems.push('revision_id does not match architecture_id and revision');
  }
  if (manifest.supersedes === manifest.revision_id) problems.push('revision supersedes itself');

  const actual = listFiles(dir).filter((p) => p !== 'manifest.json').map((p) => ({ path: p, sha256: sha256Hex(readFileSync(join(dir, p))) }));
  const declared = new Map(manifest.files.map((f) => [f.path, f.sha256]));
  for (const f of actual) {
    if (!declared.has(f.path)) problems.push(`unlisted file: ${f.path}`);
    else if (declared.get(f.path) !== f.sha256) problems.push(`file hash mismatch: ${f.path}`);
  }
  for (const p of declared.keys()) if (!actual.some((f) => f.path === p)) problems.push(`missing file: ${p}`);

  const computedDigest = computeRevisionDigest(actual);
  if (computedDigest !== manifest.content_digest) problems.push('content_digest does not match snapshot contents');

  const reqIds = new Set(manifest.requirements.map((r) => r.id));
  if (reqIds.size !== manifest.requirements.length) problems.push('duplicate requirement id');
  for (const a of manifest.adrs) if (!declared.has(a.path)) problems.push(`ADR ${a.id} path not in files: ${a.path}`);

  let plan;
  try {
    plan = parse(readFileSync(join(dir, 'plan.yaml'), 'utf8'));
  } catch (e) {
    problems.push(`plan.yaml unreadable: ${e.message}`);
  }
  if (plan) {
    problems.push(...validatePlan(plan));
    if (plan.architecture) {
      if (plan.architecture.content_digest !== null) problems.push('snapshot plan.yaml must have architecture.content_digest: null');
      if (plan.architecture.revision_id !== manifest.revision_id) problems.push('snapshot plan.yaml revision_id mismatch');
    }
    const fromPlan = plan.tasks.map((t) => ({ task_id: t.id, depends_on: [...t.depends_on].sort() })).sort((a, b) => a.task_id.localeCompare(b.task_id));
    const fromManifest = manifest.task_dependencies.map((t) => ({ task_id: t.task_id, depends_on: [...t.depends_on].sort() })).sort((a, b) => a.task_id.localeCompare(b.task_id));
    if (stable(fromPlan) !== stable(fromManifest)) problems.push('manifest task_dependencies differ from plan.yaml');
    for (const t of plan.tasks) {
      for (const r of t.requirement_ids) if (!reqIds.has(r)) problems.push(`task ${t.id}: unknown requirement ${r}`);
    }
  }
  return { dir, manifest, plan, computedDigest, problems };
}

// Open critical/high findings block approval-readiness. A finding is never auto-resolved by its own review output.
export function approvalReadiness(manifest) {
  const reasons = manifest.reviewer_findings
    .filter((f) => ['critical', 'high'].includes(f.severity) && f.disposition === 'open')
    .map((f) => `open blocking finding: ${f.id}`);
  if (!manifest.reviewer_findings.length) reasons.push('no adversarial review findings recorded');
  return { ready: reasons.length === 0, reasons };
}

// The active delivery/plan.yaml is a materialization of an approved snapshot plus its digest.
export function checkActivePlanMatchesRevision(activePlan, revision) {
  const problems = [];
  if (!activePlan.architecture) return ['active plan has no architecture binding'];
  if (activePlan.architecture.content_digest !== revision.computedDigest) problems.push('active plan digest != revision digest');
  if (activePlan.architecture.revision_id !== revision.manifest.revision_id) problems.push('active plan revision_id mismatch');
  const a = stable({ ...activePlan, architecture: { ...activePlan.architecture, content_digest: null } });
  if (a !== stable(revision.plan)) problems.push('active plan tasks differ from snapshot plan');
  return problems;
}
