#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// archive-gate — PreToolUse hook (Bash). `openspec archive <change>` of a kit-schema change is allowed
// only when the change is complete:
//   - every task is checked (OpenSpec itself lets `--yes` skip this; facts A1)
//   - check-answers, check-specs, check-grounding and check-traceability pass, and every scenario planned
//     as automated has a test carrying its marker (on a test-case schema, every test case labelled
//     `automated` also needs a test carrying its case reference)
//   - on a test-case schema (clarify-ai-qa, clarify-qa), check-test-cases passes (a scenario added late
//     still needs a test case)
//   - check-ui passes in archive mode on every kit schema (screenshots, inventory, scenarios of built
//     elements, the "## Screens" table, screenshot links of UI tasks; nothing to check without screenshots)
//   - check-e2e passes in archive mode on every kit schema (openspec/protocols/e2e.md): on clarify-ai-qa /
//     clarify-qa the E2E decision e2e.md is required; on clarify / lean a change without it does not use
//     E2E; unless E2E is skipped, every e2e case or listed scenario has an E2E test with a valid passed (or
//     accepted) result recorded by e2e-run.mjs, and in UI mode every screenshot is compared with no open
//     difference
//   - the test review exists: Verdict READY, or NOT-READY with a recorded human decision
//   - on a change stamped with the kit version (x-sdd-kit; openspec/protocols/apply.md): apply-report.md
//     passes check-apply-report and every entry of "Not verified automatically" carries a `Consent:` line;
//     a scenario or `automated` case without a test counts as covered only when it is agreed there; every
//     manual plan row and `manual` case is under "Manual checks"; with E2E skipped (e2e.md `Mode: skipped`)
//     every `e2e` case and listed scenario is agreed there; when the plan's Environment says
//     `Running application: yes`, the start-check record start-check.json exists (start-check.mjs).
//     Unstamped changes keep the gate above.
// The kit does not run the project's tests (it knows no stack); the apply instructions make the agent run
// them, and the project's own CI is the backstop.
// Without a change name the command is blocked when kit changes exist (the gate must know what to check).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runHook, hookRoot, block } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, isKitSchema, isClarifyFamily, hasTestCases, changeDir, readChangeFile, isStamped } from '../lib/project.mjs';
import { isMain } from '../lib/report.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkSpecs } from '../checks/check-specs.mjs';
import { checkGrounding } from '../checks/check-grounding.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkTestCases } from '../checks/check-test-cases.mjs';
import { checkUi } from '../checks/check-ui.mjs';
import { checkE2e } from '../checks/check-e2e.mjs';
import { checkApplyReport } from '../checks/check-apply-report.mjs';
import { entryKey, APPLY_REPORT } from '../lib/apply-report.mjs';
import { parsePlan, key } from '../lib/plan.mjs';
import { parseTestCases, TEST_CASES_FILE } from '../lib/test-cases.mjs';
import { parseE2eRecord, E2E_FILE, SKIPPED } from '../lib/e2e-record.mjs';
import { START_CHECK_FILE } from '../lib/start-check.mjs';
import { collectMarkers, collectCaseRefs } from '../lib/markers.mjs';
import { taskCounts } from '../lib/markdown.mjs';
import { testReviewProblems } from '../lib/reviews.mjs';

const ARCHIVE = /(?:^|[\s;&|(])(?:npx\s+(?:--yes\s+|-y\s+)?(?:@fission-ai\/)?)?(?:openspec|\S*openspec\.mjs)\s+archive\b([^;&|\n]*)/g;

/** Change names targeted by `openspec archive` calls in a shell command; [''] = archive without a name. */
export function archiveTargets(command) {
  const out = [];
  for (const m of command.matchAll(ARCHIVE)) {
    const names = m[1].trim().split(/\s+/).filter((t) => t && !t.startsWith('-') && !t.startsWith('<') && !t.startsWith('>'));
    out.push(names[0] ? names[0].replace(/^['"]|['"]$/g, '') : '');
  }
  return out;
}

const where = (f) => (f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : '');

/** Test cases of the change: [{capability, scenario, name, labels}]. */
function casesOf(root, change) {
  const content = readChangeFile(root, change, TEST_CASES_FILE);
  if (content === null) return [];
  const out = [];
  for (const c of parseTestCases(content).capabilities) for (const s of c.scenarios) for (const k of s.cases) out.push({ capability: c.name, scenario: s.name, name: k.name, labels: k.labels || [] });
  return out;
}

/**
 * The autonomous-apply rules of a stamped change: problems, and the keys agreed under "Not verified
 * automatically" (covered without a test).
 */
function autonomousProblems(root, change, schema) {
  const problems = [];
  const report = checkApplyReport({ root, change });
  for (const f of report.findings) {
    if (f.level === 'error') problems.push(`${report.check}: ${where(f)}${f.message}`);
    else if (/has no "Consent:" line/.test(f.message)) problems.push(`${report.check}: ${where(f)}${f.message} — ask the developer (the consent list, openspec/protocols/apply.md)`);
  }
  const covered = new Set(report.entries.unverified.filter((e) => e.consent).map(entryKey));
  if (readChangeFile(root, change, APPLY_REPORT) === null) return { problems, covered };

  const manual = new Set(report.entries.manual.map(entryKey));
  const plan = parsePlan(readChangeFile(root, change, 'verification-plan.md') || '');
  const cases = hasTestCases(schema) ? casesOf(root, change) : [];
  const wanted = [
    ...plan.coverage.rows.filter((r) => r.level === 'manual').map((r) => [r.capability, r.scenario]),
    ...cases.filter((c) => c.labels.includes('manual')).map((c) => [c.capability, c.name]),
  ];
  for (const [capability, name] of wanted) {
    if (!manual.has(key(capability, name))) problems.push(`manual check "${name}" (${capability}) is not under "Manual checks" in ${APPLY_REPORT}`);
  }

  const e2e = readChangeFile(root, change, E2E_FILE);
  const record = e2e === null ? null : parseE2eRecord(e2e);
  if (record && record.mode === SKIPPED) {
    const items = [
      ...cases.filter((c) => c.labels.includes('e2e')).map((c) => ['case', c.capability, c.name]),
      ...record.scenarios.map((s) => ['scenario', s.capability, s.scenario]),
    ];
    for (const [kind, capability, name] of items) {
      if (!covered.has(key(capability, name))) problems.push(`E2E is skipped: the e2e ${kind} "${name}" (${capability}) is not agreed under "Not verified automatically" in ${APPLY_REPORT}`);
    }
  }
  if (plan.runningApplication && !existsSync(join(changeDir(root, change), START_CHECK_FILE))) {
    problems.push(`the plan needs a running application but there is no ${START_CHECK_FILE}: run node openspec/tooling/bin/start-check.mjs before the first task (openspec/protocols/apply.md)`);
  }
  return { problems, covered };
}

/** Problems that block archiving a change (empty = allowed). */
export function archiveProblems(root, change) {
  const problems = [];
  const { open } = taskCounts(readChangeFile(root, change, 'tasks.md') || '');
  if (open) problems.push(`${open} task(s) in tasks.md are not done`);
  const schema = changeSchema(root, change);
  const stamped = isStamped(root, change) ? autonomousProblems(root, change, schema) : null;
  const covered = stamped ? stamped.covered : new Set();
  const reports = [checkSpecs({ root, change }), checkTraceability({ root, change, markers: collectMarkers(root), cases: hasTestCases(schema) ? collectCaseRefs(root) : null, covered })];
  if (isClarifyFamily(schema)) reports.unshift(checkAnswers({ root, change }), checkGrounding({ root, change }));
  if (hasTestCases(schema)) reports.push(checkTestCases({ root, change }));
  reports.push(checkUi({ root, change, stage: 'archive' }), checkE2e({ root, change, mode: 'archive' }));
  for (const r of reports) for (const f of r.findings.filter((x) => x.level === 'error')) problems.push(`${r.check}: ${where(f)}${f.message}`);
  if (stamped) problems.push(...stamped.problems);
  problems.push(...testReviewProblems(changeDir(root, change)));
  return problems;
}

export function archiveGate(input) {
  if (input.tool_name !== 'Bash') return null;
  const root = hookRoot(input);
  if (!root) return null;
  const targets = archiveTargets(String(input.tool_input?.command || ''));
  if (!targets.length) return null;
  const kitChanges = listChanges(root).filter((n) => isKitSchema(changeSchema(root, n)));
  const messages = [];
  for (const name of targets) {
    if (!name) {
      if (kitChanges.length) messages.push(`name the change explicitly ("openspec archive <change>") so the kit can check it; kit changes: ${kitChanges.join(', ')}`);
      continue;
    }
    if (!existsSync(changeDir(root, name)) || !isKitSchema(changeSchema(root, name))) continue;
    const problems = archiveProblems(root, name);
    if (problems.length) messages.push(`change "${name}" cannot be archived yet:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  }
  return messages.length ? `sdd-kit archive-gate: ${messages.join('\n')}\nArchive only finished changes (openspec/protocols/testing.md §6, openspec/protocols/apply.md).` : null;
}

if (isMain(import.meta.url)) {
  runHook('archive-gate', (input) => {
    const message = archiveGate(input);
    if (message) block(message);
  });
}
