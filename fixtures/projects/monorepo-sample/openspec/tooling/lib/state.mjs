// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Local, never-committed state of the kit gates: last verification / API results per change and the
// Stop-hook block counter. Lives in <git dir>/sdd-kit/ (per clone, never committed); outside git, in the
// OS temp dir.
//
// A working-tree fingerprint ties a result to exact file contents. It is the git tree hash of the working
// tree (tracked + untracked, .gitignore respected), built in a temporary index, so committing does NOT
// change it — only content does. Files the kit itself writes during a step are left out.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';

const git = (root, args, env) => spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: env ? { ...process.env, ...env } : process.env });

function gitDir(root) {
  const r = git(root, ['rev-parse', '--git-dir']);
  if (r.status !== 0) return null;
  const g = r.stdout.trim();
  return isAbsolute(g) ? g : join(root, g);
}

export function stateDir(root) {
  const g = gitDir(root);
  const dir = g ? join(g, 'sdd-kit') : join(tmpdir(), 'sdd-kit-' + createHash('sha256').update(root).digest('hex').slice(0, 16));
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

/**
 * Content fingerprint of the working tree; null outside git.
 *   fingerprint(root, change)                       — everything except the change's verification.md and tasks.md
 *   fingerprint(root, change, { scope: 'code' })    — only files outside openspec/ (the application itself)
 */
export function fingerprint(root, change, { scope = 'all' } = {}) {
  const g = gitDir(root);
  if (!g) return null;
  const tmp = mkdtempSync(join(tmpdir(), 'sdd-kit-index-'));
  const index = join(tmp, 'index');
  try {
    if (existsSync(join(g, 'index'))) copyFileSync(join(g, 'index'), index); // start from the real index: only changed files are re-hashed
    const env = { GIT_INDEX_FILE: index };
    if (git(root, ['add', '-A'], env).status !== 0) return null;
    const drop = scope === 'code' ? ['openspec'] : [`openspec/changes/${change}/verification.md`, `openspec/changes/${change}/tasks.md`];
    git(root, ['rm', '-r', '--cached', '-q', '--ignore-unmatch', '--', ...drop], env);
    const tree = git(root, ['write-tree'], env);
    return tree.status === 0 ? tree.stdout.trim() : null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
