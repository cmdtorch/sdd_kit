#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// test-cases-run-limit — PreToolUse hook on Claude Code's subagent tool (Agent; Task in older builds).
// Counts runs of the test-cases-reviewer subagent per change in reviews/test-cases-runs.json and blocks
// a fourth run in the same review loop: the developer then fixes or accepts each remaining blocker and
// major finding (openspec/protocols/review-test-cases.md).
// Loops: the first loop is the test-cases stage. A new loop starts when the stage confirmation in
// "Stage result" is already "Looks correct" (a late scenario) and either the current loop began before
// the confirmation or the latest review is settled (READY, or every blocker / major finding listed in
// "Stage result").
// The change is the active test-case change named in the subagent prompt, or the only one; when it
// cannot be told, the run is not counted (fail open).
// Spec reviewer (changes stamped 0.6.0 or later on `clarify`, openspec/protocols/planning.md): runs of the
// spec-reviewer subagent are counted in reviews/spec-review-runs.json. The same specs get at most two runs, and
// no second run when the first run's review (reviews/spec-review.md written after it) reports no finding.
// When the specs' entry in answers-lock.json differs from the one recorded at the last counted run (the specs
// were rewritten after a changed answer), the count starts over with one run allowed.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runHook, hookRoot, block } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, changeDir, hasTestCases, readChangeFile, usesNewPlanning } from '../lib/project.mjs';
import { parseTestCases, parseCaseReview, isListed, TEST_CASES_FILE, CASE_REVIEW } from '../lib/test-cases.mjs';
import { isMain } from '../lib/report.mjs';

export const REVIEWER = 'test-cases-reviewer';
export const SUBAGENT_TOOLS = ['Agent', 'Task'];
export const RUNS_FILE = 'reviews/test-cases-runs.json';
export const MAX_RUNS = 3;
const CRITICAL = ['blocker', 'major'];

export const SPEC_REVIEWER = 'spec-reviewer';
export const SPEC_RUNS_FILE = 'reviews/spec-review-runs.json';
export const SPEC_REVIEW_FILE = 'reviews/spec-review.md';
export const LOCK_FILE = 'answers-lock.json';
/** Runs of the spec reviewer on the same specs; after a rewrite for a changed answer one more run. */
export const MAX_SPEC_RUNS = 2;
export const MAX_SPEC_RUNS_AFTER_REWRITE = 1;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Changes whose spec reviewer runs are counted: new planning rules on `clarify`. */
function specLimited(root, change) {
  return changeSchema(root, change) === 'clarify' && usesNewPlanning(root, change);
}

/** The change a reviewer call is about: named in the prompt, else the only active change that qualifies. */
export function targetChange(root, toolInput, qualifies = (c) => hasTestCases(changeSchema(root, c))) {
  const changes = listChanges(root).filter(qualifies);
  const text = `${toolInput?.prompt ?? ''}\n${toolInput?.description ?? ''}`;
  const named = changes.filter((c) => new RegExp(`(^|[^\\w-])${escape(c)}(?![\\w-])`).test(text));
  if (named.length === 1) return named[0];
  if (named.length === 0 && changes.length === 1) return changes[0];
  return null;
}

function readRuns(path) {
  try {
    const r = JSON.parse(readFileSync(path, 'utf8'));
    if (Number.isInteger(r.loop) && Number.isInteger(r.runs)) return r;
  } catch {
    // missing or unreadable counter: start over
  }
  return null;
}

/** Blocker and major findings of the latest review not listed in "Stage result". */
function openFindings(root, change, doc) {
  const text = readChangeFile(root, change, CASE_REVIEW);
  if (text === null) return { review: null, open: [] };
  const review = parseCaseReview(text);
  const open = review.verdict === 'READY' ? [] : review.findings.filter((f) => CRITICAL.includes(f.severity) && !isListed(doc, f));
  return { review, open };
}

function explain(change, open) {
  const lines = [
    `sdd-kit test-cases-run-limit: ${REVIEWER} has already run ${MAX_RUNS} times in this review loop of change "${change}"; do not run it again.`,
  ];
  if (open.length) {
    lines.push('Remaining blocker and major findings (reviews/test-cases-review.md):');
    for (const f of open) lines.push(`  - ${f.severity}: ${f.finding}`);
  }
  lines.push(
    'Show them to the developer and ask the developer to fix or accept each one; list each accepted or hand-fixed finding under "Stage result" in test-cases.md with its requirement or test case and a short reason.',
  );
  return lines.join('\n');
}

/**
 * The specs' entry of the change's answers lock (answers-lock.json), as a string, or null when there is no
 * readable lock or no specs entry. Read defensively: an entry keyed `specs` (or `specs/...`), at the top level
 * or under `artifacts` / `entries`, holding a hash string or an object with `hash` / `sha256`.
 */
export function specsLockEntry(root, change) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(join(changeDir(root, change), LOCK_FILE), 'utf8'));
  } catch {
    return null;
  }
  if (!lock || typeof lock !== 'object') return null;
  const value = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? (typeof v.hash === 'string' ? v.hash : typeof v.sha256 === 'string' ? v.sha256 : null) : null);
  for (const scope of [lock, lock.artifacts, lock.entries]) {
    if (!scope || typeof scope !== 'object') continue;
    const keys = Object.keys(scope).filter((k) => k === 'specs' || k.startsWith('specs/')).sort();
    const parts = keys.map((k) => value(scope[k])).filter((v) => v !== null);
    if (parts.length) return parts.join('+');
  }
  return null;
}

/** A fingerprint of reviews/spec-review.md (mtime and content hash), or null when it does not exist. */
function reviewStamp(root, change) {
  const path = join(changeDir(root, change), SPEC_REVIEW_FILE);
  try {
    const text = readFileSync(path, 'utf8');
    return `${statSync(path).mtimeMs}:${createHash('sha256').update(text).digest('hex')}`;
  } catch {
    return null;
  }
}

/** Number of findings in reviews/spec-review.md (rows of its findings table with an ID). */
function specFindings(root, change) {
  const text = readChangeFile(root, change, SPEC_REVIEW_FILE) ?? '';
  let inTable = false;
  let count = 0;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    if (/^ID$/i.test(cells[0])) {
      inTable = true;
      continue;
    }
    if (!inTable || cells.every((c) => /^:?-+:?$/.test(c))) continue;
    if (cells[0] && !/^(—|-|–)$/.test(cells[0])) count += 1;
  }
  return count;
}

function readSpecRuns(path) {
  try {
    const r = JSON.parse(readFileSync(path, 'utf8'));
    if (Number.isInteger(r.runs) && Number.isInteger(r.max)) return r;
  } catch {
    // missing or unreadable counter: start over
  }
  return null;
}

function explainSpec(change, runs, reason) {
  const head =
    reason === 'clean'
      ? `sdd-kit test-cases-run-limit: the first ${SPEC_REVIEWER} run on the specs of change "${change}" reported no finding; do not run it again.`
      : runs.loop > 1
        ? `sdd-kit test-cases-run-limit: ${SPEC_REVIEWER} has already run once on the rewritten specs of change "${change}"; do not run it again.`
        : `sdd-kit test-cases-run-limit: ${SPEC_REVIEWER} has already run ${MAX_SPEC_RUNS} times on the specs of change "${change}"; do not run it again.`;
  const lines = [head];
  if (reason !== 'clean') {
    lines.push(
      `Fix the remaining findings yourself (${SPEC_REVIEW_FILE}); a finding that needs a decision about the requirements becomes a Technical round question; list the findings you could not fix in the digest.`,
    );
  }
  lines.push('Then go on with the next artifact (openspec/protocols/planning.md).');
  return lines.join('\n');
}

/** The spec reviewer limit of a new-rules change; returns a block message or null (the run is counted). */
export function specGate(root, toolInput) {
  const change = targetChange(root, toolInput, (c) => specLimited(root, c));
  if (!change || !existsSync(changeDir(root, change))) return null;
  const path = join(changeDir(root, change), SPEC_RUNS_FILE);
  const lock = specsLockEntry(root, change);
  let runs = readSpecRuns(path);
  if (!runs) runs = { loop: 1, runs: 0, max: MAX_SPEC_RUNS, specsLock: lock, review: null };
  else if (runs.specsLock && lock && runs.specsLock !== lock) {
    runs = { loop: runs.loop + 1, runs: 0, max: MAX_SPEC_RUNS_AFTER_REWRITE, specsLock: lock, review: null };
  } else if (!runs.specsLock && lock) runs.specsLock = lock;

  const review = reviewStamp(root, change);
  if (runs.runs >= runs.max) return explainSpec(change, runs, 'limit');
  if (runs.runs >= 1 && review !== null && review !== runs.review && specFindings(root, change) === 0) return explainSpec(change, runs, 'clean');
  runs.runs += 1;
  runs.review = review;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(runs, null, 2) + '\n');
  return null;
}

export function gate(input) {
  if (!SUBAGENT_TOOLS.includes(input.tool_name)) return null;
  const type = input.tool_input?.subagent_type;
  if (type !== REVIEWER && type !== SPEC_REVIEWER) return null;
  const root = hookRoot(input);
  if (!root) return null;
  if (type === SPEC_REVIEWER) return specGate(root, input.tool_input);
  const change = targetChange(root, input.tool_input);
  if (!change || !existsSync(changeDir(root, change))) return null;

  const docText = readChangeFile(root, change, TEST_CASES_FILE);
  const doc = parseTestCases(docText ?? '');
  const confirmed = doc.stage.answer === 'Looks correct';
  const { review, open } = openFindings(root, change, doc);
  const settled = review !== null && open.length === 0 && review.verdict !== null;

  const path = join(changeDir(root, change), RUNS_FILE);
  let runs = readRuns(path);
  if (!runs) runs = { loop: 1, runs: 0, confirmedAtStart: confirmed };
  else if (confirmed && (!runs.confirmedAtStart || settled)) runs = { loop: runs.loop + 1, runs: 0, confirmedAtStart: true };

  if (runs.runs >= MAX_RUNS) return explain(change, open);
  runs.runs += 1;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(runs, null, 2) + '\n');
  return null;
}

if (isMain(import.meta.url)) {
  runHook('test-cases-run-limit', (input) => {
    const message = gate(input);
    if (message) block(message);
  });
}
