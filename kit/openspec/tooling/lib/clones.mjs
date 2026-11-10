// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The clone list of a meta-repository (openspec/protocols/metarepo.md): `openspec/clones`, a project file the
// kit never overwrites. A project is a meta-repository while the file exists, even with no clone line.
//
//   # One clone per line: <path> or <name>=<path>
//   repos/backend                 named after its folder: backend
//   web=repos/frontend            its own name: web
//
// Paths are relative to the root and stay inside it. Names use letters, digits, `-`, `_`, `.`, are
// case-sensitive and unique; `root` is reserved for the root itself. `#` starts a comment.
// A change follows the meta-repository rules when its `.openspec.yaml` holds `x-sdd-kit-metarepo: true`,
// written with its first kit artifact while the project is a meta-repository.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parseYaml } from './yaml.mjs';
import { changeDir } from './project.mjs';

export const CLONES_FILE = 'openspec/clones';
export const ROOT_REPOSITORY = 'root';
export const METAREPO_KEY = 'x-sdd-kit-metarepo';
const NAME = /^[A-Za-z0-9._-]+$/;

/** Normalised clone path: `./repos/backend/` → `repos/backend`; null when it leaves the root. */
function normPath(p) {
  const s = String(p).trim().split('\\').join('/');
  if (s.startsWith('/') || /^[A-Za-z]:\//.test(s)) return null;
  const n = posix.normalize(s).replace(/\/+$/, '');
  if (n === '..' || n.startsWith('../')) return null;
  return n;
}

/**
 * One entry (`<path>` or `<name>=<path>`): { name, path } or { error }. Shared by the list and the installer's
 * `--metarepo` entries.
 */
export function parseEntry(text) {
  const entry = String(text).trim();
  const eq = entry.indexOf('=');
  const rawName = eq === -1 ? null : entry.slice(0, eq).trim();
  const rawPath = eq === -1 ? entry : entry.slice(eq + 1).trim();
  if (!rawPath) return { error: `the entry \`${entry}\` has no path` };
  if (rawName === '') return { error: `the entry \`${entry}\` has no name` };
  const path = normPath(rawPath);
  if (path === null) return { error: `\`${rawPath}\` is outside the root` };
  if (path === '.' || path === '') return { error: `\`${rawPath}\` is the root itself, not a clone` };
  const name = rawName ?? path.split('/').pop();
  if (!NAME.test(name)) return { error: `the name \`${name}\` has a character that is not allowed (letters, digits, -, _, .)` };
  if (name === ROOT_REPOSITORY) return { error: `the name \`${ROOT_REPOSITORY}\` is reserved for the root` };
  return { name, path };
}

/** Parses the list: { clones: [{name, path, line}], errors: [{line, message}] }. */
export function parseClones(content) {
  const clones = [];
  const errors = [];
  String(content ?? '')
    .split(/\r?\n/)
    .forEach((raw, idx) => {
      const line = idx + 1;
      const text = raw.replace(/(^|\s)#.*$/, '').trim();
      if (!text) return;
      const e = parseEntry(text);
      if (e.error) return errors.push({ line, message: e.error });
      if (clones.some((c) => c.name === e.name)) return errors.push({ line, message: `the name \`${e.name}\` is declared twice` });
      if (clones.some((c) => c.path === e.path)) return errors.push({ line, message: `the path \`${e.path}\` is declared twice` });
      clones.push({ name: e.name, path: e.path, line });
    });
  return { clones, errors };
}

/** The first line of a new list: its format, for the developer who opens it. */
export const CLONES_HEADER = '# One clone per line: <path> or <name>=<path> (a path relative to the root; see openspec/protocols/metarepo.md)\n';

/** The list line of a clone: the bare path when the name is the folder name, else `name=path`. */
export const cloneLine = ({ name, path }) => (path.split('/').pop() === name ? path : `${name}=${path}`);

/**
 * Merges entries (`<path>` or `<name>=<path>`) into the list content (null: no list yet, the format comment is
 * written). A known entry is skipped; an invalid entry, a known path under another name and a known name with
 * another path are errors. Returns { content, added: [{name, path}], errors: [message] }; with errors nothing
 * is to be written.
 */
export function mergeEntries(content, entries) {
  const known = parseClones(content ?? '').clones.map(({ name, path }) => ({ name, path }));
  const added = [];
  const errors = [];
  for (const raw of entries) {
    const e = parseEntry(raw);
    if (e.error) {
      errors.push(`entry \`${String(raw).trim()}\`: ${e.error}`);
      continue;
    }
    const samePath = known.find((c) => c.path === e.path);
    const sameName = known.find((c) => c.name === e.name);
    if (samePath && samePath.name === e.name) continue;
    if (samePath) errors.push(`entry \`${String(raw).trim()}\`: \`${e.path}\` is already declared as \`${samePath.name}\``);
    else if (sameName) errors.push(`entry \`${String(raw).trim()}\`: the name \`${e.name}\` is already declared for \`${sameName.path}\``);
    else {
      known.push(e);
      added.push(e);
    }
  }
  let out = content ?? CLONES_HEADER;
  if (added.length) out = `${out}${out && !out.endsWith('\n') ? '\n' : ''}${added.map(cloneLine).join('\n')}\n`;
  return { content: out, added, errors };
}

/** The project's clone list: { present, clones: [{name, path, line, exists}], errors }. */
export function readClones(root) {
  const p = join(root, CLONES_FILE);
  if (!existsSync(p)) return { present: false, clones: [], errors: [] };
  const { clones, errors } = parseClones(readFileSync(p, 'utf8'));
  return {
    present: true,
    clones: clones.map((c) => {
      let exists = false;
      try {
        exists = statSync(join(root, c.path)).isDirectory();
      } catch {
        /* missing */
      }
      return { ...c, exists };
    }),
    errors,
  };
}

/** True while `openspec/clones` exists, even with no clone line. */
export function isMetarepo(root) {
  return existsSync(join(root, CLONES_FILE));
}

/** True when the change's `.openspec.yaml` holds `x-sdd-kit-metarepo: true`. */
export function followsMetarepo(root, change) {
  const meta = join(changeDir(root, change), '.openspec.yaml');
  if (!existsSync(meta)) return false;
  try {
    const { value } = parseYaml(readFileSync(meta, 'utf8'));
    const v = value && value[METAREPO_KEY];
    return v === true || String(v).trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/**
 * Writes `x-sdd-kit-metarepo: true` into the change's `.openspec.yaml` while the project is a meta-repository.
 * Called together with the kit version stamp (lib/project.mjs stampChange), so only a change whose first kit
 * artifact is written in a meta-repository gets it. Returns true when the mark was written.
 */
export function markChange(root, change) {
  const meta = join(changeDir(root, change), '.openspec.yaml');
  if (!isMetarepo(root) || !existsSync(meta) || followsMetarepo(root, change)) return false;
  const text = readFileSync(meta, 'utf8');
  writeFileSync(meta, `${text}${text && !text.endsWith('\n') ? '\n' : ''}${METAREPO_KEY}: true\n`);
  return true;
}

const under = (file, dir) => file === dir || file.startsWith(`${dir}/`);

/**
 * The repository of a root-relative path: the name of the deepest clone that holds it, `root` for any other
 * path, and null for the root's `openspec/` and the E2E test folder `e2eFolder` (an E2E test proves the whole
 * application, not one repository).
 */
export function repositoryOf(file, clones, { e2eFolder = '' } = {}) {
  let best = null;
  for (const c of clones) if (under(file, c.path) && (!best || c.path.length > best.path.length)) best = c;
  if (best) return best.name;
  if (under(file, 'openspec') || (e2eFolder && under(file, e2eFolder))) return null;
  return ROOT_REPOSITORY;
}
