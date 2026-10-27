#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// answers-gate — PreToolUse hook (Write|Edit|MultiEdit|Bash).
// Blocks writing a clarify-family artifact while the question round it depends on is unanswered or
// unconfirmed (proposal→Main, specs→Specs, design→Design, verification-plan→Verification).
// On a test-case schema (clarify-ai-qa, clarify-qa) design.md also needs a complete test-cases stage
// (check-test-cases --stage); a blocked spec write during that stage says the Specs round was reopened.
// UI sources (openspec/protocols/ui-inventory.md), on all four kit schemas, lean included: writing proposal.md,
// a spec, test-cases.md, design.md, verification-plan.md or tasks.md runs check-ui at the stage of that
// artifact (uiStageFor), judging the files already in the change; errors about the file being written are
// left out, so it can always be fixed. A clarifications.md write that adds a `### Q` heading is blocked while
// sources/ui/ holds screenshots and ui-inventory.md does not exist. No other UI rule touches
// clarifications.md or ui-inventory.md. Lean gets only the UI check (it has no question rounds).
// Manual reasons, on all four kit schemas, for a change stamped with the kit version (x-sdd-kit): tasks.md is
// blocked while check-traceability reports a `manual` plan row without a valid reason or a dangerous scenario
// without an automated row (openspec/protocols/testing.md §1); on the test-case schemas design.md is blocked
// by the same rule for test cases through check-test-cases --stage.
// Bash: a command that writes to such an artifact (redirect, tee, cp, mv, sed -i, ...) is gated too;
// this is a heuristic — CI (check-answers) is the backstop.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runHook, hookRoot, touchedFiles, block, absPath } from '../lib/hook-io.mjs';
import { locateInChange, changeSchema, changeDir, isClarifyFamily, isKitSchema, hasTestCases, isStamped } from '../lib/project.mjs';
import { checkUi, uiStageFor } from '../checks/check-ui.mjs';
import { scanUiFolder, isUiMode, INVENTORY_FILE, UI_DIR } from '../lib/ui-inventory.mjs';
import { ROUND_FOR_ARTIFACT } from '../lib/clarifications.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkTestCases } from '../checks/check-test-cases.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
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

function explainManual(change, report) {
  return [
    `sdd-kit answers-gate: tasks of change "${change}" cannot be written yet — the verification plan has manual checks without a valid reason.`,
    ...listErrors(report),
    'A check is manual only when it cannot be automated or the function is dangerous (openspec/protocols/testing.md §1): give each manual row a "Manual reason" starting with "cannot be automated:" or "dangerous:", or plan it as unit / integration. A dangerous scenario also needs an automated row. Do not write tasks.md any other way.',
  ].join('\n');
}

/** tasks.md of a stamped change waits for valid manual reasons in the plan. */
function manualGate(root, change) {
  if (!isStamped(root, change)) return null;
  const report = checkTraceability({ root, change, markers: null });
  const findings = report.findings.filter((f) => f.rule === 'manual-reason');
  return findings.length ? explainManual(change, { ...report, findings }) : null;
}

function explainUi(change, artifact, report) {
  return [
    `sdd-kit answers-gate: ${artifact} of change "${change}" cannot be written yet — the UI check (check-ui) reports errors in the change's screenshots or UI inventory.`,
    ...listErrors(report),
    `Fix them first (openspec/protocols/ui-inventory.md): open the screenshots named above, update ${INVENTORY_FILE}, the specs or design.md as the messages say, and ask about new or changed elements in the current question round where the schema has one. Do not write ${artifact} any other way.`,
  ].join('\n');
}

const Q_HEADING = /^###\s+Q\d+\b/gm;
const countQuestions = (text) => (typeof text === 'string' ? (text.match(Q_HEADING) || []).length : 0);

/** Whether a Write / Edit / MultiEdit call adds a `### Q<n>` heading to the file at `path`. */
export function addsQuestion(input, path) {
  const ti = input.tool_input || {};
  if (typeof ti.content === 'string') {
    const old = existsSync(path) ? readFileSync(path, 'utf8') : '';
    return countQuestions(ti.content) > countQuestions(old);
  }
  const edits = Array.isArray(ti.edits) ? ti.edits.filter((e) => !e.file_path || absPath(input, e.file_path) === path) : [ti];
  return edits.some((e) => countQuestions(e.new_string) > countQuestions(e.old_string));
}

/** Main round questions wait for the UI inventory while screenshots exist. */
function questionsGate(root, change, input, path) {
  if (input.tool_name === 'Bash' || !addsQuestion(input, path)) return null;
  const dir = changeDir(root, change);
  if (!isUiMode(scanUiFolder(dir)) || existsSync(join(dir, INVENTORY_FILE))) return null;
  return [
    `sdd-kit answers-gate: questions cannot be added to clarifications.md of change "${change}" yet — ${UI_DIR}/ holds screenshots and ${INVENTORY_FILE} does not exist.`,
    `Write the UI inventory first (openspec/protocols/ui-inventory.md): open every screenshot, list its screens, interactive elements and states with fingerprints in ${INVENTORY_FILE}, then ask the Main round questions about them.`,
  ].join('\n');
}

/** check-ui at the stage of the artifact; errors about the file being written itself are left out. */
function uiGate(root, change, schema, artifact, path) {
  const stage = uiStageFor(schema, artifact);
  if (!stage) return null;
  const report = checkUi({ root, change, stage });
  const own = (f) => f.file && resolve(root, f.file) === path;
  const findings = report.findings.filter((f) => !(f.level === 'error' && own(f)));
  if (!findings.some((f) => f.level === 'error')) return null;
  return explainUi(change, artifact, { ...report, findings });
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
    if (!loc || !loc.artifact) continue;
    if (!existsSync(changeDir(root, loc.change))) continue;
    const schema = changeSchema(root, loc.change);
    if (!isKitSchema(schema)) continue;
    const abs = resolve(path);
    if (loc.artifact === 'clarifications') {
      const msg = questionsGate(root, loc.change, input, abs);
      if (msg) return msg;
      continue;
    }
    if (isClarifyFamily(schema) && loc.artifact in ROUND_FOR_ARTIFACT) {
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
    if (loc.artifact === 'tasks') {
      const manual = manualGate(root, loc.change);
      if (manual) return manual;
    }
    const ui = uiGate(root, loc.change, schema, loc.artifact, abs);
    if (ui) return ui;
  }
  return null;
}

if (isMain(import.meta.url)) {
  runHook('answers-gate', (input) => {
    const message = gate(input);
    if (message) block(message);
  });
}
