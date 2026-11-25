// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The answers lock of a change under the new planning rules (lib/project.mjs usesNewPlanning, schema clarify;
// openspec/protocols/planning.md): `answers-lock.json` in the change folder records, for every written artifact,
// a SHA-256 of the answers of each closed round the artifact was written from — the Main round for the proposal,
// the Main and Technical rounds for the specs, the design, the verification plan and the tasks — and a SHA-256 of
// each of those answers, so a changed answer names its question. An answer counts as changed when its text
// differs, spaces at its ends ignored; a question added after the artifact was written is not a change.
// artifact-feedback writes the entry when the artifact is written (an update rewrites it); answers-gate blocks
// later artifacts and task check-offs while an entry differs; check-answers reports it (CI, before apply).
//
// File format: { "artifacts": { "<artifact>": { "hash": "<sha256 of its rounds>", "rounds": { "<Round>": "<sha256>" },
//   "answers": { "Q<n>": "<sha256>" }, "revision": <n> } } }. `revision` starts at 1 and grows each time the
// entry is rewritten from different answers (the artifact was updated after a changed answer).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseClarifications } from './clarifications.mjs';
import { changeDir, changeSchema, isClarifyFamily, readChangeFile, usesNewPlanning } from './project.mjs';

export const LOCK_FILE = 'answers-lock.json';
/** Locked artifacts in the order they are written. */
export const LOCK_ORDER = ['proposal', 'specs', 'design', 'verification-plan', 'tasks'];
/** Rounds whose answers each artifact is written from. */
export const LOCK_ROUNDS = {
  proposal: ['Main'],
  specs: ['Main', 'Technical'],
  design: ['Main', 'Technical'],
  'verification-plan': ['Main', 'Technical'],
  tasks: ['Main', 'Technical'],
};

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** SHA-256 of one answer, spaces at its ends ignored. */
export function answerHash(answer) {
  return sha256(String(answer ?? '').trim());
}

/** True for a change whose written artifacts are locked to their answers: new planning rules on a question schema. */
export function usesAnswersLock(root, change) {
  return isClarifyFamily(changeSchema(root, change)) && usesNewPlanning(root, change);
}

function parsedAnswers(root, change) {
  const content = readChangeFile(root, change, 'clarifications.md');
  return content === null ? null : parseClarifications(content, { newPlanning: true });
}

/**
 * The lock entry for `artifact` from the current answers: { hash, rounds, answers } (rounds without a section are
 * left out); `hash` covers all its rounds and changes only when the artifact is written from different answers.
 */
export function lockEntry(parsed, artifact) {
  const rounds = {};
  const answers = {};
  for (const name of LOCK_ROUNDS[artifact] || []) {
    const round = parsed.rounds.find((r) => r.name === name);
    if (!round) continue;
    const own = round.questions.map((q) => [q.n, answerHash(q.answer)]);
    for (const [n, h] of own) answers[`Q${n}`] = h;
    rounds[name] = sha256(own.map(([n, h]) => `Q${n}:${h}`).join('\n'));
  }
  const hash = sha256(Object.entries(rounds).map(([name, h]) => `${name}:${h}`).join('\n'));
  return { hash, rounds, answers };
}

/** The lock of a change: { artifacts: {...} }; empty when there is none or it cannot be read. */
export function readLock(root, change) {
  const p = join(changeDir(root, change), LOCK_FILE);
  if (!existsSync(p)) return { artifacts: {} };
  try {
    const value = JSON.parse(readFileSync(p, 'utf8'));
    return value && typeof value.artifacts === 'object' && value.artifacts ? value : { artifacts: {} };
  } catch {
    return { artifacts: {} };
  }
}

/**
 * Records the answers `artifact` was written from (artifact-feedback). Returns the entry written, or null when the
 * change has no answers lock, the artifact is not locked or clarifications.md does not exist.
 */
export function writeLockEntry(root, change, artifact) {
  if (!LOCK_ROUNDS[artifact] || !usesAnswersLock(root, change)) return null;
  const parsed = parsedAnswers(root, change);
  if (!parsed) return null;
  const lock = readLock(root, change);
  const entry = lockEntry(parsed, artifact);
  const before = lock.artifacts[artifact];
  const same = before && before.hash === entry.hash;
  const revision = before ? (Number(before.revision) || 1) + (same ? 0 : 1) : 1;
  lock.artifacts[artifact] = { ...entry, revision };
  writeFileSync(join(changeDir(root, change), LOCK_FILE), JSON.stringify(lock, null, 2) + '\n');
  return lock.artifacts[artifact];
}

/**
 * Answers that differ from the ones written artifacts were based on: [{ n, round, artifacts: [...] }], ordered by
 * question; artifacts in LOCK_ORDER. Options: { artifacts } limits the artifacts compared (default: all).
 * A question of the lock that is gone from the file counts as changed; a question added later does not.
 */
export function lockDifferences(root, change, { artifacts = LOCK_ORDER } = {}) {
  if (!usesAnswersLock(root, change)) return [];
  const lock = readLock(root, change);
  const parsed = parsedAnswers(root, change);
  if (!parsed) return [];
  const byQuestion = new Map();
  for (const artifact of LOCK_ORDER.filter((a) => artifacts.includes(a))) {
    const entry = lock.artifacts[artifact];
    if (!entry || typeof entry.answers !== 'object' || !entry.answers) continue;
    const now = lockEntry(parsed, artifact).answers;
    for (const [key, hash] of Object.entries(entry.answers)) {
      if (now[key] === hash) continue;
      const n = Number(key.slice(1));
      if (!byQuestion.has(n)) byQuestion.set(n, { n, round: parsed.questions.get(n)?.round ?? null, artifacts: [] });
      byQuestion.get(n).artifacts.push(artifact);
    }
  }
  return [...byQuestion.values()].sort((a, b) => a.n - b.n);
}

/** One line per changed answer: "Q3 (Main round): proposal, specs". */
export function describeDifferences(diffs) {
  return diffs.map((d) => `Q${d.n}${d.round ? ` (${d.round} round)` : ''}: ${d.artifacts.join(', ')}`);
}
