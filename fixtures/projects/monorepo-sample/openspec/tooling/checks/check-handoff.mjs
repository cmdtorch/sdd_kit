#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-handoff — frontend-handoff.md covers every operation of api-changes.json
// (openspec/protocols/handoff.md):
//   - a "### METHOD /path" section per operation
//   - added/modified: Permissions, Request, Response, Errors, Example; removed: Migration
//   - every breaking operation is listed under "## Breaking changes"
// No api-changes.json → nothing to check (the archive gate requires it when verify.yaml has `api`).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toLines, fenceMask, stripComments } from '../lib/markdown.mjs';
import { changeDir, changeSchema, isKitSchema, schemaOfDir, readIn } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-handoff';
const USAGE = `Usage: check-handoff --change <name> [--root <dir>] [--json]

Checks frontend-handoff.md against api-changes.json (written by "api.mjs diff").`;

export const HANDOFF = 'frontend-handoff.md';
const NEEDED = { added: ['Permissions', 'Request', 'Response', 'Errors', 'Example'], modified: ['Permissions', 'Request', 'Response', 'Errors', 'Example'], removed: ['Migration'] };
const normPath = (s) => s.replace(/`/g, '').trim();

/** Sections of the handoff: { "GET /path": {line, text} }, plus the breaking-changes body. */
export function parseHandoff(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences);
  const ops = {};
  let breaking = null;
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const l = fences[i] ? '' : lines[i];
    const h3 = l.match(/^###\s+`?([A-Z]+)\s+(\/\S*?)`?\s*$/);
    const h2 = l.match(/^##\s+(.+?)\s*$/);
    if (h3) {
      cur = { line: i + 1, text: '' };
      ops[`${h3[1]} ${normPath(h3[2])}`] = cur;
      continue;
    }
    if (h2 && !l.startsWith('###')) {
      cur = /^breaking changes$/i.test(h2[1]) ? (breaking = { line: i + 1, text: '' }) : null;
      continue;
    }
    if (cur) cur.text += lines[i] + '\n';
  }
  return { ops, breaking };
}

function hasLabel(text, label) {
  return new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*${label}(?:[^*]*)?:?\\*\\*|#{4,6}\\s*${label}\\b)`, 'im').test(text);
}

/** Options: { root, change, dir? } — `dir` checks a change directory elsewhere (e.g. an archived one). */
export function checkHandoff({ root, change, dir: dirOverride }) {
  if (!change && !dirOverride) throw new UsageError('--change is required');
  const dir = dirOverride || changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = dirOverride ? schemaOfDir(dir) ?? changeSchema(root, change) : changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);
  const f = findingsFor(root);
  const diffPath = join(dir, 'api-changes.json');
  if (!existsSync(diffPath)) return makeReport(CHECK, f.list, { change, operations: 0, note: 'no api-changes.json' });
  let diff;
  try {
    diff = JSON.parse(readFileSync(diffPath, 'utf8'));
  } catch (e) {
    f.error(diffPath, null, `cannot read api-changes.json: ${e.message}`);
    return makeReport(CHECK, f.list, { change });
  }
  const operations = diff.operations || [];
  if (!operations.length) return makeReport(CHECK, f.list, { change, operations: 0 });
  const handoffPath = join(dir, HANDOFF);
  const content = readIn(dir, HANDOFF);
  if (content === null) {
    f.error(handoffPath, null, `${operations.length} API operation(s) changed but ${HANDOFF} does not exist`, 'write it per openspec/protocols/handoff.md');
    return makeReport(CHECK, f.list, { change, operations: operations.length });
  }
  const h = parseHandoff(content);
  for (const op of operations) {
    const id = `${op.method} ${op.path}`;
    const sec = h.ops[id];
    if (!sec) {
      f.error(handoffPath, null, `no "### ${id}" section (operation ${op.change})`);
      continue;
    }
    for (const label of NEEDED[op.change] || []) {
      if (!hasLabel(sec.text, label)) f.error(handoffPath, sec.line, `"${id}" has no ${label}`, `add "- **${label}:** …"`);
    }
  }
  const breakingOps = operations.filter((o) => o.breaking);
  if (breakingOps.length) {
    if (!h.breaking) f.error(handoffPath, null, `${breakingOps.length} breaking operation(s) but no "## Breaking changes" section`);
    else
      for (const op of breakingOps) {
        const esc = op.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`${esc}(?![\\w{}/-])`).test(h.breaking.text)) f.error(handoffPath, h.breaking.line, `breaking change of ${op.method} ${op.path} is not listed under "## Breaking changes"`);
      }
  }
  const known = new Set(operations.map((o) => `${o.method} ${o.path}`));
  for (const [id, sec] of Object.entries(h.ops)) {
    if (!known.has(id)) f.warning(handoffPath, sec.line, `"${id}" is not in api-changes.json (stale section, or the diff is out of date)`);
  }
  return makeReport(CHECK, f.list, { change, operations: operations.length });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkHandoff({ root, change: args.change }));
}
