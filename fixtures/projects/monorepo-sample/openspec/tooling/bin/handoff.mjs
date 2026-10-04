#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Frontend side of the handoff (openspec/protocols/handoff.md §4): starts a frontend change from a backend
// change's handoff. The backend repository is the source of truth and is only read (decision D7).
//
//   node openspec/tooling/bin/handoff.mjs import --from <backend-repo> --change <backend-change> [--as <name>]
//   node openspec/tooling/bin/handoff.mjs import --from-store <store-id> --change <backend-change> [--as <name>]
//   node openspec/tooling/bin/handoff.mjs list [--from-store <store-id>]   backend handoffs and whether imported
//
// Creates openspec/changes/<name>/ (schema clarify) with:
//   sources/D1-backend-handoff.md   the backend's frontend-handoff.md
//   sources/D2-backend-specs.md     the backend change's delta specs (behaviour, errors)
// The backend change may be active or archived (openspec/changes/archive/<date>-<change>).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, isMain } from '../lib/report.mjs';
import { findRoot } from '../lib/project.mjs';
import { findSpecFiles } from '../lib/spec-parser.mjs';
import { storeRoot, referencedStores, backendHandoffs, importedHandoffs } from '../lib/stores.mjs';

export class HandoffError extends Error {}

/** Path of a backend change, active or archived (latest archive wins). */
export function findBackendChange(backendRoot, name) {
  const active = join(backendRoot, 'openspec', 'changes', name);
  if (existsSync(active)) return active;
  const archive = join(backendRoot, 'openspec', 'changes', 'archive');
  if (existsSync(archive)) {
    const hits = readdirSync(archive).filter((d) => d.replace(/^\d{4}-\d{2}-\d{2}-/, '') === name).sort();
    if (hits.length) return join(archive, hits[hits.length - 1]);
  }
  return null;
}

/** Backend repo path from --from or --from-store (a registered OpenSpec store, D24). */
export function resolveBackend({ from, fromStore }) {
  if (from) return from;
  if (!fromStore) return null;
  const p = storeRoot(fromStore);
  if (!p) throw new HandoffError(`store "${fromStore}" is not registered on this machine (openspec store register <path> --id ${fromStore} --yes)`);
  return p;
}

export function importHandoff({ root, from, fromStore, change, as }) {
  from = resolveBackend({ from, fromStore });
  if (!from || !change) throw new HandoffError('--from <backend-repo> (or --from-store <id>) and --change <backend-change> are required');
  const backendRoot = resolve(from);
  if (!existsSync(join(backendRoot, 'openspec'))) throw new HandoffError(`${backendRoot} has no openspec/ directory`);
  const src = findBackendChange(backendRoot, change);
  if (!src) throw new HandoffError(`backend change "${change}" not found in ${backendRoot}/openspec/changes (active or archived)`);
  const handoffFile = join(src, 'frontend-handoff.md');
  if (!existsSync(handoffFile)) throw new HandoffError(`backend change "${change}" has no frontend-handoff.md (no API change, or the handoff was not written)`);
  if (!existsSync(join(root, 'openspec', 'schemas', 'clarify'))) throw new HandoffError('this project has no sdd-kit "clarify" schema — install the kit first');
  const name = as || `${change}-ui`;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw new HandoffError(`change name "${name}" must be kebab-case`);
  const dest = join(root, 'openspec', 'changes', name);
  if (existsSync(dest)) throw new HandoffError(`change "${name}" already exists`);

  const origin = `${backendRoot} — change "${change}" (${src.includes('/archive/') ? 'archived' : 'active'})`;
  const specs = findSpecFiles(join(src, 'specs'))
    .map(({ capability, file }) => `## Capability: ${capability}\n\n${readFileSync(file, 'utf8').replace(/^## /gm, '### ').replace(/^### Requirement/gm, '#### Requirement').replace(/^#### Scenario/gm, '##### Scenario').trim()}\n`)
    .join('\n');
  mkdirSync(join(dest, 'sources'), { recursive: true });
  writeFileSync(join(dest, '.openspec.yaml'), `schema: clarify\ncreated: ${new Date().toISOString().slice(0, 10)}\n`);
  writeFileSync(join(dest, 'sources', 'D1-backend-handoff.md'), `<!-- Imported by sdd-kit handoff.mjs from ${origin}. Read-only copy: the backend repository is the source of truth. -->\n\n${readFileSync(handoffFile, 'utf8')}`);
  writeFileSync(join(dest, 'sources', 'D2-backend-specs.md'), `<!-- Imported by sdd-kit handoff.mjs from ${origin}. Backend delta specs (behaviour and errors), for reference only. -->\n\n# Backend specs — ${change}\n\n${specs || '_No delta specs._\n'}`);
  return { change: name, dir: dest, sources: ['sources/D1-backend-handoff.md', 'sources/D2-backend-specs.md'], origin };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['help', 'json']);
  if (args.help || !['import', 'list'].includes(args._[0])) {
    console.log('Usage: handoff.mjs import (--from <backend-repo> | --from-store <id>) --change <backend-change> [--as <frontend-change>] [--json]\n       handoff.mjs list [--from-store <id>] [--json]');
    process.exit(args.help ? 0 : 1);
  }
  try {
    const root = args.root || findRoot();
    if (!root) throw new HandoffError('no openspec/ directory found');
    if (args._[0] === 'list') {
      const ids = args['from-store'] ? [args['from-store']] : referencedStores(root);
      const imported = importedHandoffs(root);
      const rows = [];
      for (const id of ids) {
        const path = resolveBackend({ fromStore: id });
        for (const h of backendHandoffs(path)) rows.push({ store: id, change: h.change, archived: h.archived, imported: imported.has(h.change) });
      }
      console.log(args.json ? JSON.stringify(rows, null, 2) : rows.length ? rows.map((r) => `${r.imported ? 'imported' : 'READY   '} ${r.store}: ${r.change}${r.archived ? ' (archived)' : ''}`).join('\n') : 'No backend handoffs found.');
      process.exit(0);
    }
    const r = importHandoff({ root, from: args.from, fromStore: args['from-store'], change: args.change, as: args.as });
    console.log(
      args.json
        ? JSON.stringify(r, null, 2)
        : `Created change "${r.change}" from ${r.origin}\n  sources: ${r.sources.join(', ')}\nNext: run /opsx:continue ${r.change} — the questions cover UI/UX only; API gaps become questions for the backend (openspec/protocols/handoff.md §4).`,
    );
  } catch (e) {
    if (!(e instanceof HandoffError)) throw e;
    console.error(`sdd-kit handoff: ${e.message}`);
    process.exit(1);
  }
}
