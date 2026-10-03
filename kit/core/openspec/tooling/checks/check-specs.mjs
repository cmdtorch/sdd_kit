#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-specs — delta-spec rules OpenSpec 1.13.0 does not enforce before archive
// (docs/openspec-facts.md V5, V6) plus the kit's own rules:
//   - a new capability has `## Purpose` of 50+ characters
//   - requirement text is at most 500 characters
//   - scenarios use `#### Scenario: <name>`; names are unique within a capability (they are test keys)
//   - every scenario has a THEN
//   - no source tags or change-local IDs in spec text ([Q3], [D1], [desc], [assumption], FR1, NFR2)
//   - no `###` headers that OpenSpec silently skips inside delta sections
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChangeDeltas, parseMainSpec } from '../lib/spec-parser.mjs';
import { changeDir, changeSchema, isKitSchema } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-specs';
const USAGE = `Usage: check-specs --change <name> [--root <dir>] [--json]

Checks the delta specs of a clarify/lean change for rules OpenSpec does not enforce before archive.`;

const FORBIDDEN = /\[(Q\d+|D\d+|desc|assumption)\]|\b(N?FR\d+(\.\d+)?)\b/;
export const MAX_REQUIREMENT_TEXT = 500;
export const MIN_PURPOSE = 50;

export function checkSpecs({ root, change }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);

  const f = findingsFor(root);
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
    const mainFile = join(root, 'openspec', 'specs', ...capability.split('/'), 'spec.md');
    if (!isNew && existsSync(mainFile)) {
      for (const r of parseMainSpec(readFileSync(mainFile, 'utf8')).requirements) {
        if (touched.has(r.name)) continue;
        for (const s of r.scenarios) taken.set(s.name, `requirement "${r.name}" in the main spec`);
      }
    }
    for (const r of [...delta.added, ...delta.modified]) {
      if (r.text.length > MAX_REQUIREMENT_TEXT) {
        f.error(file, r.line, `requirement "${r.name}" text is ${r.text.length} characters (maximum ${MAX_REQUIREMENT_TEXT})`, 'split it into several requirements');
      }
      if (!r.scenarios.length) f.error(file, r.line, `requirement "${r.name}" has no scenario`);
      for (const s of r.scenarios) {
        if (!s.wellFormed) f.error(file, s.line, `"#### ${s.header}" is not "#### Scenario: <name>"`, 'OpenSpec counts any #### header as a scenario; name it explicitly');
        if (!/\*\*THEN\*\*|^\s*[-*]\s*THEN\b/m.test(s.body)) f.warning(file, s.line, `scenario "${s.name}" has no THEN`);
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
