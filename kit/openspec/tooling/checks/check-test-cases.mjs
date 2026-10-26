#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-test-cases — the test-case document of a change on a test-case schema (clarify-ai-qa, clarify-qa).
//
// Default: structure and coverage of test-cases.md (openspec/protocols/test-cases.md) — every delta-spec
//   scenario has a test case, every test case sits under a scenario of the delta specs, case names are
//   unique within a capability, every case has Given/When/Then steps and verification labels
//   (automated, e2e, manual), every remark has the status open, closed or reopened. In UI mode
//   (openspec/protocols/ui-inventory.md) every case under a scenario named by an `in scope` or `mock`
//   element of ui-inventory.md carries the `e2e` label.
// --stage: also the completion of the test-cases stage (gate before writing design.md):
//   clarify-ai-qa — the latest AI QA review is READY, or every blocker and major finding of it is listed in
//                   "Stage result" as accepted or fixed by hand; the stage confirmation is "Looks correct"
//   clarify-qa    — the same, plus the line "Handed over to QA" and no open or reopened remark
// Skipped for schemas without test cases.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadChangeDeltas, changeScenarios } from '../lib/spec-parser.mjs';
import { parseTestCases, parseCaseReview, openRemarks, isListed, TEST_CASES_FILE, CASE_REVIEW, LABELS, REMARK_STATUSES, HANDED_OVER } from '../lib/test-cases.mjs';
import { scanUiFolder, isUiMode, parseInventory, allElements, INVENTORY_FILE, BUILT_DECISIONS } from '../lib/ui-inventory.mjs';
import { changeDir, changeSchema, readChangeFile, hasTestCases, TEST_CASE_SCHEMAS } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-test-cases';
const USAGE = `Usage: check-test-cases --change <name> [--stage] [--root <dir>] [--json]

Checks openspec/changes/<name>/test-cases.md: every scenario has a test case, every case belongs to a
scenario, steps, labels and remark statuses. With --stage it also checks that the test-cases stage is
complete (AI QA findings settled, hand-over to QA on clarify-qa, no open remark, "Looks correct").`;

const CRITICAL = ['blocker', 'major'];
const quote = (s, max = 60) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Runs the check. Options: { root, change, stage? }. */
export function checkTestCases({ root, change, stage = false }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!hasTestCases(schema)) {
    return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (test cases exist only in ${TEST_CASE_SCHEMAS.map((s) => `"${s}"`).join(', ')})`);
  }

  const f = findingsFor(root);
  const file = join(dir, TEST_CASES_FILE);
  const content = readChangeFile(root, change, TEST_CASES_FILE);
  if (content === null) {
    f.error(file, null, `${TEST_CASES_FILE} does not exist`, 'write the test cases per openspec/protocols/test-cases.md');
    return makeReport(CHECK, f.list, { change });
  }
  const doc = parseTestCases(content);
  for (const p of doc.problems) f.error(file, p.line, p.message);
  if (!doc.sections.general) f.warning(file, null, 'section "## General remarks" is missing');
  if (!doc.sections.specChanges) f.warning(file, null, 'section "## Spec changes during test-case review" is missing');
  if (!doc.sections.stageResult) (stage ? f.error : f.warning)(file, null, 'section "## Stage result" is missing');

  // --- coverage --------------------------------------------------------------------------------
  const scenarios = changeScenarios(loadChangeDeltas(root, dir));
  const known = new Map(); // capability -> Set(scenario)
  for (const s of scenarios) {
    if (!known.has(s.capability)) known.set(s.capability, new Set());
    known.get(s.capability).add(s.scenario);
  }
  for (const cap of doc.capabilities) {
    const names = known.get(cap.name);
    for (const sc of cap.scenarios) {
      if (names && names.has(sc.name)) continue;
      const where = names ? cap.name : `${cap.name}, a capability with no delta spec in the change`;
      if (!sc.cases.length) f.error(file, sc.line, `scenario "${sc.name}" (${where}) is not in the change's delta specs`, 'fix the name (exact match) or remove the section');
      for (const c of sc.cases) {
        f.error(file, c.line, `test case "${c.name}" is under unknown scenario "${sc.name}" (${where})`, 'move it under an existing scenario (exact name) or remove it');
      }
    }
  }
  for (const s of scenarios) {
    const cap = doc.capabilities.find((c) => c.name === s.capability);
    const sc = cap && cap.scenarios.find((x) => x.name === s.scenario);
    if (!sc || !sc.cases.length) {
      f.error(file, sc ? sc.line : cap ? cap.line : null, `scenario "${s.scenario}" (${s.capability}) has no test case`, `add "#### Case: <name>" under "### Scenario: ${s.scenario}" in "## ${s.capability}"`);
    }
  }

  // --- cases: names, labels, steps ---------------------------------------------------------------
  const uiElements = uiElementsByScenario(root, change, dir);
  for (const cap of doc.capabilities) {
    const seen = new Map();
    for (const sc of cap.scenarios) {
      const elements = uiElements.get(`${cap.name} :: ${sc.name}`);
      for (const c of sc.cases) {
        if (seen.has(c.name)) f.error(file, c.line, `duplicate test case name "${c.name}" in ${cap.name} (first at line ${seen.get(c.name)})`, 'case names must be unique within a capability');
        else seen.set(c.name, c.line);
        if (!c.labels || !c.labels.length) {
          f.error(file, c.labelsLine || c.line, `test case "${c.name}" (${cap.name}) has no verification label (allowed: ${LABELS.join(', ')})`, 'add a line "Labels: <label>[, <label>]" under the case heading');
        } else {
          for (const l of c.labels.filter((x) => !LABELS.includes(x))) {
            f.error(file, c.labelsLine, `test case "${c.name}" (${cap.name}) has unknown label "${l}" (allowed: ${LABELS.join(', ')})`, 'the unit / integration level belongs to the verification plan, not the test case');
          }
          if (elements && !c.labels.includes('e2e')) {
            f.error(file, c.labelsLine, `test case "${c.name}" (${cap.name}) is under the scenario "${sc.name}", which covers the UI element${elements.length > 1 ? 's' : ''} ${elements.map((e) => `"${e}"`).join(', ')}; the \`e2e\` label is required`, `write "Labels: ${[...c.labels.filter((l) => l !== 'e2e'), 'e2e'].join(', ')}"`);
          }
        }
        for (const kind of ['given', 'when', 'then']) {
          if (!c.steps[kind]) {
            const word = kind[0].toUpperCase() + kind.slice(1);
            f.error(file, c.line, `test case "${c.name}" (${cap.name}) has no ${word} step`, `add "- **${word}** ..." with concrete data`);
          }
        }
      }
    }
  }

  // --- remarks ---------------------------------------------------------------------------------
  for (const r of doc.remarks) {
    if (REMARK_STATUSES.includes(r.status)) continue;
    const where = r.case ? `under test case "${r.case}"` : 'in General remarks';
    const what = r.status ? `has unknown status "${r.status}"` : 'has no status';
    f.error(file, r.line, `remark "${quote(r.text)}" ${where} ${what} (allowed: ${REMARK_STATUSES.join(', ')})`, 'write it as "> **Remark** [open]: ..."; a remark with another status counts as open');
  }

  // --- stage completion ------------------------------------------------------------------------
  if (stage) {
    const reviewPath = join(dir, CASE_REVIEW);
    const reviewText = readChangeFile(root, change, CASE_REVIEW);
    if (reviewText === null) {
      f.error(reviewPath, null, `no AI QA review (${CASE_REVIEW})`, 'run the test-cases-reviewer subagent (openspec/protocols/review-test-cases.md)');
    } else {
      const review = parseCaseReview(reviewText);
      if (!review.verdict) f.error(reviewPath, null, `${CASE_REVIEW} has no "Verdict: READY" or "Verdict: NOT-READY" line`);
      else if (review.verdict === 'NOT-READY') {
        for (const x of review.findings.filter((y) => CRITICAL.includes(y.severity))) {
          if (isListed(doc, x)) continue;
          f.error(reviewPath, x.line, `AI QA finding "${x.finding}" (${x.severity}${x.id ? `, ${x.id}` : ''}) is not listed in "Stage result" as accepted or fixed by hand`, 'fix the test cases and run the reviewer again, or ask the developer to accept the finding or fix it by hand and list it in "Stage result"');
        }
      }
    }
    if (schema === 'clarify-qa') {
      if (!doc.stage.handedOver) {
        f.error(file, doc.sections.stageResult?.line ?? null, `the test cases were not handed over to QA (no line "${HANDED_OVER}" in "Stage result")`, 'hand over once the AI QA findings are settled, record the line and tell the developer');
      }
      const open = openRemarks(doc);
      if (open.length) {
        f.error(file, open[0].line, `${open.length} remark${open.length === 1 ? ' is' : 's are'} still open or reopened`, 'answer each remark and revise the test cases; only QA (or the developer on QA\'s behalf) closes a remark');
      }
    }
    const a = doc.stage.answer;
    const at = doc.stage.answerLine || doc.sections.stageResult?.line || null;
    if (a === null || /^_*$/.test(a)) {
      f.error(file, at, 'the test-cases stage is not confirmed yet (the "Stage result" [Answer]: is blank)', `ask ${schema === 'clarify-qa' ? 'QA (or the developer on QA\'s behalf)' : 'the developer'}: Looks correct / Request changes`);
    } else if (/^Request changes/i.test(a)) {
      f.error(file, at, 'the test-cases stage confirmation says "Request changes"', 'apply the requested changes, reset the answer and confirm again');
    } else if (a !== 'Looks correct') {
      f.error(file, at, `the test-cases stage confirmation "${a}" must be exactly "Looks correct"`);
    }
  }
  return makeReport(CHECK, f.list, { change, stage });
}

/**
 * In UI mode: the scenarios named by `in scope` / `mock` elements of ui-inventory.md, as a Map
 * "<capability> :: <scenario>" -> [element names]. Empty when the change has no screenshot or no inventory.
 */
function uiElementsByScenario(root, change, dir) {
  const out = new Map();
  if (!isUiMode(scanUiFolder(dir))) return out;
  const content = readChangeFile(root, change, INVENTORY_FILE);
  if (content === null) return out;
  for (const { element } of allElements(parseInventory(content))) {
    if (!BUILT_DECISIONS.includes(element.decision)) continue;
    for (const ref of element.scenarios) {
      const key = `${ref.capability} :: ${ref.scenario}`;
      if (!out.has(key)) out.set(key, []);
      if (!out.get(key).includes(element.name)) out.get(key).push(element.name);
    }
  }
  return out;
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkTestCases({ root, change: args.change, stage: Boolean(args.stage) }), ['stage']);
}
