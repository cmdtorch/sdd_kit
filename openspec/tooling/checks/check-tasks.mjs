#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-tasks — the repository of every task group of a change that follows the meta-repository rules
// (x-sdd-kit-metarepo: true in .openspec.yaml; openspec/protocols/metarepo.md). Every group heading names
// exactly one repository at its start, `## 2. [backend] Order API`: a clone name of openspec/clones or `root`.
// Only the last group of two or more (the final checks) may name none. A group that names a declared clone
// missing on disk is reported as missing. Other changes, and a change while openspec/clones is missing
// (check-traceability reports that), have nothing to check.
// answers-gate runs it on the content about to be written (`content`), artifact-feedback after tasks.md is
// written, and the archive gate before the archive.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { taskGroups } from '../lib/markdown.mjs';
import { readClones, followsMetarepo, ROOT_REPOSITORY } from '../lib/clones.mjs';
import { changeDir, changeSchema, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-tasks';
const USAGE = `Usage: check-tasks --change <name> [--root <dir>] [--json]

Checks that every task group of a meta-repository change names its repository:
"## <n>. [<name>] <title>", a clone of openspec/clones or root; the last of two or more groups may name none.`;

/**
 * The repositories named by the task groups of a change: one name per group with exactly one tag, in the
 * order of the groups, without repeats. `content` replaces tasks.md when given.
 */
export function taskRepositories(root, change, content = null) {
  const text = content ?? readChangeFile(root, change, 'tasks.md') ?? '';
  const out = [];
  for (const g of taskGroups(text)) if (g.repositories?.length === 1 && !out.includes(g.repositories[0])) out.push(g.repositories[0]);
  return out;
}

/** Runs the check. Options: { root, change, content } (`content`: tasks.md about to be written). */
export function checkTasks({ root, change, content = null }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);
  const f = findingsFor(root);
  if (!followsMetarepo(root, change)) return makeReport(CHECK, f.list, { change });
  const list = readClones(root);
  if (!list.present) return makeReport(CHECK, f.list, { change });

  const file = join(dir, 'tasks.md');
  const text = content ?? readChangeFile(root, change, 'tasks.md') ?? '';
  const names = [ROOT_REPOSITORY, ...list.clones.map((c) => c.name)];
  const byName = new Map(list.clones.map((c) => [c.name, c]));
  const groups = taskGroups(text);
  const hint = (g) => `start the heading with one repository: "## ${g.number}. [<name>] ${g.title}", where <name> is ${names.join(', ')} (openspec/protocols/metarepo.md)`;
  groups.forEach((g, idx) => {
    const what = `task group "${g.title}" (## ${g.number})`;
    const last = groups.length > 1 && idx === groups.length - 1;
    if (!g.repositories || !g.repositories.length) {
      if (!last) f.error(file, g.line, `${what} names no repository`, hint(g));
      return;
    }
    if (g.repositories.length > 1) {
      f.error(file, g.line, `${what} names ${g.repositories.length} repositories (${g.repositories.join(', ')}); a group names exactly one repository`, 'split it into one group per repository');
      return;
    }
    const [name] = g.repositories;
    if (!names.includes(name)) f.error(file, g.line, `${what} names the unknown repository \`${name}\` (known: ${names.join(', ')})`, hint(g));
    else if (byName.has(name) && !byName.get(name).exists) f.error(file, g.line, `the clone \`${name}\` at ${byName.get(name).path} is missing; it is named by the ${what}`, 'clone it into its folder, or fix openspec/clones');
  });
  return makeReport(CHECK, f.list, { change, repositories: taskRepositories(root, change, text) });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkTasks({ root, change: args.change }));
}
