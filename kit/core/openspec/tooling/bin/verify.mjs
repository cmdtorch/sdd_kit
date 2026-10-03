#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Verifies a change with the project's commands (openspec/tooling/verify.yaml) and writes
// verification.md from real test results.
//
//   node openspec/tooling/bin/verify.mjs --change <name>            full suite + gate + E2E (as gates.e2e)
//   node openspec/tooling/bin/verify.mjs --change <name> --scoped   only the tests marked for this change
//   options: --e2e off|scoped|full   --no-write   --json   --root <dir>
// Exit 0 when every command passed and every automated row is Met (manual rows are reported).
import { runVerification, VerifyError } from '../lib/verify-run.mjs';
import { VerifyConfigError } from '../lib/verify-config.mjs';
import { parseArgs } from '../lib/report.mjs';
import { findRoot } from '../lib/project.mjs';

const USAGE = `Usage: verify.mjs --change <name> [--scoped] [--e2e off|scoped|full] [--no-write] [--json] [--root <dir>]`;
const args = parseArgs(process.argv.slice(2), ['json', 'help', 'scoped', 'no-write']);
if (args.help || !args.change) {
  console.log(USAGE);
  process.exit(args.help ? 0 : 1);
}
const root = args.root || findRoot();
try {
  if (!root) throw new VerifyError('no openspec/ directory found');
  const r = runVerification({ root, change: args.change, mode: args.scoped ? 'scoped' : 'full', write: !args['no-write'], e2e: args.e2e });
  if (args.json) console.log(JSON.stringify(r, null, 2));
  else {
    const out = [`sdd-kit verify — change "${r.change}" (${r.mode})`];
    for (const c of r.commands) out.push(`  ${c.exitCode === 0 ? 'ok  ' : 'FAIL'} ${c.template} (${(c.durationMs / 1000).toFixed(1)} s)${c.summary ? ` — ${c.summary}` : ''}`);
    const by = (v) => r.rows.filter((x) => x.verdict === v);
    out.push(`  matrix: ${by('Met').length} Met, ${by('Not Met').length} Not Met, ${by('Unverified').length} Unverified`);
    for (const x of r.rows.filter((x) => x.verdict !== 'Met')) out.push(`    ${x.verdict}: ${x.scenario} (${x.capability}, ${x.level}) — ${x.actual}`);
    for (const p of r.problems) out.push(`  problem: ${p}`);
    if (!args['no-write']) out.push(`  wrote openspec/changes/${r.change}/verification.md`);
    out.push(r.ok ? (r.manualPending.length ? `OK for automated checks; ${r.manualPending.length} manual check(s) still need a human result in verification.md` : 'OK') : 'FAILED — fix the code (never weaken tests); see openspec/protocols/testing.md §7');
    console.log(out.join('\n'));
  }
  process.exit(r.ok ? 0 : 1);
} catch (e) {
  if (!(e instanceof VerifyError) && !(e instanceof VerifyConfigError)) throw e;
  console.error(`sdd-kit verify: ${e.message}`);
  process.exit(1);
}
