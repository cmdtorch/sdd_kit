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
//   - the test review exists: Verdict READY, or NOT-READY with a recorded human decision
// The kit does not run the project's tests (it knows no stack); the apply instructions make the agent run
// them, and the project's own CI is the backstop.
// Without a change name the command is blocked when kit changes exist (the gate must know what to check).
import { existsSync } from 'node:fs';
import { runHook, hookRoot, block } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, isKitSchema, isClarifyFamily, hasTestCases, changeDir, readChangeFile } from '../lib/project.mjs';
import { isMain } from '../lib/report.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkSpecs } from '../checks/check-specs.mjs';
import { checkGrounding } from '../checks/check-grounding.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkTestCases } from '../checks/check-test-cases.mjs';
import { checkUi } from '../checks/check-ui.mjs';
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

/** Problems that block archiving a change (empty = allowed). */
export function archiveProblems(root, change) {
  const problems = [];
  const { open } = taskCounts(readChangeFile(root, change, 'tasks.md') || '');
  if (open) problems.push(`${open} task(s) in tasks.md are not done`);
  const schema = changeSchema(root, change);
  const reports = [checkSpecs({ root, change }), checkTraceability({ root, change, markers: collectMarkers(root), cases: hasTestCases(schema) ? collectCaseRefs(root) : null })];
  if (isClarifyFamily(schema)) reports.unshift(checkAnswers({ root, change }), checkGrounding({ root, change }));
  if (hasTestCases(schema)) reports.push(checkTestCases({ root, change }));
  reports.push(checkUi({ root, change, stage: 'archive' }));
  for (const r of reports) for (const f of r.findings.filter((x) => x.level === 'error')) problems.push(`${r.check}: ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`);
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
  return messages.length ? `sdd-kit archive-gate: ${messages.join('\n')}\nArchive only finished changes (openspec/protocols/testing.md §6).` : null;
}

if (isMain(import.meta.url)) {
  runHook('archive-gate', (input) => {
    const message = archiveGate(input);
    if (message) block(message);
  });
}
