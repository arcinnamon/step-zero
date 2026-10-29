// Usage: node validate-contracts.mjs [repo-root]
// Validates structure and integrity of delivery/plan.yaml and architecture/revisions/*.
// Exit 0 does NOT mean "approved"; approval is never derived from repository files.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { validatePlan } from './policy/plan.mjs';
import { loadRevision } from './policy/revision.mjs';

const root = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..'));
let failures = 0;
const report = (label, problems) => {
  if (problems.length) {
    failures++;
    console.error(`FAIL ${label}`);
    for (const p of problems) console.error(`  - ${p}`);
  } else console.log(`ok   ${label}`);
};

const planPath = join(root, 'delivery', 'plan.yaml');
if (existsSync(planPath)) report('delivery/plan.yaml', validatePlan(parse(readFileSync(planPath, 'utf8'))));
else report('delivery/plan.yaml', ['missing']);

const revRoot = join(root, 'architecture', 'revisions');
if (existsSync(revRoot)) {
  for (const name of readdirSync(revRoot)) {
    const dir = join(revRoot, name);
    if (statSync(dir).isDirectory()) report(`architecture/revisions/${name}`, loadRevision(dir).problems);
  }
}
process.exit(failures ? 1 : 0);
