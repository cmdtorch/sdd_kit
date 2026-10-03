// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Local, never-committed state of the kit gates: last verification result per change and the Stop-hook
// block counter. Lives in <git dir>/sdd-kit/ (per clone, never committed); outside git, in the OS temp dir.
//
// A working-tree fingerprint ties a verification result to exact file contents: HEAD + every changed or
// untracked file's content hash. Files the kit itself writes during verification (the change's
// verification.md and tasks.md) are left out, so writing the matrix does not invalidate it.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';

const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export function stateDir(root) {
  const r = git(root, ['rev-parse', '--git-dir']);
  let dir;
  if (r.status === 0) {
    const g = r.stdout.trim();
    dir = join(isAbsolute(g) ? g : join(root, g), 'sdd-kit');
  } else {
    dir = join(tmpdir(), 'sdd-kit-' + createHash('sha256').update(root).digest('hex').slice(0, 16));
  }
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readState(root, name) {
  const p = join(stateDir(root), `${name}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeState(root, name, value) {
  writeFileSync(join(stateDir(root), `${name}.json`), JSON.stringify(value, null, 1));
}

/** Fingerprint of the working tree relevant to a change; null outside git. */
export function fingerprint(root, change) {
  const head = git(root, ['rev-parse', 'HEAD']);
  const st = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  if (st.status !== 0) return null;
  const skip = new Set([`openspec/changes/${change}/verification.md`, `openspec/changes/${change}/tasks.md`]);
  const h = createHash('sha256');
  h.update(head.status === 0 ? head.stdout.trim() : 'no-commits');
  const entries = st.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const code = e.slice(0, 2);
    const path = e.slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // renames carry the old path as the next entry
    if (skip.has(path)) continue;
    h.update(`${code}\0${path}\0`);
    const abs = join(root, path);
    if (existsSync(abs) && statSync(abs).isFile()) h.update(readFileSync(abs));
  }
  return h.digest('hex');
}
