#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-verification — verification.md covers every row of verification-plan.md and every verdict is
// `Met` with evidence. `Not Met` and `Unverified` fail (openspec/protocols/testing.md §6). Used by the
// archive gate and CI.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlan, parseVerification, VERDICTS, key, isEmptyCell } from '../lib/plan.mjs';
import { changeDir, changeSchema, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-verification';
const USAGE = `Usage: check-verification --change <name> [--root <dir>] [--json]

Checks that verification.md has a "Met" verdict with evidence for every row of verification-plan.md.`;

export function checkVerification({ root, change }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);

  const f = findingsFor(root);
  const planPath = join(dir, 'verification-plan.md');
  const verPath = join(dir, 'verification.md');
  const planContent = readChangeFile(root, change, 'verification-plan.md');
  const verContent = readChangeFile(root, change, 'verification.md');
  if (planContent === null) f.error(planPath, null, 'verification-plan.md does not exist');
  if (verContent === null) {
    f.error(verPath, null, 'verification.md does not exist', 'it is written at the end of apply (openspec/protocols/testing.md §6)');
    return makeReport(CHECK, f.list, { change });
  }
  const ver = parseVerification(verContent);
  if (!ver.matrix.present) f.error(verPath, null, '"## Verification matrix" section is missing');
  else if (ver.matrix.noTable) f.error(verPath, ver.matrix.line, '"## Verification matrix" has no table');

  const rowsByKey = new Map();
  for (const r of ver.matrix.rows) {
    const k = `${r.level}|${key(r.capability, r.scenario)}`;
    if (rowsByKey.has(k)) f.warning(verPath, r.line, `"${r.scenario}" (${r.level}) appears twice in the matrix`);
    rowsByKey.set(k, r);
    if (!VERDICTS.includes(r.verdict)) {
      f.error(verPath, r.line, `verdict "${r.verdict}" for "${r.scenario}" is not one of ${VERDICTS.join(', ')}`);
    } else if (r.verdict !== 'Met') {
      f.error(verPath, r.line, `"${r.scenario}" (${r.level}) is ${r.verdict}`, r.verdict === 'Unverified' ? 'Unverified counts as a failure: run the check or record the manual result' : 'fix the behaviour; never weaken the test');
    } else if (isEmptyCell(r.evidence)) {
      f.error(verPath, r.line, `"${r.scenario}" is Met without evidence`, 'name the test and its result, or the manual check and who did it');
    }
  }
  if (planContent !== null) {
    const plan = parsePlan(planContent);
    const plannedKeys = new Set();
    for (const p of plan.coverage.rows) {
      const k = `${p.level}|${key(p.capability, p.scenario)}`;
      plannedKeys.add(k);
      if (!rowsByKey.has(k)) f.error(verPath, null, `planned "${p.scenario}" (${p.capability}, ${p.level}) is missing from the matrix`, `plan row: verification-plan.md:${p.line}`);
    }
    for (const [k, r] of rowsByKey) {
      if (!plannedKeys.has(k)) f.warning(verPath, r.line, `matrix row "${r.scenario}" (${r.level}) is not in verification-plan.md`);
    }
  }
  if (!ver.commands.present) f.warning(verPath, null, '"## Commands run" section is missing');
  else if (!ver.commands.count) f.warning(verPath, ver.commands.line, '"## Commands run" lists no commands');
  return makeReport(CHECK, f.list, { change });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkVerification({ root, change: args.change }));
}
