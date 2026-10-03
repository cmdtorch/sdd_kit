// Phase 7: CI entry point (ci.mjs checks / verify) and the generated GitHub Actions workflow.
// "Red PR on a missing scenario test or a failing test" is checked here with the fake runner.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, renameSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { ciChecks, ciVerify } from '../kit/core/openspec/tooling/bin/ci.mjs';
import { runVerification } from '../kit/core/openspec/tooling/lib/verify-run.mjs';
import { snapshotApi } from '../kit/core/openspec/tooling/lib/api.mjs';
import { parseYaml } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { install, composeWorkflow } from '../installer/sdd-kit.mjs';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;
const git = (root, ...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
const commit = (root, msg) => {
  git(root, 'add', '-A');
  git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', msg);
};

function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-ci-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), 'fake-runs.log\n');
  git(root, 'init', '-q', '-b', 'main');
  commit(root, 'base');
  return root;
}
const read = (root, f) => readFileSync(join(root, f), 'utf8');
function plant(root, file, from, to) {
  const s = read(root, file);
  assert.ok(s.includes(from), `fixture ${file} does not contain: ${from}`);
  writeFileSync(join(root, file), s.replace(from, to));
}
function setOutcome(root, testId, outcome) {
  const t = JSON.parse(read(root, 'fake-tests.json'));
  t.find((x) => x.test === testId).outcome = outcome;
  writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(t));
}
const errorsOf = (res) => res.sections.flatMap((s) => s.errors.map((e) => `${s.section}: ${e}`));
const warningsOf = (res) => res.sections.flatMap((s) => s.warnings.map((e) => `${s.section}: ${e}`));

describe('ci.mjs verify — the test side of a pull request', () => {
  test('green when every planned scenario has a passing marked test', () => {
    const res = ciVerify({ root: project() });
    assert.equal(res.ok, true, errorsOf(res).join('\n'));
  });

  test('RED on a failing test', () => {
    const root = project();
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    const res = ciVerify({ root });
    assert.equal(res.ok, false);
    assert.ok(errorsOf(res).some((e) => /Not Met: "Empty period"/.test(e)));
  });

  test('RED on a missing scenario test (completed change)', () => {
    const root = project();
    const t = JSON.parse(read(root, 'fake-tests.json')).filter((x) => x.scenario !== 'Teacher cannot export');
    writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(t));
    const res = ciVerify({ root });
    assert.equal(res.ok, false);
    assert.ok(errorsOf(res).some((e) => /no unit test carries the marker for "Teacher cannot export"/.test(e)));
  });

  test('a change in progress only warns about tests not written yet, and runs nothing', () => {
    const root = project();
    rmSync(join(root, C, 'verification.md'));
    plant(root, `${C}/tasks.md`, '- [x] 1.3', '- [ ] 1.3');
    const t = JSON.parse(read(root, 'fake-tests.json')).filter((x) => x.level !== 'e2e');
    writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(t));
    const res = ciVerify({ root });
    assert.equal(res.ok, true, errorsOf(res).join('\n'));
    assert.ok(warningsOf(res).some((w) => /in progress, 3\/4 tasks.*no e2e test carries the marker/.test(w)));
    assert.ok(!read(root, 'fake-runs.log').includes('run unit'), 'only collect for changes in progress');
  });

  test('several completed changes share one full-suite run', () => {
    const root = project();
    cpSync(join(root, C), join(root, 'openspec/changes/add-sales-export-copy'), { recursive: true });
    rmSync(join(root, 'openspec/changes/add-sales-export-copy/specs/inventory/student-sales'), { recursive: true });
    const res = ciVerify({ root });
    assert.equal(read(root, 'fake-runs.log').split('\n').filter((l) => l === 'run unit').length, 1);
    assert.ok(res.sections.some((s) => /add-sales-export-copy/.test(s.section)));
  });

  test('RED when the API differs from the committed baseline', () => {
    const root = project();
    cpSync(join(REPO, 'fixtures/openapi/drf-before.json'), join(root, 'before.json'));
    cpSync(join(REPO, 'fixtures/openapi/drf-after.json'), join(root, 'after.json'));
    writeFileSync(join(root, 'fake-openapi-current.txt'), 'before.json\n');
    appendFileSync(join(root, 'openspec/tooling/verify.yaml'), 'api:\n  export: "node fake-openapi.mjs {out}"\n');
    snapshotApi(root);
    assert.equal(ciVerify({ root }).ok, true);
    writeFileSync(join(root, 'fake-openapi-current.txt'), 'after.json\n');
    const res = ciVerify({ root });
    assert.equal(res.ok, false);
    assert.ok(errorsOf(res).some((e) => /API differs from openspec\/api\/openapi\.json: .*added GET \/api\/v1\/sales\/export\//.test(e)));
  });
});

describe('ci.mjs checks — the planning side of a pull request', { skip: cliSkipReason() }, () => {
  test('green on the good project', () => {
    const res = ciChecks({ root: project(), base: null });
    assert.equal(res.ok, true, errorsOf(res).join('\n'));
    assert.ok(res.sections.some((s) => s.section === 'openspec validate --all --strict'));
  });

  test('RED on a planning defect that bypassed the hooks', () => {
    const root = project();
    plant(root, `${C}/proposal.md`, '## What Changes\n', '## What Changes\n\nWritten through the shell, untagged.\n');
    plant(root, `${C}/verification-plan.md`, '| inventory/sales-export | Staff can export paid sales | Empty period | unit | no | no sales |\n', '');
    const e = errorsOf(ciChecks({ root, base: null }));
    assert.ok(e.some((x) => /check-grounding: .*untagged statement/.test(x)));
    assert.ok(e.some((x) => /"Empty period" .* is neither planned nor excluded/.test(x)));
  });

  test('RED on an OpenSpec strict validation error', () => {
    const root = project();
    plant(root, `${C}/specs/inventory/sales-export/spec.md`, '#### Scenario: Teacher cannot export\n- **WHEN** a teacher requests the export\n- **THEN** the system responds 403 and no file is produced', '');
    plant(root, `${C}/specs/inventory/sales-export/spec.md`, '### Requirement: Staff can export paid sales', '### Requirement: Staff can export paid sales\n\n### Requirement: Empty one\nThe system SHALL do nothing.\n\n### Requirement: Staff can export paid sales again');
    const e = errorsOf(ciChecks({ root, base: null }));
    assert.ok(e.some((x) => /openspec validate --all --strict: change add-sales-export: ERROR/.test(x)), e.join('\n'));
  });

  test('changes archived in the PR must be complete and verified', () => {
    const root = project();
    git(root, 'checkout', '-q', '-b', 'feature');
    mkdirSync(join(root, 'openspec/changes/archive'), { recursive: true });
    renameSync(join(root, C), join(root, `openspec/changes/archive/2026-10-03-${CHANGE}`));
    commit(root, 'archive');
    assert.equal(ciChecks({ root, base: 'main' }).ok, true);
    const arch = `openspec/changes/archive/2026-10-03-${CHANGE}`;
    plant(root, `${arch}/verification.md`, 'test_empty_period passed | Met |', 'not run | Unverified |');
    plant(root, `${arch}/tasks.md`, '- [x] 2.1', '- [ ] 2.1');
    commit(root, 'bad archive');
    const e = errorsOf(ciChecks({ root, base: 'main' }));
    assert.ok(e.some((x) => /archived add-sales-export: tasks: 1 task\(s\) were not done/.test(x)));
    assert.ok(e.some((x) => /archived add-sales-export: check-verification: .*"Empty period" \(unit\) is Unverified/.test(x)));
  });

  test('a base ref that is not fetched gives a clear error', () => {
    const e = errorsOf(ciChecks({ root: project(), base: 'origin/nope' }));
    assert.ok(e.some((x) => /fetch-depth: 0/.test(x)));
  });

  test('CLI: exit codes and the GitHub step summary', () => {
    const root = project();
    const summary = join(root, 'summary.md');
    const run = (...a) => spawnSync('node', [join(root, 'openspec/tooling/bin/ci.mjs'), ...a], { cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summary, OPENSPEC_TELEMETRY: '0' } });
    assert.equal(run('checks').status, 0);
    setOutcome(root, 'tests/test_export.py::test_empty_period', 'failed');
    const v = run('verify');
    assert.equal(v.status, 1);
    assert.match(v.stdout, /FAIL change add-sales-export: tests and scenario coverage/);
    const md = read(root, 'summary.md');
    assert.match(md, /## sdd-kit — checks: ✅ passed/);
    assert.match(md, /## sdd-kit — verify: ❌ failed/);
  });
});

describe('workflow generation', () => {
  test('install --ci writes the workflow for the presets and remembers it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-wf-'));
    const r = await install({ target: root, skipOpenspec: true, yes: true, json: true, presets: ['django', 'playwright'], ci: true });
    assert.ok(r.files.some((f) => f.rel === '.github/workflows/sdd-kit.yml' && f.op === 'create'));
    const wf = parseYaml(read(root, '.github/workflows/sdd-kit.yml')).value;
    assert.deepEqual(Object.keys(wf.jobs), ['kit-checks', 'kit-verify']);
    assert.equal(wf.jobs['kit-checks'].steps[0].with['fetch-depth'], 0);
    assert.ok(wf.jobs['kit-verify'].services.postgres);
    assert.ok(wf.jobs['kit-verify'].steps.some((s) => /playwright install/.test(s.run || '')));
    assert.ok(wf.jobs['kit-verify'].steps.some((s) => s.run === 'node openspec/tooling/bin/ci.mjs verify'));
    const again = await install({ target: root, skipOpenspec: true, yes: true, json: true });
    assert.equal(again.files.find((f) => f.rel === '.github/workflows/sdd-kit.yml').op, 'unchanged');
    writeFileSync(join(root, '.github/workflows/sdd-kit.yml'), read(root, '.github/workflows/sdd-kit.yml') + '# team edit\n');
    const third = await install({ target: root, skipOpenspec: true, yes: true, json: true });
    assert.equal(third.files.find((f) => f.rel === '.github/workflows/sdd-kit.yml').op, 'conflict-modified');
  });

  test('without --ci no workflow is written', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-wf-'));
    await install({ target: root, skipOpenspec: true, yes: true, json: true });
    assert.equal(existsSync(join(root, '.github')), false);
  });

  test('the workflow parses for every preset combination', () => {
    for (const p of [[], ['django'], ['playwright'], ['django', 'playwright']]) {
      const wf = parseYaml(composeWorkflow(join(REPO, 'kit'), p)).value;
      assert.equal(wf.name, 'sdd-kit');
      assert.ok(wf.on.pull_request === null);
    }
  });
});
