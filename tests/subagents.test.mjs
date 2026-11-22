// Subagent apply (change add-subagent-execution): the version gate (changes stamped 0.5.0 or later use
// subagents) and the model setting `x-sdd-kit-subagent-model` (lib, subagent-model.mjs, doctor, lint-kit,
// kit update).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';
import { versionAtLeast, usesSubagents, SUBAGENT_MODEL_KEY, SUBAGENT_MODELS, isKnownSubagentModel, subagentModel } from '../kit/openspec/tooling/lib/project.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sales-export';

/** Copy of the checks-good fixture with the kit's openspec/; the change's stamp is `stamp` (null: none). */
function project({ stamp = null, model } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-subagents-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  if (stamp !== null) appendFileSync(join(root, 'openspec', 'changes', CHANGE, '.openspec.yaml'), `x-sdd-kit: ${stamp}\n`);
  if (model !== undefined) appendFileSync(join(root, 'openspec', 'config.yaml'), `${SUBAGENT_MODEL_KEY}: ${model}\n`);
  return root;
}
const node = (root, script, args = [], env = {}) => {
  const r = spawnSync(process.execPath, [join(root, 'openspec', 'tooling', ...script.split('/')), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr, out: r.stdout + r.stderr };
};
const model = (root, args) => node(root, 'bin/subagent-model.mjs', args);

/** A PATH with sh, git and a fake openspec of the pinned version only, so doctor runs fast and offline. */
function controlledPath() {
  const bin = mkdtempSync(join(tmpdir(), 'sdd-kit-path-'));
  const which = (c) => spawnSync('sh', ['-c', `command -v ${c}`], { encoding: 'utf8' }).stdout.trim();
  for (const c of ['sh', 'git']) symlinkSync(which(c), join(bin, c));
  const pinned = JSON.parse(readFileSync(join(REPO, 'kit', 'openspec', 'tooling', 'kit.json'), 'utf8')).openspecVersion;
  writeFileSync(join(bin, 'openspec'), `#!${which('sh')}\necho ${pinned}\n`);
  chmodSync(join(bin, 'openspec'), 0o755);
  return bin;
}
/** Doctor on a project with the kit hooks registered (so only the setting decides its warnings). */
function doctor(root) {
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'settings.json'), readFileSync(join(REPO, 'kit', 'claude-settings.fragment.json')));
  return node(root, 'bin/doctor.mjs', [], { PATH: controlledPath() });
}

// --- Version gate ---------------------------------------------------------------------------------------

describe('version gate: changes stamped 0.5.0 or later use subagents', () => {
  test('versionAtLeast compares major, minor and patch; a pre-release counts as its base version', () => {
    for (const v of ['0.5.0-beta.1', '0.5.0', '0.5.1', '0.6.0', '0.10.0', '1.0.0']) assert.equal(versionAtLeast(v, '0.5.0'), true, v);
    for (const v of ['0.4.0', '0.4.9', '0.4.10-beta.1', null, undefined, '', 'garbage']) assert.equal(versionAtLeast(v, '0.5.0'), false, String(v));
  });

  test('usesSubagents: a change stamped 0.4.0 does not use subagents; 0.5.0-beta.1, 0.5.0 and 0.6.0 do', () => {
    assert.equal(usesSubagents(project({ stamp: '0.4.0' }), CHANGE), false);
    for (const v of ['0.5.0-beta.1', '0.5.0', '0.6.0']) assert.equal(usesSubagents(project({ stamp: v }), CHANGE), true, v);
  });

  test('usesSubagents: a change without an x-sdd-kit line does not use subagents', () => {
    const root = project();
    assert.doesNotMatch(readFileSync(join(root, 'openspec', 'changes', CHANGE, '.openspec.yaml'), 'utf8'), /x-sdd-kit/);
    assert.equal(usesSubagents(root, CHANGE), false);
  });
});

// --- What the agent reads about older and unstamped changes ---------------------------------------------
// The agent picks single-agent or subagent mode from the protocol and the schema apply instruction, so the
// scenarios are proven on that text.

describe('older and unstamped changes keep the single-agent apply and verify (kit text)', () => {
  const flat = (s) => s.replace(/\s+/g, ' ');
  const PROSE = readFileSync(join(REPO, 'kit', 'openspec', 'protocols', 'subagents.md'), 'utf8').replace(/```[\s\S]*?```/g, '');
  const intro = flat(PROSE.split(/\n## 1\. /)[0]);
  const section10 = () => {
    const m = PROSE.match(/\n## 10\. [^\n]*\n([\s\S]*?)(?=\n## |$)/);
    assert.ok(m, 'section 10 not found in subagents.md');
    return flat(m[1]);
  };
  const SCHEMAS = ['clarify', 'clarify-ai-qa', 'clarify-qa', 'lean'];
  const applyInstruction = (schema) =>
    flat(parseYaml(readFileSync(join(REPO, 'kit', 'openspec', 'schemas', schema, 'schema.yaml'), 'utf8')).value.apply.instruction);
  const OLDER = /A change without the stamp, or stamped below 0\.5\.0, is implemented and verified as before: by the main agent alone, without implementation, full-suite or verify subagents/;

  // @scenario workflow/subagent-apply :: Change stamped by an older kit
  test('a change stamped below 0.5.0 is implemented by the main agent alone; a pre-release counts as its base version', () => {
    assert.match(intro, /stamped with kit version 0\.5\.0 or later \(`x-sdd-kit` in the change's `\.openspec\.yaml`; a pre-release such as `0\.5\.0-beta\.1` counts as its base version\)/);
    assert.match(intro, OLDER);
    for (const schema of SCHEMAS) assert.match(applyInstruction(schema), /On older or unstamped changes you implement and verify yourself, as before/, schema);
  });

  // @scenario workflow/subagent-apply :: Change without a stamp
  test('a change without an x-sdd-kit stamp is implemented by the main agent alone', () => {
    assert.match(intro, OLDER);
    for (const schema of SCHEMAS) {
      const a = applyInstruction(schema);
      assert.match(a, /on a change stamped 0\.5\.0 or later \(`x-sdd-kit` in its `\.openspec\.yaml`\) follow `openspec\/protocols\/subagents\.md`/, schema);
      assert.match(a, /On older or unstamped changes you implement and verify yourself, as before/, schema);
    }
  });

  // @scenario workflow/subagent-delegation :: Older change verified by the main agent
  test('verify of a change stamped below 0.5.0 or unstamped is done by the main agent, without a verify subagent', () => {
    assert.match(intro, OLDER);
    assert.match(section10(), /A change stamped below 0\.5\.0 or without a stamp is verified by you, as before/);
    for (const schema of SCHEMAS) assert.match(applyInstruction(schema), /On older or unstamped changes you implement and verify yourself, as before/, schema);
  });
});

// --- Model setting --------------------------------------------------------------------------------------

describe('model setting x-sdd-kit-subagent-model', () => {
  test('known values: the short names, inherit and full model IDs starting with claude-', () => {
    assert.deepEqual(SUBAGENT_MODELS, ['opus', 'sonnet', 'haiku', 'fable', 'inherit']);
    for (const v of [...SUBAGENT_MODELS, 'claude-sonnet-5-5', 'claude-opus-5-5']) assert.equal(isKnownSubagentModel(v), true, v);
    for (const v of ['sonet', 'gpt-5', 'claude-', 'Sonnet ', '', null]) assert.equal(isKnownSubagentModel(v), false, String(v));
    assert.deepEqual(subagentModel(project({ model: 'sonnet' })), { value: 'sonnet', model: 'sonnet', known: true });
    assert.deepEqual(subagentModel(project()), { value: null, model: 'inherit', known: true });
    assert.deepEqual(subagentModel(project({ model: 'sonet' })), { value: 'sonet', model: 'inherit', known: false });
  });

  // @scenario workflow/subagent-apply :: Model set in the project
  test('with sonnet set, subagent-model.mjs prints sonnet', () => {
    const r = model(project({ model: 'sonnet' }));
    assert.equal(r.code, 0, r.out);
    assert.equal(r.stdout, 'sonnet\n');
    assert.equal(r.stderr, '');
  });

  // @scenario workflow/subagent-apply :: No model set
  test('without the key, and with inherit, subagent-model.mjs prints inherit (the main chat model, no override)', () => {
    for (const root of [project(), project({ model: 'inherit' })]) {
      const r = model(root);
      assert.equal(r.code, 0, r.out);
      assert.equal(r.stdout, 'inherit\n');
      assert.equal(r.stderr, '');
    }
    const j = JSON.parse(model(project(), ['--json']).stdout);
    assert.deepEqual(j, { setting: null, model: 'inherit', warning: null });
  });

  // @scenario workflow/subagent-apply :: Full model ID is accepted
  test('a full model ID is passed through by subagent-model.mjs and doctor prints no subagent-model warning', () => {
    const root = project({ model: 'claude-sonnet-5-5' });
    const r = model(root);
    assert.equal(r.stdout, 'claude-sonnet-5-5\n');
    assert.equal(r.stderr, '');
    const d = doctor(root);
    assert.doesNotMatch(d.out, /! subagent model/);
    assert.match(d.out, /✓ subagent model: claude-sonnet-5-5/);
  });

  // @scenario workflow/subagent-apply :: Apply falls back to the main model
  test('an unknown value: subagent-model.mjs warns that it is unknown and prints the main-model fallback', () => {
    const r = model(project({ model: 'sonet' }));
    assert.equal(r.code, 0, r.out);
    assert.equal(r.stdout, 'inherit\n');
    assert.match(r.stderr, /warning: x-sdd-kit-subagent-model "sonet" in openspec\/config\.yaml is not a known model/);
    assert.match(r.stderr, /subagents run on the main chat's model/);
    const j = JSON.parse(model(project({ model: 'sonet' }), ['--json']).stdout);
    assert.equal(j.setting, 'sonet');
    assert.equal(j.model, 'inherit');
    assert.match(j.warning, /"sonet"/);
  });

  // @scenario workflow/subagent-apply :: Doctor warns about a typo
  test('doctor warns that sonet is an unknown model, lists the allowed values and stays "Ready."', () => {
    const d = doctor(project({ model: 'sonet' }));
    assert.match(d.out, /! subagent model: x-sdd-kit-subagent-model "sonet" in openspec\/config\.yaml is not a known model/);
    assert.match(d.out, /allowed: opus, sonnet, haiku, fable, inherit, or a full model ID starting with claude-/);
    assert.equal(d.code, 0, d.out);
    assert.match(d.out, /\nReady\.\n$/);
  });

  test('doctor says nothing about the subagent model when the key is not set', () => {
    assert.doesNotMatch(doctor(project()).out, /subagent model/);
  });

  // @scenario workflow/subagent-apply :: Kit update keeps the setting
  test('kit update keeps the line and lint-kit reports no unknown field for it', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-subagents-install-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'pilot-like'), root, { recursive: true });
    renameSync(join(root, 'gitignore.txt'), join(root, '.gitignore'));
    mkdirSync(join(root, '.claude'), { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: root });
    const installer = (cmd) => spawnSync(process.execPath, [join(REPO, 'installer', 'sdd-kit.mjs'), cmd, '--yes', '--skip-openspec', '--target', root], { cwd: root, encoding: 'utf8' });
    const first = installer('install');
    assert.equal(first.status, 0, first.stdout + first.stderr);
    appendFileSync(join(root, 'openspec', 'config.yaml'), `${SUBAGENT_MODEL_KEY}: haiku\n`);
    const before = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8');
    const upd = installer('update');
    assert.equal(upd.status, 0, upd.stdout + upd.stderr);
    const after = readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8');
    assert.match(after, /^x-sdd-kit-subagent-model: haiku$/m);
    assert.equal(after, before);
    const lint = node(root, 'checks/lint-kit.mjs');
    assert.doesNotMatch(lint.out, /x-sdd-kit-subagent-model/);
    assert.equal(lint.code, 0, lint.out);
  });
});
