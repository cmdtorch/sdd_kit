// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Session state of the automatic continuation of planning (openspec/protocols/planning.md): one JSON file per
// Claude Code session in the system temporary folder (`<tmp>/sdd-kit-planning/session-<id>.json`), never in the
// change or in git. Claude Code gives the same `session_id` to PostToolUse, UserPromptSubmit and Stop of one
// session (docs/openspec-facts.md K17).
//
// File: { root, change, continuations, next, wait: { reason, at } | null, pause: { at } | null, updatedAt }
//   root, change   the project and the change whose artifact this session wrote last (artifact-feedback)
//   continuations  how often in a row the Stop hook asked for the same `next` without a new artifact written
//   next           what the last continuation asked for (an artifact id or `round:<Round>`)
//   wait           the agent waits for the developer's next message (planning.mjs wait); cleared by that message
//   pause          the developer paused planning of the change (planning.mjs pause); stays until resume
// planning.mjs runs outside a hook and knows no session id: it marks every session file of the project that works
// on the change. A session that starts working on a paused change takes the pause over.
// Every function fails safe: an unreadable file counts as no state.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const STATE_DIR_NAME = 'sdd-kit-planning';
const PREFIX = 'session-';
/** Session files untouched for this long are removed when a session records its change. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The state folder; resolved on every call, so TMPDIR set for a process is honoured. */
export function stateDir() {
  return join(tmpdir(), STATE_DIR_NAME);
}

/** File-name-safe form of a session id; null when there is none. */
export function sessionKey(id) {
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  const key = String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
  return /[A-Za-z0-9]/.test(key) ? key : null;
}

export function statePath(id) {
  const key = sessionKey(id);
  return key ? join(stateDir(), `${PREFIX}${key}.json`) : null;
}

function readFile(p) {
  try {
    const value = JSON.parse(readFileSync(p, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function writeFile(p, state) {
  mkdirSync(stateDir(), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  renameSync(tmp, p);
}

/** The state of a session, or null. */
export function readSession(id) {
  const p = statePath(id);
  return p && existsSync(p) ? readFile(p) : null;
}

/** Writes the state of a session (no-op without a session id). */
export function writeSession(id, state) {
  const p = statePath(id);
  if (p) writeFile(p, state);
}

/** Changes the state of a session with `fn(state) → state`; nothing happens when the session has no state. */
export function updateSession(id, fn) {
  const state = readSession(id);
  if (!state) return null;
  const next = fn({ ...state });
  writeSession(id, next);
  return next;
}

/** Every session file of `root` working on `change`: [{ path, state }]. */
export function sessionsOfChange(root, change) {
  const dir = stateDir();
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(PREFIX) || !name.endsWith('.json')) continue;
    const path = join(dir, name);
    const state = readFile(path);
    if (state && state.root === resolve(root) && state.change === change) out.push({ path, state });
  }
  return out;
}

/** Applies `fn(state) → state` to every session file of `root` working on `change`; returns how many. */
export function updateChange(root, change, fn) {
  const found = sessionsOfChange(root, change);
  for (const { path, state } of found) writeFile(path, fn({ ...state }));
  return found.length;
}

function removeStale() {
  const dir = stateDir();
  if (!existsSync(dir)) return;
  const now = Date.now();
  for (const name of readdirSync(dir)) {
    if (!name.startsWith(PREFIX)) continue;
    try {
      const p = join(dir, name);
      if (now - statSync(p).mtimeMs > MAX_AGE_MS) unlinkSync(p);
    } catch {
      /* another process removed it */
    }
  }
}

/**
 * Records that session `id` wrote an artifact of `change` (artifact-feedback). Switching to another change starts
 * the counters again; a pause another session recorded for the change is taken over.
 */
export function recordChange(id, root, change) {
  const p = statePath(id);
  if (!p) return null;
  const abs = resolve(root);
  const before = existsSync(p) ? readFile(p) : null;
  const same = before && before.root === abs && before.change === change;
  const state = same ? { ...before } : { root: abs, change, continuations: 0, next: null, wait: null, pause: null };
  if (!same) {
    const paused = sessionsOfChange(abs, change).find((s) => s.state.pause);
    if (paused) state.pause = paused.state.pause;
    removeStale();
  }
  writeFile(p, state);
  return state;
}
