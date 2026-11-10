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
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runHook, hookRoot, block } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, changeDir, hasTestCases, readChangeFile } from '../lib/project.mjs';
import { parseTestCases, parseCaseReview, isListed, TEST_CASES_FILE, CASE_REVIEW } from '../lib/test-cases.mjs';
import { isMain } from '../lib/report.mjs';

export const REVIEWER = 'test-cases-reviewer';
export const SUBAGENT_TOOLS = ['Agent', 'Task'];
export const RUNS_FILE = 'reviews/test-cases-runs.json';
export const MAX_RUNS = 3;
const CRITICAL = ['blocker', 'major'];

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The change a reviewer call is about: named in the prompt, else the only active test-case change. */
export function targetChange(root, toolInput) {
  const changes = listChanges(root).filter((c) => hasTestCases(changeSchema(root, c)));
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

export function gate(input) {
  if (!SUBAGENT_TOOLS.includes(input.tool_name)) return null;
  if (input.tool_input?.subagent_type !== REVIEWER) return null;
  const root = hookRoot(input);
  if (!root) return null;
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
