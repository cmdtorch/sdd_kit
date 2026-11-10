#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-apply-report — the implementation report apply-report.md of a change (openspec/protocols/apply.md):
// the three sections "Manual checks", "Not verified automatically" and "Weakened tests" ("None." when
// empty), a reason on every entry, steps and the expected outcome on every manual check, dangerous checks
// (`Reason: dangerous: …`) first and marked "required before release", a change and the developer's consent
// on every weakened test. An entry of "Not verified automatically" without a `Consent:` line is a warning
// (the consent list at the end of apply asks for it); the report lists them in `unconsented`, and the
// archive gate blocks on them. On a meta-repository change (x-sdd-kit-metarepo: true;
// openspec/protocols/metarepo.md) every repository named by a task group has one section
// `## Repository: <name>` with at least one `Command:` and one `Result:` line; a section for another
// repository is allowed (its lines are checked too) and the result is not judged. Skipped for schemas that are not kit schemas.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseApplyReport, entryKey, APPLY_REPORT, REQUIRED_MARK, SECTION_TITLES } from '../lib/apply-report.mjs';
import { isDangerous } from '../lib/plan.mjs';
import { changeDir, changeSchema, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { followsMetarepo } from '../lib/clones.mjs';
import { taskRepositories } from './check-tasks.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-apply-report';
const USAGE = `Usage: check-apply-report --change <name> [--root <dir>] [--json]

Checks openspec/changes/<name>/apply-report.md: the three sections, a reason on every entry, steps and the
expected outcome of manual checks, dangerous checks first, consent on weakened tests; lists the entries of
"Not verified automatically" that have no consent yet.`;

/** Fields every entry of a section needs. */
const REQUIRED = { manual: ['reason', 'steps', 'expected'], unverified: ['reason'], weakened: ['change', 'reason', 'consent'] };
const label = (field) => `"${field[0].toUpperCase()}${field.slice(1)}:"`;

/** Meta-repository change: a complete `## Repository: <name>` section per repository of the task groups. */
function checkRepositories({ root, change, doc, file, f }) {
  const seen = new Set();
  for (const r of doc.repositories) {
    if (seen.has(r.name)) {
      f.error(file, r.line, `\`${r.name}\` has two sections "## Repository: ${r.name}"`, 'merge them into one section');
      continue;
    }
    seen.add(r.name);
    if (!r.commands.length) f.error(file, r.line, `the section for \`${r.name}\` names no command (no "Command:" line)`, 'write the full-suite and quality-check commands you ran in that repository, or "Command: none" when it has no tests');
    if (!r.results.length) f.error(file, r.line, `the section for \`${r.name}\` has no result (no "Result:" line)`, 'write what the commands reported, or "Result: no tests"');
  }
  for (const name of taskRepositories(root, change)) {
    if (!seen.has(name)) f.error(file, null, `section "## Repository: ${name}" is missing: a task group names \`${name}\``, `run the full suite and quality checks of ${name} with its own commands and write "Command:" and "Result:" lines under "## Repository: ${name}" (openspec/protocols/metarepo.md)`);
  }
}

/** Runs the check. Options: { root, change }. */
export function checkApplyReport({ root, change }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);

  const f = findingsFor(root);
  const file = join(dir, APPLY_REPORT);
  const content = readChangeFile(root, change, APPLY_REPORT);
  if (content === null) {
    f.error(file, null, `${APPLY_REPORT} does not exist`, 'write it at the end of the tasks (openspec/protocols/apply.md)');
    return makeReport(CHECK, f.list, { change, entries: { manual: [], unverified: [], weakened: [] }, unconsented: [] });
  }
  const doc = parseApplyReport(content);
  for (const p of doc.problems) f.error(file, p.line, p.message);
  for (const [key, title] of Object.entries(SECTION_TITLES)) {
    const s = doc.sections[key];
    if (!s) f.error(file, null, `section "## ${title}" is missing`, 'the report has three sections; an empty one says "None."');
    else if (!doc.entries[key].length && !s.none) f.error(file, s.line, `"## ${title}" is empty; write "None."`);
    else if (doc.entries[key].length && s.none) f.error(file, s.line, `"## ${title}" says "None." but has entries`);
  }

  for (const [key, fields] of Object.entries(REQUIRED)) {
    for (const e of doc.entries[key]) {
      const what = key === 'weakened' ? `weakened "${e.name}" (${e.capability})` : `"${e.name}" (${e.capability}) under "${SECTION_TITLES[key]}"`;
      for (const field of fields) if (!e[field]) f.error(file, e.line, `${what} has no ${label(field)} line`);
    }
  }

  // dangerous checks first, each marked
  let seenOther = false;
  for (const e of doc.entries.manual) {
    if (!isDangerous(e.reason)) {
      seenOther = true;
      if (e.required) f.error(file, e.line, `manual check "${e.name}" (${e.capability}) is marked "${REQUIRED_MARK}" but its reason does not start with "dangerous:"`);
      continue;
    }
    if (!e.required) f.error(file, e.line, `dangerous check "${e.name}" (${e.capability}) is not marked "${REQUIRED_MARK}"`, `write "### ${entryKey(e)} — ${REQUIRED_MARK}"`);
    if (seenOther) f.error(file, e.line, `dangerous check "${e.name}" (${e.capability}) must come before the other manual checks`);
  }

  if (followsMetarepo(root, change)) checkRepositories({ root, change, doc, file, f });

  const unconsented = doc.entries.unverified.filter((e) => !e.consent);
  for (const e of unconsented) {
    f.warning(file, e.line, `"${e.name}" (${e.capability}) under "Not verified automatically" has no "Consent:" line`, 'ask the developer in the consent list at the end of apply (openspec/protocols/apply.md); the archive waits for it');
  }
  return makeReport(CHECK, f.list, { change, entries: doc.entries, unconsented: unconsented.map(entryKey) });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkApplyReport({ root, change: args.change }));
}
