#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// API baseline and diff for the frontend handoff (openspec/protocols/handoff.md).
//   node openspec/tooling/bin/api.mjs diff --change <name>   what this change does to the API → api-changes.json
//   node openspec/tooling/bin/api.mjs snapshot               update the committed baseline (end of a change)
//   node openspec/tooling/bin/api.mjs check                  exit 1 when the API differs from the baseline (CI)
import { diffChange, snapshotApi, checkApi } from '../lib/api.mjs';
import { VerifyError } from '../lib/verify-run.mjs';
import { VerifyConfigError } from '../lib/verify-config.mjs';
import { parseArgs } from '../lib/report.mjs';
import { findRoot } from '../lib/project.mjs';

const USAGE = 'Usage: api.mjs diff --change <name> | snapshot | check   [--json] [--root <dir>]';
const args = parseArgs(process.argv.slice(2), ['json', 'help']);
const cmd = args._[0];
const root = args.root || findRoot();
const print = (human, data) => console.log(args.json ? JSON.stringify(data, null, 2) : human);
try {
  if (args.help || !cmd) {
    console.log(USAGE);
    process.exit(args.help ? 0 : 1);
  }
  if (!root) throw new VerifyError('no openspec/ directory found');
  if (cmd === 'diff') {
    if (!args.change) throw new VerifyError('--change is required');
    const r = diffChange(root, args.change);
    const lines = [`API changes of "${args.change}" against ${r.baseline}: ${r.operations.length} operation(s)`];
    for (const o of r.operations) {
      lines.push(`  ${o.change.padEnd(8)} ${o.breaking ? 'BREAKING ' : ''}${o.method} ${o.path}`);
      for (const d of o.details) lines.push(`      ${d.breaking ? '!' : '-'} ${d.text}`);
    }
    lines.push(r.operations.length ? `Wrote openspec/changes/${args.change}/api-changes.json — now write frontend-handoff.md (openspec/protocols/handoff.md).` : 'No API change: no frontend handoff is needed.');
    print(lines.join('\n'), r);
  } else if (cmd === 'snapshot') {
    const r = snapshotApi(root);
    print(r.changed ? `Updated the API baseline ${r.path} — commit it with the change.` : `API baseline ${r.path} is already current.`, r);
  } else if (cmd === 'check') {
    const r = checkApi(root);
    print(r.ok ? 'API matches the baseline.' : `API differs from the baseline ${r.snapshot ?? ''}: ${r.message ?? r.operations.map((o) => `${o.change} ${o.method} ${o.path}`).join(', ')}.\nRun "api.mjs diff --change <name>", write the handoff, then "api.mjs snapshot".`, r);
    process.exit(r.ok ? 0 : 1);
  } else throw new VerifyError(`unknown command "${cmd}"\n${USAGE}`);
} catch (e) {
  if (!(e instanceof VerifyError) && !(e instanceof VerifyConfigError)) throw e;
  console.error(`sdd-kit api: ${e.message}`);
  process.exit(1);
}
