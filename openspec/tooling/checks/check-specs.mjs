#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-specs — delta-spec rules OpenSpec does not enforce before archive (docs/openspec-facts.md V5, V6), the
// rules `openspec validate --strict` 2.2.0 fails on, caught while the spec is written, and the kit's own rules:
//   - a new capability has `## Purpose` of 50+ characters
//   - ADDED requirement text is at most 500 characters (`validate --strict` fails on it too)
//   - a MODIFIED requirement over 500 characters: an error when it is longer than the same requirement of the main
//     spec (the OpenSpec 2.2.0 rule, dist/core/validation/validator.js); a warning when it did not grow or the main
//     spec has no such requirement (the specs instruction says to keep an existing requirement whole)
//   - scenarios use `#### Scenario: <name>`; names are unique within a capability (they are test keys)
//   - every scenario has a trigger step (WHEN or GIVEN) and an outcome step (THEN), read as OpenSpec 2.2.0
//     `scenarioStepCoverage` reads them (dist/core/parsers/requirement-text.js): bold in any case with an optional
//     colon (`**When**`, `__GIVEN:__`) or a bare upper-case word anywhere in a line; the header and fenced lines
//     do not count
//   - no source tags or change-local IDs in spec text ([Q3], [D1], [desc], [assumption], FR1, NFR2)
//   - no `###` headers that OpenSpec silently skips inside delta sections
// The step rule and the MODIFIED growth rule are errors on a change stamped 0.8.0 or later (lib/project.mjs
// SPEC_STEPS_VERSION) and warnings on an earlier or unstamped change.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChangeDeltas, parseMainSpec } from '../lib/spec-parser.mjs';
import { fenceMask } from '../lib/markdown.mjs';
import { changeDir, changeSchema, isKitSchema, changeKitVersion, versionAtLeast, SPEC_STEPS_VERSION } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-specs';
const USAGE = `Usage: check-specs --change <name> [--root <dir>] [--json]

Checks the delta specs of a clarify/lean change for rules OpenSpec does not enforce before archive.`;

const FORBIDDEN = /\[(Q\d+|D\d+|desc|assumption)\]|\b(N?FR\d+(\.\d+)?)\b/;
export const MAX_REQUIREMENT_TEXT = 500;
export const MIN_PURPOSE = 50;

// The step patterns of OpenSpec 2.2.0 `scenarioStepCoverage`: bold (`**` or `__`) in any case with an optional
// colon inside, or a bare upper-case word.
const BOLD_TRIGGER_STEP = /(?:\*\*|__)(?:WHEN|GIVEN):?(?:\*\*|__)/i;
const BARE_TRIGGER_STEP = /\b(?:WHEN|GIVEN)\b/;
const BOLD_OUTCOME_STEP = /(?:\*\*|__)THEN:?(?:\*\*|__)/i;
const BARE_OUTCOME_STEP = /\bTHEN\b/;

/** { hasTrigger, hasOutcome } of a scenario body (the lines under its header), fenced lines skipped. */
export function scenarioSteps(body) {
  const lines = String(body).replace(/\r\n?/g, '\n').split('\n');
  const mask = fenceMask(lines);
  let hasTrigger = false;
  let hasOutcome = false;
  lines.forEach((line, i) => {
    if (mask[i]) return;
    if (BOLD_TRIGGER_STEP.test(line) || BARE_TRIGGER_STEP.test(line)) hasTrigger = true;
    if (BOLD_OUTCOME_STEP.test(line) || BARE_OUTCOME_STEP.test(line)) hasOutcome = true;
  });
  return { hasTrigger, hasOutcome };
}

export function checkSpecs({ root, change }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);

  const f = findingsFor(root);
  // the rules of openspec validate 2.2.0 block only changes started under them
  const strict = versionAtLeast(changeKitVersion(root, change), SPEC_STEPS_VERSION);
  const report = (...args) => (strict ? f.error(...args) : f.warning(...args));
  const deltas = loadChangeDeltas(root, dir);
  for (const { capability, file, delta, isNew } of deltas) {
    const content = readFileSync(file, 'utf8').split('\n');
    content.forEach((line, k) => {
      const m = line.match(FORBIDDEN);
      if (m) f.error(file, k + 1, `"${m[0]}" in spec text`, 'specs carry no source tags or change-local IDs; traceability lives in verification-plan.md');
    });
    for (const s of delta.skipped) {
      f.error(file, s.line, `"### ${s.header}" in "${s.section}" is not a "### Requirement:" header; OpenSpec ignores it`);
    }
    const hasAdded = delta.added.length > 0;
    if (isNew && hasAdded) {
      if (!delta.purpose) f.error(file, null, `new capability "${capability}" has no "## Purpose" section`, 'archive copies it into the new main spec');
      else if (delta.purpose.text.length < MIN_PURPOSE) {
        f.error(file, delta.purpose.line, `Purpose is ${delta.purpose.text.length} characters (minimum ${MIN_PURPOSE})`, 'OpenSpec fails --strict on the main spec after archive otherwise');
      }
    } else if (!isNew && delta.purpose) {
      f.warning(file, delta.purpose.line, `"## Purpose" in a delta for existing capability "${capability}" is ignored by OpenSpec`, `edit openspec/specs/${capability}/spec.md instead`);
    }

    // scenario names must be unique per capability (delta + unchanged requirements of the main spec)
    const touched = new Set([...delta.modified, ...delta.removed].map((r) => r.name));
    const taken = new Map();
    const current = new Map();
    const mainFile = join(root, 'openspec', 'specs', ...capability.split('/'), 'spec.md');
    if (!isNew && existsSync(mainFile)) {
      for (const r of parseMainSpec(readFileSync(mainFile, 'utf8')).requirements) {
        current.set(r.name, r);
        if (touched.has(r.name)) continue;
        for (const s of r.scenarios) taken.set(s.name, `requirement "${r.name}" in the main spec`);
      }
    }
    // archive applies RENAMED before MODIFIED: a MODIFIED under the new name is compared with the old block
    const renamedFrom = new Map(delta.renamed.map((x) => [x.to, x.from]));
    const currentOf = (name) => current.get(name) || current.get(renamedFrom.get(name));
    for (const r of [...delta.added, ...delta.modified]) {
      if (r.text.length > MAX_REQUIREMENT_TEXT) {
        const message = `requirement "${r.name}" text is ${r.text.length} characters (maximum ${MAX_REQUIREMENT_TEXT})`;
        if (delta.added.includes(r)) f.error(file, r.line, message, 'state one behaviour per requirement: move examples and edge cases into scenarios, or split it');
        else {
          const before = currentOf(r.name);
          if (before && r.text.length > before.text.length) {
            report(file, r.line, `${message}, longer than the ${before.text.length} characters of the main spec`, 'openspec validate --strict fails on a MODIFIED requirement that grows past the limit: shorten it to the main spec\'s length or less, moving detail into scenarios');
          } else {
            f.warning(file, r.line, message, 'keep an existing requirement whole under MODIFIED; split it only in a change made for that purpose');
          }
        }
      }
      if (!r.scenarios.length) f.error(file, r.line, `requirement "${r.name}" has no scenario`);
      for (const s of r.scenarios) {
        if (!s.wellFormed) f.error(file, s.line, `"#### ${s.header}" is not "#### Scenario: <name>"`, 'OpenSpec counts any #### header as a scenario; name it explicitly');
        const { hasTrigger, hasOutcome } = scenarioSteps(s.body);
        if (!hasTrigger) report(file, s.line, `scenario "${s.name}" has no WHEN or GIVEN step`, 'add a "- **WHEN** ..." or "- **GIVEN** ..." line; openspec validate --strict fails without it (a keyword in the scenario name or in fenced code does not count)');
        if (!hasOutcome) report(file, s.line, `scenario "${s.name}" has no THEN step`, 'add a "- **THEN** ..." line; openspec validate --strict fails without it');
        if (taken.has(s.name)) f.error(file, s.line, `scenario name "${s.name}" is already used by ${taken.get(s.name)}`, `scenario names are test marker keys and must be unique within "${capability}"`);
        else taken.set(s.name, `requirement "${r.name}" (line ${s.line})`);
      }
    }
  }
  return makeReport(CHECK, f.list, { change, capabilities: deltas.map((d) => d.capability) });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkSpecs({ root, change: args.change }));
}
