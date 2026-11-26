// The installer and the pinned OpenSpec CLI (change upgrade-openspec-2, design decisions 1 and 10): the installer
// refuses another OpenSpec version, installs the OpenSpec skills into the project (`--scope project`: one copy in
// `.agents/skills/`, a link in `.claude/skills/`), writes nothing outside the project, and moves the skills of a
// project installed with OpenSpec 1.15.0 on update. Every run of the installer is a child process with its own
// temporary HOME and XDG_CONFIG_HOME, so nothing outside the test folder is read or written.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, lstatSync, realpathSync, chmodSync } from 'node:fs';
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
const INSTALL_HINT = `npm i -g @fission-ai/openspec@${PINNED_VERSION}`;
const KIT_SKILLS = [
  'openspec-new-change',
  'openspec-continue-change',
  'openspec-apply-change',
  'openspec-verify-change',
  'openspec-archive-change',
  'openspec-explore',
  'openspec-update-change',
  'openspec-sync-specs',
  'openspec',
];
const COMMANDS_1_15 = ['new', 'continue', 'apply', 'verify', 'archive', 'explore', 'sync', 'update'];

/** A git project with one file of its own. */
function gitProject() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-cli-'));
  writeFileSync(join(root, 'README.md'), '# app\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

/** Environment of one installer run: a fresh HOME, and XDG_CONFIG_HOME fresh too unless `xdg: false` (unset). */
function isolatedEnv({ home = mkdtempSync(join(tmpdir(), 'sdd-kit-home-')), xdg = true, bin } = {}) {
  const env = { ...process.env, HOME: home, OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' };
  for (const k of ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_STATE_HOME', 'OPENSPEC_SKILLS_SCOPE']) delete env[k];
  if (xdg) env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), 'sdd-kit-xdg-'));
  if (bin) env.OPENSPEC_BIN = bin;
  return env;
}

/** Runs `node installer/sdd-kit.mjs <args>` in the project. */
function sddKit(root, args, env = isolatedEnv()) {
  return spawnSync(process.execPath, [INSTALLER, ...args], { cwd: root, env, encoding: 'utf8' });
}

/** A fake `openspec` that answers `--version` with the given version and fails on anything else. */
function fakeOpenspec(version) {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-fake-openspec-'));
  const bin = join(dir, 'openspec');
  writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${version}; exit 0; fi\necho "fake openspec: $*" >&2\nexit 1\n`);
  chmodSync(bin, 0o755);
  return bin;
}

/** Every file and link under a folder (relative path → content or link target); `.git/` is left out. */
function snapshot(dir) {
  const out = {};
  if (!existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isSymbolicLink()) out[p.slice(dir.length + 1)] = `-> ${realpathSync(p)}`;
      else if (e.isDirectory()) walk(p);
      else out[p.slice(dir.length + 1)] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

const read = (root, f) => readFileSync(join(root, f), 'utf8');
const output = (r) => `${r.stdout}\n${r.stderr}`;
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * A project of the 0.7.0 era (as `project070()` of tests/openspec-cli-update.test.mjs builds it): the kit files, a
 * `kit.json` pinned to OpenSpec 1.15.0 (recorded in the manifest as the kit wrote it) and what OpenSpec 1.15.0 wrote
 * into `.claude/`.
 */
function project070() {
  const root = gitProject();
  const setup = sddKit(root, ['install', '--yes', '--skip-openspec']);
  assert.equal(setup.status, 0, output(setup));
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

describe('the installer refuses another OpenSpec version', () => {
  // @scenario kit/openspec-cli :: Install with an older OpenSpec is refused
  test('install with OpenSpec 1.15.0 exits with an error, writes no file and names the pinned install command', () => {
    const root = gitProject();
    const before = snapshot(root);
    const r = sddKit(root, ['install', '--yes'], isolatedEnv({ bin: fakeOpenspec('1.15.0') }));
    assert.notEqual(r.status, 0, output(r));
    assert.ok(output(r).includes(INSTALL_HINT), output(r));
    assert.deepEqual(snapshot(root), before);
  });

  // @scenario kit/openspec-cli :: Update with an older OpenSpec is refused
  test('update with OpenSpec 1.15.0 exits with an error, changes no file and names the pinned install command', () => {
    const root = project070();
    assert.equal(JSON.parse(read(root, KIT_JSON)).openspecVersion, '1.15.0', 'the project is pinned to OpenSpec 1.15.0');
    const before = snapshot(root);
    const r = sddKit(root, ['update', '--yes'], isolatedEnv({ bin: fakeOpenspec('1.15.0') }));
    assert.notEqual(r.status, 0, output(r));
    assert.ok(output(r).includes(INSTALL_HINT), output(r));
    assert.deepEqual(snapshot(root), before);
  });
});

describe('the installer with the pinned OpenSpec CLI', { skip: cliSkipReason() }, () => {
  // @scenario kit/openspec-cli :: Install with the pinned OpenSpec goes on
  test('install with OpenSpec 2.2.0 completes and pins 2.2.0 in kit.json', () => {
    const root = gitProject();
    const r = sddKit(root, ['install', '--yes']);
    assert.equal(r.status, 0, output(r));
    assert.equal(JSON.parse(read(root, 'openspec/tooling/kit.json')).openspecVersion, '2.2.0');
  });

  // @scenario kit/openspec-cli :: New project gets the kit profile skills in the project
  test('a new project gets the kit profile skills in .agents/skills/, linked from .claude/skills/', () => {
    const root = gitProject();
    const r = sddKit(root, ['install', '--yes']);
    assert.equal(r.status, 0, output(r));
    for (const name of KIT_SKILLS) {
      assert.ok(existsSync(join(root, '.agents/skills', name, 'SKILL.md')), `.agents/skills/${name}/SKILL.md`);
      const link = join(root, '.claude/skills', name);
      assert.ok(lstatSync(link).isSymbolicLink(), `.claude/skills/${name} is a link`);
      assert.equal(realpathSync(link), realpathSync(join(root, '.agents/skills', name)), `.claude/skills/${name} links to .agents/skills/${name}`);
    }
    for (const dir of ['.agents/skills', '.claude/skills']) {
      assert.ok(!existsSync(join(root, dir, 'openspec-propose')), `no openspec-propose in ${dir}`);
    }
    assert.match(read(root, 'openspec/config.yaml'), /^skillsScope: project\b/m, 'the project keeps its skills: no scope question on update');
  });

  // @scenario kit/openspec-cli :: Nothing is written outside the project
  test('the home folder skills and OpenSpec config are untouched, XDG_CONFIG_HOME unset', () => {
    const home = mkdtempSync(join(tmpdir(), 'sdd-kit-home-'));
    // a developer who also uses OpenSpec machine-wide: global skills of their own and their own profile
    const known = {
      '.claude/skills/my-skill/SKILL.md': '# my skill\n',
      '.claude/skills/openspec-propose/SKILL.md': '# my global propose skill\n',
      '.agents/skills/openspec-explore/SKILL.md': '# my global explore skill\n',
      '.agents/skills/openspec-propose/SKILL.md': '# my global propose skill\n',
      '.config/openspec/config.json': '{ "profile": "core" }\n',
      '.local/share/openspec/projects.json': '{ "projects": [] }\n',
    };
    for (const [rel, content] of Object.entries(known)) {
      mkdirSync(dirname(join(home, rel)), { recursive: true });
      writeFileSync(join(home, rel), content);
    }
    // OpenSpec's own data folder too (2.2.0 `update` records projects there): it stays as the developer had it
    const watched = ['.claude/skills', '.agents/skills', '.config/openspec', '.local/share/openspec'];
    const before = Object.fromEntries(watched.map((d) => [d, snapshot(join(home, d))]));
    const root = gitProject();
    const r = sddKit(root, ['install', '--yes'], isolatedEnv({ home, xdg: false }));
    assert.equal(r.status, 0, output(r));
    for (const d of watched) assert.deepEqual(snapshot(join(home, d)), before[d], `~/${d} is unchanged`);
  });

  // @scenario kit/openspec-cli :: Update of a project installed with OpenSpec 1.15.0 moves the skills
  test('update with OpenSpec 2.2.0 turns the 1.15.0 skill folders into links and removes the generated command files', () => {
    const root = gitProject();
    // a project of the 0.7.0 era: the kit files, a config without skillsScope, and what OpenSpec 1.15.0 wrote
    const setup = sddKit(root, ['install', '--yes', '--skip-openspec']);
    assert.equal(setup.status, 0, output(setup));
    writeFileSync(join(root, 'openspec/config.yaml'), read(root, 'openspec/config.yaml').replace(/^skillsScope:.*\n/m, ''));
    cpSync(join(LAYOUT_1_15, '.claude'), join(root, '.claude'), { recursive: true });
    assert.ok(lstatSync(join(root, '.claude/skills/openspec-new-change')).isDirectory());
    assert.ok(existsSync(join(root, '.claude/commands/opsx/new.md')));

    const r = sddKit(root, ['update', '--yes']);
    assert.equal(r.status, 0, output(r));
    const link = join(root, '.claude/skills/openspec-new-change');
    assert.ok(lstatSync(link).isSymbolicLink(), '.claude/skills/openspec-new-change is a link');
    assert.equal(realpathSync(link), realpathSync(join(root, '.agents/skills/openspec-new-change')));
    for (const c of COMMANDS_1_15) assert.ok(!existsSync(join(root, '.claude/commands/opsx', `${c}.md`)), `.claude/commands/opsx/${c}.md is removed`);
  });
});

// the fixture of the 1.15.0 layout is what the update test relies on
test('the OpenSpec 1.15.0 layout fixture holds the eight skills and the eight command files', () => {
  for (const name of KIT_SKILLS.filter((n) => n !== 'openspec')) assert.ok(existsSync(join(LAYOUT_1_15, '.claude/skills', name, 'SKILL.md')), name);
  for (const c of COMMANDS_1_15) assert.ok(existsSync(join(LAYOUT_1_15, '.claude/commands/opsx', `${c}.md`)), c);
});

describe('the kit wrapper keeps the skills in the project', () => {
  /** Runs kit/openspec/tooling/bin/openspec.mjs with a fake pinned CLI; returns the arguments the CLI got. */
  function wrapperArgs(args) {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-fake-openspec-'));
    const log = join(dir, 'args.txt');
    const bin = join(dir, 'openspec');
    writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${PINNED_VERSION}; exit 0; fi\necho "$*" > "${log}"\n`);
    chmodSync(bin, 0o755);
    const r = spawnSync(process.execPath, [join(REPO, 'kit/openspec/tooling/bin/openspec.mjs'), ...args], { env: isolatedEnv({ bin }), encoding: 'utf8' });
    assert.equal(r.status, 0, output(r));
    return read(dir, 'args.txt').trim();
  }

  test('an init without a scope gets --scope project; a named scope and other commands are passed as they are', () => {
    assert.equal(wrapperArgs(['init', '--tools', 'claude']), 'init --tools claude --scope project');
    assert.equal(wrapperArgs(['init', '--scope', 'global']), 'init --scope global');
    assert.equal(wrapperArgs(['init', '--scope=global']), 'init --scope=global');
    assert.equal(wrapperArgs(['update']), 'update');
  });

  test('OpenSpec runs with an empty temporary HOME, removed afterwards, and the kit XDG profile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-fake-openspec-'));
    const log = join(dir, 'env.txt');
    const bin = join(dir, 'openspec');
    writeFileSync(bin, `#!/bin/sh\nif [ "$1" = "--version" ]; then echo ${PINNED_VERSION}; exit 0; fi\n`
      + `{ echo "$HOME"; ls -A "$HOME" | wc -l; echo "$XDG_CONFIG_HOME"; echo "$XDG_DATA_HOME"; } > "${log}"\n`);
    chmodSync(bin, 0o755);
    const env = isolatedEnv({ bin });
    const r = spawnSync(process.execPath, [join(REPO, 'kit/openspec/tooling/bin/openspec.mjs'), 'update'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, output(r));
    const [home, entries, xdg, data] = read(dir, 'env.txt').trim().split('\n').map((l) => l.trim());
    assert.notEqual(home, env.HOME, 'not the HOME of the caller');
    assert.equal(entries, '0', 'the temporary HOME is empty');
    assert.ok(!existsSync(home), 'the temporary HOME is removed afterwards');
    assert.equal(xdg, join(REPO, 'kit/openspec/tooling/xdg'));
    assert.ok(data.startsWith(home), 'XDG_DATA_HOME lies inside the temporary HOME');
  });
});
