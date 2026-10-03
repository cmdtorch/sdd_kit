// Phase 5: results parsing (real pytest / Playwright output), verify runs, the Stop-hook test gate
// (incl. the re-entry limit), the archive gate and presets.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { parseResults } from '../kit/core/openspec/tooling/lib/results.mjs';
import { runVerification } from '../kit/core/openspec/tooling/lib/verify-run.mjs';
import { loadVerifyConfig, validateVerifyConfig } from '../kit/core/openspec/tooling/lib/verify-config.mjs';
import { parseYaml } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { checkVerification } from '../kit/core/openspec/tooling/checks/check-verification.mjs';
import { archiveTargets } from '../kit/core/openspec/tooling/hooks/archive-gate.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(REPO, 'kit', 'core', 'openspec', 'tooling', 'hooks');
const RESULTS = join(REPO, 'fixtures', 'results');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;

/** Good project + kit core, under git with one commit (fingerprints need git). */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-verify-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  rmSync(join(root, C, 'verification.md'));
  writeFileSync(join(root, '.gitignore'), 'fake-runs.log\n');
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
  return root;
}
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const runs = (root) => (existsSync(join(root, 'fake-runs.log')) ? read(root, 'fake-runs.log').trim().split('\n') : []);
function setOutcome(root, testId, outcome) {
  const t = JSON.parse(read(root, 'fake-tests.json'));
  t.find((x) => x.test === testId).outcome = outcome;
  writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(t));
}
function plant(root, file, from, to) {
  const s = read(root, file);
  assert.ok(s.includes(from), `fixture ${file} does not contain: ${from}`);
  writeFileSync(join(root, file), s.replace(from, to));
}
function hook(name, root, input) {
  const r = spawnSync('node', [join(HOOKS, name)], { cwd: root, input: JSON.stringify({ session_id: 'sess-1', cwd: root, ...input }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const stop = (root, active = false) => hook('test-gate.mjs', root, { hook_event_name: 'Stop', stop_hook_active: active });
const writeTasks = (root, file = `${C}/tasks.md`) =>
  hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, file), old_string: 'a', new_string: 'b' } });
const archive = (root, command) => hook('archive-gate.mjs', root, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });

describe('results from real tools', () => {
  test('pytest plugin output (sdd-json): markers and outcomes', () => {
    const run = parseResults(read(RESULTS, 'pytest-run.json'), 'sdd-json', 'unit');
    const byTest = Object.fromEntries(run.map((r) => [r.test, r.outcome]));
    assert.equal(byTest['tests/test_sample.py::test_successful_export'], 'passed');
    assert.equal(byTest['tests/test_sample.py::test_empty_period_fails'], 'failed');
    assert.equal(byTest['tests/test_sample.py::test_teacher_skipped'], 'skipped');
    assert.equal(byTest['tests/test_sample.py::test_setup_error'], 'error');
    assert.equal(byTest['tests/test_sample.py::TestRecording::test_teacher_forbidden'], 'passed');
    assert.equal(run.filter((r) => r.scenario === 'Successful export').length, 3, 'parametrized cases count separately');
    assert.ok(parseResults(read(RESULTS, 'pytest-collect.json'), 'sdd-json', 'unit').every((r) => !r.outcome));
  });

  test('Playwright JSON (--list and run): annotations, outcomes, relative files', () => {
    const scratchRoot = JSON.parse(read(RESULTS, 'playwright-run.json')).config.rootDir.replace(/\/e2e$/, '');
    const list = parseResults(read(RESULTS, 'playwright-list.json'), 'playwright-json', 'e2e', scratchRoot);
    assert.deepEqual(list.map((r) => r.scenario).sort(), ['Empty period', 'Successful export', 'Teacher cannot export']);
    assert.ok(list.every((r) => r.file === 'e2e/export.spec.ts' && !r.outcome));
    const run = parseResults(read(RESULTS, 'playwright-run.json'), 'playwright-json', 'e2e', scratchRoot);
    const o = Object.fromEntries(run.map((r) => [r.scenario, r.outcome]));
    assert.deepEqual(o, { 'Successful export': 'passed', 'Empty period': 'failed', 'Teacher cannot export': 'skipped' });
    assert.match(run.find((r) => r.scenario === 'Teacher cannot export').test, /^e2e\/export\.spec\.ts:19 › teacher › cannot export$/);
  });

  test('a malformed scenario annotation is reported', () => {
    const bad = { config: {}, suites: [{ title: 'a.spec.ts', specs: [{ title: 't', file: 'a.spec.ts', line: 1, tests: [{ annotations: [{ type: 'scenario', description: 'no separator' }], results: [] }] }] }] };
    assert.throws(() => parseResults(JSON.stringify(bad), 'playwright-json', 'e2e'), /must be "<capability-path> :: <Scenario name>"/);
  });
});

describe('verify.yaml', () => {
  test('the fixture config is valid and gets defaults', () => {
    const cfg = loadVerifyConfig(join(REPO, 'fixtures', 'projects', 'checks-good'));
    assert.equal(cfg.gates.stop_block_limit, 3);
    assert.equal(cfg.levels.unit.format, 'sdd-json');
  });
  test('validation catches mistakes', () => {
    const p = validateVerifyConfig({ version: 2, levels: { unit: { format: 'junit', full: 'x', scoped: 'y', colect: 'z' }, smoke: {} }, gates: { stop: 'always' } });
    const msgs = p.map((x) => x.message).join('\n');
    for (const re of [/version must be 1/, /format must be one of/, /"collect" command is required/, /"scoped" must contain \{files\}/, /unknown field "colect"/, /unknown level "smoke"/, /stop must be full or off/]) assert.match(msgs, re);
  });
});

describe('verify run (fake runner standing in for pytest/Playwright)', () => {
  test('green: every row Met from real results, verification.md passes check-verification, state saved', () => {
    const root = project();
    const r = runVerification({ root, change: CHANGE });
    assert.equal(r.ok, true, JSON.stringify(r.problems));
    assert.equal(r.complete, true);
    assert.deepEqual(r.rows.map((x) => x.verdict), ['Met', 'Met', 'Met', 'Met', 'Met']);
    assert.match(r.rows[0].expected, /the file contains exactly the two paid sales and their total/);
    assert.deepEqual(runs(root), ['run unit', 'gate', 'collect e2e', 'run e2e e2e/export.spec.ts']);
    assert.match(read(root, `${C}/verification.md`), /Generated by sdd-kit verify/);
    assert.equal(checkVerification({ root, change: CHANGE }).ok, true);
  });

  test('a failing marked test makes its row Not Met and the run fail', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    const r = runVerification({ root, change: CHANGE });
    assert.equal(r.ok, false);
    const row = r.rows.find((x) => x.scenario === 'Empty period');
    assert.equal(row.verdict, 'Not Met');
    assert.match(row.evidence, /failed: tests\/test_export\.py::test_empty_period/);
    assert.ok(r.problems.some((p) => /node fake-runner\.mjs run unit \{out\}` failed \(exit 1\)/.test(p)));
    assert.equal(checkVerification({ root, change: CHANGE }).ok, false);
  });

  test('a failing quality gate fails the run even when all rows are Met', () => {
    const root = project();
    writeFileSync(join(root, 'fake-gate-fails'), '');
    const r = runVerification({ root, change: CHANGE });
    assert.equal(r.ok, false);
    assert.ok(r.rows.every((x) => x.verdict === 'Met'));
    assert.ok(r.problems.some((p) => /quality gate/.test(p)));
  });

  test('a planned scenario without a marked test is Unverified (a regression elsewhere is still caught)', () => {
    const root = project();
    const t = JSON.parse(read(root, 'fake-tests.json')).filter((x) => x.scenario !== 'Teacher cannot export');
    t.find((x) => x.test === 'tests/test_other.py::test_unrelated').outcome = 'failed';
    writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(t));
    const r = runVerification({ root, change: CHANGE });
    assert.equal(r.rows.find((x) => x.scenario === 'Teacher cannot export').verdict, 'Unverified');
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => /failed \(exit 1\)/.test(p)), 'unrelated failing test still fails the full run');
  });

  test('skipped-only tests leave the row Unverified', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_teacher_forbidden', 'skipped');
    assert.equal(runVerification({ root, change: CHANGE }).rows.find((x) => x.scenario === 'Teacher cannot export').verdict, 'Unverified');
  });

  test('manual rows stay pending until a human records a result, which later runs keep', () => {
    const root = project();
    plant(root, `${C}/verification-plan.md`, '| inventory/sales-export | Staff can export paid sales | Empty period | unit | no | no sales |', '| inventory/sales-export | Staff can export paid sales | Empty period | unit | no | no sales |\n| inventory/sales-export | Staff can export paid sales | Empty period | manual | no | open the file in Excel |');
    let r = runVerification({ root, change: CHANGE });
    assert.equal(r.ok, true);
    assert.equal(r.complete, false);
    assert.equal(r.manualPending.length, 1);
    plant(root, `${C}/verification.md`, '| manual | the file contains only the header row | manual check pending | — | Unverified |', '| manual | the file contains only the header row | opens fine in Excel 365 | checked by QA (Aysel) 2026-10-03 | Met |');
    r = runVerification({ root, change: CHANGE });
    assert.equal(r.complete, true);
    assert.match(read(root, `${C}/verification.md`), /checked by QA \(Aysel\) 2026-10-03 \| Met \|/);
  });

  test('scoped mode runs only the tests marked for the change', () => {
    const root = project();
    const r = runVerification({ root, change: CHANGE, mode: 'scoped' });
    assert.equal(r.ok, true);
    const unitRun = runs(root).find((l) => l.startsWith('run unit'));
    assert.ok(unitRun.includes('tests/test_export.py::test_successful_export'));
    assert.ok(!unitRun.includes('test_unrelated'));
    assert.ok(!runs(root).includes('gate'), 'the quality gate belongs to the full run');
  });

  test('E2E off leaves e2e rows Unverified', () => {
    const root = project();
    const r = runVerification({ root, change: CHANGE, e2e: 'off' });
    assert.equal(r.rows.find((x) => x.level === 'e2e').verdict, 'Unverified');
    assert.equal(r.ok, false);
  });
});

describe('test gate (Stop hook)', () => {
  test('does nothing until the last task is checked (not armed)', () => {
    const root = project();
    assert.equal(stop(root).code, 0);
    assert.deepEqual(runs(root), []);
  });

  test('checking the last task arms the gate; a green run lets Claude stop and disarms it', () => {
    const root = project();
    const fb = writeTasks(root);
    assert.match(JSON.parse(fb.stdout).hookSpecificOutput.additionalContext, /all tasks of "add-sales-export" are checked/);
    const r = stop(root);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(runs(root).includes('run unit'));
    const n = runs(root).length;
    assert.equal(stop(root).code, 0);
    assert.equal(runs(root).length, n, 'disarmed: no second run');
  });

  test('failing tests block the stop with the failure; after the limit the human decides; a new human turn resets', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    writeTasks(root);
    const first = stop(root, false);
    assert.equal(first.code, 2);
    assert.match(first.stderr, /test gate \(attempt 1 of 3\)/);
    assert.match(first.stderr, /Not Met: "Empty period"/);
    assert.equal(stop(root, true).code, 2);
    assert.match(stop(root, true).stderr, /attempt 3 of 3/);
    const handover = stop(root, true);
    assert.equal(handover.code, 0, 'no infinite loop');
    assert.match(JSON.parse(handover.stdout).systemMessage, /still failing after 3 attempt\(s\) — handing over to you/);
    assert.equal(stop(root, false).code, 0, 'after a handover the gate stays quiet while nothing changed');
    writeFileSync(join(root, 'apps.py'), 'fix_attempt = 1\n');
    assert.match(stop(root, false).stderr, /attempt 1 of 3/, 'files changed: the gate runs again, counting from 1');
  });

  test('an open question in the Apply round never blocks (waiting for the human)', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    writeTasks(root);
    writeFileSync(join(root, C, 'clarifications.md'), read(root, `${C}/clarifications.md`) + '\n## Apply round\n\n### Q6. Rounding?\nFor: PO/PM\nWhy this is asked: x\n- A. Up\n- X. Other (please specify)\n\n[Answer]:\n');
    assert.equal(stop(root).code, 0);
  });

  test('unchecking a task disarms the gate', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    writeTasks(root);
    plant(root, `${C}/tasks.md`, '- [x] 2.1', '- [ ] 2.1');
    writeTasks(root);
    assert.equal(stop(root).code, 0);
  });
});

describe('session-start reports verification status', () => {
  test('failed, changed since green, and no misleading question line', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    runVerification({ root, change: CHANGE });
    const ctx = () => JSON.parse(hook('session-start.mjs', root, { hook_event_name: 'SessionStart', source: 'startup' }).stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx(), /last verification FAILED/);
    assert.doesNotMatch(ctx(), /Unanswered or unconfirmed question rounds/);
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'passed');
    runVerification({ root, change: CHANGE });
    assert.match(ctx(), /verified \(green\)/);
    writeFileSync(join(root, 'apps.py'), 'x = 1\n');
    assert.match(ctx(), /files changed since the last green verification/);
  });
});

describe('archive gate', () => {
  test('finds archive commands', () => {
    assert.deepEqual(archiveTargets('openspec archive add-x --yes'), ['add-x']);
    assert.deepEqual(archiveTargets('node openspec/tooling/bin/openspec.mjs archive add-y'), ['add-y']);
    assert.deepEqual(archiveTargets('npx -y @fission-ai/openspec archive "add-z" && git status'), ['add-z']);
    assert.deepEqual(archiveTargets('openspec archive'), ['']);
    assert.deepEqual(archiveTargets('openspec status --change a'), []);
  });

  test('blocks without a verification run, allows after a green one, blocks again after a code change', () => {
    const root = project();
    const before = archive(root, `openspec archive ${CHANGE} --yes`);
    assert.equal(before.code, 2);
    assert.match(before.stderr, /no full verification run on record/);
    runVerification({ root, change: CHANGE });
    const ok = archive(root, `openspec archive ${CHANGE} --yes`);
    assert.equal(ok.code, 0, ok.stderr);
    writeFileSync(join(root, 'apps.py'), 'changed = True\n');
    const stale = archive(root, `openspec archive ${CHANGE}`);
    assert.equal(stale.code, 2);
    assert.match(stale.stderr, /files changed since the last verification/);
  });

  test('committing after verification does not make it stale (content fingerprint)', () => {
    const root = project();
    runVerification({ root, change: CHANGE });
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'verified'], { cwd: root });
    const r = archive(root, `openspec archive ${CHANGE}`);
    assert.equal(r.code, 0, r.stderr);
  });

  test('a hand-edited verification.md cannot pass', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    runVerification({ root, change: CHANGE });
    writeFileSync(join(root, C, 'verification.md'), read(root, `${C}/verification.md`).replace('| Not Met |', '| Met |'));
    const r = archive(root, `openspec archive ${CHANGE}`);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /the last verification failed/);
  });

  test('open tasks, a missing name, and pending manual checks block; non-kit changes pass', () => {
    const root = project();
    runVerification({ root, change: CHANGE });
    plant(root, `${C}/tasks.md`, '- [x] 2.1', '- [ ] 2.1');
    assert.match(archive(root, `openspec archive ${CHANGE}`).stderr, /1 task\(s\) in tasks\.md are not done/);
    assert.match(archive(root, 'openspec archive').stderr, /name the change explicitly/);
    plant(root, `${C}/.openspec.yaml`, 'schema: clarify', 'schema: spec-driven');
    assert.equal(archive(root, `openspec archive ${CHANGE}`).code, 0);
  });
});

describe('presets', () => {
  test('install --preset django,playwright creates a valid verify.yaml and the pytest plugin; updates remember presets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-preset-'));
    const r = await install({ target: root, skipOpenspec: true, yes: true, json: true, presets: ['django', 'playwright'] });
    assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
    assert.deepEqual(r.presets, ['django', 'playwright']);
    const cfg = loadVerifyConfig(root);
    assert.equal(cfg.levels.unit.format, 'sdd-json');
    assert.equal(cfg.levels.e2e.format, 'playwright-json');
    assert.ok(existsSync(join(root, 'openspec/tooling/pytest/sdd_kit_pytest.py')));
    writeFileSync(join(root, 'openspec/tooling/verify.yaml'), read(root, 'openspec/tooling/verify.yaml').replace('make test', 'make tests'));
    const again = await install({ target: root, skipOpenspec: true, yes: true, json: true });
    assert.deepEqual(again.presets, ['django', 'playwright']);
    assert.match(read(root, 'openspec/tooling/verify.yaml'), /make tests/, 'verify.yaml is owned by the project');
    assert.ok(again.files.some((f) => f.rel === 'openspec/tooling/pytest/sdd_kit_pytest.py' && f.op === 'unchanged'));
  });

  test('unknown preset is refused', async () => {
    await assert.rejects(install({ target: mkdtempSync(join(tmpdir(), 'x-')), skipOpenspec: true, yes: true, json: true, presets: ['rails'] }), /unknown preset "rails"/);
  });

  test('without presets the composed config is valid YAML for both levels', () => {
    const { value } = parseYaml(read(join(REPO, 'kit', 'presets', 'django'), 'verify.unit.yaml').replace(/^ {2}/gm, ''));
    assert.ok(value.unit.collect.includes('--sdd-out={out}'));
  });
});

const PY = process.env.SDD_KIT_PYTHON;
describe('real pytest + kit plugin', { skip: PY ? false : 'set SDD_KIT_PYTHON to a python with pytest (and pytest-xdist)' }, () => {
  test('collect and run reports, identical with xdist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-pytest-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'pytest-sample'), dir, { recursive: true });
    const env = { ...process.env, PYTHONPATH: join(REPO, 'kit', 'presets', 'django', 'openspec', 'tooling', 'pytest'), PYTHONDONTWRITEBYTECODE: '1' };
    const pytest = (...a) => spawnSync(PY, ['-m', 'pytest', '-p', 'sdd_kit_pytest', '-p', 'no:cacheprovider', '-q', ...a], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(pytest('--collect-only', `--sdd-out=${join(dir, 'c.json')}`).status, 0);
    assert.equal(JSON.parse(read(dir, 'c.json')).length, 7);
    assert.equal(pytest(`--sdd-out=${join(dir, 'r.json')}`).status, 1);
    assert.deepEqual(JSON.parse(read(dir, 'r.json')), JSON.parse(read(RESULTS, 'pytest-run.json')));
    if (spawnSync(PY, ['-c', 'import xdist'], { env }).status === 0) {
      pytest('-n', '2', `--sdd-out=${join(dir, 'x.json')}`);
      assert.deepEqual(JSON.parse(read(dir, 'x.json')), JSON.parse(read(dir, 'r.json')));
    }
  });
});
