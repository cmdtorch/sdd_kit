// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Locating the project root, changes and their schema.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseYaml } from './yaml.mjs';

export const KIT_SCHEMAS = ['clarify', 'lean'];

/** Nearest directory (from `start` upwards) that contains `openspec/`; null if none. */
export function findRoot(start = process.cwd()) {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, 'openspec')) && statSync(join(dir, 'openspec')).isDirectory()) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function changeDir(root, name) {
  return join(root, 'openspec', 'changes', name);
}

/** Active (non-archived) change names. */
export function listChanges(root) {
  const dir = join(root, 'openspec', 'changes');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n !== 'archive' && statSync(join(dir, n)).isDirectory())
    .sort();
}

/** Schema name of a change from its `.openspec.yaml`; falls back to config `schema`, then spec-driven. */
export function changeSchema(root, name) {
  const meta = join(changeDir(root, name), '.openspec.yaml');
  if (existsSync(meta)) {
    try {
      const { value } = parseYaml(readFileSync(meta, 'utf8'));
      if (value && typeof value.schema === 'string') return value.schema;
    } catch {
      /* fall through */
    }
  }
  const cfg = join(root, 'openspec', 'config.yaml');
  if (existsSync(cfg)) {
    try {
      const { value } = parseYaml(readFileSync(cfg, 'utf8'));
      if (value && typeof value.schema === 'string') return value.schema;
    } catch {
      /* fall through */
    }
  }
  return 'spec-driven';
}

/** Schema of a change directory anywhere (also archived ones); null when it has no .openspec.yaml schema. */
export function schemaOfDir(dir) {
  const meta = join(dir, '.openspec.yaml');
  if (!existsSync(meta)) return null;
  try {
    const { value } = parseYaml(readFileSync(meta, 'utf8'));
    return value && typeof value.schema === 'string' ? value.schema : null;
  } catch {
    return null;
  }
}

/** Reads a file of a change directory, or null. */
export function readIn(dir, file) {
  const p = join(dir, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function isKitSchema(schema) {
  return KIT_SCHEMAS.includes(schema);
}

/** Artifact ids of the kit schemas by file name inside a change dir (specs are matched separately). */
const ARTIFACT_FILES = {
  'clarifications.md': 'clarifications',
  'proposal.md': 'proposal',
  'design.md': 'design',
  'verification-plan.md': 'verification-plan',
  'tasks.md': 'tasks',
  'verification.md': 'verification',
};

/**
 * Which change and artifact a path belongs to: { change, artifact|null, rel } or null when the path is
 * not inside an active change (archived changes are ignored).
 */
export function locateInChange(root, absPath) {
  const base = join(root, 'openspec', 'changes') + '/';
  const p = resolve(absPath);
  if (!p.startsWith(base)) return null;
  const parts = p.slice(base.length).split('/');
  if (parts.length < 2 || parts[0] === 'archive') return null;
  const [change, ...rest] = parts;
  const rel = rest.join('/');
  let artifact = null;
  if (rest[0] === 'specs' && rel.endsWith('.md')) artifact = 'specs';
  else if (rest.length === 1) artifact = ARTIFACT_FILES[rest[0]] || null;
  return { change, artifact, rel };
}

/** Reads a file of the change, or null when it does not exist. */
export function readChangeFile(root, name, file) {
  const p = join(changeDir(root, name), file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
