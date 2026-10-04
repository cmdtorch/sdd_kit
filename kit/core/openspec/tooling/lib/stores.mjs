// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Split repositories (D7, D24): the backend repository is registered as an OpenSpec store and the frontend
// lists it under `references:` (read-only). OpenSpec never syncs stores (docs/openspec-facts.md §17), so the
// kit reports how fresh the local backend checkout is and which backend handoffs are waiting for a UI change.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseYaml } from './yaml.mjs';

/** Store ids listed under `references:` in openspec/config.yaml (strings or {id}). */
export function referencedStores(root) {
  const p = join(root, 'openspec', 'config.yaml');
  if (!existsSync(p)) return [];
  try {
    const refs = parseYaml(readFileSync(p, 'utf8')).value?.references;
    return Array.isArray(refs) ? refs.map((r) => (typeof r === 'string' ? r : r?.id)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Local path of a registered store on this machine, or null. Registry file first, the CLI as fallback. */
export function storeRoot(id) {
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  const reg = join(dataHome, 'openspec', 'stores', 'registry.yaml');
  if (existsSync(reg)) {
    try {
      const p = parseYaml(readFileSync(reg, 'utf8')).value?.stores?.[id]?.backend?.local_path;
      if (p && existsSync(p)) return p;
    } catch {
      /* fall back to the CLI */
    }
  }
  const r = spawnSync(process.env.OPENSPEC_BIN || 'openspec', ['store', 'list', '--json'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  if (r.status !== 0) return null;
  try {
    const s = JSON.parse(r.stdout).stores.find((x) => x.id === id);
    return s && existsSync(s.root) ? s.root : null;
  } catch {
    return null;
  }
}

const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/** Freshness of a local checkout: {branch, behind, ahead, dirty, fetchAgeHours} (nulls when unknown). */
export function checkoutStatus(path) {
  const branch = git(path, ['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch.status !== 0) return null;
  const counts = git(path, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']);
  const [ahead, behind] = counts.status === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [null, null];
  const dirty = git(path, ['status', '--porcelain']).stdout.split('\n').filter(Boolean).length;
  const hasUpstream = counts.status === 0;
  let fetchAgeHours = null;
  if (hasUpstream) {
    // last fetch: FETCH_HEAD, or (fresh clone, never fetched since) the upstream ref itself
    const gd = git(path, ['rev-parse', '--git-dir']).stdout.trim();
    const gitDir = gd.startsWith('/') ? gd : join(path, gd);
    const upstreamRef = git(path, ['rev-parse', '--symbolic-full-name', '@{u}']).stdout.trim();
    const candidates = [join(gitDir, 'FETCH_HEAD'), upstreamRef ? join(gitDir, upstreamRef) : null, join(gitDir, 'packed-refs')].filter((p) => p && existsSync(p));
    if (candidates.length) fetchAgeHours = (Date.now() - statSync(candidates[0]).mtimeMs) / 3600000;
  }
  return { branch: branch.stdout.trim(), behind, ahead, dirty, fetchAgeHours, hasUpstream };
}

/** Backend changes (active and archived) that have a frontend handoff: [{change, archived, dir}]. */
export function backendHandoffs(storePath) {
  const out = [];
  const changes = join(storePath, 'openspec', 'changes');
  if (!existsSync(changes)) return out;
  for (const n of readdirSync(changes)) {
    if (n === 'archive') continue;
    if (existsSync(join(changes, n, 'frontend-handoff.md'))) out.push({ change: n, archived: false, dir: join(changes, n) });
  }
  const archive = join(changes, 'archive');
  if (existsSync(archive)) {
    for (const n of readdirSync(archive).sort()) {
      if (existsSync(join(archive, n, 'frontend-handoff.md'))) out.push({ change: n.replace(/^\d{4}-\d{2}-\d{2}-/, ''), archived: true, dir: join(archive, n) });
    }
  }
  return out;
}

/** Backend change names already imported into this (frontend) project, active or archived changes. */
export function importedHandoffs(root) {
  const seen = new Set();
  const scan = (dir) => {
    if (!existsSync(dir)) return;
    for (const n of readdirSync(dir)) {
      const f = join(dir, n, 'sources', 'D1-backend-handoff.md');
      if (!existsSync(f)) continue;
      const m = readFileSync(f, 'utf8').slice(0, 600).match(/change "([^"]+)"/);
      if (m) seen.add(m[1]);
    }
  };
  scan(join(root, 'openspec', 'changes'));
  scan(join(root, 'openspec', 'changes', 'archive'));
  return seen;
}

/** Session-start lines for the referenced backend stores of a frontend project. */
export function referencedStoreLines(root, { staleHours = 24 } = {}) {
  const lines = [];
  for (const id of referencedStores(root)) {
    const path = storeRoot(id);
    if (!path) {
      lines.push(`sdd-kit WARNING: referenced store "${id}" is not registered on this machine. Clone the backend repository and run: node openspec/tooling/bin/openspec.mjs store register <path-to-backend> --id ${id} --yes`);
      continue;
    }
    const st = checkoutStatus(path);
    if (st) {
      const warn = [];
      if (st.behind) warn.push(`${st.behind} commit(s) behind ${st.branch}'s upstream`);
      if (st.hasUpstream && st.fetchAgeHours !== null && st.fetchAgeHours > staleHours) warn.push(`last fetch ${Math.round(st.fetchAgeHours)} h ago`);
      if (warn.length) lines.push(`sdd-kit WARNING: the backend checkout "${id}" (${path}, branch ${st.branch}) may be stale: ${warn.join(', ')}. Run "git -C ${path} pull" before relying on its specs and handoffs.`);
    }
    const imported = importedHandoffs(root);
    const waiting = backendHandoffs(path).filter((h) => !imported.has(h.change));
    if (waiting.length) {
      lines.push(`sdd-kit: backend handoffs ready for a UI change (store "${id}"): ${waiting.map((h) => `${h.change}${h.archived ? ' (archived)' : ''}`).join(', ')}. Start one with: node openspec/tooling/bin/handoff.mjs import --from-store ${id} --change <name>`);
    }
  }
  return lines;
}
