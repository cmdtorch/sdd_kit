// UI screenshots in the hooks: answers-gate and archive-gate run check-ui (openspec/changes/add-ui-sources,
// design D4). Every test copies a fixture project into a temp directory, adds generated screenshots, their
// registration, a complete UI inventory, a "## Screens" table and a UI task there, and runs the hooks as
// processes with Claude Code-shaped stdin.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;
const LEAN = 'add-orders-list';
const L = `openspec/changes/${LEAN}`;

// A few bytes per image: a real PNG signature plus content that differs per file.
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const image = (name, seed = '') => Buffer.concat([PNG, Buffer.from(`${name}${seed}`)]);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const SHOTS = [
  ['U1', '01-orders-list.png'],
  ['U2', '02-orders-list-empty.png'],
  ['U3', '06-export-modal.png'],
];
const HEADER = '| Element | Type | Variants | Decision | Source | Scenarios |\n|---|---|---|---|---|---|';
const ROWS = {
  'open-export': '| open-export | button | filled, empty | in scope | [Q1] | inventory/sales-export :: Successful export |',
  'bulk-delete': '| bulk-delete | button | filled | out of scope | [Q3] | — |',
  'empty-state': '| empty-state | state | empty | in scope | [Q4] | inventory/sales-export :: Empty period |',
  'logout-button': '| logout-button | button | filled, empty | existing | — | — |',
  'export-button': '| export-button | button | — | in scope | [desc] | inventory/sales-export :: Successful export |',
  'share-button': '| share-button | button | — | mock | [Q3] | inventory/sales-export :: Teacher cannot export |',
};
const SCREENS = {
  'orders-list': { shots: 'U1 (filled), U2 (empty)', elements: ['open-export', 'bulk-delete', 'empty-state', 'logout-button'] },
  'export-modal': { shots: 'U3', elements: ['export-button', 'share-button'] },
};
const UI_TASK = '- [x] 1.4 Build the `export-modal` dialog from [its screenshot](sources/ui/06-export-modal.png)';

function inventoryText(shotRows, rows = ROWS, screens = SCREENS) {
  const out = ['# UI Inventory', '', '## Screenshots', '', '| Tag | File | Fingerprint |', '|---|---|---|'];
  for (const [tag, file, fp] of shotRows) out.push(`| ${tag} | ${file} | ${fp} |`);
  for (const [name, screen] of Object.entries(screens)) {
    out.push('', `## Screen: ${name}`, '', `Screenshots: ${screen.shots}`, '', HEADER);
    for (const e of screen.elements) out.push(rows[e]);
  }
  return out.join('\n') + '\n';
}
function writeShots(dir, shots) {
  mkdirSync(join(dir, 'sources', 'ui'), { recursive: true });
  const fps = {};
  for (const [, file] of shots) {
    const buf = image(file);
    writeFileSync(join(dir, 'sources', 'ui', file), buf);
    fps[file] = sha256(buf);
  }
  return fps;
}

/** The checks-good fixture (a complete `clarify` change ready to archive) plus the kit's openspec/. */
function baseProject(fixture = 'checks-good') {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-ui-hooks-'));
  cpSync(join(REPO, 'fixtures', 'projects', fixture), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  return root;
}
function plant(root, file, from, to) {
  const p = join(root, file);
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(from), `${file} does not contain: ${from}`);
  writeFileSync(p, s.replace(from, to));
}
const register = (root, shots) => plant(root, `${C}/clarifications.md`, "- [D1] Client request — `sources/D1.md`\n", `- [D1] Client request — \`sources/D1.md\`\n${shots.map(([t, f]) => `- [${t}] Screenshot — \`sources/ui/${f}\``).join('\n')}\n`);

/**
 * The checks-good change in UI mode, complete and ready to archive: registered screenshots, a complete
 * inventory with matching fingerprints, a "## Screens" table in design.md and a UI task linking its screenshot.
 */
function uiProject({ inventory = true } = {}) {
  const root = baseProject();
  const dir = join(root, C);
  const fps = writeShots(dir, SHOTS);
  register(root, SHOTS);
  if (inventory) writeFileSync(join(dir, 'ui-inventory.md'), inventoryText(SHOTS.map(([t, f]) => [t, f, fps[f]])));
  writeFileSync(join(dir, 'design.md'), `${readFileSync(join(dir, 'design.md'), 'utf8')}\n## Screens\n\n| Screen | Pages and components |\n|---|---|\n| orders-list | SalesListPage [U1] |\n| export-modal | ExportDialog [U3] |\n`);
  plant(root, `${C}/tasks.md`, '- [x] 1.3 Write the integration test', `${UI_TASK}\n- [x] 1.3 Write the integration test`);
  return root;
}

/** A `lean` change in the same project: one screenshot registered in its inventory, a proposal naming every element. */
function leanProject({ inventory = true, rows = null } = {}) {
  const root = baseProject();
  const dir = join(root, L);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.openspec.yaml'), 'schema: lean\ncreated: 2026-10-26\n');
  const fps = writeShots(dir, [['U1', '01-orders-list.png']]);
  const leanRows = rows || {
    'export-button': '| export-button | button | — | in scope | — | orders/orders-list :: Export starts |',
    'bulk-delete': '| bulk-delete | button | — | out of scope | — | — |',
  };
  if (inventory) writeFileSync(join(dir, 'ui-inventory.md'), inventoryText([['U1', '01-orders-list.png', fps['01-orders-list.png']]], leanRows, { 'orders-list': { shots: 'U1', elements: Object.keys(leanRows) } }));
  writeFileSync(join(dir, 'proposal.md'), '## Why\n\nExport the orders list.\n\n## What Changes\n\n- export-button: in scope\n- bulk-delete: out of scope\n');
  mkdirSync(join(dir, 'specs', 'orders', 'orders-list'), { recursive: true });
  writeFileSync(join(dir, 'specs', 'orders', 'orders-list', 'spec.md'), '## ADDED Requirements\n\n### Requirement: Orders can be exported\nThe list SHALL export orders.\n\n#### Scenario: Export starts\n- **WHEN** the user clicks export\n- **THEN** the file downloads\n');
  return root;
}

/** Runs a kit hook like Claude Code does: JSON on stdin, CLAUDE_PROJECT_DIR set, cwd = project. */
function hook(name, root, input) {
  const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'hooks', name)], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', hook_event_name: 'PreToolUse', ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const write = (root, file, content = 'x\n') => hook('answers-gate.mjs', root, { tool_name: 'Write', tool_input: { file_path: join(root, file), content } });
const archive = (root, change = CHANGE) => hook('archive-gate.mjs', root, { tool_name: 'Bash', tool_input: { command: `openspec archive ${change} --yes` } });
function allowed(r, what) {
  assert.equal(r.code, 0, `${what} must not be blocked: ${r.stderr}`);
}
function blocked(r, ...patterns) {
  assert.equal(r.code, 2, `expected a block, got exit ${r.code}: ${r.stderr}`);
  for (const p of patterns) assert.match(r.stderr, p);
}
const NO_UI_RULE = /check-ui|ui-inventory|sources\/ui|screenshot/i;
const addShot = (root, file, change = C) => writeFileSync(join(root, change, 'sources', 'ui', file), image(file));
const MAIN_QUESTIONS = '## Main round\n\n### Q1. Is bulk delete part of this change?\nWhy this is asked: the list screenshot shows it.\n- A. Yes\n- B. No\n\n[Answer]:\n';

describe('the complete UI change passes every gate', () => {
  test('every planning artifact and the archive are allowed', () => {
    const root = uiProject();
    for (const f of ['proposal.md', 'specs/inventory/sales-export/spec.md', 'design.md', 'verification-plan.md', 'tasks.md', 'clarifications.md', 'ui-inventory.md']) allowed(write(root, `${C}/${f}`), f);
    allowed(archive(root), 'the archive');
  });

  test('lean: a complete UI change gets no question-round gate', () => {
    const root = leanProject();
    assert.equal(existsSync(join(root, L, 'clarifications.md')), false);
    for (const f of ['proposal.md', 'specs/orders/orders-list/spec.md', 'verification-plan.md', 'tasks.md']) allowed(write(root, `${L}/${f}`), f);
  });
});

describe('ui-sources/screenshots (hooks)', () => {
  // @scenario ui-sources/screenshots :: Change without screenshots needs no inventory
  test('a clarify change without sources/ui/ writes the proposal with no UI rule', () => {
    const root = baseProject();
    assert.equal(existsSync(join(root, C, 'sources', 'ui')), false);
    const r = write(root, `${C}/proposal.md`, '## Why\n');
    allowed(r, 'proposal.md');
    assert.doesNotMatch(r.stderr, NO_UI_RULE);
  });

  // @scenario ui-sources/screenshots :: Notes file alone does not switch the mode on
  test('sources/ui/ with only screens.md does not need an inventory', () => {
    const root = baseProject();
    mkdirSync(join(root, C, 'sources', 'ui'), { recursive: true });
    writeFileSync(join(root, C, 'sources', 'ui', 'screens.md'), '# Screens\n\nThe list and the export dialog.\n');
    const r = write(root, `${C}/proposal.md`, '## Why\n');
    allowed(r, 'proposal.md');
    assert.doesNotMatch(r.stderr, NO_UI_RULE);
  });

  // @scenario ui-sources/screenshots :: Deleting every screenshot switches the mode off
  test('an inventory listing two deleted screenshots is ignored', () => {
    const root = uiProject();
    const dir = join(root, C);
    writeFileSync(join(dir, 'ui-inventory.md'), inventoryText(SHOTS.slice(0, 2).map(([t, f]) => [t, f, 'a'.repeat(64)]), ROWS, { 'orders-list': SCREENS['orders-list'] }));
    for (const [, f] of SHOTS) rmSync(join(dir, 'sources', 'ui', f));
    for (const f of ['proposal.md', 'design.md', 'tasks.md']) {
      const r = write(root, `${C}/${f}`);
      allowed(r, f);
      assert.doesNotMatch(r.stderr, NO_UI_RULE);
    }
  });

  // @scenario ui-sources/screenshots :: One screenshot switches the mode on
  test('one screenshot and no inventory block the proposal', () => {
    const root = baseProject();
    writeShots(join(root, C), [['U1', '01-orders-list.png']]);
    register(root, [['U1', '01-orders-list.png']]);
    blocked(write(root, `${C}/proposal.md`, '## Why\n'), /the UI inventory is missing/);
  });

  // @scenario ui-sources/screenshots :: Out of scope without an answer blocks the proposal
  test('an out-of-scope element with no question cited blocks the proposal', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, '| bulk-delete | button | filled | out of scope | [Q3] |', '| bulk-delete | button | filled | out of scope | — |');
    blocked(write(root, `${C}/proposal.md`, '## Why\n'), /proposal of change "add-sales-export" cannot be written yet/, /element "bulk-delete".*needs an answered question/);
  });

  // @scenario ui-sources/screenshots :: Inventory and questions are written while elements have no decision
  test('the inventory and then the Main round questions are written while no element has a decision', () => {
    const root = uiProject({ inventory: false });
    const dir = join(root, C);
    const undecided = Object.fromEntries(Object.entries(ROWS).map(([k, v]) => [k, v.replace(/\| (in scope|out of scope|existing|mock) \| [^|]+ \|/, '|  | — |')]));
    const fps = Object.fromEntries(SHOTS.map(([, f]) => [f, sha256(readFileSync(join(dir, 'sources', 'ui', f)))]));
    const text = inventoryText(SHOTS.map(([t, f]) => [t, f, fps[f]]), undecided);
    allowed(write(root, `${C}/ui-inventory.md`, text), 'ui-inventory.md');
    writeFileSync(join(dir, 'ui-inventory.md'), text);
    const clar = readFileSync(join(dir, 'clarifications.md'), 'utf8');
    allowed(write(root, `${C}/clarifications.md`, clar.replace('## Specs round', '### Q6. What does open-export do?\nWhy this is asked: no source names it.\n- A. Opens the export dialog\n- B. Nothing yet\n\n[Answer]:\n\n## Specs round')), 'the Main round questions');
  });

  // @scenario ui-sources/screenshots :: Questions about a late screenshot are not blocked
  test('Specs round questions about a screenshot missing from the inventory are allowed', () => {
    const root = uiProject();
    addShot(root, '04-export-modal.png');
    const r = hook('answers-gate.mjs', root, {
      tool_name: 'Edit',
      tool_input: { file_path: join(root, C, 'clarifications.md'), old_string: '### Summary confirmation — Specs round', new_string: '### Q6. What does the new export dialog close button do?\nWhy this is asked: 04-export-modal.png is new.\n- A. Closes it\n- B. Not yet defined\n\n[Answer]:\n\n### Summary confirmation — Specs round' },
    });
    allowed(r, 'the Specs round questions');
  });

  // @scenario ui-sources/screenshots :: SVG file blocks the next artifact
  test('an SVG beside the screenshots blocks the design', () => {
    const root = uiProject();
    writeFileSync(join(root, C, 'sources', 'ui', '03-export-modal.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    blocked(write(root, `${C}/design.md`), /`03-export-modal\.svg` is not an accepted screenshot/, /export it as PNG/);
  });

  // @scenario ui-sources/screenshots :: SVG-only folder blocks the next artifact
  test('a folder with only an SVG blocks the proposal', () => {
    const root = baseProject();
    mkdirSync(join(root, C, 'sources', 'ui'), { recursive: true });
    writeFileSync(join(root, C, 'sources', 'ui', '03-export-modal.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
    blocked(write(root, `${C}/proposal.md`, '## Why\n'), /`03-export-modal\.svg`/, /export it as PNG/);
  });

  // @scenario ui-sources/screenshots :: Screenshots are archived with the change
  test('a real openspec archive moves the screenshots with the change and not into the specs', { skip: cliSkipReason() }, () => {
    const root = uiProject({});
    allowed(archive(root), 'the archive');
    execFileSync(process.env.OPENSPEC_BIN || 'openspec', ['archive', CHANGE, '--yes'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, XDG_CONFIG_HOME: join(root, '.xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    });
    assert.equal(existsSync(join(root, C)), false, 'the change left the active changes');
    const archived = readdirSync(join(root, 'openspec', 'changes', 'archive')).filter((n) => n.endsWith(`-${CHANGE}`));
    assert.equal(archived.length, 1);
    const uiDir = join(root, 'openspec', 'changes', 'archive', archived[0], 'sources', 'ui');
    for (const [, f] of SHOTS) assert.deepEqual(readFileSync(join(uiDir, f)), image(f), f);
    const files = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name)));
    };
    walk(join(root, 'openspec', 'specs'));
    assert.ok(files.some((p) => p.endsWith('sales-export/spec.md')), 'the delta specs were merged');
    for (const p of files) assert.doesNotMatch(p, /\.(png|jpe?g|webp)$/i, `${p} is a screenshot under openspec/specs/`);
  });

  // @scenario ui-sources/screenshots :: Screenshot added after the Main round blocks the specs
  test('a new screenshot missing from the inventory blocks a spec file', () => {
    const root = uiProject();
    addShot(root, '04-export-modal.png');
    blocked(write(root, `${C}/specs/inventory/sales-export/spec.md`), /specs of change "add-sales-export" cannot be written yet/, /`04-export-modal\.png` is missing from the inventory/);
  });

  // @scenario ui-sources/screenshots :: Screenshot added during implementation blocks the archive
  test('a screenshot added during implementation blocks the archive', () => {
    const root = uiProject();
    addShot(root, '05-export-done.png');
    blocked(archive(root), /change "add-sales-export" cannot be archived yet/, /check-ui: .*`05-export-done\.png` is missing from the inventory/);
  });

  // @scenario ui-sources/screenshots :: Deleted screenshot blocks the next artifact
  test('a deleted screenshot still in the inventory blocks the design', () => {
    const root = uiProject();
    rmSync(join(root, C, 'sources', 'ui', '02-orders-list-empty.png'));
    blocked(write(root, `${C}/design.md`), /`02-orders-list-empty\.png` is listed in the inventory but missing/);
  });

  // @scenario ui-sources/screenshots :: Screenshot deleted during implementation blocks the archive
  test('a screenshot deleted during implementation blocks the archive', () => {
    const root = uiProject();
    rmSync(join(root, C, 'sources', 'ui', '02-orders-list-empty.png'));
    blocked(archive(root), /check-ui: .*`02-orders-list-empty\.png` is listed in the inventory but missing/);
  });
});

describe('ui-sources/inventory (hooks)', () => {
  // @scenario ui-sources/inventory :: Main round questions are blocked without an inventory
  test('Main round questions in clarifications.md wait for the inventory', () => {
    const root = uiProject({ inventory: false });
    const p = join(root, C, 'clarifications.md');
    const sources = readFileSync(p, 'utf8').split('## Main round')[0];
    writeFileSync(p, sources);
    blocked(write(root, `${C}/clarifications.md`, `${sources}${MAIN_QUESTIONS}`), /write the UI inventory first/i, /ui-inventory\.md/);
  });

  test('other clarifications.md writes are never blocked by a UI rule', () => {
    const root = uiProject({ inventory: false });
    const p = join(root, C, 'clarifications.md');
    allowed(hook('answers-gate.mjs', root, { tool_name: 'Edit', tool_input: { file_path: p, old_string: '[Answer]: B', new_string: '[Answer]: A' } }), 'an answer');
    allowed(write(root, `${C}/clarifications.md`, readFileSync(p, 'utf8').replace('## Sources', '## Sources\n')), 'a rewrite with the same questions');
    addShot(root, '04-export-modal.png');
    writeFileSync(join(root, C, 'sources', 'ui', 'bad.svg'), '<svg/>');
    allowed(write(root, `${C}/ui-inventory.md`, '# UI Inventory\n'), 'ui-inventory.md');
  });

  // @scenario ui-sources/inventory :: Lean proposal is blocked without an inventory
  test('lean: a screenshot and no inventory block the proposal', () => {
    const root = leanProject({ inventory: false });
    blocked(write(root, `${L}/proposal.md`, '## Why\n'), /proposal of change "add-orders-list" cannot be written yet/, /the UI inventory is missing/);
  });

  // @scenario ui-sources/inventory :: Proposal is blocked without an inventory
  test('registered screenshots and a confirmed Main round without an inventory block the proposal', () => {
    const root = uiProject({ inventory: false });
    blocked(write(root, `${C}/proposal.md`, '## Why\n'), /the UI inventory is missing/);
  });

  // @scenario ui-sources/inventory :: Element without a decision blocks the proposal
  test('an element without a decision blocks the proposal', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, '| bulk-delete | button | filled | out of scope | [Q3] |', '| bulk-delete | button | filled |  | [Q3] |');
    blocked(write(root, `${C}/proposal.md`, '## Why\n'), /element "bulk-delete".*has no decision/);
  });

  // @scenario ui-sources/inventory :: Not yet defined blocks the proposal
  test('"not yet defined" blocks the proposal and lists the allowed decisions', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, '| export-button | button | — | in scope |', '| export-button | button | — | not yet defined |');
    blocked(write(root, `${C}/proposal.md`, '## Why\n'), /element "export-button".*unknown decision "not yet defined"/, /in scope, mock, out of scope, decoration, existing/);
  });

  // @scenario ui-sources/inventory :: Late element without a decision blocks the design
  test('an element added after the specs without a decision blocks the design', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, ROWS['share-button'], `${ROWS['share-button']}\n| retry-button | button | — |  | — | — |`);
    blocked(write(root, `${C}/design.md`), /design of change "add-sales-export" cannot be written yet/, /element "retry-button".*has no decision/);
  });

  // @scenario ui-sources/inventory :: Element without a decision blocks the archive
  test('an element without a decision blocks the archive', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, ROWS['share-button'], `${ROWS['share-button']}\n| retry-button | button | — |  | — | — |`);
    blocked(archive(root), /check-ui: .*element "retry-button".*has no decision/);
  });

  // @scenario ui-sources/inventory :: Lean proposal missing a decision blocks the specs
  test('lean: a proposal that does not name every element blocks a spec file', () => {
    const root = leanProject();
    plant(root, `${L}/proposal.md`, '- bulk-delete: out of scope\n', '');
    blocked(write(root, `${L}/specs/orders/orders-list/spec.md`), /element "bulk-delete".*is missing from the proposal/);
  });

  test('lean: rewriting the proposal itself is not blocked by its old content', () => {
    const root = leanProject();
    plant(root, `${L}/proposal.md`, '- bulk-delete: out of scope\n', '');
    allowed(write(root, `${L}/proposal.md`, '## Why\n\n- export-button: in scope\n- bulk-delete: out of scope\n'), 'the fixed proposal');
  });
});

describe('ui-sources/coverage (hooks)', () => {
  // @scenario ui-sources/coverage :: In-scope element without a scenario blocks the design
  test('an in-scope element without a scenario blocks the design', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, ROWS['export-button'], '| export-button | button | — | in scope | [desc] | — |');
    allowed(write(root, `${C}/specs/inventory/sales-export/spec.md`), 'a spec file (scenarios are checked from the design on)');
    blocked(write(root, `${C}/design.md`), /element "export-button".*names no scenario/);
  });

  // @scenario ui-sources/coverage :: Lean element without a scenario blocks the verification plan
  test('lean: an in-scope element without a scenario blocks the verification plan', () => {
    const root = leanProject({
      rows: {
        'export-button': '| export-button | button | — | in scope | — | — |',
        'bulk-delete': '| bulk-delete | button | — | out of scope | — | — |',
      },
    });
    allowed(write(root, `${L}/specs/orders/orders-list/spec.md`), 'a spec file');
    blocked(write(root, `${L}/verification-plan.md`), /verification-plan of change "add-orders-list" cannot be written yet/, /element "export-button".*names no scenario/);
  });

  // @scenario ui-sources/coverage :: Mock element without a scenario blocks the design
  test('a mock element without a scenario blocks the design', () => {
    const root = uiProject();
    plant(root, `${C}/ui-inventory.md`, ROWS['share-button'], '| share-button | button | — | mock | [Q3] | — |');
    blocked(write(root, `${C}/design.md`), /element "share-button".*names no scenario/);
  });
});

describe('ui-sources/implementation (hooks)', () => {
  // @scenario ui-sources/implementation :: Screen without a design row blocks the tasks
  test('a screen without a "## Screens" row blocks the tasks', () => {
    const root = uiProject();
    plant(root, `${C}/design.md`, '| export-modal | ExportDialog [U3] |\n', '');
    allowed(write(root, `${C}/design.md`), 'design.md (the table is checked from the verification plan on)');
    blocked(write(root, `${C}/tasks.md`), /tasks of change "add-sales-export" cannot be written yet/, /screen "export-modal"/);
  });

  // @scenario ui-sources/implementation :: Screen without a design row blocks the archive
  test('a screen without a "## Screens" row blocks the archive', () => {
    const root = uiProject();
    plant(root, `${C}/design.md`, '| export-modal | ExportDialog [U3] |\n', '');
    blocked(archive(root), /check-ui: .*screen "export-modal"/);
  });

  // @scenario ui-sources/implementation :: UI task without a screenshot blocks the archive
  test('a UI task that links no screenshot blocks the archive', () => {
    const root = uiProject();
    plant(root, `${C}/tasks.md`, UI_TASK, '- [x] 1.4 Build the `export-modal` dialog');
    allowed(write(root, `${C}/tasks.md`), 'tasks.md (task links are checked at the archive)');
    blocked(archive(root), /check-ui: .*task "1\.4 Build the `export-modal` dialog" names the screen "export-modal" but links no screenshot/);
  });
});

describe('artifact-feedback shows check-ui errors after a write (design D4)', () => {
  const post = (root, file) => hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, file), content: '' } });
  const context = (r) => {
    assert.equal(r.code, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '';
  };

  test('silent about the UI for a complete UI change and for a change without screenshots', () => {
    for (const root of [uiProject(), baseProject()]) {
      assert.equal(context(post(root, `${C}/ui-inventory.md`)), '');
      assert.doesNotMatch(context(post(root, `${C}/tasks.md`)), /check-ui/);
    }
  });

  // @scenario ui-sources/screenshots :: Inventory errors are shown after the inventory is written
  test('an inventory missing a registered screenshot is written, then its error is shown', () => {
    const root = uiProject();
    const dir = join(root, C);
    const fps = Object.fromEntries(SHOTS.map(([, f]) => [f, sha256(image(f))]));
    const without = SHOTS.filter(([, f]) => f !== '02-orders-list-empty.png');
    const text = inventoryText(without.map(([t, f]) => [t, f, fps[f]]));
    allowed(write(root, `${C}/ui-inventory.md`, text), 'ui-inventory.md');
    writeFileSync(join(dir, 'ui-inventory.md'), text);
    const ctx = context(post(root, `${C}/ui-inventory.md`));
    assert.match(ctx, /check-ui found \d+ problem\(s\) after writing ui-inventory\.md \(change "add-sales-export"\)/);
    assert.match(ctx, /screenshot `02-orders-list-empty\.png` is missing from the inventory/);
  });

  // @scenario ui-sources/implementation :: Missing screenshot link is shown after the tasks are written
  test('a UI task without a screenshot link is written, then shown with its screen', () => {
    const root = uiProject();
    const tasks = readFileSync(join(root, C, 'tasks.md'), 'utf8').replace(UI_TASK, '- [ ] 1.4 Build the `export-modal` dialog');
    allowed(write(root, `${C}/tasks.md`, tasks), 'tasks.md');
    writeFileSync(join(root, C, 'tasks.md'), tasks);
    const ctx = context(post(root, `${C}/tasks.md`));
    assert.match(ctx, /check-ui found 1 problem\(s\) after writing tasks\.md/);
    assert.match(ctx, /task "1\.4 Build the `export-modal` dialog" names the screen "export-modal" but links no screenshot/);
  });

  test('after tasks.md only the findings in tasks.md are shown', () => {
    const root = uiProject();
    plant(root, `${C}/tasks.md`, UI_TASK, '- [x] 1.4 Build the `export-modal` dialog');
    addShot(root, '07-late.png');
    const ctx = context(post(root, `${C}/tasks.md`));
    assert.match(ctx, /names the screen "export-modal" but links no screenshot/);
    assert.doesNotMatch(ctx, /07-late\.png/);
  });
});

describe('test-case schemas', () => {
  test('clarify-ai-qa: test-cases.md is checked too', () => {
    const root = baseProject('ai-qa-good');
    const c = 'openspec/changes/add-sale-export';
    allowed(write(root, `${c}/test-cases.md`), 'test-cases.md without screenshots');
    mkdirSync(join(root, c, 'sources', 'ui'), { recursive: true });
    writeFileSync(join(root, c, 'sources', 'ui', '03-export-modal.svg'), '<svg/>');
    blocked(write(root, `${c}/test-cases.md`), /test-cases of change "add-sale-export" cannot be written yet/, /`03-export-modal\.svg`/);
    blocked(archive(root, 'add-sale-export'), /check-ui: .*`03-export-modal\.svg`/);
  });
});
