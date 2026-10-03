#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// artifact-feedback — PostToolUse hook (Write|Edit|MultiEdit). Never blocks. After a kit artifact is
// written it runs the matching check and hands the errors back to Claude, so they are fixed now
// instead of failing in CI:
//   clarifications.md → check-answers (format + rounds of existing artifacts)
//   proposal.md / design.md → check-grounding      specs/**.md → check-specs
//   verification-plan.md → check-traceability (plan + trace; markers are checked later)
//   verification.md → check-verification
// It also arms the Stop-hook test gate when the last task in tasks.md is checked off.
import { runHook, hookRoot, touchedFiles, addContext } from '../lib/hook-io.mjs';
import { locateInChange, changeSchema, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { isMain } from '../lib/report.mjs';
import { checkAnswers } from '../checks/check-answers.mjs';
import { checkGrounding } from '../checks/check-grounding.mjs';
import { checkSpecs } from '../checks/check-specs.mjs';
import { checkTraceability } from '../checks/check-traceability.mjs';
import { checkVerification } from '../checks/check-verification.mjs';
import { writeState, readState } from '../lib/state.mjs';
import { loadVerifyConfig } from '../lib/verify-config.mjs';

const MAX_LISTED = 10;

function checksFor(artifact, schema, root, change, rel) {
  switch (artifact) {
    case 'clarifications':
      return schema === 'clarify' ? [checkAnswers({ root, change })] : [];
    case 'proposal':
    case 'design':
      return schema === 'clarify' ? [checkGrounding({ root, change, file: rel })] : [];
    case 'specs':
      return [checkSpecs({ root, change })];
    case 'verification-plan':
      return [checkTraceability({ root, change, markers: null })];
    case 'verification':
      return [checkVerification({ root, change })];
    default:
      return [];
  }
}

/** Arms (all tasks done) or disarms the test gate for a change; returns a note for Claude or null. */
export function armGate(root, change) {
  const tasks = readChangeFile(root, change, 'tasks.md') || '';
  const done = (tasks.match(/^\s*-\s*\[[xX]\]/gm) || []).length;
  const open = (tasks.match(/^\s*-\s*\[ \]/gm) || []).length;
  const wasArmed = Boolean(readState(root, `armed-${change}`)?.armed);
  if (done > 0 && open === 0) {
    if (!wasArmed) writeState(root, `armed-${change}`, { armed: true, at: new Date().toISOString() });
    let cfg = null;
    try {
      cfg = loadVerifyConfig(root);
    } catch {
      return `sdd-kit: all tasks of "${change}" are checked, but openspec/tooling/verify.yaml is invalid — fix it so the change can be verified.`;
    }
    if (!cfg || cfg.gates.stop === 'off') return null;
    return wasArmed ? null : `sdd-kit: all tasks of "${change}" are checked. When you finish this turn the test gate runs the full verification (node openspec/tooling/bin/verify.mjs --change ${change}); run it yourself first and fix what fails.`;
  }
  if (wasArmed) writeState(root, `armed-${change}`, { armed: false, at: new Date().toISOString() });
  return null;
}

export function feedback(input) {
  const root = hookRoot(input);
  if (!root) return null;
  const out = [];
  let checkErrors = false;
  for (const path of touchedFiles(input)) {
    const loc = locateInChange(root, path);
    if (!loc || !loc.artifact) continue;
    const schema = changeSchema(root, loc.change);
    if (!isKitSchema(schema)) continue;
    if (loc.artifact === 'tasks') {
      const note = armGate(root, loc.change);
      if (note) out.push(note);
      continue;
    }
    for (const report of checksFor(loc.artifact, schema, root, loc.change, loc.rel)) {
      const errors = report.findings.filter((f) => f.level === 'error');
      if (!errors.length) continue;
      checkErrors = true;
      out.push(`sdd-kit ${report.check} found ${errors.length} problem(s) after writing ${loc.rel} (change "${loc.change}"):`);
      for (const f of errors.slice(0, MAX_LISTED)) out.push(`  - ${f.file ? `${f.file}${f.line ? `:${f.line}` : ''}: ` : ''}${f.message}${f.hint ? ` (${f.hint})` : ''}`);
      if (errors.length > MAX_LISTED) out.push(`  - ... and ${errors.length - MAX_LISTED} more`);
    }
  }
  if (!out.length) return null;
  if (checkErrors) out.push('Fix these now; CI runs the same checks.');
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  runHook('artifact-feedback', (input) => {
    const text = feedback(input);
    if (text) addContext('PostToolUse', text);
  });
}
