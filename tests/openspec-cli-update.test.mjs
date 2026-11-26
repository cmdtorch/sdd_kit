// The update message about active changes (change upgrade-openspec-2, design decision 4): `sdd-kit update` reads
// the project's old `openspec/tooling/kit.json` before it writes kit files; when that kit was pinned to OpenSpec
// 1.x, the output lists every active change (every folder of `openspec/changes/` except `archive/`) and names the
// OpenSpec skills that continue them, then the update goes on. Every run of the installer is a child process with
// its own temporary HOME and XDG_CONFIG_HOME, so nothing outside the test folder is read or written.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cliSkipReason, PINNED_VERSION } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(REPO, 'installer', 'sdd-kit.mjs');
const LAYOUT_1_15 = join(REPO, 'fixtures', 'projects', 'openspec-1.15.0-layout');
const KIT_JSON = 'openspec/tooling/kit.json';
const MANIFEST = 'openspec/tooling/kit-manifest.json';
const KIT = JSON.parse(readFileSync(join(REPO, 'kit', KIT_JSON), 'utf8'));

/** A git project with one file of its own. */
function gitProject() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-upd-'));
  writeFileSync(join(root, 'README.md'), '# app\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

/** Environment of one installer run: fresh HOME and XDG_CONFIG_HOME, telemetry off. */
function isolatedEnv() {
  const env = { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'sdd-kit-home-')), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' };
  for (const k of ['XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'OPENSPEC_SKILLS_SCOPE']) delete env[k];
  env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), 'sdd-kit-xdg-'));
  return env;
}

/** Runs `node installer/sdd-kit.mjs <args>` in the project and expects it to complete. */
function sddKit(root, args) {
  const r = spawnSync(process.execPath, [INSTALLER, ...args], { cwd: root, env: isolatedEnv(), encoding: 'utf8' });
  const out = `${r.stdout}\n${r.stderr}`;
  assert.equal(r.status, 0, out);
  return out;
}

const read = (root, f) => readFileSync(join(root, f), 'utf8');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** A change folder as OpenSpec writes it. */
function addChange(root, name, schema) {
  mkdirSync(join(root, 'openspec/changes', name), { recursive: true });
  writeFileSync(join(root, 'openspec/changes', name, '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-11-01\n`);
  writeFileSync(join(root, 'openspec/changes', name, 'proposal.md'), '# Proposal\n');
}

/**
 * A project of the 0.7.0 era: the kit files, a `kit.json` pinned to OpenSpec 1.15.0 (recorded in the manifest as
 * the kit wrote it, so the update replaces it) and what OpenSpec 1.15.0 wrote into `.claude/`.
 */
function project070() {
  const root = gitProject();
  sddKit(root, ['install', '--yes', '--skip-openspec']);
  const old = JSON.stringify({ kit: 'sdd-kit', kitVersion: '0.7.0', openspecVersion: '1.15.0' }, null, 2) + '\n';
  writeFileSync(join(root, KIT_JSON), old);
  const manifest = JSON.parse(read(root, MANIFEST));
  manifest.files[KIT_JSON] = sha256(old);
  writeFileSync(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(root, 'openspec/config.yaml'), read(root, 'openspec/config.yaml').replace(/^skillsScope:.*\n/m, ''));
  cpSync(join(LAYOUT_1_15, '.claude'), join(root, '.claude'), { recursive: true });
  mkdirSync(join(root, 'openspec/changes/archive/2026-10-01-done-before'), { recursive: true });
  return root;
}

describe('the update names the active changes', { skip: cliSkipReason() }, () => {
  // @scenario kit/openspec-cli :: Active changes are listed and the update completes
  test('update from a kit pinned to OpenSpec 1.15.0 names both active changes and the two skills, then updates', () => {
    const root = project070();
    addChange(root, 'add-export', 'clarify');
    addChange(root, 'old-fix', 'spec-driven');
    const out = sddKit(root, ['update', '--yes']);
    for (const s of ['add-export', 'old-fix', '/openspec-continue-change', '/openspec-apply-change']) assert.ok(out.includes(s), `the output names ${s}:\n${out}`);
    assert.ok(!out.includes('done-before'), 'an archived change is not named');
    const kit = JSON.parse(read(root, KIT_JSON));
    assert.equal(kit.kitVersion, KIT.kitVersion);
    assert.equal(kit.openspecVersion, PINNED_VERSION);
  });

  // @scenario kit/openspec-cli :: No active changes, no message
  test('update from a kit pinned to OpenSpec 1.15.0 with only archive/ in openspec/changes/ names no change', () => {
    const root = project070();
    const out = sddKit(root, ['update', '--yes']);
    assert.ok(!out.includes('/openspec-continue-change'), out);
    assert.ok(!out.includes('done-before'), out);
    assert.ok(!/active change/i.test(out), out);
  });

  // @scenario kit/openspec-cli :: A later update does not repeat the message
  test('update of a project already pinned to OpenSpec 2.2.0 does not name its active change', () => {
    const root = gitProject();
    sddKit(root, ['install', '--yes']);
    assert.equal(JSON.parse(read(root, KIT_JSON)).openspecVersion, PINNED_VERSION);
    addChange(root, 'add-export', 'clarify');
    const out = sddKit(root, ['update', '--yes']);
    assert.ok(!out.includes('add-export'), out);
    assert.ok(!out.includes('/openspec-continue-change'), out);
  });

  // @scenario kit/openspec-cli :: No `/opsx:` in the installer output
  test('update of a 0.7.0 project with an active change prints no /opsx: command', () => {
    const root = project070();
    addChange(root, 'add-export', 'clarify');
    const out = sddKit(root, ['update', '--yes']);
    assert.ok(out.includes('add-export'), out);
    assert.ok(!out.includes('/opsx:'), out);
  });
});
