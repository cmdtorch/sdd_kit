// Meta-repository support (change metarepo-support): the clone list library, project files that include the
// clones, and the repository binding of the verification plan. Every test builds a temporary
// meta-repository (tests/helpers/metarepo.mjs): nested git repositories cannot live in fixtures/.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync, appendFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { parseClones, readClones, isMetarepo, followsMetarepo, repositoryOf, ROOT_REPOSITORY, CLONES_FILE } from '../kit/openspec/tooling/lib/clones.mjs';
import { collectMarkers, listProjectFiles } from '../kit/openspec/tooling/lib/markers.mjs';
import { checkE2e } from '../kit/openspec/tooling/checks/check-e2e.mjs';
import { checkApplyReport } from '../kit/openspec/tooling/checks/check-apply-report.mjs';
import { testReviewInput, renderTestReviewInput } from '../kit/openspec/tooling/lib/reviews.mjs';
import { metarepo, writeChange, writeTest, write, commitAll, git, removeClone, scenarioLine, runKit, traceability, archive, hook, errorsOf, installer, doctorRun, scripted, gitStatus, CHANGE, C as C_ORDERS } from './helpers/metarepo.mjs';
import { install } from '../installer/sdd-kit.mjs';
import { doctor, runDoctor } from '../kit/openspec/tooling/bin/doctor.mjs';
import { playwrightReport, runE2e } from './helpers/e2e.mjs';

describe('clone list library (design §2)', () => {
  // @scenario metarepo/clones :: Clone named after its folder
  test('a bare path is named after its folder', () => {
    const { clones, errors } = parseClones('repos/backend\n');
    assert.deepEqual(errors, []);
    assert.deepEqual(clones.map(({ name, path }) => ({ name, path })), [{ name: 'backend', path: 'repos/backend' }]);
  });

  // @scenario metarepo/clones :: Clone with its own name
  test('name=path gives the clone its own name', () => {
    const { clones, errors } = parseClones('api=repos/backend\n');
    assert.deepEqual(errors, []);
    assert.deepEqual(clones.map(({ name, path }) => ({ name, path })), [{ name: 'api', path: 'repos/backend' }]);
  });

  test('comments, blank lines, ./ and trailing slashes; line numbers', () => {
    const { clones, errors } = parseClones('# clones\n\n./repos/backend/\n  web = repos/frontend  # the UI\n');
    assert.deepEqual(errors, []);
    assert.deepEqual(clones.map(({ name, path, line }) => ({ name, path, line })), [
      { name: 'backend', path: 'repos/backend', line: 3 },
      { name: 'web', path: 'repos/frontend', line: 4 },
    ]);
  });

  test('list errors: repeated name, repeated path, reserved name, outside the root, bad characters, empty parts', () => {
    const msgs = (text) => parseClones(text).errors.map((e) => e.message);
    assert.deepEqual(msgs('repos/backend\napi/backend\n'), ['the name `backend` is declared twice']);
    assert.deepEqual(msgs('repos/backend\napi=repos/backend\n'), ['the path `repos/backend` is declared twice']);
    assert.deepEqual(msgs('root=repos/core\n'), ['the name `root` is reserved for the root']);
    assert.deepEqual(msgs('../backend\n'), ['`../backend` is outside the root']);
    assert.deepEqual(msgs('/srv/backend\n'), ['`/srv/backend` is outside the root']);
    assert.deepEqual(msgs('repos/../../x\n'), ['`repos/../../x` is outside the root']);
    assert.deepEqual(msgs('.\n'), ['`.` is the root itself, not a clone']);
    assert.deepEqual(msgs('order api=repos/backend\n'), ['the name `order api` has a character that is not allowed (letters, digits, -, _, .)']);
    assert.deepEqual(msgs('backend=\n'), ['the entry `backend=` has no path']);
    assert.deepEqual(msgs('=repos/backend\n'), ['the entry `=repos/backend` has no name']);
    const e = parseClones('repos/backend\nrepos/backend\n').errors[0];
    assert.equal(e.line, 2);
    assert.equal(parseClones('Backend=repos/a\nbackend=repos/b\n').errors.length, 0, 'names are case-sensitive');
  });

  test('readClones, isMetarepo and followsMetarepo', () => {
    const root = metarepo({ create: ['backend'] });
    assert.equal(CLONES_FILE, 'openspec/clones');
    assert.equal(ROOT_REPOSITORY, 'root');
    const list = readClones(root);
    assert.equal(list.present, true);
    assert.deepEqual(list.clones.map(({ name, path, exists }) => ({ name, path, exists })), [
      { name: 'backend', path: 'repos/backend', exists: true },
      { name: 'frontend', path: 'repos/frontend', exists: false },
    ]);
    assert.equal(isMetarepo(root), true);
    writeFileSync(join(root, CLONES_FILE), '# no clones yet\n');
    assert.equal(isMetarepo(root), true, 'a list with no clone line is still a meta-repository');
    assert.deepEqual(readClones(root).clones, []);
    rmSync(join(root, CLONES_FILE));
    assert.equal(isMetarepo(root), false);
    assert.deepEqual(readClones(root), { present: false, clones: [], errors: [] });

    writeChange(root, [['Order is created', 'unit', 'backend']]);
    assert.equal(followsMetarepo(root, CHANGE), true);
    writeChange(root, [['Order is created', 'unit', 'backend']], { name: 'old-change', marked: false });
    assert.equal(followsMetarepo(root, 'old-change'), false);
  });

  test('repositoryOf: the clone of a path, root outside every clone, null for openspec/ and the E2E folder', () => {
    const clones = parseClones('backend=repos/backend\nfrontend=repos/frontend\nweb-admin=repos/frontend/admin\n').clones;
    assert.equal(repositoryOf('repos/backend/tests/test_orders.py', clones), 'backend');
    assert.equal(repositoryOf('repos/frontend/src/a.ts', clones), 'frontend');
    assert.equal(repositoryOf('repos/frontend/admin/src/a.ts', clones), 'web-admin', 'the deepest clone wins');
    assert.equal(repositoryOf('repos/backendx/a.py', clones), 'root');
    assert.equal(repositoryOf('checks/test_rules.py', clones), 'root');
    assert.equal(repositoryOf('openspec/changes/x/tasks.md', clones), null);
    assert.equal(repositoryOf('e2e/orders.spec.ts', clones, { e2eFolder: 'e2e' }), null);
    assert.equal(repositoryOf('e2e/orders.spec.ts', clones), 'root');
  });
});

// --- Group 2: project files include the clones (design §3) -----------------------------------------------

/** A meta-repository with one marked change: "Order is created" proven in the backend. */
function orders(opts = {}) {
  const root = metarepo(opts);
  writeChange(root, [['Order is created', 'integration', 'backend']]);
  return root;
}
const ORDER = 'Order is created';
/** Errors of check-traceability --markers that name a scenario. */
const scenarioErrors = (root, scenario) => errorsOf(traceability(root).report).filter((m) => m.includes(`"${scenario}"`));

describe('marked tests are found inside the clones', () => {
  // @scenario metarepo/test-discovery :: Committed test in a clone closes a scenario
  test('a committed test in a clone closes its scenario', () => {
    const root = orders();
    assert.match(scenarioErrors(root, ORDER).join('\n'), /no test .*carries the marker for "Order is created"/, 'without a test the scenario is open');
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    commitAll(join(root, 'repos', 'backend'));
    assert.equal(git(join(root, 'repos', 'backend'), 'status', '--porcelain'), '', 'the test is committed in the clone');
    assert.equal(git(root, 'status', '--porcelain', '--ignored', 'repos').trim(), '!! repos/', 'the root ignores the clones');
    assert.deepEqual(scenarioErrors(root, ORDER), []);
  });

  // @scenario metarepo/test-discovery :: Uncommitted test in a clone closes a scenario
  test('an uncommitted test in a clone closes its scenario', () => {
    const root = orders();
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    assert.match(git(join(root, 'repos', 'backend'), 'status', '--porcelain'), /\?\? tests\//);
    assert.deepEqual(scenarioErrors(root, ORDER), []);
  });

  // @scenario metarepo/test-discovery :: File ignored by the clone is not read
  test('a file the clone ignores is not read', () => {
    const root = orders();
    writeTest(root, 'repos/backend/node_modules/pkg/test_orders.py', [ORDER]);
    assert.match(scenarioErrors(root, ORDER).join('\n'), /no test .*carries the marker for "Order is created"/);
    // control: the same file outside the ignored folder counts
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    assert.deepEqual(scenarioErrors(root, ORDER), []);
  });

  // @scenario metarepo/test-discovery :: Clone's own OpenSpec folder is not read
  test("a clone's own openspec/ and .claude/ are not read", () => {
    const root = orders();
    write(root, 'repos/backend/openspec/changes/add-export/tasks.md', `${scenarioLine(ORDER)}\n- [ ] 1.1 Task\n`);
    writeTest(root, 'repos/backend/.claude/hooks/check.test.mjs', [ORDER]);
    assert.match(scenarioErrors(root, ORDER).join('\n'), /no test .*carries the marker for "Order is created"/);
    assert.deepEqual(collectMarkers(root).filter((m) => m.scenario === ORDER), []);
  });

  // @scenario metarepo/test-discovery :: Root ignore pattern excludes a clone path
  test('openspec/markers-ignore of the root matches clone paths', () => {
    const root = orders();
    write(root, 'repos/backend/docs/testing.md', `Mark a test like this:\n\n${scenarioLine(ORDER)}\n`);
    assert.deepEqual(scenarioErrors(root, ORDER), [], 'control: without the pattern the docs file counts');
    writeFileSync(join(root, 'openspec', 'markers-ignore'), 'repos/backend/docs/\n');
    assert.match(scenarioErrors(root, ORDER).join('\n'), /no test .*carries the marker for "Order is created"/);
  });

  test('a clone folder without its own git is walked; a missing clone is skipped; paths start with the clone', () => {
    const root = metarepo({ create: ['backend'] });
    mkdirSync(join(root, 'repos', 'frontend', 'tests'), { recursive: true });
    writeTest(root, 'repos/frontend/tests/orders.spec.ts', [ORDER]);
    writeTest(root, 'repos/frontend/node_modules/pkg/x.test.js', [ORDER]);
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    writeTest(root, 'checks/test_rules.py', [ORDER]);
    const files = collectMarkers(root).filter((m) => m.scenario === ORDER).map((m) => m.file).sort();
    assert.deepEqual(files, ['checks/test_rules.py', 'repos/backend/tests/test_orders.py', 'repos/frontend/tests/orders.spec.ts']);
    removeClone(root, 'frontend');
    assert.deepEqual(collectMarkers(root).filter((m) => m.scenario === ORDER).map((m) => m.file).sort(), ['checks/test_rules.py', 'repos/backend/tests/test_orders.py']);
  });

  test('a project without openspec/clones lists only its own files', () => {
    const root = metarepo({ clones: null });
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    writeTest(root, 'checks/test_rules.py', [ORDER]);
    assert.deepEqual(listProjectFiles(root).filter((f) => f.startsWith('repos/')), []);
    assert.deepEqual(collectMarkers(root).map((m) => m.file), ['checks/test_rules.py']);
  });
});

describe('a test path shows its repository', () => {
  // @scenario metarepo/test-discovery :: Review input shows the clone
  test('review-input lists a clone test by its path from the root', () => {
    const root = orders();
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    const r = runKit(root, 'bin/review-input.mjs', ['--change', CHANGE, '--json']);
    assert.equal(r.code, 0, r.err);
    const s = JSON.parse(r.out).scenarios.find((x) => x.scenario === ORDER);
    assert.deepEqual(s.tests, [{ file: 'repos/backend/tests/test_orders.py', line: 1 }]);
    assert.equal(s.missing, false);
    const text = runKit(root, 'bin/review-input.mjs', ['--change', CHANGE]).out;
    assert.match(text, /^- repos\/backend\/tests\/test_orders\.py:1$/m);
  });
});

describe('search stays within the hook timeouts', () => {
  // @scenario metarepo/test-discovery :: Large frontend clone with dependencies
  test('50,000 ignored dependency files, 400 frontend and 300 backend sources: collected in under 30 s', () => {
    const root = orders();
    const fe = join(root, 'repos', 'frontend');
    for (let p = 0; p < 500; p++) {
      const dir = join(fe, 'node_modules', `pkg-${p}`, 'lib');
      mkdirSync(dir, { recursive: true });
      for (let k = 0; k < 100; k++) writeFileSync(join(dir, `f${k}.js`), `module.exports = ${k};\n`);
    }
    writeTest(root, 'repos/frontend/node_modules/pkg-0/lib/orders.test.js', ['Order list is shown']);
    for (let k = 0; k < 400; k++) write(root, `repos/frontend/src/api/request-${k}.ts`, `export const r${k} = () => fetch('/api/${k}');\n`);
    for (let k = 0; k < 300; k++) write(root, `repos/backend/orders/route_${k}.py`, `def route_${k}():\n    return ${k}\n`);
    writeTest(root, 'repos/frontend/tests/orders.spec.ts', ['Order list is shown']);
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    commitAll(join(root, 'repos', 'backend'));

    const started = Date.now();
    const markers = collectMarkers(root);
    const ms = Date.now() - started;
    assert.ok(ms < 30000, `collection took ${ms} ms`);
    assert.deepEqual(markers.map((m) => `${m.file} ${m.scenario}`).sort(), ['repos/backend/tests/test_orders.py Order is created', 'repos/frontend/tests/orders.spec.ts Order list is shown']);
  });
});

describe('recorded E2E runs cover every clone', () => {
  const RECORD = '# E2E Stage\n\nMode: real backend\nTests: e2e/\nStart: command `mise run up`\n\n## Scenarios\n\n- orders/order-flow :: Order is created\n';
  /** A meta-repository change with a root e2e/ folder and one passed run recorded by e2e-run.mjs. */
  function recorded() {
    const root = metarepo();
    writeChange(root, [['Order is created', 'integration', 'backend']], { e2e: RECORD, tasks: '# Tasks\n\n## 1. [frontend] Order screen\n\n- [x] 1.1 Build it\n\n## 2. Final checks\n\n- [x] 2.1 Run the suite\n' });
    write(root, 'repos/backend/orders/views.py', 'def create():\n    return 1\n');
    write(root, 'repos/frontend/src/orders.ts', 'export const list = () => [];\n');
    write(root, 'e2e/playwright.config.ts', 'export default { retries: 0 };\n');
    write(root, 'e2e/orders.spec.ts', [`import { test } from '@playwright/test';`, '', scenarioLine(ORDER), `test('creates an order', async () => {});`, ''].join('\n'));
    const report = playwrightReport(join(root, 'e2e'), [{ file: 'orders.spec.ts', title: 'creates an order', line: 4, status: 'expected' }]);
    const r = runE2e(join(root, 'openspec', 'tooling', 'bin', 'e2e-run.mjs'), root, CHANGE, report);
    assert.equal(r.code, 0, r.out + r.err);
    return root;
  }
  const stale = (root) => errorsOf(runCheckE2e(root)).filter((m) => /changed after the latest E2E run/.test(m));
  const runCheckE2e = (root) => checkE2e({ root, change: CHANGE, mode: 'archive' });

  // @scenario metarepo/e2e :: Edit in a clone invalidates the run
  test('an edit in a clone invalidates the run', () => {
    const root = recorded();
    assert.deepEqual(errorsOf(runCheckE2e(root)), [], 'the fresh run is valid');
    appendFileSync(join(root, 'repos/backend/orders/views.py'), '# changed\n');
    assert.equal(stale(root).length, 1, JSON.stringify(runCheckE2e(root).findings));
  });

  // @scenario metarepo/e2e :: Edit in an untouched clone also invalidates the run
  test('an edit in a clone that no task group names also invalidates the run', () => {
    const root = recorded();
    assert.deepEqual(stale(root), []);
    write(root, 'repos/backend/orders/serializers.py', 'FIELDS = []\n');
    assert.equal(stale(root).length, 1);
  });

  // @scenario metarepo/e2e :: File ignored by a clone does not invalidate the run
  test('a change in a folder the clone ignores keeps the run valid', () => {
    const root = recorded();
    write(root, 'repos/frontend/node_modules/react/index.js', 'module.exports = 2;\n');
    assert.deepEqual(errorsOf(runCheckE2e(root)), []);
    // control: the same edit in a file the clone tracks makes it stale
    appendFileSync(join(root, 'repos/frontend/src/orders.ts'), '// changed\n');
    assert.equal(stale(root).length, 1);
  });
});

// --- Group 3: repository binding in the plan (design §4) ---------------------------------------------------

const LIST = 'Order list is shown';
const HINT = 'Empty phone shows a hint';
/** Errors of check-traceability (with markers unless `markers: false`). */
const traceErrors = (root, opts) => errorsOf(traceability(root, CHANGE, opts).report);
const noTestIn = (scenario, repo) => new RegExp(`no test in \`${repo}\` carries the marker for "${scenario}"`);

/** A ready meta-repository change: "Order is created" in the backend, its test there; archive passes. */
function ready(opts = {}) {
  const root = metarepo(opts);
  writeChange(root, [[ORDER, 'integration', 'backend']]);
  writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
  return root;
}

describe('the clone list in the checks and the archive gate', () => {
  // @scenario metarepo/clones :: Invalid clone list blocks the archive
  test('a repeated clone name blocks the archive', () => {
    const root = ready();
    const ok = archive(root);
    assert.equal(ok.code, 0, ok.err);
    appendFileSync(join(root, 'openspec', 'clones'), 'backend=repos/frontend\n');
    const r = archive(root);
    assert.equal(r.code, 2, 'the archive is blocked');
    assert.match(r.err, /change "add-orders" cannot be archived yet/);
    assert.match(r.err, /openspec\/clones:4: .*the name `backend` is declared twice/);
  });

  // @scenario metarepo/clones :: Invalid clone list is reported by the checks
  test('check-traceability reports the clone list error on a meta-repository change', () => {
    const root = ready();
    assert.deepEqual(traceErrors(root), []);
    appendFileSync(join(root, 'openspec', 'clones'), 'backend=repos/frontend\n');
    const { code, report } = traceability(root);
    assert.equal(code, 1);
    const f = report.findings.find((x) => /declared twice/.test(x.message));
    assert.deepEqual({ level: f.level, file: f.file, line: f.line, message: f.message }, { level: 'error', file: 'openspec/clones', line: 4, message: 'clone list: the name `backend` is declared twice' });
  });

  // @scenario metarepo/clones :: Empty clone list is a meta-repository
  test('a list with only a comment: no repository and backend are reported, root is not', () => {
    const root = metarepo({ clones: '' , create: [] });
    writeChange(root, [[ORDER, 'integration', ''], [LIST, 'integration', 'backend'], [HINT, 'integration', 'root']]);
    const errs = traceErrors(root, { markers: false });
    assert.deepEqual(errs.filter((m) => /repository/.test(m)), [
      `plan row of "${ORDER}" (orders/order-flow) names no repository`,
      `plan row of "${LIST}" (orders/order-flow) names the unknown repository \`backend\` (known: root)`,
    ]);
    assert.deepEqual(errs.filter((m) => m.includes(HINT)), []);
  });

  // @scenario metarepo/clones :: Checks name the missing clone instead of the test
  test('a missing clone named by a row is reported as missing, not as a scenario without a test', () => {
    const root = metarepo({ create: ['backend'] });
    writeChange(root, [[LIST, 'integration', 'frontend']]);
    const errs = traceErrors(root);
    assert.deepEqual(errs, [`the clone \`frontend\` at repos/frontend is missing; it is named by the plan row of "${LIST}" (orders/order-flow)`]);
  });

  // @scenario metarepo/clones :: Change started before the switch archives under the old rules
  test('a change without the meta-repository mark archives without repositories in its plan, tasks or report', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', '']], {
      marked: false,
      column: false,
      tasks: '# Tasks\n\n## 1. Orders\n\n- [x] 1.1 Write the tests and the code\n',
      report: '# Apply Report\n\n## Manual checks\n\nNone.\n\n## Not verified automatically\n\nNone.\n\n## Weakened tests\n\nNone.\n',
    });
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    assert.deepEqual(traceErrors(root), []);
    const r = archive(root);
    assert.equal(r.code, 0, r.err);
    // the same change with the mark is held to the rules
    writeFileSync(join(root, C_ORDERS, '.openspec.yaml'), readFileSync(join(root, C_ORDERS, '.openspec.yaml'), 'utf8') + 'x-sdd-kit-metarepo: true\n');
    assert.equal(archive(root).code, 2);
  });

  // @scenario metarepo/clones :: Clone list removed during a meta-repository change
  test('a marked change reports that openspec/clones is missing', () => {
    const root = ready();
    rmSync(join(root, 'openspec', 'clones'));
    const errs = traceErrors(root);
    assert.ok(errs.includes('the change follows the meta-repository rules (x-sdd-kit-metarepo: true) but openspec/clones is missing'), errs.join('\n'));
    assert.equal(archive(root).code, 2);
  });
});

describe('every plan row names its repository', () => {
  // @scenario metarepo/test-discovery :: Missing column is reported
  test('a Scenario coverage table without a Repository column', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend']], { column: false });
    assert.deepEqual(traceErrors(root, { markers: false }), ['"## Scenario coverage" needs a Repository column: every row names its repositories (openspec/clones names or root)']);
  });

  // @scenario metarepo/test-discovery :: Row without a repository is reported
  test('an empty Repository cell names the scenario', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', '—'], [LIST, 'integration', 'frontend']]);
    assert.deepEqual(traceErrors(root, { markers: false }), [`plan row of "${ORDER}" (orders/order-flow) names no repository`]);
  });

  // @scenario metarepo/test-discovery :: Unknown repository is reported
  test('an undeclared repository name', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend, mobile']]);
    assert.deepEqual(traceErrors(root, { markers: false }), [`plan row of "${ORDER}" (orders/order-flow) names the unknown repository \`mobile\` (known: root, backend, frontend)`]);
  });

  // @scenario metarepo/test-discovery :: Manual row without a repository is reported
  test('a manual row with a valid reason and no repository', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend'], [LIST, 'manual', '']]);
    assert.deepEqual(traceErrors(root, { markers: false }), [`plan row of "${LIST}" (orders/order-flow) names no repository`]);
  });
});

describe('a test counts only in a named repository', () => {
  // @scenario metarepo/test-discovery :: Backend test does not close a frontend row
  test('a backend test does not close a frontend row', () => {
    const root = metarepo();
    writeChange(root, [[LIST, 'integration', 'frontend']]);
    writeTest(root, 'repos/backend/tests/test_orders.py', [LIST]);
    const errs = traceErrors(root);
    assert.equal(errs.length, 1, errs.join('\n'));
    assert.match(errs[0], noTestIn(LIST, 'frontend'));
  });

  // @scenario metarepo/test-discovery :: Playwright test in the frontend clone closes a frontend row
  test('a Playwright test in the frontend clone closes a frontend row', () => {
    const root = metarepo();
    writeChange(root, [[LIST, 'integration', 'frontend']]);
    writeTest(root, 'repos/frontend/tests/orders.spec.ts', [LIST]);
    assert.deepEqual(traceErrors(root), []);
    assert.deepEqual(collectMarkers(root).map((m) => m.file), ['repos/frontend/tests/orders.spec.ts']);
  });

  // @scenario metarepo/test-discovery :: Row for two repositories needs a test in each
  test('a row for backend and root blocks the archive while root has no test', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend, root']]);
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, noTestIn(ORDER, 'root'));
    assert.doesNotMatch(r.err, noTestIn(ORDER, 'backend'));
    writeTest(root, 'checks/test_orders.py', [ORDER]);
    const ok = archive(root);
    assert.equal(ok.code, 0, ok.err);
  });

  // @scenario metarepo/test-discovery :: Root test closes a root row
  test('a root test closes a root row', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'unit', 'root']]);
    assert.match(traceErrors(root).join('\n'), noTestIn(ORDER, 'root'));
    writeTest(root, 'checks/test_rules.py', [ORDER]);
    assert.deepEqual(traceErrors(root), []);
  });

  // @scenario metarepo/e2e :: Backend row leaves the frontend to E2E
  test('a scenario of both clones planned only for the backend asks for no frontend test', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend']]);
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    const { report } = traceability(root);
    assert.deepEqual(report.findings.filter((f) => f.message.includes(ORDER) || f.message.includes('frontend')), []);
    assert.equal(report.ok, true);
  });

  // @scenario metarepo/e2e :: Root E2E test does not close a backend integration row
  test('a marker in the root E2E folder does not close a backend integration row, nor a root row', () => {
    const root = metarepo();
    const record = '# E2E Stage\n\nMode: real backend\nTests: e2e/\nStart: command `mise run up`\n\n## Scenarios\n\n- orders/order-flow :: Order is created\n';
    writeChange(root, [[ORDER, 'integration', 'backend'], [LIST, 'unit', 'root']], { e2e: record });
    writeTest(root, 'e2e/orders.spec.ts', [ORDER, LIST]);
    const errs = traceErrors(root);
    assert.equal(errs.length, 2, errs.join('\n'));
    assert.match(errs[0], noTestIn(ORDER, 'backend'));
    assert.match(errs[1], noTestIn(LIST, 'root'));
  });

  // @scenario metarepo/e2e :: e2e level in a single repository is reported
  test('the e2e level is unknown outside a meta-repository change, known inside one', () => {
    const single = metarepo({ clones: null });
    writeChange(single, [[ORDER, 'e2e', '']], { marked: false, column: false });
    assert.deepEqual(traceErrors(single, { markers: false }), [`level "e2e" for "${ORDER}" is not one of unit, integration, manual`]);
    const meta = metarepo();
    writeChange(meta, [[ORDER, 'e2e', 'frontend']]);
    assert.deepEqual(traceErrors(meta), [], 'an e2e row needs no marked test in a repository (check-e2e proves it)');
  });
});

describe('automated test cases name their repository', () => {
  const EMPTY_LIST = 'Empty order list';
  // @scenario metarepo/test-discovery :: Case reference in the wrong repository does not count
  test('a case reference in the frontend does not close a backend case row', () => {
    const root = metarepo();
    const cases = [{ scenario: LIST, name: EMPTY_LIST, labels: 'automated', level: 'integration', repository: 'backend' }];
    writeChange(root, [[LIST, 'integration', 'frontend']], { schema: 'clarify-ai-qa', cases });
    writeTest(root, 'repos/frontend/tests/orders.spec.ts', [{ scenarios: [LIST], cases: [EMPTY_LIST] }]);
    const errs = traceErrors(root);
    assert.deepEqual(errs.filter((m) => m.includes(EMPTY_LIST)), [`no test in \`backend\` references the automated test case "${EMPTY_LIST}" (orders/order-flow)`]);
    writeTest(root, 'repos/backend/tests/test_orders.py', [{ cases: [EMPTY_LIST] }]);
    assert.deepEqual(traceErrors(root).filter((m) => m.includes(EMPTY_LIST)), []);
  });

  test('a case row without a repository, with an unknown one, and a table without the column', () => {
    const root = metarepo();
    const cases = [
      { scenario: LIST, name: EMPTY_LIST, labels: 'automated', level: 'integration', repository: '' },
      { scenario: LIST, name: 'Long list', labels: 'automated', level: 'unit', repository: 'mobile' },
    ];
    writeChange(root, [[LIST, 'integration', 'frontend']], { schema: 'clarify-ai-qa', cases });
    const errs = traceErrors(root, { markers: false });
    assert.deepEqual(errs, [
      `test case row of "${EMPTY_LIST}" (orders/order-flow) names no repository`,
      'test case row of "Long list" (orders/order-flow) names the unknown repository `mobile` (known: root, backend, frontend)',
    ]);
  });
});

describe('a missing clone blocks only the changes that name it', () => {
  // @scenario metarepo/test-discovery :: Archive blocked by a named missing clone
  test('a plan row on a missing clone blocks the archive', () => {
    const root = metarepo({ create: ['backend'] });
    writeChange(root, [[ORDER, 'integration', 'backend'], [LIST, 'integration', 'frontend']]);
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, /the clone `frontend` at repos\/frontend is missing/);
    assert.doesNotMatch(r.err, noTestIn(LIST, 'frontend'));
  });

  // @scenario metarepo/test-discovery :: Archive not blocked by a clone the change does not name
  test('a missing clone the change does not name does not block the archive', () => {
    const root = ready({ create: ['backend'] });
    const r = archive(root);
    assert.equal(r.code, 0, r.err);
    assert.equal(r.err, '');
  });
});

// --- Group 4: the meta-repository mark of a change (design §8) ---------------------------------------------

describe('a change started in a meta-repository is marked', () => {
  /** A new change with no artifact yet: only its .openspec.yaml. */
  const newChange = (root, name = 'add-invoices') => {
    write(root, `openspec/changes/${name}/.openspec.yaml`, 'schema: clarify\ncreated: 2026-11-10\n');
    return name;
  };
  const meta = (root, name) => readFileSync(join(root, 'openspec', 'changes', name, '.openspec.yaml'), 'utf8');
  const writeFirst = (root, name) => {
    write(root, `openspec/changes/${name}/clarifications.md`, '# Clarifications\n');
    return hook(root, 'artifact-feedback.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'openspec', 'changes', name, 'clarifications.md'), content: '# Clarifications\n' } });
  };

  // @scenario metarepo/clones :: Change started after the switch is marked
  test('the first artifact of a new change in a meta-repository writes the mark with the stamp', () => {
    const root = metarepo();
    const name = newChange(root);
    assert.equal(followsMetarepo(root, name), false);
    const r = writeFirst(root, name);
    assert.equal(r.code, 0, r.err);
    assert.match(meta(root, name), /^x-sdd-kit: \S+\nx-sdd-kit-metarepo: true\n$/m);
    assert.equal(followsMetarepo(root, name), true);
    // a second write does not repeat the mark
    writeFirst(root, name);
    assert.equal(meta(root, name).match(/x-sdd-kit-metarepo/g).length, 1);
  });

  // @scenario metarepo/clones :: Change created before the switch but written after it
  test('a change created in a single repository and first written after the switch is marked', () => {
    const root = metarepo({ clones: null, create: [] });
    const name = newChange(root);
    const other = newChange(root, 'add-reports');
    writeFirst(root, other);
    assert.doesNotMatch(meta(root, other), /x-sdd-kit-metarepo/, 'a change started in a single repository is not marked');
    assert.match(meta(root, other), /x-sdd-kit: /);
    writeFileSync(join(root, CLONES_FILE), '# One clone per line\nrepos/backend\n');
    writeFirst(root, name);
    assert.match(meta(root, name), /x-sdd-kit-metarepo: true/);
    assert.equal(followsMetarepo(root, name), true);
    // the change stamped before the switch keeps the single-repository rules
    writeFirst(root, other);
    assert.doesNotMatch(meta(root, other), /x-sdd-kit-metarepo/);
  });
});

// --- Group 5: the repository of task groups (design §5) -----------------------------------------------------

describe('every task group names its repository', () => {
  const TASKS_PATH = (root) => join(root, C_ORDERS, 'tasks.md');
  /** tasks.md from group headings, one open task each. */
  const tasksOf = (...titles) => ['# Tasks', '', ...titles.flatMap((t, k) => [`## ${k + 1}. ${t}`, '', `- [ ] ${k + 1}.1 Do it`, '']), ''].join('\n');
  /** A meta-repository change whose plan is complete; tasks.md is written by the test. */
  const planned = (opts) => {
    const root = metarepo(opts);
    writeChange(root, [[ORDER, 'integration', 'backend']]);
    return root;
  };
  const writeTasks = (root, content) => hook(root, 'answers-gate.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: TASKS_PATH(root), content } });
  const editTasks = (root, old_string, new_string) => hook(root, 'answers-gate.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: TASKS_PATH(root), old_string, new_string } });

  // @scenario metarepo/apply :: Group without a repository blocks the tasks
  test('a group without a repository blocks the write; an Edit that drops the tag too', () => {
    const root = planned();
    const r = writeTasks(root, tasksOf('[backend] Orders', 'Order API', 'Final checks'));
    assert.equal(r.code, 2, 'the write is blocked');
    assert.match(r.err, /tasks of change "add-orders" cannot be written yet/);
    assert.match(r.err, /task group "Order API" \(## 2\) names no repository/);
    const ok = writeTasks(root, tasksOf('[backend] Orders', '[backend] Order API', 'Final checks'));
    assert.equal(ok.code, 0, ok.err);
    // an Edit is judged on the file it would produce
    write(root, `${C_ORDERS}/tasks.md`, tasksOf('[backend] Orders', '[backend] Order API', 'Final checks'));
    const edit = editTasks(root, '## 2. [backend] Order API', '## 2. Order API');
    assert.equal(edit.code, 2);
    assert.match(edit.err, /task group "Order API" \(## 2\) names no repository/);
    assert.equal(editTasks(root, '1.1 Do it', '1.1 Do it well').code, 0);
    // a write the gate cannot see (the shell) is reported after the fact
    write(root, `${C_ORDERS}/tasks.md`, tasksOf('[backend] Orders', 'Order API', 'Final checks'));
    const post = hook(root, 'artifact-feedback.mjs', { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: TASKS_PATH(root), content: '' } });
    assert.match(post.out, /check-tasks found 1 problem\(s\) after writing tasks\.md/);
    assert.match(post.out, /task group \\"Order API\\" \(## 2\) names no repository/);
  });

  // @scenario metarepo/apply :: Group with an unknown repository blocks the tasks
  test('a group with an undeclared repository blocks the write', () => {
    const root = planned();
    const r = writeTasks(root, tasksOf('[backend] Orders', '[mobile] Order screen', 'Final checks'));
    assert.equal(r.code, 2);
    assert.match(r.err, /task group "Order screen" \(## 2\) names the unknown repository `mobile` \(known: root, backend, frontend\)/);
  });

  // @scenario metarepo/apply :: Group with two repositories blocks the tasks
  test('a group with two repositories blocks the write', () => {
    const root = planned();
    const r = writeTasks(root, tasksOf('[backend] Order API', '[backend, frontend] Orders', 'Final checks'));
    assert.equal(r.code, 2);
    assert.match(r.err, /task group "Orders" \(## 2\) names 2 repositories \(backend, frontend\); a group names exactly one repository/);
  });

  // @scenario metarepo/apply :: Final checks group needs no repository
  test('the last of several groups needs no repository', () => {
    const root = planned();
    const r = writeTasks(root, tasksOf('[root] Shared rules', '[backend] Order API', '[frontend] Order screen', 'Final checks'));
    assert.equal(r.code, 0, r.err);
    assert.equal(r.err, '');
  });

  // @scenario metarepo/apply :: Single group needs a repository
  test('a single group is not a final checks group', () => {
    const root = planned();
    const r = writeTasks(root, tasksOf('Order API'));
    assert.equal(r.code, 2);
    assert.match(r.err, /task group "Order API" \(## 1\) names no repository/);
    assert.equal(writeTasks(root, tasksOf('[backend] Order API')).code, 0);
  });

  // @scenario metarepo/clones :: Empty clone list needs root in task groups
  test('with only a comment in the clone list, backend is an unknown repository and root is known', () => {
    const root = metarepo({ clones: '', create: [] });
    writeChange(root, [[ORDER, 'integration', 'root']]);
    const r = writeTasks(root, tasksOf('[root] Rules', '[backend] API', 'Final checks'));
    assert.equal(r.code, 2);
    assert.match(r.err, /task group "API" \(## 2\) names the unknown repository `backend` \(known: root\)/);
    assert.doesNotMatch(r.err, /"Rules"/);
  });

  test('a change without the meta-repository mark and a single repository keep untagged groups', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', '']], { marked: false, column: false });
    assert.equal(writeTasks(root, tasksOf('Order API', 'Final checks')).code, 0);
    const single = metarepo({ clones: null, create: [] });
    writeChange(single, [[ORDER, 'integration', '']], { marked: false, column: false });
    assert.equal(writeTasks(single, tasksOf('Order API')).code, 0);
  });

  // @scenario metarepo/test-discovery :: Archive blocked by a task group on a missing clone
  test('a task group on a missing clone blocks the archive although no plan row names it', () => {
    const root = metarepo({ create: ['backend'] });
    writeChange(root, [[ORDER, 'integration', 'backend']], {
      tasks: '# Tasks\n\n## 1. [backend] Order API\n\n- [x] 1.1 Build it\n\n## 2. [backend] Order rules\n\n- [x] 2.1 Build it\n\n## 3. [frontend] Order screen\n\n- [x] 3.1 Build it\n\n## 4. Final checks\n\n- [x] 4.1 Run the suite\n',
    });
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, /check-tasks: .*tasks\.md:\d+: the clone `frontend` at repos\/frontend is missing; it is named by the task group "Order screen" \(## 3\)/);
  });
});

// --- Group 6: report sections per repository (design §6) ----------------------------------------------------

describe('the implementation report has a section per repository', () => {
  /** apply-report.md with the three sections and the given "## Repository:" section bodies: [[name, lines]]. */
  const reportWith = (sections) =>
    [
      '# Apply Report',
      '',
      '## Manual checks',
      '',
      'None.',
      '',
      '## Not verified automatically',
      '',
      'None.',
      '',
      '## Weakened tests',
      '',
      'None.',
      '',
      ...sections.flatMap(([name, lines]) => [`## Repository: ${name}`, '', ...lines, '']),
    ].join('\n');
  const BOTH = [[ORDER, 'integration', 'backend'], [LIST, 'integration', 'frontend']];
  const OK_LINES = ['Command: mise run test:backend', 'Result: 41 passed'];
  const reportErrors = (root) => errorsOf(checkApplyReport({ root, change: CHANGE }));
  const withTests = (root) => {
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    writeTest(root, 'repos/frontend/tests/orders.spec.ts', [LIST]);
    return root;
  };

  // @scenario metarepo/apply :: Report with a section per repository
  test('a section with a command and a result for each repository of the task groups', () => {
    const root = metarepo();
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES], ['frontend', ['Command: mise run test:frontend', 'Result: 18 passed']]]) });
    assert.deepEqual(reportErrors(root), []);
    withTests(root);
    const r = archive(root);
    assert.equal(r.code, 0, r.err);
  });

  // @scenario metarepo/apply :: Missing section blocks the archive
  test('a repository of the task groups without a section blocks the archive', () => {
    const root = withTests(metarepo());
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES]]) });
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, /check-apply-report: .*apply-report\.md: section "## Repository: frontend" is missing: a task group names `frontend`/);
    assert.doesNotMatch(r.err, /Repository: backend/);
  });

  // @scenario metarepo/apply :: Empty section is reported
  test('a section without a Command: line', () => {
    const root = metarepo();
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES], ['frontend', []]]) });
    assert.deepEqual(reportErrors(root), ['the section for `frontend` names no command (no "Command:" line)', 'the section for `frontend` has no result (no "Result:" line)']);
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES], ['frontend', ['Result: 18 passed']]]) });
    assert.deepEqual(reportErrors(root), ['the section for `frontend` names no command (no "Command:" line)']);
  });

  // @scenario metarepo/apply :: Root without tests reports no tests
  test('a root section with Command: none and Result: no tests', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'manual', 'root']], {
      tasks: '# Tasks\n\n## 1. [root] Shared rules\n\n- [x] 1.1 Write the rules\n',
      report: reportWith([['root', ['Command: none', 'Result: no tests']]]).replace('## Manual checks\n\nNone.', `## Manual checks\n\n### ${'orders/order-flow'} :: ${ORDER}\nReason: cannot be automated: a person judges the layout\nSteps: open the page\nExpected: it looks right`),
    });
    assert.deepEqual(reportErrors(root), []);
  });

  // @scenario metarepo/apply :: Section without a result is reported
  test('a section with a command and no Result: line', () => {
    const root = metarepo();
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES], ['frontend', ['Command: mise run test:frontend']]]) });
    const { findings } = checkApplyReport({ root, change: CHANGE });
    const errs = findings.filter((f) => f.level === 'error');
    assert.deepEqual(errs.map((f) => [f.file, f.message]), [[`${C_ORDERS}/apply-report.md`, 'the section for `frontend` has no result (no "Result:" line)']]);
  });

  // @scenario metarepo/apply :: Repeated section is reported
  test('two sections for one repository', () => {
    const root = metarepo();
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES], ['frontend', OK_LINES], ['backend', ['Command: mise run lint:backend', 'Result: clean']]]) });
    assert.deepEqual(reportErrors(root), ['`backend` has two sections "## Repository: backend"']);
  });

  // @scenario metarepo/apply :: Failed result does not block by itself
  test('a failed result is not judged', () => {
    const root = withTests(metarepo());
    writeChange(root, BOTH, { report: reportWith([['backend', OK_LINES], ['frontend', ['Command: mise run test:frontend', 'Result: 2 tests failed']]]) });
    assert.deepEqual(reportErrors(root), []);
    const r = archive(root);
    assert.equal(r.code, 0, r.err);
  });

  // @scenario metarepo/apply :: Repository named only in the plan needs no section
  test('a repository named by the plan and by no task group needs no section; another section is allowed', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend'], [LIST, 'unit', 'root']], {
      tasks: '# Tasks\n\n## 1. [backend] Order API\n\n- [x] 1.1 Build it\n\n## 2. Final checks\n\n- [x] 2.1 Run the suite\n',
      report: reportWith([['backend', OK_LINES], ['frontend', ['Command: mise run lint:frontend', 'Result: clean']]]),
    });
    assert.deepEqual(reportErrors(root), []);
  });

  test('a change without the meta-repository mark needs no section', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', '']], { marked: false, column: false, tasks: '# Tasks\n\n## 1. Orders\n\n- [x] 1.1 Build it\n', report: reportWith([]) });
    assert.deepEqual(reportErrors(root), []);
  });
});

// --- Group 7: E2E in a meta-repository (design §7) ----------------------------------------------------------

describe('E2E in a meta-repository', () => {
  const STAGE = '# E2E Stage\n\nMode: real backend\nTests: e2e/\nStart: command `mise run up`\n';
  const SKIPPED_STAGE = '# E2E Stage\n\nMode: skipped\n\nThe change does not touch the web interface.\n';
  const e2eErrors = (root, mode = 'archive') => errorsOf(checkE2e({ root, change: CHANGE, mode }));
  /** A root E2E test that references `scenarios`, and (when `run`) one passed run recorded by e2e-run.mjs. */
  function rootE2e(root, scenarios, { run = true, folder = 'e2e' } = {}) {
    write(root, `${folder}/playwright.config.ts`, 'export default { retries: 0 };\n');
    write(root, `${folder}/orders.spec.ts`, [`import { test } from '@playwright/test';`, '', ...scenarios.map((s) => scenarioLine(s)), `test('orders', async () => {});`, ''].join('\n'));
    if (!run) return;
    const report = playwrightReport(join(root, folder), [{ file: 'orders.spec.ts', title: 'orders', line: 3 + scenarios.length, status: 'expected' }]);
    const r = runE2e(join(root, 'openspec', 'tooling', 'bin', 'e2e-run.mjs'), root, CHANGE, report);
    assert.equal(r.code, 0, r.out + r.err);
  }
  const UNVERIFIED = (consent) =>
    `# Apply Report\n\n## Manual checks\n\nNone.\n\n## Not verified automatically\n\n### ${CAP_PATH} :: ${HINT}\nReason: E2E switched off\n${consent ? 'Consent: "skip E2E, QA checks the hint" (developer, 2026-11-10)\n' : ''}\n## Weakened tests\n\nNone.\n\n## Repository: frontend\n\nCommand: mise run test:frontend\nResult: 18 passed\n`;
  const CAP_PATH = 'orders/order-flow';

  // @scenario metarepo/e2e :: Skipped stage without interface passes
  test('a clarify-ai-qa change with the stage skipped and no e2e case passes', () => {
    const root = metarepo();
    const cases = [{ scenario: ORDER, name: 'Order with one item', labels: 'automated', level: 'integration', repository: 'backend' }];
    writeChange(root, [[ORDER, 'integration', 'backend']], { schema: 'clarify-ai-qa', cases, e2e: SKIPPED_STAGE });
    assert.deepEqual(e2eErrors(root), []);
    assert.deepEqual(e2eErrors(root, 'format'), []);
  });

  // @scenario metarepo/e2e :: Frontend-only scenario proven by E2E
  test('an e2e row with a root E2E test and a passed run does not block the archive', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: STAGE });
    rootE2e(root, [HINT]);
    const r = archive(root);
    assert.equal(r.code, 0, r.err);
    assert.equal(r.err, '');
  });

  // @scenario metarepo/e2e :: e2e row without an E2E test blocks the archive
  test('an e2e row without an E2E test that references it blocks the archive', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: STAGE });
    rootE2e(root, [ORDER], { run: false });
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, /check-e2e: .*E2E scenario "Empty phone shows a hint" \(orders\/order-flow\) has no E2E test: no test in e2e\/ references it/);
    // without a stage record at all the row is not silently dropped
    rmSync(join(root, C_ORDERS, 'e2e.md'));
    const none = archive(root);
    assert.equal(none.code, 2);
    assert.match(none.err, /check-e2e: .*plan row of "Empty phone shows a hint" \(orders\/order-flow\) has the level e2e, but the change has no e2e\.md/);
  });

  // @scenario metarepo/e2e :: e2e row with E2E skipped needs consent
  test('with E2E skipped an e2e row needs an agreed entry under "Not verified automatically"', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: SKIPPED_STAGE });
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, /E2E is skipped: the e2e scenario "Empty phone shows a hint" \(orders\/order-flow\) is not agreed under "Not verified automatically" in apply-report\.md/);
    // an entry without consent is not enough
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: SKIPPED_STAGE, report: UNVERIFIED(false) });
    const unagreed = archive(root);
    assert.equal(unagreed.code, 2);
    assert.match(unagreed.err, /"Empty phone shows a hint" \(orders\/order-flow\) under "Not verified automatically" has no "Consent:" line/);
  });

  // @scenario metarepo/e2e :: e2e row with E2E skipped passes with consent
  test('with E2E skipped an agreed entry covers the e2e row', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: SKIPPED_STAGE, report: UNVERIFIED(true) });
    const r = archive(root);
    assert.equal(r.code, 0, r.err);
  });

  // @scenario metarepo/e2e :: Root E2E test proves a frontend scenario
  test('a test in the root e2e/ folder with a passed run proves a frontend row', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend'], [HINT, 'e2e', 'frontend']], { e2e: STAGE });
    writeTest(root, 'repos/backend/tests/test_orders.py', [ORDER]);
    rootE2e(root, [HINT]);
    assert.deepEqual(e2eErrors(root), []);
    // control: the row counts, so a later failed run would be reported
    appendFileSync(join(root, 'e2e', 'orders.spec.ts'), '// edited\n');
    assert.match(e2eErrors(root).join('\n'), /E2E scenario "Empty phone shows a hint" \(orders\/order-flow\) has no valid E2E result after the change of its test file e2e\/orders\.spec\.ts/);
  });

  // @scenario metarepo/e2e :: Clone Playwright test does not count
  test('a Playwright test in the frontend clone is not an E2E test of the stage', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: STAGE });
    write(root, 'e2e/playwright.config.ts', 'export default { retries: 0 };\n');
    writeTest(root, 'repos/frontend/tests/phone.spec.ts', [HINT]);
    assert.ok(collectMarkers(root).some((m) => m.file === 'repos/frontend/tests/phone.spec.ts'), 'the clone test is a marked test of its clone');
    const errs = e2eErrors(root);
    assert.ok(errs.includes('E2E scenario "Empty phone shows a hint" (orders/order-flow) has no E2E test: no test in e2e/ references it (tests outside the E2E test folder do not count)'), errs.join('\n'));
  });

  // @scenario metarepo/e2e :: Test folder inside a clone is reported
  test('a stage record whose test folder is inside a clone', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: STAGE.replace('Tests: e2e/', 'Tests: repos/frontend/e2e/') });
    const expected = 'the E2E test folder "repos/frontend/e2e/" is inside the clone `frontend`: in a meta-repository it must be a folder of the root, outside every clone';
    assert.ok(e2eErrors(root, 'format').includes(expected), e2eErrors(root, 'format').join('\n'));
    assert.ok(e2eErrors(root).includes(expected));
    // the same record on a single-repository change is fine
    const single = metarepo({ clones: null, create: ['frontend'] });
    writeChange(single, [[HINT, 'integration', '']], { marked: false, column: false, e2e: STAGE.replace('Tests: e2e/', 'Tests: repos/frontend/e2e/') });
    assert.deepEqual(errorsOf(checkE2e({ root: single, change: CHANGE, mode: 'format' })), []);
  });

  // @scenario metarepo/e2e :: One root command starts both clones
  test('start-check runs the start command from the root and requests the one address', async () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend']], { e2e: STAGE });
    const { createServer } = await import('node:net');
    const port = await new Promise((done) => {
      const s = createServer().listen(0, '127.0.0.1', () => {
        const p = s.address().port;
        s.close(() => done(p));
      });
    });
    // stands in for `mise run up`: paths relative to the root reach both clones, then the app serves
    const start = `pwd > started-in.txt && touch repos/backend/.up repos/frontend/.up && node -e "require('http').createServer((q,s)=>s.end('ok')).listen(${port},'127.0.0.1')"`;
    const url = `http://127.0.0.1:${port}/`;
    const { spawn } = await import('node:child_process');
    const r = await new Promise((done) => {
      const p = spawn(process.execPath, [join(root, 'openspec', 'tooling', 'bin', 'start-check.mjs'), '--change', CHANGE, '--start', start, '--url', url, '--timeout', '20', '--interval', '0.2'], { cwd: join(root, 'repos', 'frontend') });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.stderr.on('data', (d) => (out += d));
      p.on('close', (code) => done({ code, out }));
    });
    assert.equal(r.code, 0, r.out);
    assert.equal(readFileSync(join(root, 'started-in.txt'), 'utf8').trim(), realpathSync(root));
    assert.ok(existsSync(join(root, 'repos', 'backend', '.up')) && existsSync(join(root, 'repos', 'frontend', '.up')), 'both clones were reached');
    const rec = JSON.parse(readFileSync(join(root, C_ORDERS, 'start-check.json'), 'utf8'));
    assert.deepEqual([rec.ok, rec.start, rec.url, rec.status], [true, start, url, 200]);
  });
});

describe('an e2e row in the other checks', () => {
  test('the review input does not call an e2e row missing', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend'], [ORDER, 'integration', 'backend']]);
    const input = testReviewInput(root, join(root, C_ORDERS));
    const byName = Object.fromEntries(input.scenarios.map((s) => [s.scenario, s.missing]));
    assert.deepEqual(byName, { [HINT]: false, [ORDER]: true });
    assert.doesNotMatch(renderTestReviewInput(CHANGE, input).split(`"${ORDER}"`)[0], /Missing:/);
  });

  test('an e2e row is the automated companion of a dangerous scenario', () => {
    const root = metarepo();
    writeChange(root, [[HINT, 'e2e', 'frontend'], [HINT, 'manual', 'frontend']]);
    const plan = join(root, C_ORDERS, 'verification-plan.md');
    writeFileSync(plan, readFileSync(plan, 'utf8').replace('cannot be automated: a person judges the layout', 'dangerous: many users see the hint'));
    assert.deepEqual(traceErrors(root, { markers: false }).filter((m) => /dangerous/.test(m)), []);
    // control: without the e2e row the dangerous scenario is reported
    writeFileSync(plan, readFileSync(plan, 'utf8').replace(/^\| orders\/order-flow \| Orders are managed \| Empty phone shows a hint \| e2e \|.*\n/m, ''));
    assert.deepEqual(traceErrors(root, { markers: false }).filter((m) => /dangerous/.test(m)), [`dangerous scenario "${HINT}" (orders/order-flow) also needs a unit or integration row or an E2E test`]);
  });
});

// --- Group 8: the root's gates and the guard of a clone's OpenSpec (design §8) ------------------------------

describe('root changes keep their gates in a meta-repository', () => {
  // @scenario metarepo/clones :: Unanswered Main round blocks the proposal in a meta-repository
  test('a blank answer of the Main round blocks the proposal of a meta-repository change', () => {
    const root = metarepo();
    writeChange(root, [[ORDER, 'integration', 'backend']], { schema: 'clarify' });
    const clar = (answer) =>
      `# Clarifications\n\n## Sources\n\n- [desc] Developer description: "orders"\n\n## Main round\n\n### Q1. Which orders are listed?\nFor: Dev\nWhy this is asked: the list\n- A. all\n- B. open only\n- X. Other (please specify)\n\n[Answer]:${answer}\n`;
    write(root, `${C_ORDERS}/clarifications.md`, clar(''));
    const writeProposal = () => hook(root, 'answers-gate.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, C_ORDERS, 'proposal.md'), content: '## Why\n\nOrders.\n' } });
    const r = writeProposal();
    assert.equal(r.code, 2, 'the write is blocked');
    assert.match(r.err, /proposal of change "add-orders" cannot be written yet — the Main round/);
    assert.match(r.err, /clarifications\.md:\d+: Q1 is not answered/);
  });

  // @scenario metarepo/clones :: Open task blocks the archive in a meta-repository
  test('an open task blocks the archive of a covered meta-repository change and is named', () => {
    const root = ready();
    assert.equal(archive(root).code, 0, 'the covered change archives');
    write(root, `${C_ORDERS}/tasks.md`, '# Tasks\n\n## 1. [backend] Orders in backend\n\n- [x] 1.1 Write the tests and the code\n- [ ] 1.2 Add the order filter\n\n## 2. Final checks\n\n- [x] 2.1 Run the full suite\n');
    const r = archive(root);
    assert.equal(r.code, 2, 'the archive is blocked');
    assert.match(r.err, /1 task\(s\) in tasks\.md are not done: 1\.2 Add the order filter/);
  });
});

describe("a clone's own OpenSpec is not edited from the root", () => {
  const CLONE_MSG = /OpenSpec of the clone `backend` \(repos\/backend\)[\s\S]*from a session started in repos\/backend/;
  const pre = (root, tool_name, tool_input) => hook(root, 'answers-gate.mjs', { hook_event_name: 'PreToolUse', tool_name, tool_input });
  const bash = (root, command) => pre(root, 'Bash', { command });
  const withCloneOpenspec = () => {
    const root = metarepo();
    write(root, 'repos/backend/openspec/changes/add-export/proposal.md', '## Why\n\nExport.\n');
    write(root, 'repos/backend/openspec/changes/add-export/tasks.md', '# Tasks\n');
    write(root, 'repos/backend/openspec/specs/orders/spec.md', '# Orders\n');
    write(root, 'repos/backend/openspec/config.yaml', 'schema: spec-driven\n');
    return root;
  };

  // @scenario metarepo/clones :: Editing a clone's proposal is blocked
  test("a file-tool write to a clone's proposal is blocked with the clone's name and folder", () => {
    const root = withCloneOpenspec();
    const file = 'repos/backend/openspec/changes/add-export/proposal.md';
    const w = pre(root, 'Write', { file_path: file, content: 'x' });
    assert.equal(w.code, 2, 'Write is blocked');
    assert.match(w.err, CLONE_MSG);
    const e = pre(root, 'Edit', { file_path: join(root, file), old_string: 'Export.', new_string: 'Export all.' });
    assert.equal(e.code, 2, 'Edit is blocked');
    assert.match(e.err, CLONE_MSG);
    const m = pre(root, 'MultiEdit', { file_path: join(root, file), edits: [{ old_string: 'Export.', new_string: 'x' }] });
    assert.equal(m.code, 2, 'MultiEdit is blocked');
    // control: the clone's own code and the root's changes are not guarded
    assert.equal(pre(root, 'Write', { file_path: 'repos/backend/orders/views.py', content: 'x' }).code, 0);
    assert.equal(pre(root, 'Write', { file_path: 'repos/backend/openspec-notes.md', content: 'x' }).code, 0);
    // control: the same project without the clone list is not guarded
    rmSync(join(root, CLONES_FILE));
    assert.equal(pre(root, 'Write', { file_path: file, content: 'x' }).code, 0);
  });

  // @scenario metarepo/clones :: Shell write to a clone's OpenSpec is blocked
  test("a shell redirect, tee, sed -i, cp or mv into a clone's OpenSpec is blocked", () => {
    const root = withCloneOpenspec();
    const r = bash(root, 'echo x >> repos/backend/openspec/config.yaml');
    assert.equal(r.code, 2);
    assert.match(r.err, CLONE_MSG);
    for (const cmd of [
      'echo x > ./repos/backend/openspec/config.yaml',
      'printf x | tee -a repos/backend/openspec/config.yaml',
      "sed -i 's/a/b/' repos/backend/openspec/specs/orders/spec.md",
      'cp notes.md repos/backend/openspec/changes/add-export/proposal.md',
      'mv repos/backend/openspec/changes/add-export repos/backend/old-export',
      'echo x >"repos/frontend/openspec/config.yaml"',
    ]) {
      const b = bash(root, cmd);
      assert.equal(b.code, 2, `blocked: ${cmd}`);
    }
    // control: writes outside every clone's OpenSpec pass
    assert.equal(bash(root, 'echo x >> repos/backend/README.md').code, 0);
    assert.equal(bash(root, 'cp repos/backend/openspec/config.yaml /tmp/config.yaml').code, 0);
  });

  // @scenario metarepo/clones :: Write through an absolute path is blocked
  test("an absolute path into a clone's OpenSpec is blocked, by a file tool and by the shell", () => {
    const root = withCloneOpenspec();
    const abs = join(root, 'repos/backend/openspec/specs/orders/spec.md');
    const w = pre(root, 'Write', { file_path: abs, content: 'x' });
    assert.equal(w.code, 2);
    assert.match(w.err, CLONE_MSG);
    const b = bash(root, `echo x > ${abs}`);
    assert.equal(b.code, 2);
    assert.match(b.err, CLONE_MSG);
  });

  // @scenario metarepo/clones :: Removing a clone's OpenSpec file is blocked
  test("rm of a clone's OpenSpec file or folder is blocked", () => {
    const root = withCloneOpenspec();
    const r = bash(root, 'rm repos/backend/openspec/changes/add-export/tasks.md');
    assert.equal(r.code, 2);
    assert.match(r.err, CLONE_MSG);
    assert.equal(bash(root, 'rm -rf repos/backend/openspec').code, 2);
    assert.equal(bash(root, 'git status && rm -f ./repos/backend/openspec/specs/orders/spec.md').code, 2);
    assert.ok(existsSync(join(root, 'repos/backend/openspec/changes/add-export/tasks.md')));
    // control: removing a file of the clone's code passes
    assert.equal(bash(root, 'rm repos/backend/README.md').code, 0);
  });

  // @scenario metarepo/clones :: Reading a clone's OpenSpec is allowed
  test("reading a clone's OpenSpec is not blocked", () => {
    const root = withCloneOpenspec();
    const file = 'repos/backend/openspec/specs/orders/spec.md';
    for (const r of [
      pre(root, 'Read', { file_path: join(root, file) }),
      bash(root, `cat ${file}`),
      bash(root, `grep -rn Orders repos/backend/openspec | head -5`),
      bash(root, `cat ${file} > /tmp/orders-spec-copy.md`),
      bash(root, `diff ${file} repos/frontend/README.md 2>/dev/null`),
    ]) {
      assert.equal(r.code, 0, r.err);
      assert.equal(r.err, '');
    }
  });
});

// --- Group 9: the installer (design §9) -----------------------------------------------------------------------

/** Clones declared in the project's list: ['name=path', ...]. */
const declared = (root) => readClones(root).clones.map((c) => `${c.name}=${c.path}`);
const clonesText = (root) => readFileSync(join(root, CLONES_FILE), 'utf8');
/** In-process install with terminal answers: the installer believes it runs in a terminal. */
const installAsked = (root, answers, extra = {}) => {
  const io = scripted(answers);
  return install({ target: root, skipOpenspec: true, interactive: true, io, ...extra }).then((result) => ({ result, io }));
};
const KIND = /meta-repository.*single repository|single repository.*meta-repository/i;
const PATH_Q = /clone path/i;

describe('the installer asks for the repository kind in a terminal', () => {
  // @scenario metarepo/clones :: Installer in a terminal asks for the repository kind
  test('install asks the repository kind right after the language question', async () => {
    const root = metarepo({ kit: false, clones: null });
    const { io } = await installAsked(root, ['English', 'single']);
    assert.equal(io.asked.length, 2, io.asked.join('\n'));
    assert.match(io.asked[0], /Language of the clarifying questions/);
    assert.match(io.asked[1], KIND);
  });

  // @scenario metarepo/clones :: Single repository answer creates no list
  test('the answer "single repository" creates no clone list', async () => {
    const root = metarepo({ kit: false, clones: null });
    await installAsked(root, ['English', 'single repository']);
    assert.equal(existsSync(join(root, CLONES_FILE)), false);
    assert.ok(existsSync(join(root, 'openspec', 'tooling', 'kit.json')), 'the kit is installed');
    const empty = metarepo({ kit: false, clones: null });
    await installAsked(empty, ['English', '']);
    assert.equal(existsSync(join(empty, CLONES_FILE)), false, 'an empty answer is the default: single repository');
  });

  // @scenario metarepo/clones :: Invalid path in a terminal is asked again
  test('a path outside the root is explained and asked again', async () => {
    const root = metarepo({ kit: false, clones: null });
    const { io } = await installAsked(root, ['English', 'meta-repository', '../backend', 'repos/backend', '']);
    assert.equal(io.asked.filter((q) => PATH_Q.test(q)).length, 3, 'the path is asked again after the invalid answer');
    assert.ok(io.said.some((t) => /`\.\.\/backend` is outside the root/.test(t)), io.said.join('\n'));
    assert.deepEqual(declared(root), ['backend=repos/backend']);
    assert.doesNotMatch(clonesText(root), /\.\.\/backend/);
  });

  // @scenario metarepo/clones :: Installer in a terminal asks the clone paths
  test('clone paths are asked until an empty answer', async () => {
    const root = metarepo({ kit: false, clones: null });
    const { io } = await installAsked(root, ['English', 'm', 'repos/backend', 'repos/frontend', '']);
    assert.equal(io.asked.filter((q) => PATH_Q.test(q)).length, 3);
    assert.deepEqual(declared(root), ['backend=repos/backend', 'frontend=repos/frontend']);
    assert.match(clonesText(root), /^# .*<path> or <name>=<path>/, 'the list starts with its format comment');
  });

  // @scenario metarepo/clones :: Update asks no repository question
  test('update in a terminal asks no repository question and creates no list', async () => {
    const root = metarepo({ kit: false, clones: null });
    await install({ target: root, skipOpenspec: true, yes: true, json: true });
    const { io } = await installAsked(root, [], { command: 'update' });
    assert.deepEqual(io.asked, []);
    assert.equal(existsSync(join(root, CLONES_FILE)), false);
    // control: install in the same terminal asks it
    const again = metarepo({ kit: false, clones: null });
    const asked = await installAsked(again, ['English', 'single']);
    assert.ok(asked.io.asked.some((q) => KIND.test(q)));
  });
});

describe('the --metarepo flag of install and update', () => {
  // @scenario metarepo/clones :: Install with clones in the flag
  test('install --yes --metarepo with named entries declares both clones and asks nothing', async () => {
    const root = metarepo({ kit: false, clones: null });
    const { io } = await installAsked(root, [], { yes: true, metarepo: 'backend=repos/backend,frontend=repos/frontend' });
    assert.deepEqual(io.asked, [], 'no question with --yes');
    assert.deepEqual(declared(root), ['backend=repos/backend', 'frontend=repos/frontend']);
    // the same through the command line
    const cli = metarepo({ kit: false, clones: null });
    const r = installer(cli, ['install', '--yes', '--metarepo', 'backend=repos/backend,frontend=repos/frontend']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(declared(cli), ['backend=repos/backend', 'frontend=repos/frontend']);
  });

  // @scenario metarepo/clones :: Flag with a bare path
  test('a bare path in the flag is named after its folder', () => {
    const root = metarepo({ kit: false, clones: null });
    const r = installer(root, ['install', '--yes', '--metarepo', 'repos/backend']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(declared(root), ['backend=repos/backend']);
  });

  // @scenario metarepo/clones :: Install with the flag alone
  test('the flag alone creates the list with its format comment and no clone line', () => {
    for (const args of [['install', '--yes', '--metarepo'], ['install', '--metarepo', '--yes']]) {
      const root = metarepo({ kit: false, clones: null });
      const r = installer(root, args);
      assert.equal(r.code, 0, r.out + r.err);
      assert.ok(existsSync(join(root, CLONES_FILE)));
      const lines = clonesText(root).split('\n').filter((l) => l.trim());
      assert.ok(lines.length >= 1 && lines.every((l) => l.startsWith('#')), clonesText(root));
      assert.match(clonesText(root), /<path> or <name>=<path>/);
      assert.deepEqual(declared(root), []);
    }
  });

  // @scenario metarepo/clones :: Install without the flag stays a single repository
  test('install --yes without the flag creates no list', () => {
    const root = metarepo({ kit: false, clones: null });
    const r = installer(root, ['install', '--yes']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(existsSync(join(root, CLONES_FILE)), false);
  });

  // @scenario metarepo/clones :: Invalid flag entry writes nothing
  test('an invalid entry stops the installer before it writes', () => {
    const root = metarepo({ kit: false, clones: null });
    const before = git(root, 'status', '--porcelain', '--untracked-files=all');
    const r = installer(root, ['install', '--yes', '--metarepo', 'backend=']);
    assert.equal(r.code, 1);
    assert.match(r.err, /--metarepo entry `backend=`/);
    assert.equal(existsSync(join(root, 'openspec')), false, 'no openspec/ folder');
    assert.equal(existsSync(join(root, '.claude')), false, 'no .claude/ folder');
    assert.equal(git(root, 'status', '--porcelain', '--untracked-files=all'), before, 'no file is created');
  });

  // @scenario metarepo/clones :: Update switches a single repository to a meta-repository
  test('update --metarepo turns an installed single repository into a meta-repository', () => {
    const root = metarepo({ kit: false, clones: null });
    assert.equal(installer(root, ['install', '--yes']).code, 0);
    assert.equal(existsSync(join(root, CLONES_FILE)), false);
    const r = installer(root, ['update', '--yes', '--metarepo', 'repos/backend']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(declared(root), ['backend=repos/backend']);
  });

  // @scenario metarepo/clones :: Update adds clones to an existing list
  test('update --metarepo adds new clones and skips known ones', () => {
    const root = metarepo({ kit: false, clones: null });
    assert.equal(installer(root, ['install', '--yes', '--metarepo', 'repos/backend']).code, 0);
    const r = installer(root, ['update', '--yes', '--metarepo', 'repos/backend,repos/frontend']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(declared(root), ['backend=repos/backend', 'frontend=repos/frontend']);
    assert.equal(clonesText(root).match(/repos\/backend/g).length, 1, 'backend is declared once');
  });

  // @scenario metarepo/clones :: Known path under another name writes nothing
  test('a known path under another name stops the installer and keeps the list', () => {
    const root = metarepo({ kit: false, clones: null });
    assert.equal(installer(root, ['install', '--yes', '--metarepo', 'repos/backend']).code, 0);
    const before = clonesText(root);
    const r = installer(root, ['update', '--yes', '--metarepo', 'api=repos/backend']);
    assert.equal(r.code, 1);
    assert.match(r.err, /`repos\/backend` is already declared as `backend`/);
    assert.equal(clonesText(root), before);
  });

  // @scenario metarepo/clones :: Update keeps the clone list
  test('update without the flag keeps the list byte for byte', () => {
    const root = metarepo({ kit: false, clones: null });
    assert.equal(installer(root, ['install', '--yes', '--metarepo', 'repos/backend']).code, 0);
    appendFileSync(join(root, CLONES_FILE), '# our own note\n');
    const before = clonesText(root);
    const r = installer(root, ['update', '--yes']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(clonesText(root), before);
    const manifest = JSON.parse(readFileSync(join(root, 'openspec', 'tooling', 'kit-manifest.json'), 'utf8'));
    assert.equal(CLONES_FILE in manifest.files, false, 'the list is not a kit file');
  });

  // @scenario metarepo/clones :: Path not yet on disk is accepted
  test('a clone path that does not exist yet is declared and reported as missing', async () => {
    const root = metarepo({ kit: false, clones: null, create: ['backend'] });
    const r = installer(root, ['install', '--yes', '--metarepo', 'repos/backend,repos/frontend']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.deepEqual(declared(root), ['backend=repos/backend', 'frontend=repos/frontend']);
    assert.match(r.out, /! clones: the clone `frontend` at repos\/frontend is missing/);
    const asked = metarepo({ kit: false, clones: null, create: [] });
    await installAsked(asked, ['English', 'meta-repository', 'repos/frontend', '']);
    assert.deepEqual(declared(asked), ['frontend=repos/frontend']);
  });
});

describe('the kit changes nothing inside a clone', () => {
  // @scenario metarepo/clones :: Install leaves the clones untouched
  test('install and the health check leave both clones clean', () => {
    const root = metarepo({ kit: false, clones: null });
    const r = installer(root, ['install', '--yes', '--metarepo', 'repos/backend,repos/frontend']);
    assert.equal(r.code, 0, r.out + r.err);
    const d = doctorRun(root);
    assert.match(d.out, /\nReady\.\n$/, d.out);
    for (const name of ['backend', 'frontend']) {
      assert.equal(gitStatus(join(root, 'repos', name)), '', `${name} is clean`);
      assert.equal(existsSync(join(root, 'repos', name, 'openspec')), false);
      assert.equal(existsSync(join(root, 'repos', name, '.claude')), false);
    }
  });

  // @scenario metarepo/clones :: Uninstall leaves the clones and the list
  test('uninstall leaves both clones clean and keeps openspec/clones', () => {
    const root = metarepo({ kit: false, clones: null });
    assert.equal(installer(root, ['install', '--yes', '--metarepo', 'repos/backend,repos/frontend']).code, 0);
    const before = clonesText(root);
    const r = installer(root, ['uninstall', '--yes']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(existsSync(join(root, 'openspec', 'tooling', 'kit.json')), false, 'the kit is removed');
    assert.equal(clonesText(root), before);
    for (const name of ['backend', 'frontend']) assert.equal(gitStatus(join(root, 'repos', name)), '', `${name} is clean`);
  });
});

describe('projects without clones are unchanged', () => {
  // @scenario metarepo/clones :: Single repository change archives as before
  test('a single repository change without repositories archives, and is blocked exactly as before', () => {
    const root = metarepo({ clones: null, create: [] });
    writeChange(root, [[ORDER, 'integration', '']], {
      marked: false,
      column: false,
      tasks: '# Tasks\n\n## 1. Orders\n\n- [x] 1.1 Write the tests and the code\n\n## 2. Final checks\n\n- [x] 2.1 Run the suite\n',
      report: '# Apply Report\n\n## Manual checks\n\nNone.\n\n## Not verified automatically\n\nNone.\n\n## Weakened tests\n\nNone.\n',
    });
    writeTest(root, 'tests/orders.test.mjs', [ORDER]);
    const ok = archive(root);
    assert.equal(ok.code, 0, ok.err);
    assert.equal(ok.err, '');
    // without the test the scenario is reported as in a single repository: no repository in the message
    rmSync(join(root, 'tests', 'orders.test.mjs'));
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.err, new RegExp(`"${ORDER}"`));
    assert.doesNotMatch(r.err, /repositor|clone/i);
  });
});

// --- Group 10: the health check (design §9) -------------------------------------------------------------------

/** Doctor items about clones: [level, message]. */
const cloneItems = (root) => doctor(root).filter((i) => i.check === 'clones').map((i) => [i.level, i.message]);
/** A meta-repository with the kit installed by the installer (hooks registered), clones from `clones`. */
const installed = (clones, create = ['backend', 'frontend']) => {
  const root = metarepo({ kit: false, clones: null, create });
  const r = installer(root, ['install', '--yes', '--metarepo', ...(clones ? [clones] : [])]);
  assert.equal(r.code, 0, r.out + r.err);
  return root;
};
const setList = (root, text) => writeFileSync(join(root, CLONES_FILE), `# One clone per line\n${text}`);

describe('the health check reports the clone list', () => {
  // @scenario metarepo/clones :: Repeated clone name is reported
  test('a name declared twice is an error', () => {
    const root = installed('repos/backend');
    setList(root, 'repos/backend\napi/backend\n');
    assert.deepEqual(cloneItems(root).filter(([l]) => l === 'error'), [['error', 'openspec/clones:3: the name `backend` is declared twice']]);
    const d = doctorRun(root);
    assert.equal(d.code, 1);
    assert.match(d.out, /✗ clones: openspec\/clones:3: the name `backend` is declared twice/);
    assert.doesNotMatch(d.out, /\nReady\.\n$/);
  });

  // @scenario metarepo/clones :: Repeated clone path is reported
  test('a path declared twice is an error', () => {
    const root = installed('repos/backend');
    setList(root, 'repos/backend\napi=repos/backend\n');
    assert.deepEqual(cloneItems(root).filter(([l]) => l === 'error'), [['error', 'openspec/clones:3: the path `repos/backend` is declared twice']]);
  });

  // @scenario metarepo/clones :: Reserved name is reported
  test('the name root is an error', () => {
    const root = installed('repos/backend');
    setList(root, 'root=repos/core\n');
    assert.deepEqual(cloneItems(root).filter(([l]) => l === 'error'), [['error', 'openspec/clones:2: the name `root` is reserved for the root']]);
  });

  // @scenario metarepo/clones :: Path outside the root is reported
  test('a path outside the root is an error', () => {
    const root = installed('repos/backend');
    setList(root, '../backend\n');
    assert.deepEqual(cloneItems(root).filter(([l]) => l === 'error'), [['error', 'openspec/clones:2: `../backend` is outside the root']]);
  });

  // @scenario metarepo/clones :: Name with a space is reported
  test('a name with a space is an error', () => {
    const root = installed('repos/backend');
    setList(root, 'order api=repos/backend\n');
    const errors = cloneItems(root).filter(([l]) => l === 'error');
    assert.equal(errors.length, 1);
    assert.match(errors[0][1], /^openspec\/clones:2: the name `order api` has a character that is not allowed/);
  });

  // @scenario metarepo/clones :: Health check reports a missing clone
  test('a declared clone without its folder is a warning; the check still ends with "Ready."', () => {
    const root = installed('repos/backend,repos/frontend', ['backend']);
    assert.deepEqual(cloneItems(root).filter(([l]) => l !== 'ok'), [['warning', 'the clone `frontend` at repos/frontend is missing']]);
    const d = doctorRun(root);
    assert.match(d.out, /! clones: the clone `frontend` at repos\/frontend is missing/);
    assert.match(d.out, /\nReady\.\n$/, d.out);
    assert.equal(d.code, 0);
  });

  // @scenario metarepo/clones :: Health check says nothing about clones
  test('a project without openspec/clones hears nothing about clones, even with a nested repository', () => {
    const root = metarepo({ kit: false, clones: null });
    assert.equal(installer(root, ['install', '--yes']).code, 0);
    const d = doctorRun(root);
    assert.doesNotMatch(d.out, /clone|nested|repos\/|own git/i);
    assert.match(d.out, /\nReady\.\n$/, d.out);
    assert.deepEqual(cloneItems(root), []);
  });
});

describe('the health check offers undeclared nested repositories', () => {
  // @scenario metarepo/clones :: Doctor adds a clone in a terminal
  test('the answer "yes" appends the offered line', async () => {
    const root = installed('repos/backend');
    const io = scripted(['yes']);
    const items = await runDoctor(root, { interactive: true, io });
    assert.equal(io.asked.length, 1);
    assert.match(io.asked[0], /repos\/frontend/);
    assert.deepEqual(declared(root), ['backend=repos/backend', 'frontend=repos/frontend']);
    assert.match(clonesText(root), /\nrepos\/frontend\n$/);
    assert.ok(items.some((i) => i.check === 'clones' && i.level === 'ok' && /repos\/frontend/.test(i.message)));
    // asked no more once it is declared
    const again = scripted([]);
    await runDoctor(root, { interactive: true, io: again });
    assert.deepEqual(again.asked, []);
  });

  // @scenario metarepo/clones :: Developer answers no
  test('the answer "no" keeps the list and the next run asks again', async () => {
    const root = installed('repos/backend');
    const before = clonesText(root);
    const io = scripted(['no']);
    await runDoctor(root, { interactive: true, io });
    assert.equal(clonesText(root), before);
    const next = scripted(['n']);
    await runDoctor(root, { interactive: true, io: next });
    assert.equal(next.asked.length, 1);
    assert.match(next.asked[0], /repos\/frontend/);
    assert.equal(clonesText(root), before);
  });

  // @scenario metarepo/clones :: Doctor only prints without a terminal
  test('without a terminal the line is printed and nothing is written', async () => {
    const root = installed('repos/backend');
    const before = clonesText(root);
    const d = doctorRun(root);
    assert.match(d.out, /! clones: repos\/frontend has its own git but is not declared in openspec\/clones/);
    assert.match(d.out, /fix: add the line `repos\/frontend` to openspec\/clones/);
    assert.match(d.out, /\nReady\.\n$/, 'the offer never changes "Ready."');
    assert.equal(clonesText(root), before);
    // --yes in a terminal only prints too
    const io = scripted([]);
    await runDoctor(root, { interactive: false, io });
    assert.deepEqual(io.asked, []);
  });

  // @scenario metarepo/clones :: Offered line avoids a known name
  test('a folder named like a declared clone is offered as <parent>-<folder>', () => {
    const root = installed('repos/backend,repos/frontend');
    mkdirSync(join(root, 'services', 'backend'), { recursive: true });
    git(join(root, 'services', 'backend'), 'init', '-q');
    const d = doctorRun(root);
    assert.match(d.out, /add the line `services-backend=services\/backend` to openspec\/clones/);
    assert.deepEqual(parseClones(`services-backend=services/backend\n`).errors, [], 'the offered line is a valid entry');
  });

  // @scenario metarepo/clones :: Install never asks about nested repositories
  test('install --yes --metarepo asks nothing and its health check prints the undeclared clone', async () => {
    const root = metarepo({ kit: false, clones: null });
    const { result, io } = await installAsked(root, [], { yes: true, metarepo: 'repos/backend' });
    assert.deepEqual(io.asked, []);
    assert.match(result.doctorText, /repos\/frontend has its own git but is not declared/);
    // the process with a terminal-less stdin, end to end
    const cli = metarepo({ kit: false, clones: null });
    const r = installer(cli, ['install', '--yes', '--metarepo', 'repos/backend']);
    assert.equal(r.code, 0, r.out + r.err);
    assert.match(r.out, /add the line `repos\/frontend` to openspec\/clones/);
    assert.match(r.out, /\nReady\.\n$/, r.out);
    assert.deepEqual(declared(cli), ['backend=repos/backend']);
  });

  // @scenario metarepo/clones :: Repository inside dependencies is not offered
  test('repositories inside dependency folders, hidden folders and declared clones are not offered', () => {
    const root = installed('repos/backend,repos/frontend');
    for (const dir of ['repos/frontend/node_modules/pkg', 'node_modules/pkg', '.cache/tool', 'repos/backend/vendor/lib', 'a/b/c/d']) {
      mkdirSync(join(root, dir), { recursive: true });
      git(join(root, dir), 'init', '-q');
    }
    mkdirSync(join(root, 'tools', 'gen'), { recursive: true });
    git(join(root, 'tools', 'gen'), 'init', '-q');
    const d = doctorRun(root);
    assert.doesNotMatch(d.out, /node_modules|\.cache|vendor|a\/b\/c\/d/);
    assert.match(d.out, /tools\/gen has its own git/, 'control: a nested repository three levels deep or less is offered');
  });
});

// --- Group 11: the meta-repository protocol and the kit block (design §1) -----------------------------------

describe('the meta-repository protocol', () => {
  /** The protocol as the installed kit holds it, line breaks collapsed. */
  const protocol = () => {
    const root = installed('repos/backend');
    return readFileSync(join(root, 'openspec', 'protocols', 'metarepo.md'), 'utf8').replace(/\s+/g, ' ');
  };

  // @scenario metarepo/apply :: Protocol names the group's repository
  test("the tasks of a group are done in the folder of its repository with that repository's own commands", () => {
    const text = protocol();
    assert.match(text, /do the tasks of a group in the folder of the repository the group names/i);
    assert.match(text, /run that repository's tests with its own commands, found in the meta-repository's instructions and mise tasks/i);
    assert.match(text, /The kit stores no commands and does not switch or create branches/);
    assert.match(text, /`## 2\. \[backend\] Order API`/);
  });

  // @scenario metarepo/apply :: Protocol suggests AGENTS.md in a meta-repository
  test('missing commands are suggested for AGENTS.md, never for CLAUDE.md', () => {
    const text = protocol();
    assert.match(text, /ask the developer once/i);
    assert.match(text, /suggest writing the commands into `AGENTS\.md`, never into `CLAUDE\.md`/);
  });

  // @scenario metarepo/apply :: Kit block points to the protocol
  test('the kit block says to follow the protocol when openspec/clones exists, with or without the list', () => {
    const POINTER = /When `openspec\/clones` exists, follow `openspec\/protocols\/metarepo\.md`/;
    const single = metarepo({ kit: false, clones: null });
    assert.equal(installer(single, ['install', '--yes']).code, 0);
    const meta = installed('repos/backend');
    for (const root of [single, meta]) {
      const cfg = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8');
      const block = cfg.slice(cfg.indexOf('# >>> sdd-kit >>>'), cfg.indexOf('# <<< sdd-kit <<<'));
      assert.match(block.replace(/\s+/g, ' '), POINTER);
    }
  });

  // @scenario metarepo/e2e :: Protocol asks only for interface changes
  test('the E2E question is asked only for a change that touches the web interface', () => {
    const text = protocol();
    assert.match(text, /ask the E2E question only when the change touches the web interface/i);
    assert.match(text, /in the Main round on the clarify family and before the first task on `lean`/);
    assert.match(text, /`Mode: skipped`[^.]*does not touch the web interface/);
  });

  test('the protocol states the rules the checks enforce', () => {
    const text = protocol();
    for (const rule of [
      /\*Repository\* column/,
      /`e2e` level|level `e2e`/,
      /`e2e\.md`/,
      /`## Repository: <name>`/,
      /`Command: none`/,
      /`Result: no tests`/,
      /a folder of the root, outside every clone/,
      /`x-sdd-kit-metarepo: true`/,
      /session started in the clone/,
    ]) assert.match(text, rule);
  });
});
