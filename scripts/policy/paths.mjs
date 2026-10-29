import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const defaultProtectedPaths = JSON.parse(readFileSync(join(here, 'protected-paths.json'), 'utf8')).protected;

// Literal directory prefix of a glob, e.g. "src/api/**" -> "src/api/", "**" -> "".
const prefix = (glob) => {
  const i = glob.search(/[*?[{]/);
  return i === -1 ? glob : glob.slice(0, i);
};

const norm = (p) => p.replace(/^\.\//, '');

// Conservative overlap test: two globs overlap when one's literal prefix contains the other's.
// Over-reporting is intentional (fail closed); a whole-repo glob always overlaps.
export function globsOverlap(a, b) {
  const pa = prefix(norm(a));
  const pb = prefix(norm(b));
  return pa.startsWith(pb) || pb.startsWith(pa);
}

export function protectedOverlaps(allowedPaths, protectedPaths = defaultProtectedPaths) {
  const hits = [];
  for (const a of allowedPaths) {
    for (const p of protectedPaths) if (globsOverlap(a, p)) hits.push({ allowed: a, protected: p });
  }
  return hits;
}

function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const matchesAny = (path, globs) => globs.some((g) => globToRegExp(norm(g)).test(norm(path)));

// Classifies changed file paths against the protected list passed in by the caller.
// The caller must obtain the list from the trusted base revision, not from the PR.
export function classifyChange(changedPaths, protectedPaths = defaultProtectedPaths) {
  const protectedHits = changedPaths.filter((p) => matchesAny(p, protectedPaths));
  return { class: protectedHits.length ? 'architecture-control' : 'delivery', protectedHits };
}
