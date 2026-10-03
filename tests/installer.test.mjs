// Installer tests: install into a pilot-shaped project, re-run, update with a newer kit, local edits,
// conflicts, dry run, uninstall. One suite runs the real pinned OpenSpec CLI.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { install, status, uninstall } from '../installer/sdd-kit.mjs';
import { patchGitignore, unpatchGitignore } from '../installer/lib/gitignore.mjs';
import { upsertKitBlock, removeKitBlock, kitBlock } from '../installer/lib/config-edit.mjs';
import { parseYaml } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT = join(REPO, 'fixtures', 'projects', 'pilot-like');
const FRAGMENT = join(REPO, 'kit', 'core', 'config-fragment.yaml');

/** Pilot-shaped project under git, with the files a real checkout has but the fixture cannot carry. */
function pilot() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-install-'));
  cpSync(PILOT, root, { recursive: true });
  renameSync(join(root, 'gitignore.txt'), join(root, '.gitignore'));
  mkdirSync(join(root, '.claude', 'tdd-guard', 'data'), { recursive: true });
  writeFileSync(join(root, '.claude', 'tdd-guard', 'data', 'test.json'), '{}');
  writeFileSync(join(root, '.claude', 'settings.local.json'), '{"enabledPlugins":{"tdd-guard@tdd-guard":true}}\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const opts = (root, extra = {}) => ({ target: root, skipOpenspec: true, yes: true, json: true, ...extra });
const ignored = (root, f) => spawnSync('git', ['check-ignore', '-q', f], { cwd: root }).status === 0;
/** Snapshot of every file under a dir (relative path → content). */
function snapshot(root) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[p.slice(root.length + 1)] = readFileSync(p, 'utf8');
    }
  };
  walk(root);
  return out;
}

describe('install into a pilot-shaped project', () => {
  test('copies the kit, edits config/settings/.gitignore and self-checks clean', async () => {
    const root = pilot();
    const before = { config: read(root, 'openspec/config.yaml'), settings: JSON.parse(read(root, '.claude/settings.json')) };
    const r = await install(opts(root, { questionsLanguage: 'Russian' }));
    assert.ok(r.files.length > 30 && r.files.every((f) => f.op === 'create'));
    assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
    assert.ok(existsSync(join(root, 'openspec/protocols/questions.md')));
    assert.ok(existsSync(join(root, 'openspec/tooling/kit-manifest.json')));

    // config: the pilot's context and comments are kept, the kit block is appended inside context
    const cfg = read(root, 'openspec/config.yaml');
    const { value } = parseYaml(cfg);
    assert.equal(value.schema, 'clarify');
    assert.ok(value.context.startsWith(parseYaml(before.config).value.context.trimEnd()));
    assert.match(value.context, /# >>> sdd-kit >>>[\s\S]*Questions language: Russian[\s\S]*# <<< sdd-kit <<</);
    assert.ok(cfg.includes('# Per-operation guidance (optional)'), 'commented examples survive');

    // settings: pilot hooks first and untouched, kit hooks added
    const s = JSON.parse(read(root, '.claude/settings.json'));
    assert.deepEqual(s.hooks.PreToolUse.slice(0, 2), before.settings.hooks.PreToolUse);
    assert.match(JSON.stringify(s.hooks), /answers-gate\.mjs/);
    assert.equal(read(root, '.claude/settings.local.json'), '{"enabledPlugins":{"tdd-guard@tdd-guard":true}}\n');

    // .gitignore (D6), checked with git itself
    for (const f of ['openspec/config.yaml', 'openspec/protocols/questions.md', 'openspec/changes/legacy-change/proposal.md', '.claude/settings.json', '.claude/skills/openspec-apply-change/SKILL.md', '.claude/commands/opsx/propose.md']) {
      assert.equal(ignored(root, f), false, `${f} must be versioned`);
    }
    for (const f of ['.claude/settings.local.json', '.claude/tdd-guard/data/test.json', '.claude/skills/django-tdd/SKILL.md', '.claude/worktrees/x', 'graphify-out/graph.json', '.venv/x']) {
      assert.equal(ignored(root, f), true, `${f} must stay ignored`);
    }

    // the in-flight change keeps its schema (D11)
    assert.match(read(root, 'openspec/changes/legacy-change/.openspec.yaml'), /schema: spec-driven/);
  });

  test('re-running changes nothing, byte for byte', async () => {
    const root = pilot();
    await install(opts(root, { questionsLanguage: 'Russian' }));
    const snap = snapshot(root);
    const r = await install(opts(root));
    assert.ok(r.files.every((f) => f.op === 'unchanged'));
    assert.deepEqual(r.actions.map((a) => a.op), ['unchanged', 'unchanged', 'unchanged']);
    assert.equal(r.questionsLanguage, 'Russian', 'the language is kept without the flag');
    assert.deepEqual(snapshot(root), snap);
  });

  test('dry run writes nothing', async () => {
    const root = pilot();
    const snap = snapshot(root);
    const r = await install(opts(root, { dryRun: true }));
    assert.ok(r.plan.files.length > 30);
    assert.equal(r.plan.config, 'update');
    assert.deepEqual(snapshot(root), snap);
  });

  test('--keep-default-schema leaves spec-driven as the default', async () => {
    const root = pilot();
    await install(opts(root, { keepDefaultSchema: true }));
    assert.equal(parseYaml(read(root, 'openspec/config.yaml')).value.schema, 'spec-driven');
  });

  test('refuses to touch anything when .claude/settings.json is invalid', async () => {
    const root = pilot();
    writeFileSync(join(root, '.claude/settings.json'), '{ broken');
    const snap = snapshot(root);
    await assert.rejects(install(opts(root)), /settings\.json is not valid JSON/);
    assert.deepEqual(snapshot(root), snap);
  });

  test('refuses a folded context it cannot edit safely', async () => {
    const root = pilot();
    writeFileSync(join(root, 'openspec/config.yaml'), 'schema: spec-driven\ncontext: >\n  folded text\n');
    await assert.rejects(install(opts(root)), /must be a literal block scalar/);
  });

  test('works in a project with no openspec/ and no .claude/ at all', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-empty-'));
    const r = await install(opts(root));
    assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
    assert.equal(parseYaml(read(root, 'openspec/config.yaml')).value.schema, 'clarify');
    assert.ok(JSON.parse(read(root, '.claude/settings.json')).hooks.SessionStart);
  });
});

describe('updating to a newer kit', () => {
  /** A copy of the kit with one protocol changed (= a new kit release). */
  function newerKit() {
    const kit = mkdtempSync(join(tmpdir(), 'sdd-kit-src-'));
    cpSync(join(REPO, 'kit'), kit, { recursive: true });
    const p = join(kit, 'core/openspec/protocols/grounding.md');
    writeFileSync(p, readFileSync(p, 'utf8') + '\n<!-- new in 0.2.0 -->\n');
    const q = join(kit, 'core/openspec/protocols/testing.md');
    writeFileSync(q, readFileSync(q, 'utf8') + '\n<!-- new in 0.2.0 -->\n');
    return kit;
  }

  test('unedited kit files are updated, locally edited ones are kept and reported', async () => {
    const root = pilot();
    await install(opts(root));
    writeFileSync(join(root, 'openspec/protocols/testing.md'), read(root, 'openspec/protocols/testing.md') + '\nTeam note.\n');
    const r = await install(opts(root, { kitDir: newerKit() }));
    const op = (rel) => r.files.find((f) => f.rel === rel).op;
    assert.equal(op('openspec/protocols/grounding.md'), 'update');
    assert.equal(op('openspec/protocols/testing.md'), 'conflict-modified');
    assert.match(read(root, 'openspec/protocols/grounding.md'), /new in 0\.2\.0/);
    assert.match(read(root, 'openspec/protocols/testing.md'), /Team note\./);
    assert.doesNotMatch(read(root, 'openspec/protocols/testing.md'), /new in 0\.2\.0/);
    // the conflict stays a conflict on the next run (the manifest keeps the old kit hash)
    const again = await install(opts(root, { kitDir: newerKit() }));
    assert.equal(again.files.find((f) => f.rel === 'openspec/protocols/testing.md').op, 'conflict-modified');
  });

  test('--force replaces an edited file and keeps a backup', async () => {
    const root = pilot();
    await install(opts(root));
    writeFileSync(join(root, 'openspec/protocols/testing.md'), 'mine\n');
    const r = await install(opts(root, { force: true }));
    assert.equal(r.files.find((f) => f.rel === 'openspec/protocols/testing.md').op, 'overwrite');
    assert.equal(read(root, 'openspec/protocols/testing.md.sdd-kit-backup'), 'mine\n');
    assert.equal(read(root, 'openspec/protocols/testing.md'), read(REPO, 'kit/core/openspec/protocols/testing.md'));
  });

  test('a pre-existing project file at a kit path is never overwritten', async () => {
    const root = pilot();
    mkdirSync(join(root, 'openspec/protocols'), { recursive: true });
    writeFileSync(join(root, 'openspec/protocols/questions.md'), 'our own questions guide\n');
    const r = await install(opts(root));
    assert.equal(r.files.find((f) => f.rel === 'openspec/protocols/questions.md').op, 'conflict-foreign');
    assert.equal(read(root, 'openspec/protocols/questions.md'), 'our own questions guide\n');
  });

  test('a deleted kit file is restored; a file dropped from the kit is removed when unedited', async () => {
    const root = pilot();
    await install(opts(root));
    rmSync(join(root, 'openspec/protocols/grounding.md'));
    const kit = mkdtempSync(join(tmpdir(), 'sdd-kit-src-'));
    cpSync(join(REPO, 'kit'), kit, { recursive: true });
    rmSync(join(kit, 'core/openspec/tooling/hooks/artifact-feedback.mjs'));
    const r = await install(opts(root, { kitDir: kit }));
    assert.equal(r.files.find((f) => f.rel === 'openspec/protocols/grounding.md').op, 'restore');
    assert.equal(r.files.find((f) => f.rel === 'openspec/tooling/hooks/artifact-feedback.mjs').op, 'delete');
    assert.ok(!existsSync(join(root, 'openspec/tooling/hooks/artifact-feedback.mjs')));
  });
});

describe('status and uninstall', () => {
  test('status reports edited files', async () => {
    const root = pilot();
    assert.equal(status({ target: root }).installed, false);
    await install(opts(root));
    writeFileSync(join(root, 'openspec/protocols/questions.md'), 'x');
    const s = status({ target: root });
    assert.equal(s.installed, true);
    assert.deepEqual(s.files, [{ rel: 'openspec/protocols/questions.md', state: 'modified' }]);
    assert.equal(s.hooks, true);
    assert.equal(s.defaultSchema, 'clarify');
  });

  test('uninstall restores config, settings and .gitignore and keeps edited files', async () => {
    const root = pilot();
    const original = snapshot(root);
    await install(opts(root));
    writeFileSync(join(root, 'openspec/protocols/testing.md'), 'team version\n');
    const r = uninstall({ target: root });
    assert.deepEqual(r.kept, ['openspec/protocols/testing.md']);
    const after = snapshot(root);
    delete after['openspec/protocols/testing.md'];
    assert.deepEqual(after, original);
  });

  test('uninstall refuses while changes use kit schemas, unless --force', async () => {
    const root = pilot();
    await install(opts(root));
    mkdirSync(join(root, 'openspec/changes/new-feature'));
    writeFileSync(join(root, 'openspec/changes/new-feature/.openspec.yaml'), 'schema: clarify\n');
    assert.throws(() => uninstall({ target: root }), /active changes still use kit schemas: new-feature/);
    assert.ok(uninstall({ target: root, force: true }).removed.length > 30);
  });

  test('uninstall --dry-run writes nothing', async () => {
    const root = pilot();
    await install(opts(root));
    const snap = snapshot(root);
    uninstall({ target: root, dryRun: true });
    assert.deepEqual(snapshot(root), snap);
  });
});

describe('text editing helpers', () => {
  const block = kitBlock(FRAGMENT, 'English');

  test('gitignore patch/unpatch round-trips; projects that never ignored .claude get no .claude/*', () => {
    const original = 'node_modules/\n.claude/\n/openspec\n';
    const patched = patchGitignore(original);
    assert.match(patched, /# sdd-kit disabled: \.claude\//);
    assert.match(patched, /^\.claude\/\*$/m);
    assert.equal(patchGitignore(patched), patched, 'idempotent');
    assert.equal(unpatchGitignore(patched), original);
    const plain = patchGitignore('node_modules/\n');
    assert.doesNotMatch(plain, /^\.claude\/\*$/m);
    assert.match(plain, /^\.claude\/settings\.local\.json$/m);
    assert.match(patchGitignore(null), /# >>> sdd-kit >>>/);
  });

  test('config block: insert into context, replace on re-run, remove', () => {
    const cfg = 'schema: spec-driven\n# comment\ncontext: |\n    Deep indent line.\n\n    Second paragraph.\n# trailing comment\nrules:\n  proposal:\n    - x\n';
    const once = upsertKitBlock(cfg, block);
    const v = parseYaml(once).value;
    assert.match(v.context, /^Deep indent line\.\n\nSecond paragraph\.\n# >>> sdd-kit >>>/);
    assert.deepEqual(v.rules, { proposal: ['x'] });
    assert.equal(upsertKitBlock(once, block), once);
    const ru = upsertKitBlock(once, kitBlock(FRAGMENT, 'Russian'));
    assert.match(parseYaml(ru).value.context, /Questions language: Russian/);
    assert.equal(removeKitBlock(once), cfg);
  });

  test('config block: no context yet', () => {
    const out = upsertKitBlock('schema: spec-driven\n', block);
    assert.match(parseYaml(out).value.context, /^# >>> sdd-kit >>>/);
  });
});

describe('install with the real OpenSpec CLI', { skip: cliSkipReason() }, () => {
  test('new project: init + kit profile skills; the developer’s global config is untouched', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-real-'));
    const home = mkdtempSync(join(tmpdir(), 'sdd-kit-xdg-'));
    const saved = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = home;
    try {
      const r = await install({ target: root, yes: true, json: true });
      assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
      const skills = readdirSync(join(root, '.claude/skills'));
      assert.ok(skills.includes('openspec-continue-change') && skills.includes('openspec-new-change') && skills.includes('openspec-verify-change'));
      assert.ok(!skills.includes('openspec-propose'), 'propose is not part of the kit profile');
      assert.deepEqual(readdirSync(home), [], 'nothing written to the global config dir');
      assert.deepEqual(JSON.parse(read(root, 'openspec/tooling/xdg/openspec/config.json')), JSON.parse(read(REPO, 'kit/core/openspec/tooling/xdg/openspec/config.json')));
    } finally {
      if (saved === undefined) delete process.env.XDG_CONFIG_HOME;
      else process.env.XDG_CONFIG_HOME = saved;
    }
  });

  test('pilot-shaped project: openspec update switches skills to the kit profile', async () => {
    const root = pilot();
    // real generated skills instead of the fixture stubs
    execFileSync('openspec', ['init', '--tools', 'claude', '--no-animation', '--profile', 'core'], { cwd: root, env: { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), 'x-')), OPENSPEC_TELEMETRY: '0' }, stdio: 'ignore' });
    assert.ok(existsSync(join(root, '.claude/skills/openspec-propose')));
    const r = await install({ target: root, yes: true, json: true });
    assert.equal(r.lint.ok, true, JSON.stringify(r.lint.findings));
    assert.ok(!existsSync(join(root, '.claude/skills/openspec-propose')));
    assert.ok(existsSync(join(root, '.claude/skills/openspec-continue-change')));
    assert.ok(existsSync(join(root, '.claude/skills/django-tdd/SKILL.md')), 'project skills are untouched');
  });
});
