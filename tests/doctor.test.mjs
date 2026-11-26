// doctor and OpenSpec 2 (change upgrade-openspec-2, design decisions 5 and 7): the Node minimum is 22.12.0, compared
// by the full version (injected here instead of switching Node), and every file left in `.claude/commands/opsx/` is a
// warning that names it and says to delete it. Installer and doctor runs are child processes with their own temporary
// HOME and XDG_CONFIG_HOME.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { cliSkipReason } from './helpers/openspec.mjs';
import { doctor } from '../kit/openspec/tooling/bin/doctor.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(REPO, 'installer', 'sdd-kit.mjs');

function isolatedEnv() {
  const env = { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'sdd-kit-home-')), XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'sdd-kit-xdg-')), OPENSPEC_TELEMETRY: '0' };
  for (const k of ['XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'OPENSPEC_BIN']) delete env[k];
  return env;
}
const output = (r) => `${r.stdout}\n${r.stderr}`;

/** A git project after `sdd-kit <args>` (install by default). */
function sddKit(args, root) {
  if (!root) {
    root = mkdtempSync(join(tmpdir(), 'sdd-kit-doctor-'));
    writeFileSync(join(root, 'README.md'), '# app\n');
    execFileSync('git', ['init', '-q'], { cwd: root });
  }
  const r = spawnSync(process.execPath, [INSTALLER, ...args], { cwd: root, env: isolatedEnv(), encoding: 'utf8' });
  assert.equal(r.status, 0, output(r));
  return root;
}

/** `doctor.mjs` in the project, as the developer runs it: its text report. */
function doctorText(root) {
  const r = spawnSync(process.execPath, [join(root, 'openspec/tooling/bin/doctor.mjs')], { cwd: root, env: isolatedEnv(), encoding: 'utf8' });
  return output(r);
}

describe('the Node minimum is 22.12.0', () => {
  const root = sddKit(['install', '--yes', '--skip-openspec']);
  const node = (version) => doctor(root, { nodeVersion: version }).find((i) => i.check === 'node');

  // @scenario kit/openspec-cli :: Node 20 is an error
  test('Node 20.20.2 is an error naming the version, the fix names Node 22.12', () => {
    const item = node('20.20.2');
    assert.equal(item.level, 'error');
    assert.match(item.message, /20\.20\.2/);
    assert.match(item.fix, /install Node 22\.12 or newer/);
  });

  // @scenario kit/openspec-cli :: Node 22.12.0 is accepted
  test('Node 22.12.0 is ok', () => {
    assert.equal(node('22.12.0').level, 'ok');
    assert.equal(node('24.1.0').level, 'ok');
  });

  // @scenario kit/openspec-cli :: Node 22.11 is an error
  test('Node 22.11.0 is an error', () => {
    assert.equal(node('22.11.0').level, 'error');
  });

  test('without an injected version doctor checks the running Node', () => {
    assert.match(doctor(root).find((i) => i.check === 'node').message, new RegExp(process.versions.node.replace(/\./g, '\\.')));
  });
});

describe('leftover /opsx command files', { skip: cliSkipReason() }, () => {
  // @scenario kit/openspec-cli :: An edited command file is left behind
  test('an edited apply.md left after the update is a warning naming it and saying to delete it', () => {
    const root = sddKit(['install', '--yes']);
    mkdirSync(join(root, '.claude/commands/opsx'), { recursive: true });
    writeFileSync(join(root, '.claude/commands/opsx/apply.md'), '# my own apply command\n\nEdited by the team.\n');
    sddKit(['update', '--yes'], root);
    const out = doctorText(root);
    assert.match(out, /! commands: \.claude\/commands\/opsx\/apply\.md is left from OpenSpec 1/);
    assert.match(out, /fix: delete it: OpenSpec 2 has no \/opsx commands/);
  });

  // @scenario kit/openspec-cli :: No command files, no warning
  test('right after install the report names no file under .claude/commands/opsx/', () => {
    const root = sddKit(['install', '--yes']);
    assert.doesNotMatch(doctorText(root), /\.claude\/commands\/opsx\//);
  });
});
