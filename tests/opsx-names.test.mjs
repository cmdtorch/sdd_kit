// Command names in the kit (change upgrade-openspec-2, design decision 8): OpenSpec 2.x has no `/opsx:*`
// commands, so the installed kit files name the OpenSpec skills (`/openspec-new-change`,
// `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-archive-change`, ...) and never `/opsx:`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { install } from '../installer/sdd-kit.mjs';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(REPO, 'installer', 'sdd-kit.mjs');
const PILOT = join(REPO, 'fixtures', 'projects', 'pilot-like');
const OPSX = /\/opsx:/;

/** Pilot-shaped project under git with the kit installed (`sdd-kit install --yes`; the starter hook test needs no CLI step). */
async function installed() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-opsx-'));
  cpSync(PILOT, root, { recursive: true });
  renameSync(join(root, 'gitignore.txt'), join(root, '.gitignore'));
  mkdirSync(join(root, '.claude'), { recursive: true });
  if (!existsSync(join(root, '.claude', 'settings.json'))) writeFileSync(join(root, '.claude', 'settings.json'), '{}\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  const r = await install({ target: root, skipOpenspec: true, yes: true, json: true });
  assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
  return root;
}

/**
 * A fresh git project without `openspec/`, installed with the real OpenSpec CLI (`sdd-kit install --yes`: `openspec
 * init`, the kit files, `openspec update`) in a child process with its own HOME and XDG_CONFIG_HOME.
 */
function installedWithCli() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-opsx-cli-'));
  writeFileSync(join(root, 'README.md'), '# app\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  const env = { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'sdd-kit-home-')), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' };
  for (const k of ['XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'OPENSPEC_SKILLS_SCOPE']) delete env[k];
  env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), 'sdd-kit-xdg-'));
  const r = spawnSync(process.execPath, [INSTALLER, 'install', '--yes', '--json'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  const result = JSON.parse(r.stdout);
  assert.ok(result.actions.some((a) => /^openspec init\b/.test(a.step)), 'the install ran openspec init');
  assert.ok(result.actions.some((a) => /^openspec update\b/.test(a.step)), 'the install ran openspec update');
  assert.equal(result.lint.ok, true, JSON.stringify(result.lint.findings));
  return root;
}

describe('kit texts name the OpenSpec skills', () => {
  // @scenario kit/openspec-cli :: No `/opsx:` in installed kit files
  test('no installed kit file, settings or openspec/config.yaml names an /opsx: command', { skip: cliSkipReason() }, () => {
    const root = installedWithCli();
    const manifest = JSON.parse(readFileSync(join(root, 'openspec', 'tooling', 'kit-manifest.json'), 'utf8'));
    const files = Object.keys(manifest.files);
    for (const dir of ['openspec/protocols/', 'openspec/schemas/', 'openspec/tooling/', '.claude/']) {
      assert.ok(files.some((f) => f.startsWith(dir)), `the manifest lists kit files under ${dir}`);
    }
    const searched = [...files, 'openspec/config.yaml', '.claude/settings.json'];
    const hits = searched.filter((f) => OPSX.test(readFileSync(join(root, f), 'utf8')));
    assert.deepEqual(hits, [], `files naming /opsx: ${hits.join(', ')}`);
  });

  // @scenario kit/openspec-cli :: The starter hook names the new-change skill
  test('the installed schema starter tells the developer to start again with /openspec-new-change', async () => {
    const root = await installed();
    const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'hooks', 'schema-starter.mjs')], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'Bash', tool_input: { command: 'openspec new change "add-export"' } }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /If the menu is dismissed: do not create the change; tell the developer to start again with \/openspec-new-change <name>\./);
    assert.doesNotMatch(r.stderr, /\/opsx:new/);
  });
});
