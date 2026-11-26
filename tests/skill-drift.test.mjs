// The skill drift check (change upgrade-openspec-2, design decision 3): `doctor` and the session-start hook find
// skill drift with OpenSpec's own `openspec update --dry-run --json` (kit profile, empty temporary HOME) when the CLI
// is the pinned version, fall back to the file check (`openspec-propose` present, `openspec-continue-change` missing)
// when the CLI is missing or another version, and report a dry run that fails as a warning. The router skill
// `openspec` is never drift. Every installer, doctor and hook run is a child process with its own temporary HOME and
// XDG_CONFIG_HOME, so nothing outside the test folder is read or written.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, chmodSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { cliSkipReason, PINNED_VERSION } from './helpers/openspec.mjs';
import { skillDrift } from '../kit/openspec/tooling/lib/skills.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(REPO, 'installer', 'sdd-kit.mjs');
const FIX = 'node openspec/tooling/bin/openspec.mjs update';

/** A git project with one file of its own. */
function gitProject() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-drift-'));
  writeFileSync(join(root, 'README.md'), '# app\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

/** A fresh HOME and XDG_CONFIG_HOME; `bin` sets OPENSPEC_BIN, `path` replaces PATH. */
function isolatedEnv({ bin, path } = {}) {
  const env = { ...process.env, HOME: mkdtempSync(join(tmpdir(), 'sdd-kit-home-')), XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'sdd-kit-xdg-')), OPENSPEC_TELEMETRY: '0' };
  for (const k of ['XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'OPENSPEC_BIN']) delete env[k];
  if (bin) env.OPENSPEC_BIN = bin;
  if (path) env.PATH = path;
  return env;
}

const output = (r) => `${r.stdout}\n${r.stderr}`;

/** `sdd-kit install --yes` (with the real CLI, or `--skip-openspec`). */
function installed({ skipOpenspec = false } = {}) {
  const root = gitProject();
  const r = spawnSync(process.execPath, [INSTALLER, 'install', '--yes', ...(skipOpenspec ? ['--skip-openspec'] : [])], { cwd: root, env: isolatedEnv(), encoding: 'utf8' });
  assert.equal(r.status, 0, output(r));
  return root;
}

/** `doctor.mjs --json` in the project: { items, skills (the skills item), out }. */
function doctorRun(root, env = isolatedEnv()) {
  const r = spawnSync(process.execPath, [join(root, 'openspec/tooling/bin/doctor.mjs'), '--json'], { cwd: root, env, encoding: 'utf8' });
  const { items } = JSON.parse(r.stdout);
  return { items, skills: items.find((i) => i.check === 'skills'), out: output(r) };
}

/** The session-start hook of the project, run as Claude Code does: its additional context ('' when none). */
function sessionStart(root, env = isolatedEnv()) {
  const r = spawnSync(process.execPath, [join(root, 'openspec/tooling/hooks/session-start.mjs')], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, hook_event_name: 'SessionStart', source: 'startup' }),
    env: { ...env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, output(r));
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '';
}

/**
 * A fake `openspec`: `--version` prints `version`; any other call is logged to `log` and exits with `status`
 * (printing nothing). Returns { bin, calls() → the logged argument lines }.
 */
function fakeOpenspec(version, status = 1) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-fake-openspec-'));
  const bin = join(dir, 'openspec');
  const log = join(dir, 'calls.txt');
  writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\necho "$*" >> "${log}"\nexit ${status}\n`);
  chmodSync(bin, 0o755);
  return { bin, calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n') : []) };
}

/** A PATH with sh and git only: no `openspec` command. */
function pathWithoutOpenspec() {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-path-'));
  const which = (c) => spawnSync('sh', ['-c', `command -v ${c}`], { encoding: 'utf8' }).stdout.trim();
  for (const c of ['sh', 'git']) symlinkSync(which(c), join(dir, c));
  return dir;
}

/** A project with the kit (no OpenSpec run) and the kit profile skills as plain folders, plus `extra` skills. */
function fileCheckProject({ without = [], extra = [] } = {}) {
  const root = installed({ skipOpenspec: true });
  const names = ['openspec', 'openspec-new-change', 'openspec-continue-change', 'openspec-apply-change', ...extra].filter((n) => !without.includes(n));
  for (const n of names) {
    mkdirSync(join(root, '.claude/skills', n), { recursive: true });
    writeFileSync(join(root, '.claude/skills', n, 'SKILL.md'), `# ${n}\n`);
  }
  return root;
}

describe('the drift check with the pinned OpenSpec CLI', { skip: cliSkipReason() }, () => {
  // @scenario kit/openspec-cli :: Router skill is not reported as drift
  test('right after install the router skill is there and the skills line is ok', () => {
    const root = installed();
    assert.ok(existsSync(join(root, '.claude/skills/openspec/SKILL.md')), '.claude/skills/openspec exists');
    const d = doctorRun(root);
    assert.equal(d.skills.level, 'ok', d.out);
    assert.doesNotMatch(d.skills.message, /\.claude\/skills\/openspec\b(?!-)/);
  });

  // @scenario kit/openspec-cli :: A missing skill is reported by doctor
  test('a deleted skill link is a skills warning naming it, with the wrapper update as the fix', () => {
    const root = installed();
    rmSync(join(root, '.claude/skills/openspec-continue-change'));
    const d = doctorRun(root);
    assert.equal(d.skills.level, 'warning', d.out);
    assert.match(d.skills.message, /\.claude\/skills\/openspec-continue-change/);
    assert.equal(d.skills.fix, FIX);
  });

  // @scenario kit/openspec-cli :: A missing skill is reported at session start
  test('a deleted skill link is a session-start warning naming it and the fix', () => {
    const root = installed();
    rmSync(join(root, '.claude/skills/openspec-continue-change'));
    const ctx = sessionStart(root);
    assert.match(ctx, /WARNING: OpenSpec skills differ from the kit profile: .*\.claude\/skills\/openspec-continue-change/);
    assert.ok(ctx.includes(FIX), ctx);
  });

  // @scenario kit/openspec-cli :: No drift, no warning
  test('right after install the session context holds no skills warning', () => {
    const root = installed();
    const ctx = sessionStart(root);
    assert.doesNotMatch(ctx, /skill/i);
    assert.doesNotMatch(ctx, /WARNING/);
  });

  test('the dry run leaves the project and the developer home as they were', () => {
    const root = installed();
    rmSync(join(root, '.claude/skills/openspec-continue-change'));
    const env = isolatedEnv();
    doctorRun(root, env);
    assert.ok(!existsSync(join(root, '.claude/skills/openspec-continue-change')), 'the dry run did not restore the link');
    for (const d of ['.agents', '.claude', '.local']) assert.ok(!existsSync(join(env.HOME, d)), `nothing written to ~/${d}`);
  });
});

describe('the drift check falls back to the file check', () => {
  // @scenario kit/openspec-cli :: Another CLI version falls back to the file check
  test('doctor with OpenSpec 1.15.0 names openspec-propose and does not run the dry run', () => {
    const root = fileCheckProject({ extra: ['openspec-propose'] });
    const cli = fakeOpenspec('1.15.0');
    const d = doctorRun(root, isolatedEnv({ bin: cli.bin }));
    assert.equal(d.skills.level, 'warning', d.out);
    assert.match(d.skills.message, /openspec-propose/);
    assert.equal(d.skills.fix, FIX);
    assert.deepEqual(cli.calls().filter((c) => c.includes('update')), []);
  });

  // @scenario kit/openspec-cli :: Session start falls back to the file check with another CLI version
  test('session start with OpenSpec 1.15.0 warns about openspec-propose and does not run the dry run', () => {
    const root = fileCheckProject({ extra: ['openspec-propose'] });
    const cli = fakeOpenspec('1.15.0');
    const ctx = sessionStart(root, isolatedEnv({ bin: cli.bin }));
    assert.match(ctx, /WARNING: OpenSpec skills differ from the kit profile: openspec-propose is installed/);
    assert.ok(ctx.includes(FIX), ctx);
    assert.deepEqual(cli.calls().filter((c) => c.includes('update')), []);
  });

  // @scenario kit/openspec-cli :: A missing CLI falls back to the file check
  test('doctor without an openspec command names openspec-continue-change', () => {
    const root = fileCheckProject({ without: ['openspec-continue-change'] });
    const d = doctorRun(root, isolatedEnv({ path: pathWithoutOpenspec() }));
    assert.equal(d.items.find((i) => i.check === 'openspec').level, 'error', 'the missing CLI is reported on its own line');
    assert.equal(d.skills.level, 'warning', d.out);
    assert.match(d.skills.message, /openspec-continue-change/);
  });

  test('the file check finds nothing when the kit profile skills are there', () => {
    const root = fileCheckProject();
    const d = doctorRun(root, isolatedEnv({ bin: fakeOpenspec('1.15.0').bin }));
    assert.equal(d.skills.level, 'ok', d.out);
  });
});

describe('a dry run that fails', () => {
  // @scenario kit/openspec-cli :: A failed dry run in doctor is a warning
  test('doctor reports a dry run that exits with 1 as a warning that the skill check could not run', () => {
    const root = fileCheckProject();
    const cli = fakeOpenspec(PINNED_VERSION, 1);
    const d = doctorRun(root, isolatedEnv({ bin: cli.bin }));
    assert.ok(cli.calls().some((c) => c.startsWith('update --dry-run --json')), 'the dry run was tried');
    assert.equal(d.skills.level, 'warning', d.out);
    assert.match(d.skills.message, /skill check could not run/);
    assert.ok(!d.items.some((i) => i.level === 'error'), d.out);
  });

  test('unreadable JSON from the dry run is a warning too', () => {
    const root = fileCheckProject();
    const d = doctorRun(root, isolatedEnv({ bin: fakeOpenspec(PINNED_VERSION, 0).bin }));
    assert.equal(d.skills.level, 'warning', d.out);
    assert.match(d.skills.message, /skill check could not run/);
  });

  // @scenario kit/openspec-cli :: A failed dry run is a warning
  test('session start goes on and warns that the skill check could not run', () => {
    const root = fileCheckProject();
    const cli = fakeOpenspec(PINNED_VERSION, 1);
    const ctx = sessionStart(root, isolatedEnv({ bin: cli.bin }));
    assert.ok(cli.calls().some((c) => c.startsWith('update --dry-run --json')), 'the dry run was tried');
    assert.match(ctx, /WARNING: the OpenSpec skill check could not run/);
  });

  test('a dry run that does not end within the timeout is a failed check', () => {
    const root = fileCheckProject();
    const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-fake-openspec-'));
    const bin = join(dir, 'openspec');
    writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${PINNED_VERSION}; exit 0; fi\nexec sleep 5\n`);
    chmodSync(bin, 0o755);
    const d = skillDrift(root, { openspecVersion: PINNED_VERSION }, { bin, timeout: 300 });
    assert.equal(d.method, 'dry-run');
    assert.match(d.failed, /did not end within/);
    assert.deepEqual(d.drift, []);
  });
});
