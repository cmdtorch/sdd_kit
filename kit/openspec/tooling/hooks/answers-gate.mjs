#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// answers-gate — PreToolUse hook (Write|Edit|MultiEdit|Bash).
// Blocks writing a clarify-family artifact while the question round it depends on is unanswered or
// unconfirmed (proposal→Main, specs→Specs, design→Design, verification-plan→Verification).
// On a test-case schema (clarify-ai-qa, clarify-qa) design.md also needs a complete test-cases stage
// (check-test-cases --stage); a blocked spec write during that stage says the Specs round was reopened.
// Bash: a command that writes to such an artifact (redirect, tee, cp, mv, sed -i, ...) is gated too;
// this is a heuristic — CI (check-answers) is the backstop.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, hookRoot, touchedFiles, block } from '../lib/hook-io.mjs';
import { locateInChange, changeSchema, changeDir, isClarifyFamily, hasTestCases } from '../lib/project.mjs';
import { ROUND_FOR_ARTIFACT } from '../lib/clarifications.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkTestCases } from '../checks/check-test-cases.mjs';
import { TEST_CASES_FILE } from '../lib/test-cases.mjs';
import { isMain } from '../lib/report.mjs';

const MAX_LISTED = 8;
const GATED_PATH = /(?:^|[\s'"=(])((?:\.\/)?(?:[^\s'"]*\/)?openspec\/changes\/[^\s'"/]+\/(?:proposal\.md|design\.md|verification-plan\.md|specs\/[^\s'"]+\.md))/g;
const WRITES = /(^|[^<>&0-9])>>?|\btee\b|\bcp\b|\bmv\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\bdd\b|\btruncate\b|\binstall\b|\brsync\b|writeFile|open\(.*['"]w/;

/** Gated targets of a Bash command (paths of kit artifacts it appears to write). */
export function bashTargets(command) {
  if (!WRITES.test(command)) return [];
  return [...command.matchAll(GATED_PATH)].map((m) => m[1]);
}

function listErrors(report) {
  const errors = report.findings.filter((f) => f.level === 'error');
  const lines = errors.slice(0, MAX_LISTED).map((f) => `  - ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`);
  if (errors.length > MAX_LISTED) lines.push(`  - ... and ${errors.length - MAX_LISTED} more`);
  return lines;
}

function explain(change, artifact, report, duringTestCases) {
  const round = ROUND_FOR_ARTIFACT[artifact];
  const lines = [
    `sdd-kit answers-gate: ${artifact} of change "${change}" cannot be written yet — the ${round} round in clarifications.md is not complete and confirmed.`,
    ...listErrors(report),
  ];
  if (duringTestCases) {
    lines.push(
      'The test-cases stage reopened the Specs round with a follow-up question (openspec/protocols/test-cases.md §4.3). Change the delta specs only after the developer has answered it and confirmed the Specs round summary again; until then do not run the test-cases reviewer.',
    );
  }
  lines.push(
    `Continue the question protocol (openspec/protocols/questions.md): ask the user, write the answers into clarifications.md, analyse them, then get an explicit "Looks correct" on the ${round} round summary. Do not write ${artifact} any other way.`,
  );
  return lines.join('\n');
}

function explainTestCases(change, report) {
  return [
    `sdd-kit answers-gate: design of change "${change}" cannot be written yet — the test-cases stage is not complete.`,
    ...listErrors(report),
    'Continue the test-cases stage (openspec/protocols/test-cases.md): fix the test cases, settle every blocker and major finding of the AI QA review, and get an explicit "Looks correct" in "Stage result" of test-cases.md. Do not write design.md any other way.',
  ].join('\n');
}

export function gate(input) {
  const root = hookRoot(input);
  if (!root) return null;
  let targets = [];
  if (input.tool_name === 'Bash') {
    const cmd = String(input.tool_input?.command || '');
    targets = bashTargets(cmd).map((p) => (p.startsWith('/') ? p : `${input.cwd || root}/${p.replace(/^\.\//, '')}`));
  } else {
    targets = touchedFiles(input);
  }
  for (const path of targets) {
    const loc = locateInChange(root, path);
    if (!loc || !(loc.artifact in ROUND_FOR_ARTIFACT)) continue;
    if (!existsSync(changeDir(root, loc.change))) continue;
    const schema = changeSchema(root, loc.change);
    if (!isClarifyFamily(schema)) continue;
    const report = checkAnswers({ root, change: loc.change, artifact: loc.artifact });
    if (!report.ok) {
      const duringTestCases = loc.artifact === 'specs' && hasTestCases(schema) && existsSync(join(changeDir(root, loc.change), TEST_CASES_FILE));
      return explain(loc.change, loc.artifact, report, duringTestCases);
    }
    if (loc.artifact === 'design' && hasTestCases(schema)) {
      const stage = checkTestCases({ root, change: loc.change, stage: true });
      if (!stage.ok) return explainTestCases(loc.change, stage);
    }
  }
  return null;
}

if (isMain(import.meta.url)) {
  runHook('answers-gate', (input) => {
    const message = gate(input);
    if (message) block(message);
  });
}
