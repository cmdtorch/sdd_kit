// Phase 9: monorepo adapter — `cwd` levels, root-relative test paths, installer adapter, the sample monorepo.
// The full end-to-end run of the sample (real pytest via uv, real Playwright browser) is opt-in: SDD_KIT_E2E=1.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { runVerification } from '../kit/core/openspec/tooling/lib/verify-run.mjs';
import { parseResults } from '../kit/core/openspec/tooling/lib/results.mjs';
import { loadVerifyConfig } from '../kit/core/openspec/tooling/lib/verify-config.mjs';
import { parseYaml } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { install } from '../installer/sdd-kit.mjs';
import { ciChecks } from '../kit/core/openspec/tooling/bin/ci.mjs';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE = join(REPO, 'fixtures', 'projects', 'monorepo-sample');
const read = (root, f) => readFileSync(join(root, f), 'utf8');

/** checks-good with its unit tests moved into backend/ (run with cwd: backend). */
function cwdProject() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-mono-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  mkdirSync(join(root, 'backend'));
  renameSync(join(root, 'tests'), join(root, 'backend', 'tests'));
  cpSync(join(root, 'fake-runner.mjs'), join(root, 'backend', 'fake-runner.mjs'));
  const unit = JSON.parse(read(root, 'fake-tests.json')).filter((t) => t.level === 'unit'); // ids relative to backend/
  writeFileSync(join(root, 'backend', 'fake-tests.json'), JSON.stringify(unit));
  writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(JSON.parse(read(root, 'fake-tests.json')).filter((t) => t.level === 'e2e')));
  writeFileSync(
    join(root, 'openspec/tooling/verify.yaml'),
    read(root, 'openspec/tooling/verify.yaml')
      .replace('  unit:\n', '  unit:\n    cwd: backend\n')
      .replace('    scoped: "node fake-runner.mjs run unit {out} {files}"', '    scoped: "node fake-runner.mjs run unit {out} {files} && test -f {root}/openspec/config.yaml"'),
  );
  return root;
}

describe('levels with cwd', () => {
  test('commands run in cwd; test ids become root-relative; scoped ids go back relative to cwd', () => {
    const root = cwdProject();
    assert.equal(loadVerifyConfig(root).levels.unit.cwd, 'backend');
    const r = runVerification({ root, change: 'add-sales-export', mode: 'scoped' });
    assert.equal(r.ok, true, JSON.stringify(r.problems));
    assert.match(r.rows.find((x) => x.scenario === 'Empty period').evidence, /backend\/tests\/test_export\.py::test_empty_period/);
    const log = read(root, 'backend/fake-runs.log');
    assert.match(log, /^run unit tests\/test_export\.py::test_successful_export/m, 'scoped ids relative to cwd');
    assert.doesNotMatch(log, /backend\/tests/);
    assert.ok(r.markers.every((m) => m.level !== 'unit' || m.test.startsWith('backend/')));
  });

  test('sdd-json and Playwright results with cwd', () => {
    const sdd = parseResults(JSON.stringify([{ level: 'unit', capability: 'a', scenario: 'b', test: 'tests/t.py::x', outcome: 'passed' }]), 'sdd-json', 'unit', '/r', 'backend');
    assert.deepEqual([sdd[0].test, sdd[0].file], ['backend/tests/t.py::x', 'backend/tests/t.py']);
    const pw = { config: {}, suites: [{ title: 's.spec.ts', specs: [{ title: 't', file: 'tests/s.spec.ts', line: 3, tests: [{ annotations: [{ type: 'scenario', description: 'a :: b' }], results: [] }] }] }] };
    assert.equal(parseResults(JSON.stringify(pw), 'playwright-json', 'e2e', '/r', 'e2e')[0].file, 'e2e/tests/s.spec.ts');
  });

  test('cwd must stay inside the project', async () => {
    const { validateVerifyConfig } = await import('../kit/core/openspec/tooling/lib/verify-config.mjs');
    for (const bad of ['/abs', '../up', 'a/../../b']) {
      const p = validateVerifyConfig({ version: 1, levels: { unit: { format: 'sdd-json', collect: 'x', full: 'y', cwd: bad } } });
      assert.ok(p.some((x) => /cwd must be a relative directory/.test(x.message)), bad);
    }
  });
});

describe('installer --adapter monorepo', () => {
  test('verify.yaml with cwd per level, API export in backend/, a compose-based CI job; remembered on update', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-mono-inst-'));
    const r = await install({ target: root, skipOpenspec: true, yes: true, json: true, presets: ['django', 'playwright'], adapter: 'monorepo', ci: true });
    assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
    const cfg = loadVerifyConfig(root);
    assert.equal(cfg.levels.unit.cwd, 'backend');
    assert.equal(cfg.levels.e2e.cwd, 'e2e');
    assert.match(cfg.api.export, /^cd backend && /);
    assert.match(cfg.levels.unit.full, /PYTHONPATH=\{root\}\/openspec\/tooling\/pytest/);
    const wf = parseYaml(read(root, '.github/workflows/sdd-kit.yml')).value;
    const steps = wf.jobs['kit-verify'].steps;
    assert.ok(steps.some((s) => s.run === 'docker compose up -d --build --wait'));
    assert.ok(steps.some((s) => s['working-directory'] === 'backend' && /uv sync --frozen/.test(s.run)));
    assert.equal(wf.jobs['kit-verify'].env.E2E_BASE_URL, 'http://localhost:8080');
    assert.equal(wf.jobs['kit-verify'].services, undefined, 'the database comes from docker compose');
    assert.equal(JSON.parse(read(root, 'openspec/tooling/kit-manifest.json')).adapter, 'monorepo');
    const again = await install({ target: root, skipOpenspec: true, yes: true, json: true });
    assert.equal(again.files.find((f) => f.rel === '.github/workflows/sdd-kit.yml').op, 'unchanged');
    await assert.rejects(install({ target: root, skipOpenspec: true, yes: true, json: true, adapter: 'split' }), /unknown adapter|switching adapters/);
  });

  test('unknown adapter is refused', async () => {
    await assert.rejects(install({ target: mkdtempSync(join(tmpdir(), 'x-')), skipOpenspec: true, yes: true, json: true, adapter: 'polyrepo' }), /unknown adapter "polyrepo"/);
  });
});

describe('sample monorepo (static)', { skip: cliSkipReason() }, () => {
  test('kit checks are green on the sample and docker-compose.yml is valid', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-sample-'));
    cpSync(SAMPLE, root, { recursive: true });
    const res = ciChecks({ root, base: null });
    assert.equal(res.ok, true, res.sections.flatMap((s) => s.errors).join('\n'));
    const compose = spawnSync('docker', ['compose', '-f', join(root, 'docker-compose.yml'), 'config', '--quiet'], { encoding: 'utf8' });
    if (!compose.error) assert.equal(compose.status, 0, compose.stderr);
  });
});

describe('sample monorepo end to end (real pytest, Playwright browser, API)', { skip: process.env.SDD_KIT_E2E === '1' ? false : 'set SDD_KIT_E2E=1 (needs uv, npm and a Playwright Chromium)' }, () => {
  test('verify → ci → archive gate → openspec archive → ci on the archived change', { timeout: 900_000 }, () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-sample-e2e-'));
    cpSync(SAMPLE, root, { recursive: true });
    const sh = (cmd, opts = {}) => execFileSync('sh', ['-c', cmd], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, OPENSPEC_TELEMETRY: '0' }, ...opts });
    // the copy carries the kit version it was installed with: update it like a team would
    sh(`node ${JSON.stringify(join(REPO, 'installer', 'sdd-kit.mjs'))} update --skip-openspec --yes`);
    sh('git init -q -b main && git add -A && git -c user.email=t@t -c user.name=t commit -qm base');
    sh('npm ci --no-fund --no-audit', { cwd: join(root, 'e2e') });
    const v = spawnSync('node', ['openspec/tooling/bin/verify.mjs', '--change', 'add-sales-list'], { cwd: root, encoding: 'utf8' });
    assert.equal(v.status, 0, v.stdout + v.stderr);
    assert.match(v.stdout, /matrix: 4 Met, 0 Not Met, 0 Unverified/);
    assert.match(read(root, 'openspec/changes/add-sales-list/verification.md'), /e2e\/tests\/sales\.spec\.ts:3 › sales page shows a recorded sale \| Met/);
    sh('git add -A && git -c user.email=t@t -c user.name=t commit -qm verified');
    assert.match(sh('node openspec/tooling/bin/ci.mjs verify'), /sdd-kit CI: OK/);
    const gate = spawnSync('node', ['openspec/tooling/hooks/archive-gate.mjs'], { cwd: root, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'openspec archive add-sales-list --yes' }, cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.equal(gate.status, 0, gate.stderr);
    sh('git checkout -q -b feature && node openspec/tooling/bin/openspec.mjs archive add-sales-list --yes && git add -A && git -c user.email=t@t -c user.name=t commit -qm archive');
    assert.ok(existsSync(join(root, 'openspec/specs/sales/sales-page/spec.md')));
    assert.match(sh('node openspec/tooling/bin/ci.mjs checks --base main'), /archived add-sales-list: check-verification[\s\S]*sdd-kit CI: OK/);
  });
});
