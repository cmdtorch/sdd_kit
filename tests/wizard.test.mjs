// Install wizard: layout detection, scripted answers → install options, the equivalent command line,
// and the CLI flow (preview, confirmation, nothing written when declined).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PassThrough, Writable } from 'node:stream';
import { detectProject, createAsker, runWizard, equivalentCommand } from '../installer/lib/wizard.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(REPO, 'installer', 'sdd-kit.mjs');

function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-wizard-'));
  for (const [f, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    if (!f.endsWith('/')) writeFileSync(join(root, f), content);
  }
  return root;
}

/** Runs the wizard with the given input lines; returns the options and everything it printed. */
async function scripted(lines, detected, currentLanguage = null) {
  const input = new PassThrough();
  let printed = '';
  const output = new Writable({ write(c, _e, cb) { printed += c; cb(); } });
  const ask = createAsker(input, output);
  input.end(lines.map((l) => l + '\n').join(''));
  const opts = await runWizard({ ask, detected, currentLanguage });
  ask.close();
  return { opts, printed };
}

describe('detectProject', () => {
  test('Django project at the root → single repository with django', () => {
    const d = detectProject(project({ 'manage.py': '', 'pyproject.toml': 'dependencies = ["django>=5"]' }));
    assert.deepEqual(d, { layout: 'single', django: true, e2e: false, backendPath: null });
  });
  test('backend/ + frontend/ + e2e/ → monorepo, Django found in backend/', () => {
    const d = detectProject(project({ 'backend/manage.py': '', 'frontend/package.json': '{}', 'e2e/playwright.config.ts': '' }));
    assert.deepEqual(d, { layout: 'monorepo', django: true, e2e: true, backendPath: null });
  });
  test('package.json only → split frontend; a sibling backend/ checkout is offered', () => {
    const parent = mkdtempSync(join(tmpdir(), 'sdd-kit-wizard-pair-'));
    mkdirSync(join(parent, 'backend'));
    mkdirSync(join(parent, 'web'));
    writeFileSync(join(parent, 'web', 'package.json'), '{}');
    assert.deepEqual(detectProject(join(parent, 'web')), { layout: 'split-frontend', django: false, e2e: false, backendPath: '../backend' });
  });
  test('non-Django Python project → single repository without django', () => {
    const d = detectProject(project({ 'pyproject.toml': 'dependencies = ["fastapi"]' }));
    assert.equal(d.layout, 'single');
    assert.equal(d.django, false);
  });
});

describe('runWizard', () => {
  const single = { layout: 'single', django: true, e2e: false, backendPath: null };

  test('Enter everywhere accepts the detected defaults', async () => {
    const { opts } = await scripted(['', '', '', ''], single);
    assert.deepEqual(opts, { presets: ['django'], adapter: null, role: null, backendPath: null, questionsLanguage: 'English', ci: true });
  });
  test('end of input answers the remaining questions with defaults', async () => {
    const { opts } = await scripted([], single, 'Russian');
    assert.equal(opts.questionsLanguage, 'Russian');
    assert.deepEqual(opts.presets, ['django']);
  });
  test('monorepo with Playwright, chosen by number', async () => {
    const { opts } = await scripted(['2', 'y', 'y', 'Russian', 'n'], single);
    assert.deepEqual(opts, { presets: ['django', 'playwright'], adapter: 'monorepo', role: null, backendPath: null, questionsLanguage: 'Russian', ci: false });
  });
  test('split backend', async () => {
    const { opts } = await scripted(['3', '', '', ''], single);
    assert.equal(opts.adapter, 'split');
    assert.equal(opts.role, 'backend');
    assert.deepEqual(opts.presets, ['django']);
  });
  test('split frontend: no stack question (no presets), backend path offered from detection', async () => {
    const { opts, printed } = await scripted(['', '', '', ''], { layout: 'split-frontend', django: false, e2e: false, backendPath: '../backend' });
    assert.deepEqual(opts, { presets: [], adapter: 'split', role: 'frontend', backendPath: '../backend', questionsLanguage: 'English', ci: true });
    assert.doesNotMatch(printed, /Django/);
  });
  test('not Django → no preset and a pointer to writing verify.yaml', async () => {
    const { opts, printed } = await scripted(['1', 'n', '', ''], single);
    assert.deepEqual(opts.presets, []);
    assert.match(printed, /verify\.yaml by hand/);
  });
  test('invalid answers are asked again', async () => {
    const { opts, printed } = await scripted(['7', 'monorepo', 'maybe', 'y', 'n', '', ''], single);
    assert.equal(opts.adapter, 'monorepo');
    assert.deepEqual(opts.presets, ['django']);
    assert.match(printed, /please enter a number from 1 to 4/);
    assert.match(printed, /please answer y or n/);
  });
});

test('equivalentCommand reproduces the answers as flags', () => {
  assert.equal(
    equivalentCommand({ presets: ['django', 'playwright'], adapter: 'monorepo', questionsLanguage: 'Russian', ci: true }),
    'sdd-kit install --adapter monorepo --preset django,playwright --questions-language Russian --ci',
  );
  assert.equal(
    equivalentCommand({ presets: [], adapter: 'split', role: 'frontend', backendPath: '../my backend', questionsLanguage: 'Brazilian Portuguese', ci: false }),
    "sdd-kit install --adapter split --role frontend --backend-path '../my backend' --questions-language 'Brazilian Portuguese'",
  );
});

describe('CLI', () => {
  const run = (root, input, extra = []) => spawnSync(process.execPath, [CLI, 'install', '--wizard', '--skip-openspec', '--target', root, ...extra], { input, encoding: 'utf8' });

  test('answers → preview → confirmation → installed with the chosen options and next steps', () => {
    const root = project({ 'manage.py': '', '.gitignore': '' });
    const r = run(root, '\n\nRussian\n\ny\n');
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /Same as: sdd-kit install --preset django --questions-language Russian --ci/);
    assert.match(r.stdout, /\[dry run\]/);
    assert.match(r.stdout, /Next steps:/);
    assert.match(r.stdout, /api\.mjs snapshot/);
    const manifest = JSON.parse(readFileSync(join(root, 'openspec/tooling/kit-manifest.json'), 'utf8'));
    assert.deepEqual(manifest.presets, ['django']);
    assert.equal(manifest.ci, true);
    assert.ok(existsSync(join(root, '.github/workflows/sdd-kit.yml')));
    assert.match(readFileSync(join(root, 'openspec/config.yaml'), 'utf8'), /Questions language: Russian/);
  });
  test('declining the confirmation writes nothing', () => {
    const root = project({ 'manage.py': '' });
    const r = run(root, '\n\n\n\nn\n');
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Nothing was written/);
    assert.deepEqual(readdirSync(root), ['manage.py']);
  });
  test('--dry-run stops after the preview', () => {
    const root = project({ 'manage.py': '' });
    const r = run(root, '\n\n\n\n', ['--dry-run']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\[dry run\]/);
    assert.deepEqual(readdirSync(root), ['manage.py']);
  });
  test('--wizard with --json is refused', () => {
    const root = project({ 'manage.py': '' });
    const r = run(root, '', ['--json']);
    assert.equal(r.status, 1);
    assert.match(r.stdout + r.stderr, /cannot be combined/);
  });
  test('piped input without --wizard keeps the flag-only behaviour', () => {
    const root = project({ 'manage.py': '' });
    const r = spawnSync(process.execPath, [CLI, 'install', '--skip-openspec', '--target', root], { input: '', encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout, /install wizard/);
  });
});
