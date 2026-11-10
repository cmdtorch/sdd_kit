#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Runs the E2E tests of a change and records the run (openspec/protocols/e2e.md). The only way E2E results
// reach the change: check-e2e trusts nothing else.
//   node openspec/tooling/bin/e2e-run.mjs --change <name> [-- <playwright args>]
//   node openspec/tooling/bin/e2e-run.mjs --change <name> --state
// Reads e2e.md of the change (the "Tests:" folder and "Start:"), runs `npx playwright test --reporter=json
// [args]` in the test folder (with E2E_BASE_URL set when the developer starts the application), and appends
// the run to <change>/e2e-runs.json: the result of each test with the @case / @scenario references above it,
// the retries setting, and the fingerprints of the project (lib/e2e-runs.mjs). Playwright's exit code is
// passed through: a run with a failing test is still recorded.
// --state prints the current state id, for "## No new run needed" in e2e.md.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { parseArgs } from '../lib/report.mjs';
import { findRoot, changeDir, readChangeFile } from '../lib/project.mjs';
import { parseE2eRecord, E2E_FILE, SKIPPED, MODES } from '../lib/e2e-record.mjs';
import { normFolder, projectState, stateId, parsePlaywrightReport, withRefs, appendRun } from '../lib/e2e-runs.mjs';

const NAME = 'sdd-kit e2e-run';
const USAGE = `Usage: e2e-run.mjs --change <name> [--root <dir>] [-- <playwright args>]
       e2e-run.mjs --change <name> --state

Runs \`npx playwright test --reporter=json\` in the E2E test folder named in ${E2E_FILE} and records the
run in the change's e2e-runs.json. Arguments after \`--\` go to Playwright (for example a test file or
-g "<title>"). --state prints the current state id for "## No new run needed".`;

function fail(message, code = 1) {
  console.error(`${NAME}: ${message}`);
  process.exit(code);
}

const argv = process.argv.slice(2);
const dash = argv.indexOf('--');
const own = dash === -1 ? argv : argv.slice(0, dash);
const passThrough = dash === -1 ? [] : argv.slice(dash + 1);
const args = parseArgs(own, ['state', 'help']);
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!args.change) fail(`--change is required\n\n${USAGE}`);

const root = args.root || findRoot();
if (!root) fail('no openspec/ directory found (run inside the project or pass --root)');
if (!existsSync(changeDir(root, args.change))) fail(`change "${args.change}" not found`);

const content = readChangeFile(root, args.change, E2E_FILE);
if (content === null) fail(`the change has no ${E2E_FILE}: record the E2E decision first (openspec/protocols/e2e.md)`);
const record = parseE2eRecord(content);
if (record.mode === SKIPPED) fail(`E2E is skipped for this change (${E2E_FILE}: "Mode: ${SKIPPED}"); nothing to run`);
if (!MODES.includes(record.mode)) fail(`${E2E_FILE} has no valid mode (allowed: ${MODES.join(', ')})`);
if (!record.tests) fail(`${E2E_FILE} names no E2E test folder ("Tests:")`);
const folder = normFolder(record.tests);
const cwd = join(root, folder);
if (!folder || !existsSync(cwd) || !statSync(cwd).isDirectory()) fail(`the E2E test folder "${record.tests}" does not exist`);

if (args.state) {
  console.log(stateId(projectState(root, folder).appState));
  process.exit(0);
}

const env = { ...process.env };
if (record.start?.kind === 'developer') {
  if (!record.start.url) fail(`${E2E_FILE}: the developer starts the application, but the application address is missing`);
  env.E2E_BASE_URL = record.start.url;
}

// The JSON reporter writes to PLAYWRIGHT_JSON_OUTPUT_NAME when set, otherwise to stdout.
const tmp = mkdtempSync(join(tmpdir(), 'sdd-kit-e2e-'));
const reportFile = join(tmp, 'report.json');
env.PLAYWRIGHT_JSON_OUTPUT_NAME = reportFile;
const pwArgs = ['playwright', 'test', '--reporter=json', ...passThrough];
console.log(`${NAME}: npx ${pwArgs.join(' ')}  (in ${folder}/)`);
const res = spawnSync('npx', pwArgs, { cwd, env, encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'], maxBuffer: 512 * 1024 * 1024 });
if (res.error) {
  rmSync(tmp, { recursive: true, force: true });
  fail(`could not run npx: ${res.error.message}`);
}
const code = res.status ?? 1;

let report = null;
const sources = [existsSync(reportFile) ? readFileSync(reportFile, 'utf8') : null, res.stdout ?? ''];
rmSync(tmp, { recursive: true, force: true });
for (const text of sources) {
  if (!text) continue;
  report = parseJson(text);
  if (report) break;
}
if (!report) {
  if (res.stdout) process.stderr.write(res.stdout.slice(-4000));
  fail(`Playwright produced no JSON report (exit code ${code}); no run recorded`, code || 1);
}

const parsed = parsePlaywrightReport(report, { root, cwd });
for (const e of report.errors ?? []) console.error(`${NAME}: Playwright error: ${firstLine(e.message ?? e.value ?? JSON.stringify(e))}`);
if (!parsed.tests.length) fail(`no test ran (exit code ${code}); no run recorded`, code || 1);

const state = projectState(root, folder);
const run = {
  at: new Date().toISOString(),
  retries: parsed.retries,
  tests: withRefs(root, parsed.tests),
  appState: state.appState,
  testFiles: state.testFiles,
};
const file = appendRun(root, args.change, run);

const count = (s) => run.tests.filter((t) => t.status === s).length;
console.log(
  `${NAME}: ${run.tests.length} test(s): ${count('passed')} passed, ${count('failed')} failed, ${count('skipped')} skipped; retries ${run.retries ?? 'unknown'}; state ${stateId(run.appState)}`,
);
for (const t of run.tests.filter((x) => x.status === 'failed')) console.log(`  FAILED ${t.file}:${t.line} ${t.title}`);
const unreferenced = run.tests.filter((t) => !t.refs.cases.length && !t.refs.scenarios.length);
if (unreferenced.length) console.log(`  ${unreferenced.length} test(s) carry no @case / @scenario reference`);
if (run.retries !== 0) console.log(`  retries must be 0: set "retries: 0" in the Playwright config`);
console.log(`${NAME}: run recorded in ${relative(root, file)}`);
process.exit(code);

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/^\{/m);
    if (start === -1) return null;
    try {
      return JSON.parse(text.slice(start));
    } catch {
      return null;
    }
  }
}

function firstLine(s) {
  return String(s).split('\n')[0];
}
