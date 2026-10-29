import { createHash } from 'node:crypto';

export const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

// files: [{ path, sha256 }]; order-independent and independent of manifest.json.
export function computeRevisionDigest(files) {
  const lines = [...files].sort(byPath).map((f) => `${f.path}\t${f.sha256}\n`).join('');
  return `sha256:${sha256Hex(lines)}`;
}
