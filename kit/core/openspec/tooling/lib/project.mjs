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

export function isKitSchema(schema) {
  return KIT_SCHEMAS.includes(schema);
}

/** Reads a file of the change, or null when it does not exist. */
export function readChangeFile(root, name, file) {
  const p = join(changeDir(root, name), file);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}
