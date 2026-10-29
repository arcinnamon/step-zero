// Usage: node seal-revision.mjs <revision-dir>
// Recomputes `files` and `content_digest` in manifest.json from the snapshot contents.
// Sealing records integrity only. It never records or implies approval.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { computeRevisionDigest, sha256Hex } from './policy/digest.mjs';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node seal-revision.mjs <revision-dir>');
  process.exit(2);
}

const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const files = walk(dir)
  .map((p) => relative(dir, p).split('\\').join('/'))
  .filter((p) => p !== 'manifest.json')
  .sort()
  .map((path) => ({ path, sha256: sha256Hex(readFileSync(join(dir, path))) }));

const manifestPath = join(dir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.files = files;
manifest.content_digest = computeRevisionDigest(files);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${manifest.revision_id}: ${manifest.content_digest}`);
