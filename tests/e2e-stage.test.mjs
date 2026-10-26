// The E2E stage (openspec/changes/add-e2e-stage): the parser of the stage record `e2e.md` (design D2) and
// the format checks of check-e2e (design D4).
// Every test builds a small change in a temp project and writes its `e2e.md`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseE2eRecord, E2E_FILE, MODES, SCREEN_RESULTS } from '../kit/openspec/tooling/lib/e2e-record.mjs';
import { checkE2e, E2E_CHECK_MODES } from '../kit/openspec/tooling/checks/check-e2e.mjs';
import { projectState, stateId, parsePlaywrightReport, normFolder, RUNS_FILE } from '../kit/openspec/tooling/lib/e2e-runs.mjs';
import { refsAbove } from '../kit/openspec/tooling/lib/markers.mjs';
import { playwrightReport, runE2e, fakeEnv } from './helpers/e2e.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sale-export';
const C = `openspec/changes/${CHANGE}`;

const GOOD = `# E2E Stage

Mode: real backend
Tests: e2e/
Start: command \`npm run e2e:serve\`
Note: —

## Scenarios
- inventory/sale-export :: Successful export

## Accepted cases
- inventory/sale-export :: Export of a month with two sales — export service sandbox is down

## Screens
| Screenshot | Result | Differences | Reason |
|---|---|---|---|
| 01-orders-list.png | no differences | — | — |
| 02-orders-list-mobile.png | accepted | new header colour | approved by the designer |

## No new run needed
- 7c1e09a2 — typo fix in an export label comment
`;

/** A temp project with one change of `schema`; writes `e2e.md` when `record` is a string. Returns the root. */
function project({ schema = 'clarify-ai-qa', record = GOOD } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-e2e-'));
  mkdirSync(join(root, C), { recursive: true });
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
  writeFileSync(join(root, C, '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-10-26\n`);
  if (record !== null) writeFileSync(join(root, C, E2E_FILE), record);
  return root;
}
/** GOOD with `from` replaced by `to`; fails when GOOD does not contain `from`. */
function variant(from, to) {
  assert.ok(GOOD.includes(from), `the good record does not contain: ${from}`);
  return GOOD.replace(from, to);
}
const run = (root, mode) => checkE2e({ root, change: CHANGE, ...(mode ? { mode } : {}) });
const errors = (report) => report.findings.filter((f) => f.level === 'error').map((f) => f.message);
function assertError(report, re) {
  assert.equal(report.ok, false, `expected an error matching ${re}, got none`);
  assert.ok(errors(report).some((m) => re.test(m)), `no error matches ${re}:\n${errors(report).join('\n')}`);
}

describe('e2e.md parser (design D2)', () => {
  test('constants', () => {
    assert.equal(E2E_FILE, 'e2e.md');
    assert.deepEqual(MODES, ['real backend', 'stubbed backend', 'skipped']);
    assert.deepEqual(SCREEN_RESULTS, ['no differences', 'differences', 'accepted']);
    assert.deepEqual(E2E_CHECK_MODES, ['format', 'archive']);
  });

  test('reads every line and section of the record', () => {
    const r = parseE2eRecord(GOOD);
    assert.deepEqual(r.problems, []);
    assert.equal(r.mode, 'real backend');
    assert.equal(r.tests, 'e2e/');
    assert.equal(r.start.kind, 'command');
    assert.equal(r.start.command, 'npm run e2e:serve');
    assert.equal(r.note, null);
    assert.deepEqual(r.scenarios.map(({ capability, scenario }) => ({ capability, scenario })), [{ capability: 'inventory/sale-export', scenario: 'Successful export' }]);
    assert.deepEqual(r.accepted.map(({ capability, name, reason }) => ({ capability, name, reason })), [
      { capability: 'inventory/sale-export', name: 'Export of a month with two sales', reason: 'export service sandbox is down' },
    ]);
    assert.deepEqual(r.screens.map(({ screenshot, result, differences, reason }) => ({ screenshot, result, differences, reason })), [
      { screenshot: '01-orders-list.png', result: 'no differences', differences: '', reason: '' },
      { screenshot: '02-orders-list-mobile.png', result: 'accepted', differences: 'new header colour', reason: 'approved by the designer' },
    ]);
    assert.deepEqual(r.noNewRun.map(({ state, what }) => ({ state, what })), [{ state: '7c1e09a2', what: 'typo fix in an export label comment' }]);
    assert.equal(r.screens[1].line, 18);
  });

  test('developer start with an address, unquoted command, a note', () => {
    const dev = parseE2eRecord(variant('Start: command `npm run e2e:serve`\nNote: —', 'Start: developer at http://localhost:3000\nNote: backend on staging data'));
    assert.deepEqual({ kind: dev.start.kind, url: dev.start.url }, { kind: 'developer', url: 'http://localhost:3000' });
    assert.equal(dev.note, 'backend on staging data');
    const cmd = parseE2eRecord(variant('Start: command `npm run e2e:serve`', 'Start: command pnpm --filter web dev'));
    assert.equal(cmd.start.command, 'pnpm --filter web dev');
  });
});

describe('check-e2e format checks (design D4)', () => {
  test('the good record passes the format checks', () => {
    const root = project();
    for (const mode of [undefined, 'format']) {
      const r = run(root, mode);
      assert.equal(r.ok, true, `${mode}: ${errors(r).join('\n')}`);
      assert.equal(r.skipped, undefined);
    }
    // archive mode adds the run checks: no folder, no run
    assertError(run(root, 'archive'), /the E2E stage has not run/);
  });

  // @scenario e2e/stage :: Unknown mode is reported
  test('unknown mode names the value and lists the modes', () => {
    const r = run(project({ record: variant('Mode: real backend', 'Mode: staging server') }));
    assertError(r, /"staging server".*"real backend", "stubbed backend", "skipped"|"staging server".*real backend, stubbed backend, skipped/);
    const msg = errors(r).find((m) => m.includes('staging server'));
    for (const m of MODES) assert.ok(msg.includes(m), `"${m}" is not listed in: ${msg}`);
  });

  test('a record without a Mode: line is reported', () => {
    assertError(run(project({ record: variant('Mode: real backend\n', '') })), /no "Mode:" line/);
  });

  // @scenario e2e/stage :: Missing test folder is reported
  test('real backend without a test folder', () => {
    const r = run(project({ record: variant('Tests: e2e/\n', '') }));
    assertError(r, /E2E test folder is missing/);
    const r2 = run(project({ record: variant('Tests: e2e/', 'Tests: —') }));
    assertError(r2, /E2E test folder is missing/);
  });

  test('missing start is reported unless E2E is skipped', () => {
    assertError(run(project({ record: variant('Start: command `npm run e2e:serve`\n', '') })), /how the application is started is missing/);
    const skipped = run(project({ record: '# E2E Stage\n\nMode: skipped\n' }));
    assert.equal(skipped.ok, true, errors(skipped).join('\n'));
  });

  // @scenario e2e/stage :: Developer start without an address is reported
  test('developer start without an address', () => {
    for (const start of ['Start: developer', 'Start: developer at', 'Start: developer at —']) {
      const r = run(project({ record: variant('Start: command `npm run e2e:serve`', start) }));
      assertError(r, /application address is missing/);
    }
  });

  test('a start that is neither a command nor the developer is reported', () => {
    assertError(run(project({ record: variant('Start: command `npm run e2e:serve`', 'Start: docker compose up') })), /"docker compose up".*command <cmd>.*developer at <url>/);
  });

  // @scenario e2e/tests :: Accepted case without a reason is reported
  test('accepted case without a reason names the case', () => {
    for (const line of [
      '- inventory/sale-export :: Export of a month with two sales',
      '- inventory/sale-export :: Export of a month with two sales —',
      '- inventory/sale-export :: Export of a month with two sales — —',
    ]) {
      const r = run(project({ record: variant('- inventory/sale-export :: Export of a month with two sales — export service sandbox is down', line) }));
      assertError(r, /accepted case "Export of a month with two sales".*reason is missing/);
    }
  });

  test('accepted case without its capability is reported', () => {
    assertError(run(project({ record: variant('- inventory/sale-export :: Export of a month', '- Export of a month') })), /"Export of a month with two sales.*<capability-path> :: <name> — <reason>/);
  });

  test('screens row with an unknown result', () => {
    const r = run(project({ record: variant('| 01-orders-list.png | no differences |', '| 01-orders-list.png | looks fine |') }));
    assertError(r, /`01-orders-list.png` has unknown result "looks fine" \(allowed: no differences, differences, accepted\)/);
  });

  // @scenario e2e/visual-check :: Accepted difference without a reason is reported
  test('accepted difference without a reason names the screenshot', () => {
    for (const reason of ['—', '']) {
      const r = run(project({ record: variant('| new header colour | approved by the designer |', `| new header colour | ${reason} |`) }));
      assertError(r, /`02-orders-list-mobile.png`.*reason is missing/);
    }
  });

  test('malformed scenario and no-new-run items are reported', () => {
    assertError(run(project({ record: variant('- inventory/sale-export :: Successful export', '- Successful export') })), /"Successful export".*<capability-path> :: <Scenario name>/);
    assertError(run(project({ record: variant('- 7c1e09a2 — typo fix', '- typo fix') })), /"typo fix in an export label comment".*<state id> — <what changed>/);
  });

  test('no e2e.md: nothing to check in format mode', () => {
    const r = run(project({ record: null }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.findings, []);
  });

  test('skipped on schemas outside the kit', () => {
    const r = run(project({ schema: 'spec-driven', record: variant('Mode: real backend', 'Mode: staging server') }));
    assert.equal(r.skipped, true);
    assert.match(r.reason, /spec-driven/);
  });

  test('unknown check mode is a usage error', () => {
    assert.throws(() => run(project(), 'gate'), /--mode must be one of format, archive/);
  });

  test('command line: exit codes, JSON and text', () => {
    const script = join(REPO, 'kit', 'openspec', 'tooling', 'checks', 'check-e2e.mjs');
    const cli = (root, args) => {
      try {
        return { code: 0, out: execFileSync('node', [script, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
      } catch (e) {
        return { code: e.status, out: e.stdout, err: e.stderr };
      }
    };
    const good = project();
    const ok = cli(good, ['--change', CHANGE, '--json']);
    assert.equal(ok.code, 0, ok.out + ok.err);
    assert.equal(JSON.parse(ok.out).ok, true);
    assert.match(cli(good, ['--change', CHANGE, '--mode', 'format']).out, /check-e2e: OK \(0 error\(s\), 0 warning\(s\)\)/);
    const archive = cli(good, ['--change', CHANGE, '--mode', 'archive']);
    assert.equal(archive.code, 1);
    assert.match(archive.out, /the E2E stage has not run/);
    const bad = cli(project({ record: variant('Mode: real backend', 'Mode: staging server') }), ['--change', CHANGE]);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /ERROR openspec\/changes\/add-sale-export\/e2e\.md:3: .*"staging server"/);
    assert.equal(cli(good, []).code, 1);
    assert.equal(cli(good, ['--change', CHANGE, '--mode', 'gate']).code, 1);
    assert.match(cli(good, ['--help']).out, /Usage: check-e2e/);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Group 2: the run script e2e-run.mjs (design D3) and the archive checks of check-e2e (design D4).
// `AT` builds the marker keywords at run time, so no line of this file starts with a marker.
const AT = '@';
const CAP = 'inventory/sale-export';
const TWO = 'Export of a month with two sales';
const EMPTY = 'Export of an empty month';
const caseRef = (name, cap = CAP) => `// ${AT}case ${cap} :: ${name}`;
const scenarioRef = (name, cap = CAP) => `// ${AT}scenario ${cap} :: ${name}`;
const E2E_RUN = join(REPO, 'kit', 'openspec', 'tooling', 'bin', 'e2e-run.mjs');

const DELTA = `# Spec Delta

## ADDED Requirements

### Requirement: Sales export
The system SHALL export the sales of a month.

#### Scenario: Successful export
- **GIVEN** two sales in March
- **WHEN** the accountant exports March
- **THEN** the file has two rows

#### Scenario: Empty month
- **GIVEN** no sales in April
- **WHEN** the accountant exports April
- **THEN** the file has only the header
`;

/** test-cases.md with one scenario and the given cases: [{name, labels}]. */
function testCasesMd(cases) {
  const body = cases.map((c) => `#### Case: ${c.name}\nLabels: ${c.labels}\n- **Given** a month\n- **When** the accountant exports it\n- **Then** the file is right\n`).join('\n');
  return `# Test Cases\n\n## ${CAP}\n\n### Scenario: Successful export\n\n${body}`;
}

/** An e2e.md for the temp projects of group 2. */
function e2eMd({ mode = 'real backend', start = 'command `npm run e2e:serve`', scenarios = [], accepted = [], noNewRun = [] } = {}) {
  const items = (title, list) => (list.length ? `\n## ${title}\n${list.map((x) => `- ${x}`).join('\n')}\n` : '');
  return `# E2E Stage\n\nMode: ${mode}\nTests: e2e/\nStart: ${start}\n${items('Scenarios', scenarios)}${items('Accepted cases', accepted)}${items('No new run needed', noNewRun)}`;
}

/** An E2E spec file whose single test starts on line 5, with `refs` (marker lines) above it. */
function specFile(title, refs, body = 'await signIn(page);') {
  return [`import { test } from '@playwright/test';`, `import { signIn } from './helpers/sign-in';`, '', ...refs, `test('${title}', async ({ page }) => {`, `  ${body}`, `});`, ''].join('\n');
}

/**
 * A temp git project with a change: app code, the E2E folder e2e/ (a shared sign-in helper, the config and
 * one spec file per case), test-cases.md (test-case schemas) or a delta spec, and e2e.md.
 */
function e2eProject({ schema = 'clarify-ai-qa', record = e2eMd(), cases = [{ name: TWO, labels: 'automated, e2e' }, { name: EMPTY, labels: 'automated, e2e' }] } = {}) {
  const root = project({ schema, record });
  execFileSync('git', ['init', '-q'], { cwd: root });
  const write = (rel, content) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), content);
  };
  write('app/src/export.js', 'export const total = (sales) => sales.reduce((a, s) => a + s.amount, 0);\n');
  write('e2e/helpers/sign-in.ts', 'export async function signIn(page) { await page.goto("/"); }\n');
  write('e2e/playwright.config.ts', 'export default { retries: 0 };\n');
  if (schema === 'clarify-ai-qa' || schema === 'clarify-qa') {
    write(`${C}/test-cases.md`, testCasesMd(cases));
    write('e2e/two-sales.spec.ts', specFile('exports two sales', [caseRef(TWO)]));
    write('e2e/empty-month.spec.ts', specFile('exports an empty month', [caseRef(EMPTY)]));
  } else {
    write(`${C}/specs/${CAP}/spec.md`, DELTA);
    write('e2e/two-sales.spec.ts', specFile('exports two sales', [scenarioRef('Successful export')]));
    write('e2e/empty-month.spec.ts', specFile('exports an empty month', [scenarioRef('Empty month')]));
  }
  return root;
}

const SPECS = { two: { file: 'two-sales.spec.ts', title: 'exports two sales', line: 5 }, empty: { file: 'empty-month.spec.ts', title: 'exports an empty month', line: 5 } };

/** A Playwright JSON report for the e2e/ folder. `results`: {two: 'expected'|'unexpected'|'skipped'|'flaky', empty: ...}. */
const pwReport = (root, results, opts) => playwrightReport(join(root, 'e2e'), Object.entries(results).map(([key, status]) => ({ ...SPECS[key], status })), opts);

/** Runs e2e-run.mjs as a process in `root`; the fake npx prints `report` (an object), if given. */
const e2eRun = (root, report, args = []) => runE2e(E2E_RUN, root, CHANGE, report, args);
const runsOf = (root) => JSON.parse(readFileSync(join(root, C, RUNS_FILE), 'utf8')).runs;
const archive = (root) => run(root, 'archive');
function assertNoError(report, re) {
  const hit = errors(report).filter((m) => re.test(m));
  assert.deepEqual(hit, [], `unexpected error(s) matching ${re}`);
}
/** Appends a line to a project file (a code change). */
const touch = (root, rel) => appendFileSync(join(root, rel), '// changed\n');

describe('e2e-runs library', () => {
  test('normFolder', () => {
    assert.equal(normFolder('e2e/'), 'e2e');
    assert.equal(normFolder('./apps/web/e2e//'), 'apps/web/e2e');
  });

  test('refsAbove reads the markers directly above a test, over comments and blank lines', () => {
    const content = [
      `test('a', () => {});`,
      caseRef(TWO),
      '',
      scenarioRef('Successful export'),
      '// selects the March row',
      `test('b', () => {});`,
      `test('c', () => {});`,
    ].join('\n');
    assert.deepEqual(refsAbove(content, 6), { cases: [{ capability: CAP, name: TWO }], scenarios: [{ capability: CAP, scenario: 'Successful export' }] });
    assert.deepEqual(refsAbove(content, 7), { cases: [], scenarios: [] });
    assert.deepEqual(refsAbove(content, 1), { cases: [], scenarios: [] });
  });

  test('parsePlaywrightReport: statuses, nested titles, project-relative files, retries', () => {
    const root = '/p';
    const report = pwReport(root, { two: 'flaky', empty: 'skipped' }, { retries: 2 });
    report.suites[0].suites = [{ title: 'March', file: 'two-sales.spec.ts', specs: [{ title: 'inner', file: 'two-sales.spec.ts', line: 9, tests: [{ status: 'expected' }] }] }];
    const { retries, tests } = parsePlaywrightReport(report, { root, cwd: '/p/e2e' });
    assert.equal(retries, 2);
    assert.deepEqual(tests, [
      { file: 'e2e/two-sales.spec.ts', title: 'exports two sales', line: 5, status: 'failed' },
      { file: 'e2e/two-sales.spec.ts', title: 'March › inner', line: 9, status: 'passed' },
      { file: 'e2e/empty-month.spec.ts', title: 'exports an empty month', line: 5, status: 'skipped' },
    ]);
    assert.equal(parsePlaywrightReport({ config: {}, suites: [] }, { root, cwd: '/p/e2e' }).retries, null);
    report.config.projects.push({ ...report.config.projects[0], id: 'firefox', name: 'firefox', retries: 0 });
    assert.equal(parsePlaywrightReport(report, { root, cwd: '/p/e2e' }).retries, 2, 'the largest retries of the projects');
  });

  test('projectState: the app state leaves out the test folder; test files are fingerprinted one by one', () => {
    const root = e2eProject();
    const a = projectState(root, 'e2e');
    assert.match(a.appState, /^[0-9a-f]{64}$/);
    assert.deepEqual(Object.keys(a.testFiles).sort(), ['e2e/empty-month.spec.ts', 'e2e/helpers/sign-in.ts', 'e2e/playwright.config.ts', 'e2e/two-sales.spec.ts']);
    touch(root, 'e2e/two-sales.spec.ts');
    mkdirSync(join(root, 'e2e', 'test-results'));
    writeFileSync(join(root, 'e2e', 'test-results', 'trace.zip'), 'x');
    writeFileSync(join(root, C, RUNS_FILE), '{"runs":[]}');
    const b = projectState(root, 'e2e');
    assert.equal(b.appState, a.appState, 'test folder, Playwright output and openspec/ do not change the app state');
    assert.notEqual(b.testFiles['e2e/two-sales.spec.ts'], a.testFiles['e2e/two-sales.spec.ts']);
    assert.equal(b.testFiles['e2e/test-results/trace.zip'], undefined);
    touch(root, 'app/src/export.js');
    assert.notEqual(projectState(root, 'e2e').appState, a.appState);
    assert.equal(stateId(a.appState), a.appState.slice(0, 8));
  });
});

describe('e2e-run.mjs (design D3)', () => {
  test('runs Playwright in the test folder and records the run', () => {
    const root = e2eProject();
    const r = e2eRun(root, pwReport(root, { two: 'expected', empty: 'unexpected' }), ['--', '--project', 'chromium']);
    assert.equal(r.code, 1, 'the exit code of Playwright passes through');
    assert.deepEqual(r.calls.map(({ cwd, args, baseUrl }) => ({ cwd, args, baseUrl })), [
      { cwd: join(root, 'e2e'), args: ['playwright', 'test', '--reporter=json', '--project', 'chromium'], baseUrl: null },
    ]);
    const runs = runsOf(root);
    assert.equal(runs.length, 1);
    const [one] = runs;
    assert.match(one.at, /^\d{4}-\d\d-\d\dT/);
    assert.equal(one.retries, 0);
    assert.deepEqual(one.tests, [
      { file: 'e2e/two-sales.spec.ts', title: 'exports two sales', line: 5, refs: { cases: [{ capability: CAP, name: TWO }], scenarios: [] }, status: 'passed' },
      { file: 'e2e/empty-month.spec.ts', title: 'exports an empty month', line: 5, refs: { cases: [{ capability: CAP, name: EMPTY }], scenarios: [] }, status: 'failed' },
    ]);
    const now = projectState(root, 'e2e');
    assert.equal(one.appState, now.appState);
    assert.deepEqual(one.testFiles, now.testFiles);
    assert.match(r.out, /2 test\(s\): 1 passed, 1 failed, 0 skipped/);
    assert.match(r.out, /FAILED e2e\/empty-month\.spec\.ts:5 exports an empty month/);

    const again = e2eRun(root, pwReport(root, { two: 'expected' }));
    assert.equal(again.code, 0);
    assert.equal(runsOf(root).length, 2, 'every run is appended');

    const retried = e2eRun(root, pwReport(root, { two: 'expected' }, { retries: 2 }));
    assert.equal(runsOf(root).at(-1).retries, 2, 'the retries setting of the Playwright config is recorded');
    assert.match(retried.out, /retries 2;/);
    assert.match(retried.out, /retries must be 0/);
  });

  test('sets E2E_BASE_URL when the developer starts the application', () => {
    const root = e2eProject({ record: e2eMd({ start: 'developer at http://localhost:4100' }) });
    const r = e2eRun(root, pwReport(root, { two: 'expected', empty: 'expected' }));
    assert.equal(r.code, 0, r.err);
    assert.equal(r.calls[0].baseUrl, 'http://localhost:4100');
  });

  test('--state prints the state id and records nothing', () => {
    const root = e2eProject();
    const r = e2eRun(root, null, ['--state']);
    assert.equal(r.code, 0, r.err);
    assert.equal(r.out.trim(), stateId(projectState(root, 'e2e').appState));
    assert.match(r.out.trim(), /^[0-9a-f]{8}$/);
    assert.deepEqual(r.calls, []);
    assert.equal(existsSync(join(root, C, RUNS_FILE)), false);
  });

  test('refuses without e2e.md, with skipped E2E, or a missing test folder', () => {
    const none = e2eProject({ record: null });
    assert.match(e2eRun(none, pwReport(none, { two: 'expected' })).err, /no e2e\.md/);
    const skipped = e2eProject({ record: '# E2E Stage\n\nMode: skipped\n' });
    const r = e2eRun(skipped, pwReport(skipped, { two: 'expected' }));
    assert.equal(r.code, 1);
    assert.match(r.err, /E2E is skipped/);
    assert.deepEqual(r.calls, []);
    const nofolder = e2eProject({ record: e2eMd().replace('Tests: e2e/', 'Tests: web/e2e/') });
    assert.match(e2eRun(nofolder, pwReport(nofolder, { two: 'expected' })).err, /"web\/e2e\/" does not exist/);
  });

  test('a report that is not JSON records no run', () => {
    const root = e2eProject();
    const env = fakeEnv(root);
    writeFileSync(env.FAKE_PW_REPORT, 'Error: Cannot find module @playwright/test');
    const res = spawnSync('node', [E2E_RUN, '--change', CHANGE], { cwd: root, encoding: 'utf8', env });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /no JSON report/);
    assert.equal(existsSync(join(root, C, RUNS_FILE)), false);
  });
});

describe('check-e2e archive checks (design D4)', () => {
  test('a change that needs E2E and has no run: the E2E stage has not run', () => {
    const r = archive(e2eProject());
    assertError(r, /the E2E stage has not run/);
  });

  test('skipped E2E has no archive checks', () => {
    const r = archive(e2eProject({ record: '# E2E Stage\n\nMode: skipped\n' }));
    assert.equal(r.ok, true, errors(r).join('\n'));
  });

  test('a green full run passes; a failing latest result names the case', () => {
    const root = e2eProject();
    e2eRun(root, pwReport(root, { two: 'expected', empty: 'expected' }));
    const ok = archive(root);
    assert.equal(ok.ok, true, errors(ok).join('\n'));
    e2eRun(root, pwReport(root, { two: 'unexpected' }));
    assertError(archive(root), new RegExp(`"${TWO}".*latest E2E result is failed`));
  });

  test('an accepted case needs its test but no passing result', () => {
    const root = e2eProject({ record: e2eMd({ accepted: [`${CAP} :: ${TWO} — export service sandbox is down`] }) });
    e2eRun(root, pwReport(root, { two: 'skipped', empty: 'expected' }));
    const r = archive(root);
    assert.equal(r.ok, true, errors(r).join('\n'));
  });

  test('a skipped test of a case that is not accepted is reported', () => {
    const root = e2eProject();
    e2eRun(root, pwReport(root, { two: 'skipped', empty: 'expected' }));
    assertError(archive(root), new RegExp(`"${TWO}".*skipped.*not under "## Accepted cases"`));
  });

  test('project files changed after the latest run; the no-new-run decision for that state', () => {
    const root = e2eProject();
    e2eRun(root, pwReport(root, { two: 'expected', empty: 'expected' }));
    touch(root, 'app/src/export.js');
    assertError(archive(root), /project files changed after the latest E2E run/);
    const id = stateId(projectState(root, 'e2e').appState);
    writeFileSync(join(root, C, E2E_FILE), e2eMd({ noNewRun: [`${id} — comment typo in the export`] }));
    const r = archive(root);
    assert.equal(r.ok, true, errors(r).join('\n'));
  });

  test('a run file that is not JSON is reported', () => {
    const root = e2eProject();
    writeFileSync(join(root, C, RUNS_FILE), '{ not json');
    assertError(archive(root), /e2e-runs\.json is not valid JSON/);
  });

  // @scenario e2e/tests :: Listed scenario that does not exist is reported
  test('a listed scenario that is not in the delta specs is named', () => {
    const root = e2eProject({ schema: 'clarify', record: e2eMd({ scenarios: [`${CAP} :: Successful export`, `${CAP} :: Export starts`] }) });
    const r = archive(root);
    assertError(r, /listed scenario "Export starts" \(inventory\/sale-export\) is not a scenario of the change's delta specs/);
    assertNoError(r, /"Successful export".*(not a scenario|no E2E test)/);
  });

  // @scenario e2e/tests :: Unit test does not count as E2E coverage
  test('a case referenced only by a unit test outside the E2E folder has no E2E test', () => {
    const root = e2eProject();
    writeFileSync(join(root, 'e2e', 'two-sales.spec.ts'), specFile('exports two sales', []));
    mkdirSync(join(root, 'tests'));
    writeFileSync(join(root, 'tests', 'export.test.mjs'), [caseRef(TWO), `test('two sales', () => {});`, ''].join('\n'));
    const r = archive(root);
    assertError(r, new RegExp(`E2E case "${TWO}" \\(inventory/sale-export\\) has no E2E test`));
    assertNoError(r, new RegExp(`"${EMPTY}".*no E2E test`));
  });

  // @scenario e2e/tests :: Case that is not e2e needs no E2E test
  test('a case labelled only automated needs no E2E test', () => {
    const root = e2eProject({ cases: [{ name: TWO, labels: 'automated, e2e' }, { name: 'Export of a cancelled sale', labels: 'automated' }] });
    e2eRun(root, pwReport(root, { two: 'expected' }));
    const r = archive(root);
    assertNoError(r, /Export of a cancelled sale/);
    assert.equal(r.ok, true, errors(r).join('\n'));
  });

  test('a listed scenario without a test in the folder is named (clarify)', () => {
    const root = e2eProject({ schema: 'clarify', record: e2eMd({ scenarios: [`${CAP} :: Successful export`] }) });
    writeFileSync(join(root, 'e2e', 'two-sales.spec.ts'), specFile('exports two sales', []));
    assertError(archive(root), /E2E scenario "Successful export" \(inventory\/sale-export\) has no E2E test/);
  });

  test('a listed scenario covered and green passes (lean)', () => {
    const root = e2eProject({ schema: 'lean', record: e2eMd({ scenarios: [`${CAP} :: Successful export`] }) });
    e2eRun(root, pwReport(root, { two: 'expected' }));
    const r = archive(root);
    assert.equal(r.ok, true, errors(r).join('\n'));
  });

  // @scenario e2e/tests :: Automatic retries are reported
  test('a recorded run made with retries: 2 is reported', () => {
    const root = e2eProject({ cases: [{ name: TWO, labels: 'automated, e2e' }] });
    const now = projectState(root, 'e2e');
    const runs = {
      runs: [
        {
          at: '2026-10-26T10:00:00.000Z',
          retries: 2,
          tests: [{ file: 'e2e/two-sales.spec.ts', title: 'exports two sales', line: 5, refs: { cases: [{ capability: CAP, name: TWO }], scenarios: [] }, status: 'passed' }],
          appState: now.appState,
          testFiles: now.testFiles,
        },
      ],
    };
    writeFileSync(join(root, C, RUNS_FILE), JSON.stringify(runs, null, 2));
    assertError(archive(root), /the E2E run of 2026-10-26T10:00:00\.000Z was made with retries: 2; retries must be 0/);
    runs.runs[0].retries = 0;
    writeFileSync(join(root, C, RUNS_FILE), JSON.stringify(runs, null, 2));
    const ok = archive(root);
    assert.equal(ok.ok, true, errors(ok).join('\n'));
  });

  // @scenario e2e/stage :: Rerun of a test fixed in its own file completes the stage
  test('a rerun of only the test fixed in its own file completes the stage', () => {
    const root = e2eProject();
    e2eRun(root, pwReport(root, { two: 'unexpected', empty: 'expected' }));
    assertError(archive(root), new RegExp(`"${TWO}".*latest E2E result is failed`));
    writeFileSync(join(root, 'e2e', 'two-sales.spec.ts'), specFile('exports two sales', [caseRef(TWO)], "await page.getByRole('button', { name: 'Export' }).click();"));
    assertError(archive(root), new RegExp(`"${TWO}".*after the change of its test file e2e/two-sales\\.spec\\.ts`));
    const rerun = e2eRun(root, pwReport(root, { two: 'expected' }), ['--', 'two-sales.spec.ts']);
    assert.equal(rerun.code, 0, rerun.err);
    const r = archive(root);
    assert.equal(r.ok, true, errors(r).join('\n'));
  });

  // @scenario e2e/stage :: Shared E2E helper change needs every test again
  test('a change of a shared helper in the E2E folder needs every test again', () => {
    const root = e2eProject();
    e2eRun(root, pwReport(root, { two: 'expected', empty: 'expected' }));
    touch(root, 'e2e/helpers/sign-in.ts');
    e2eRun(root, pwReport(root, { two: 'expected' }), ['--', 'two-sales.spec.ts']);
    const r = archive(root);
    assertError(r, new RegExp(`"${EMPTY}".*has no valid E2E result after the change of the shared E2E file\\(s\\) e2e/helpers/sign-in\\.ts`));
    assertNoError(r, new RegExp(`"${TWO}"`));
  });

  // @scenario e2e/stage :: Application fix needs every test again
  test('an application fix needs every test again', () => {
    const root = e2eProject();
    e2eRun(root, pwReport(root, { two: 'unexpected', empty: 'expected' }));
    touch(root, 'app/src/export.js');
    e2eRun(root, pwReport(root, { two: 'expected' }), ['--', 'two-sales.spec.ts']);
    const r = archive(root);
    assertError(r, new RegExp(`"${EMPTY}".*has no valid E2E result after the latest application change`));
    assertNoError(r, new RegExp(`"${TWO}"`));
    assertNoError(r, /project files changed after the latest E2E run/);
    e2eRun(root, pwReport(root, { two: 'expected', empty: 'expected' }));
    const ok = archive(root);
    assert.equal(ok.ok, true, errors(ok).join('\n'));
  });
});
