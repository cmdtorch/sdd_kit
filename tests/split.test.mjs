// Phase 10: split repositories — backend registered as an OpenSpec store, frontend references it (D7, D24),
// no E2E in split repos (D23). Uses the real pinned CLI with an isolated XDG_DATA_HOME (store registry).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { install, uninstall } from '../installer/sdd-kit.mjs';
import { upsertReference, removeReference } from '../installer/lib/config-edit.mjs';
import { parseYaml } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const commitAll = (cwd, msg) => {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', msg);
};

describe('references editing', () => {
  test('adds and removes a store id in block, flow and missing forms', () => {
    const none = 'schema: clarify\n';
    const added = upsertReference(none, 'backend');
    assert.deepEqual(parseYaml(added).value.references, ['backend']);
    assert.equal(upsertReference(added, 'backend'), added, 'idempotent');
    assert.equal(removeReference(added, 'backend').trimEnd(), none.trimEnd());
    const block = 'schema: clarify\nreferences:\n  - design-system\ncontext: |\n  x\n';
    assert.deepEqual(parseYaml(upsertReference(block, 'backend')).value.references, ['design-system', 'backend']);
    assert.equal(removeReference(upsertReference(block, 'backend'), 'backend'), block);
    const flow = 'schema: clarify\nreferences: [a]\n';
    assert.deepEqual(parseYaml(upsertReference(flow, 'backend')).value.references, ['a', 'backend']);
  });
});

describe('split adapter options', () => {
  test('needs a role; refuses Playwright on a split frontend (D23); refuses switching roles', async () => {
    const root = () => mkdtempSync(join(tmpdir(), 'sdd-kit-split-opt-'));
    const base = { skipOpenspec: true, yes: true, json: true };
    await assert.rejects(install({ target: root(), ...base, adapter: 'split' }), /needs --role backend or --role frontend/);
    await assert.rejects(install({ target: root(), ...base, adapter: 'split', role: 'frontend', presets: ['playwright'] }), /only supported in a monorepo \(D23\)/);
    await assert.rejects(install({ target: root(), ...base, role: 'backend' }), /--role is only used with --adapter split/);
    const be = root();
    await install({ target: be, ...base, adapter: 'split', role: 'backend' });
    await assert.rejects(install({ target: be, ...base, role: 'frontend' }), /installed with --role backend/);
  });
});

describe('split pair end to end (real OpenSpec CLI)', { skip: cliSkipReason() }, () => {
  const saved = {};
  let dataHome;
  before(() => {
    saved.data = process.env.XDG_DATA_HOME;
    dataHome = mkdtempSync(join(tmpdir(), 'sdd-kit-data-'));
    process.env.XDG_DATA_HOME = dataHome; // the store registry of "this machine"
  });
  after(() => {
    if (saved.data === undefined) delete process.env.XDG_DATA_HOME;
    else process.env.XDG_DATA_HOME = saved.data;
  });

  const env = () => ({ ...process.env, OPENSPEC_TELEMETRY: '0' });
  const startHook = (fe) =>
    JSON.parse(spawnSync('node', [join(fe, 'openspec/tooling/hooks/session-start.mjs')], { cwd: fe, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: fe }), encoding: 'utf8', env: { ...env(), CLAUDE_PROJECT_DIR: fe } }).stdout || '{"hookSpecificOutput":{"additionalContext":""}}').hookSpecificOutput.additionalContext;

  test('backend store + frontend references + handoff list/import + stale checkout warning + uninstall', async () => {
    // backend repository with an upstream remote and a change that has a frontend handoff
    const remote = mkdtempSync(join(tmpdir(), 'sdd-kit-remote-'));
    git(remote, 'init', '-q', '--bare', '-b', 'main');
    const be = mkdtempSync(join(tmpdir(), 'sdd-kit-be-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), be, { recursive: true });
    cpSync(join(REPO, 'fixtures', 'handoff', 'frontend-handoff.md'), join(be, 'openspec/changes/add-sales-export/frontend-handoff.md'));
    git(be, 'init', '-q', '-b', 'main');
    const rb = await install({ target: be, yes: true, json: true, adapter: 'split', role: 'backend' });
    assert.ok(rb.actions.some((a) => /openspec store register .* --id backend/.test(a.step)));
    assert.equal(read(be, '.openspec-store/store.yaml'), 'version: 1\nid: backend\n');
    assert.match(read(dataHome, 'openspec/stores/registry.yaml'), /backend:[\s\S]*local_path:/);
    commitAll(be, 'base');
    git(be, 'remote', 'add', 'origin', remote);
    git(be, 'push', '-q', '-u', 'origin', 'main');
    git(be, 'fetch', '-q');

    // frontend repository references the backend store
    const fe = mkdtempSync(join(tmpdir(), 'sdd-kit-fe-'));
    git(fe, 'init', '-q', '-b', 'main');
    const rf = await install({ target: fe, yes: true, json: true, adapter: 'split', role: 'frontend', backendPath: be });
    assert.equal(rf.lint.ok, true, JSON.stringify(rf.lint.findings));
    assert.deepEqual(parseYaml(read(fe, 'openspec/config.yaml')).value.references, ['backend']);

    // OpenSpec itself shows the backend specs to the frontend agent
    const ctx = JSON.parse(execFileSync('openspec', ['context', '--json'], { cwd: fe, encoding: 'utf8', env: env() }));
    assert.ok(ctx.members.some((m) => m.role === 'referenced_store' && m.id === 'backend' && m.path === be));

    // session start: a handoff is waiting, the checkout is fresh
    let text = startHook(fe);
    assert.match(text, /backend handoffs ready for a UI change \(store "backend"\): add-sales-export/);
    assert.doesNotMatch(text, /may be stale/);

    // list → import by store id → listed as imported, no longer suggested
    const h = (...a) => execFileSync('node', [join(fe, 'openspec/tooling/bin/handoff.mjs'), ...a], { cwd: fe, encoding: 'utf8', env: env() });
    assert.match(h('list'), /READY {4}backend: add-sales-export/);
    assert.match(h('import', '--from-store', 'backend', '--change', 'add-sales-export'), /Created change "add-sales-export-ui"/);
    assert.match(h('list'), /imported backend: add-sales-export/);
    text = startHook(fe);
    assert.doesNotMatch(text, /handoffs ready/);
    assert.match(text, /add-sales-export-ui \[clarify\] — next artifact: clarifications/);

    // the upstream moves on (a teammate pushed); after a fetch the local checkout is behind → warning
    const mate = mkdtempSync(join(tmpdir(), 'sdd-kit-mate-'));
    git(mate, 'clone', '-q', remote, '.');
    writeFileSync(join(mate, 'new.txt'), 'x');
    commitAll(mate, 'teammate change');
    git(mate, 'push', '-q');
    git(be, 'fetch', '-q');
    assert.match(startHook(fe), /backend checkout "backend" .* may be stale: 1 commit\(s\) behind main's upstream/);

    // not fetched for more than a day → warning (simulate by ageing FETCH_HEAD)
    git(be, 'pull', '-q');
    const old = new Date(Date.now() - 30 * 3600 * 1000);
    const { utimesSync } = await import('node:fs');
    utimesSync(join(be, '.git', 'FETCH_HEAD'), old, old);
    assert.match(startHook(fe), /may be stale: last fetch 30 h ago/);

    // writing into the referenced backend store from the frontend is blocked by the kit hook
    const gateHook = (command) => spawnSync('node', [join(fe, 'openspec/tooling/hooks/answers-gate.mjs')], { cwd: fe, input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: fe }), encoding: 'utf8', env: { ...env(), CLAUDE_PROJECT_DIR: fe } });
    const blocked = gateHook('openspec new change hack --store backend');
    assert.equal(blocked.status, 2);
    assert.match(blocked.stderr, /referenced store — read-only/);
    assert.equal(gateHook('openspec archive add-sales-export --yes --store backend').status, 2);
    assert.equal(gateHook('openspec show inventory/student-sales --type spec --store backend').status, 0, 'reading is fine');

    // unregistered store → clear instruction
    writeFileSync(join(fe, 'openspec/config.yaml'), upsertReference(read(fe, 'openspec/config.yaml'), 'design-system'));
    assert.match(startHook(fe), /referenced store "design-system" is not registered on this machine/);
    writeFileSync(join(fe, 'openspec/config.yaml'), removeReference(read(fe, 'openspec/config.yaml'), 'design-system'));

    // uninstall removes the reference the kit added (change must go first: it uses a kit schema)
    const res = uninstall({ target: fe, force: true });
    assert.ok(res.removed.length > 30);
    assert.equal(parseYaml(read(fe, 'openspec/config.yaml')).value.references, undefined);
    assert.ok(existsSync(join(be, '.openspec-store/store.yaml')), 'the backend keeps its store identity');
  });
});
