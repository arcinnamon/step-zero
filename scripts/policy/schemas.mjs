import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'delivery', 'schemas');
const names = ['common', 'task', 'plan', 'architecture-revision', 'evidence'];

let ajv;
function getAjv() {
  if (!ajv) {
    ajv = new Ajv2020({ allErrors: true, strict: true });
    for (const n of names) ajv.addSchema(JSON.parse(readFileSync(join(schemaDir, `${n}.schema.json`), 'utf8')));
  }
  return ajv;
}

const ids = {
  plan: 'https://step-zero.local/schemas/plan.schema.json',
  revision: 'https://step-zero.local/schemas/architecture-revision.schema.json',
  task: 'https://step-zero.local/schemas/task.schema.json',
  evidence: 'https://step-zero.local/schemas/evidence.schema.json',
};

export function validateSchema(kind, data) {
  const validate = getAjv().getSchema(ids[kind]);
  if (validate(data)) return [];
  return validate.errors.map((e) => `${kind}${e.instancePath || ''}: ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);
}
