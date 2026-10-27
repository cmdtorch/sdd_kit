#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// artifact-feedback — PostToolUse hook (Write|Edit|MultiEdit). Never blocks. After a kit artifact is
// written it runs the matching check and hands the errors back to Claude, so they are fixed now
// instead of failing in CI:
//   clarifications.md → check-answers (format + rounds of existing artifacts)
//   proposal.md / design.md → check-grounding      specs/**.md → check-specs
//   verification-plan.md → check-traceability (plan + trace; markers are checked at archive)
//   ui-inventory.md → check-ui, stage base (openspec/protocols/ui-inventory.md)
//   tasks.md → check-ui, stage archive, only the findings in tasks.md (screenshot links of UI tasks,
//              [U<n>] citations); the other stages are judged by answers-gate before the write;
//              on a stamped change also a warning for tasks that ask a human to check by hand
//   e2e.md → check-e2e, format mode (the E2E stage record; runs and coverage are judged at archive)
//   apply-report.md → check-apply-report (the implementation report, openspec/protocols/apply.md)
// check-ui finds nothing outside UI mode except format errors of sources/ui/.
// When the last task in tasks.md is checked off it reminds Claude of the end-of-apply steps.
// The first kit artifact of a change stamps the kit version into its .openspec.yaml (`x-sdd-kit`): stamped
// changes follow the autonomous-apply rules (openspec/protocols/apply.md), older ones keep theirs.
import { basename } from 'node:path';
import { runHook, hookRoot, touchedFiles, addContext } from '../lib/hook-io.mjs';
import { locateInChange, changeSchema, isKitSchema, isClarifyFamily, readChangeFile, stampChange, isStamped } from '../lib/project.mjs';
import { isMain } from '../lib/report.mjs';
import { taskCounts, handTasks } from '../lib/markdown.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkGrounding } from '../checks/check-grounding.mjs';
import { checkSpecs } from '../checks/check-specs.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkUi } from '../checks/check-ui.mjs';
import { checkE2e } from '../checks/check-e2e.mjs';
import { checkApplyReport } from '../checks/check-apply-report.mjs';
import { APPLY_REPORT } from '../lib/apply-report.mjs';
import { E2E_FILE } from '../lib/e2e-record.mjs';
import { INVENTORY_FILE } from '../lib/ui-inventory.mjs';

const MAX_LISTED = 10;

function checksFor(artifact, schema, root, change, rel) {
  switch (artifact) {
    case 'clarifications':
      return isClarifyFamily(schema) ? [checkAnswers({ root, change })] : [];
    case 'proposal':
    case 'design':
      return isClarifyFamily(schema) ? [checkGrounding({ root, change, file: rel })] : [];
    case 'specs':
      return [checkSpecs({ root, change })];
    case 'verification-plan':
      return [checkTraceability({ root, change, markers: null })];
    case 'ui-inventory':
      return [checkUi({ root, change, stage: 'base' })];
    case 'e2e':
      return [checkE2e({ root, change, mode: 'format' })];
    case 'apply-report':
      return [checkApplyReport({ root, change })];
    case 'tasks': {
      const report = checkUi({ root, change, stage: 'archive' });
      return [{ ...report, findings: report.findings.filter((f) => f.file && basename(f.file) === 'tasks.md') }];
    }
    default:
      return [];
  }
}

/** Warning for tasks that ask a human to check by hand (stamped changes); null when there are none. */
export function handTasksNote(root, change) {
  if (!isStamped(root, change)) return null;
  const found = handTasks(readChangeFile(root, change, 'tasks.md') || '');
  if (!found.length) return null;
  return [
    `sdd-kit warning: tasks.md of "${change}" has tasks for a human (openspec/protocols/apply.md):`,
    ...found.slice(0, MAX_LISTED).map((t) => `  - openspec/changes/${change}/tasks.md:${t.line}: task asks a human to check by hand: "${t.text}"`),
    'Automate the check in a task, or leave it out of tasks.md: a manual check goes to "Manual checks" in apply-report.md for QA after the archive.',
  ].join('\n');
}

/** Reminder of the end-of-apply steps once every task of a change is checked; null otherwise. */
export function tasksDoneNote(root, change) {
  const { done, open } = taskCounts(readChangeFile(root, change, 'tasks.md') || '');
  if (!done || open) return null;
  const note = `sdd-kit: all tasks of "${change}" are checked. Before you report it done: run the project's full test suite and quality checks and fix what fails, make sure the test review is done, then run the archive checks: node openspec/tooling/checks/check-traceability.mjs --change ${change} --markers (openspec/protocols/testing.md §6); then the E2E stage when the change needs it (openspec/protocols/e2e.md).`;
  if (!isStamped(root, change)) return note;
  return `${note} Then write apply-report.md, ask the consent list once and give the ready message (openspec/protocols/apply.md §7–9); do not archive the change yourself.`;
}

export function feedback(input) {
  const root = hookRoot(input);
  if (!root) return null;
  const out = [];
  let checkErrors = false;
  let inventoryNote = false;
  for (const path of touchedFiles(input)) {
    const loc = locateInChange(root, path);
    if (!loc) continue;
    const artifact = loc.artifact || { [INVENTORY_FILE]: 'ui-inventory', [E2E_FILE]: 'e2e', [APPLY_REPORT]: 'apply-report' }[loc.rel] || null;
    if (!artifact) continue;
    const schema = changeSchema(root, loc.change);
    if (!isKitSchema(schema)) continue;
    if (loc.artifact) stampChange(root, loc.change, loc.rel);
    if (artifact === 'tasks') {
      const hand = handTasksNote(root, loc.change);
      if (hand) out.push(hand);
      const note = tasksDoneNote(root, loc.change);
      if (note) out.push(note);
    }
    for (const report of checksFor(artifact, schema, root, loc.change, loc.rel)) {
      const errors = report.findings.filter((f) => f.level === 'error');
      if (!errors.length) continue;
      checkErrors = true;
      if (artifact === 'ui-inventory' && isClarifyFamily(schema)) inventoryNote = true;
      out.push(`sdd-kit ${report.check} found ${errors.length} problem(s) after writing ${loc.rel} (change "${loc.change}"):`);
      for (const f of errors.slice(0, MAX_LISTED)) out.push(`  - ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}${f.hint ? ` (${f.hint})` : ''}`);
      if (errors.length > MAX_LISTED) out.push(`  - ... and ${errors.length - MAX_LISTED} more`);
    }
  }
  if (!out.length) return null;
  if (inventoryNote) out.push('Decisions and their sources in ui-inventory.md may wait for the answers of the current question round (openspec/protocols/ui-inventory.md §4).');
  if (checkErrors) out.push('Fix these now; CI runs the same checks.');
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  runHook('artifact-feedback', (input) => {
    const text = feedback(input);
    if (text) addContext('PostToolUse', text);
  });
}
