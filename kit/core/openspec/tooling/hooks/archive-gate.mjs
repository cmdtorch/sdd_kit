#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// archive-gate — PreToolUse hook (Bash). `openspec archive <change>` of a kit-schema change is allowed
// only when the change is complete and verified:
//   - every task is checked (OpenSpec itself lets `--yes` skip this; facts A1)
//   - check-answers, check-specs, check-grounding, check-traceability (markers of the last verification)
//     and check-verification pass
//   - the last full `verify.mjs` run is green, includes the manual checks, and the working tree has not
//     changed since (fingerprint), so a hand-edited verification.md cannot pass
//   - the test review exists: Verdict READY, or NOT-READY with a recorded human decision
//   - when verify.yaml has `api`: api-changes.json is current, frontend-handoff.md passes check-handoff and
//     the API baseline was updated after the last application change (openspec/protocols/handoff.md)
// Without a change name the command is blocked when kit changes exist (the gate must know what to check).
import { existsSync } from 'node:fs';
import { runHook, hookRoot, block } from '../lib/hook-io.mjs';
import { listChanges, changeSchema, isKitSchema, changeDir, readChangeFile } from '../lib/project.mjs';
import { readState, fingerprint } from '../lib/state.mjs';
import { isMain } from '../lib/report.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkSpecs } from '../checks/check-specs.mjs';
import { checkGrounding } from '../checks/check-grounding.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkVerification } from '../checks/check-verification.mjs';
import { checkHandoff } from '../checks/check-handoff.mjs';
import { loadVerifyConfig } from '../lib/verify-config.mjs';
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
  const tasks = readChangeFile(root, change, 'tasks.md') || '';
  const open = (tasks.match(/^\s*-\s*\[ \]/gm) || []).length;
  if (open) problems.push(`${open} task(s) in tasks.md are not done`);
  const schema = changeSchema(root, change);
  const state = readState(root, `verify-${change}`);
  const reports = [checkSpecs({ root, change }), checkTraceability({ root, change, markers: state?.markers ?? null }), checkVerification({ root, change })];
  if (schema === 'clarify') reports.unshift(checkAnswers({ root, change }), checkGrounding({ root, change }));
  for (const r of reports) for (const f of r.findings.filter((x) => x.level === 'error')) problems.push(`${r.check}: ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`);
  let cfg = null;
  try {
    cfg = loadVerifyConfig(root);
  } catch (e) {
    problems.push(e.message);
  }
  if (cfg?.api) {
    const code = fingerprint(root, change, { scope: 'code' });
    const diff = readState(root, `api-diff-${change}`);
    if (!existsSync(`${changeDir(root, change)}/api-changes.json`) || !diff) problems.push(`no API diff on record — run: node openspec/tooling/bin/api.mjs diff --change ${change}`);
    else if (code && diff.fingerprint !== code) problems.push(`the application changed after the API diff (${diff.at}) — run again: node openspec/tooling/bin/api.mjs diff --change ${change}`);
    else {
      for (const f of checkHandoff({ root, change }).findings.filter((x) => x.level === 'error')) problems.push(`check-handoff: ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}`);
      const snap = readState(root, 'api-snapshot');
      if (diff.operations > 0 && (!snap || (code && snap.fingerprint !== code))) problems.push('the API baseline is not updated for this change — run: node openspec/tooling/bin/api.mjs snapshot (and commit it)');
    }
  }
  problems.push(...testReviewProblems(changeDir(root, change)));
  if (!state) problems.push(`no full verification run on record — run: node openspec/tooling/bin/verify.mjs --change ${change}`);
  else {
    const fp = fingerprint(root, change);
    if (fp && state.fingerprint !== fp) problems.push(`files changed since the last verification (${state.at}) — run again: node openspec/tooling/bin/verify.mjs --change ${change}`);
    if (!state.ok) problems.push('the last verification failed');
    else if (!state.complete) problems.push(`manual checks have no human result yet: ${(state.manualPending || []).join(', ')} — a human records them in verification.md, then run verify again`);
  }
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
  return messages.length ? `sdd-kit archive-gate: ${messages.join('\n')}\nArchive only verified changes (openspec/protocols/testing.md §6).` : null;
}

if (isMain(import.meta.url)) {
  runHook('archive-gate', (input) => {
    const message = archiveGate(input);
    if (message) block(message);
  });
}
