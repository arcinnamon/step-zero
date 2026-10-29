import { validateSchema } from './schemas.mjs';
import { defaultProtectedPaths, protectedOverlaps } from './paths.mjs';

function findCycle(tasks) {
  const deps = new Map(tasks.map((t) => [t.id, t.depends_on]));
  const state = new Map();
  const visit = (id, stack) => {
    if (state.get(id) === 'done') return null;
    if (state.get(id) === 'active') return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 'active');
    for (const d of deps.get(id) ?? []) {
      if (!deps.has(d)) continue;
      const c = visit(d, [...stack, id]);
      if (c) return c;
    }
    state.set(id, 'done');
    return null;
  };
  for (const id of deps.keys()) {
    const c = visit(id, []);
    if (c) return c;
  }
  return null;
}

// Returns a list of problems; an empty list means the plan is structurally sound.
export function validatePlan(plan, { protectedPaths = defaultProtectedPaths } = {}) {
  const problems = validateSchema('plan', plan);
  if (problems.length) return problems;

  if (plan.architecture === null) {
    if (plan.tasks.length) problems.push('plan has tasks but no architecture binding');
    return problems;
  }

  const ids = new Set();
  for (const t of plan.tasks) {
    if (ids.has(t.id)) problems.push(`duplicate task id: ${t.id}`);
    ids.add(t.id);
  }
  for (const t of plan.tasks) {
    const b = t.architecture_binding;
    if (b.architecture_id !== plan.architecture.architecture_id || b.revision_id !== plan.architecture.revision_id) {
      problems.push(`task ${t.id}: architecture_binding does not match plan architecture`);
    }
    for (const d of t.depends_on) {
      if (d === t.id) problems.push(`task ${t.id}: depends on itself`);
      else if (!ids.has(d)) problems.push(`task ${t.id}: unknown dependency ${d}`);
    }
    for (const hit of protectedOverlaps(t.scope.allowed_paths, protectedPaths)) {
      problems.push(`task ${t.id}: allowed path ${hit.allowed} overlaps protected path ${hit.protected}`);
    }
  }
  const cycle = findCycle(plan.tasks);
  if (cycle) problems.push(`dependency cycle: ${cycle.join(' -> ')}`);
  return problems;
}
