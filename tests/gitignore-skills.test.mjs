// The project's skills are versioned (change upgrade-openspec-2, design decision 2): with OpenSpec 2.x the skills
// live in `.agents/skills/` and `.claude/skills/` holds links to them, so the kit's `.gitignore` rules must let git
// track both the folders and the links, and handle a line that ignores `.agents/` as a whole like the `.claude/`
// one. Every check runs real `git add -A` in a temporary project; every installer run is a child process with its
// own temporary HOME and XDG_CONFIG_HOME.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { cliSkipReason } from './helpers/openspec.mjs';
import { BEGIN, END } from '../installer/lib/gitignore.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INSTALLER = join(REPO, 'installer', 'sdd-kit.mjs');
const LAYOUT_1_15 = join(REPO, 'fixtures', 'projects', 'openspec-1.15.0-layout');

/** A git project with one file of its own and the given `.gitignore`. */
function gitProject(gitignore) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-gi-'));
  writeFileSync(join(root, 'README.md'), '# app\n');
  if (gitignore !== undefined) writeFileSync(join(root, '.gitignore'), gitignore);
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

function sddKit(root, args) {
  const r = spawnSync(process.execPath, [INSTALLER, ...args], { cwd: root, env: isolatedEnv(), encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  return r;
}

/** `git add -A`, then the index as path → mode. */
function addAll(root) {
  execFileSync('git', ['add', '-A'], { cwd: root });
  const out = execFileSync('git', ['ls-files', '-s'], { cwd: root, encoding: 'utf8' });
  const index = {};
  for (const line of out.split('\n').filter(Boolean)) {
    const [meta, path] = line.split('\t');
    index[path] = meta.split(' ')[0];
  }
  return index;
}

const read = (root, f) => readFileSync(join(root, f), 'utf8');
const lines = (text) => text.split('\n').map((l) => l.trim());
/** The lines of the project's own part of `.gitignore`, before the kit block. */
const ownLines = (text) => lines(text.split(BEGIN)[0]);

/** The links and the skill file that must be in the index. */
function assertSkillsTracked(index) {
  for (const link of ['.claude/skills/openspec', '.claude/skills/openspec-new-change']) {
    assert.equal(index[link], '120000', `${link} is in the index as a symbolic link`);
  }
  assert.ok(index['.agents/skills/openspec-new-change/SKILL.md'], '.agents/skills/openspec-new-change/SKILL.md is in the index');
}

describe('the OpenSpec skills are versioned', { skip: cliSkipReason() }, () => {
  // @scenario kit/openspec-cli :: Skill links are tracked when `.claude/` was ignored
  test('with `.claude/` ignored, git add -A takes the skill links and the skill folders', () => {
    const root = gitProject('node_modules/\n.claude/\n');
    sddKit(root, ['install', '--yes']);
    const index = addAll(root);
    assertSkillsTracked(index);
    assert.ok(!index['.claude/settings.local.json'], 'local settings stay ignored');
  });

  // @scenario kit/openspec-cli :: Update of a 0.7.0 project tracks the links
  test('update of a 0.7.0 project drops the folder-only rule and git add -A takes the links', () => {
    const root = gitProject('node_modules/\n.claude/\n');
    sddKit(root, ['install', '--yes', '--skip-openspec']);
    // the project as kit 0.7.0 with OpenSpec 1.15.0 left it: the 0.7.0 block, no skillsScope, skill folders
    const block070 = [
      BEGIN,
      '# openspec/ and the shared parts of .claude/ are versioned (sdd-kit D6)',
      '.claude/*', '!.claude/settings.json', '!.claude/agents/', '!.claude/commands/', '!.claude/skills/', '.claude/skills/*', '!.claude/skills/openspec-*/',
      '.claude/settings.local.json', '.claude/tdd-guard/', '.claude/worktrees/',
      END,
    ];
    writeFileSync(join(root, '.gitignore'), ['node_modules/', '# sdd-kit disabled: .claude/', '', ...block070, ''].join('\n'));
    writeFileSync(join(root, 'openspec/config.yaml'), read(root, 'openspec/config.yaml').replace(/^skillsScope:.*\n/m, ''));
    cpSync(join(LAYOUT_1_15, '.claude'), join(root, '.claude'), { recursive: true });

    sddKit(root, ['update', '--yes']);
    assert.ok(!lines(read(root, '.gitignore')).includes('!.claude/skills/openspec-*/'), 'the folder-only rule is gone');
    assertSkillsTracked(addAll(root));
  });

  // @scenario kit/openspec-cli :: A whole-`.agents/` ignore line is commented out
  test('a `.agents/` line is commented out; only the OpenSpec skills of .agents/ are let in', () => {
    const root = gitProject('node_modules/\n.agents/\n');
    mkdirSync(join(root, '.agents/other'), { recursive: true });
    writeFileSync(join(root, '.agents/other/notes.md'), '# notes\n');
    sddKit(root, ['install', '--yes']);
    const gi = ownLines(read(root, '.gitignore'));
    assert.ok(gi.includes('# sdd-kit disabled: .agents/'), gi.join('\n'));
    assert.ok(!gi.includes('.agents/'), 'the line itself is gone');
    const index = addAll(root);
    assert.ok(index['.agents/skills/openspec-new-change/SKILL.md'], '.agents/skills/openspec-new-change/SKILL.md is in the index');
    assert.ok(!index['.agents/other/notes.md'], '.agents/other/notes.md stays ignored');
  });

  // @scenario kit/openspec-cli :: Other forms of the whole-`.agents/` line are commented out
  test('the forms `/.agents`, `.agents`, `.agents/*` and `/.agents/**` are commented out too', () => {
    for (const form of ['/.agents', '.agents', '.agents/*', '/.agents/**']) {
      const root = gitProject(`${form}\n`);
      sddKit(root, ['install', '--yes', '--skip-openspec']);
      const gi = ownLines(read(root, '.gitignore'));
      assert.ok(gi.includes(`# sdd-kit disabled: ${form}`), `${form}:\n${gi.join('\n')}`);
      assert.ok(!gi.includes(form), `${form} itself is gone from the project's lines`);
    }
    const root = gitProject('/.agents\n');
    sddKit(root, ['install', '--yes']);
    assert.ok(lines(read(root, '.gitignore')).includes('# sdd-kit disabled: /.agents'));
    assert.ok(addAll(root)['.agents/skills/openspec-new-change/SKILL.md'], 'the skill is in the index');
  });

  // @scenario kit/openspec-cli :: Uninstall restores the `.agents/` line
  test('uninstall brings the `.agents/` line back and leaves no disabled line', () => {
    const root = gitProject('node_modules/\n.agents/\n');
    sddKit(root, ['install', '--yes']);
    assert.ok(lines(read(root, '.gitignore')).includes('# sdd-kit disabled: .agents/'));
    sddKit(root, ['uninstall', '--yes']);
    const gi = read(root, '.gitignore');
    assert.ok(lines(gi).includes('.agents/'), gi);
    assert.doesNotMatch(gi, /# sdd-kit disabled:/);
  });

  test('the installer output names .agents/skills/ among the files to commit', () => {
    const root = gitProject();
    const r = sddKit(root, ['install', '--yes']);
    const hint = r.stdout.split('\n').find((l) => /\bcommit\b/.test(l));
    assert.ok(hint, r.stdout);
    assert.match(hint, /\.agents\/skills\//);
  });
});
