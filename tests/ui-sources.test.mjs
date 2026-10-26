// UI screenshots as requirement sources: the inventory parser, the UI-mode detection and the stages of
// check-ui (openspec/changes/add-ui-sources, design D1–D3), plus `[U<n>]` tags in check-grounding and the
// `e2e` label in check-test-cases (D5).
// Every test builds a small change in a temp project and writes tiny generated images into `sources/ui/`.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseInventory, scanUiFolder, isUiMode } from '../kit/openspec/tooling/lib/ui-inventory.mjs';
import { checkUi, UI_STAGES, uiStageFor } from '../kit/openspec/tooling/checks/check-ui.mjs';
import { checkGrounding } from '../kit/openspec/tooling/checks/check-grounding.mjs';
import { checkTestCases } from '../kit/openspec/tooling/checks/check-test-cases.mjs';
import { checkAnswers } from '../kit/openspec/tooling/checks/check-answers.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-orders-export';
const C = `openspec/changes/${CHANGE}`;

// A few bytes per image: a real PNG / JPEG / WebP signature plus content that differs per file.
const SIGNATURES = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  webp: Buffer.from('RIFF\0\0\0\0WEBP'),
};
function image(name, seed = '') {
  const ext = name.split('.').pop().toLowerCase().replace('jpeg', 'jpg');
  return Buffer.concat([SIGNATURES[ext] || Buffer.alloc(0), Buffer.from(`${name}${seed}`)]);
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const SHOTS = [
  ['U1', '01-orders-list.png'],
  ['U2', '02-orders-list-mobile.png'],
  ['U4', '04-export-modal.png'],
];

const CLARIFICATIONS = (shots) => `# Clarifications — ${CHANGE}

Depth: Standard

## Sources

- [desc] Developer description: "Export of orders to Excel"
- [D1] Client request — \`sources/D1.md\`
${shots.map(([tag, file]) => `- [${tag}] Screenshot — \`sources/ui/${file}\``).join('\n')}

## Main round

### Q1. Is bulk delete part of this change?
Why this is asked: the list screenshot shows a bulk delete button.
- A. Yes
- B. No

[Answer]: B

### Q2. What does the share button do in this change?
Why this is asked: no source names sharing.
- A. Real sharing
- B. A mock that shows "Coming soon"

[Answer]: B

### Summary confirmation — Main round

- Bulk delete is out of scope [Q1]

Does this all look correct before I continue?

- Looks correct
- Request changes

[Answer]: Looks correct

## Specs round

### Q3. Is the promo banner link clickable?
Why this is asked: it looks like a link.
- A. Yes
- B. No, decoration only

[Answer]: B

### Q4. Does the list keep its filters after the export?
Why this is asked: not stated anywhere.
- A. Yes
- B. No

[Answer]:

### Summary confirmation — Specs round

[Answer]:
`;

const ELEMENT_HEADER = '| Element | Type | Variants | Decision | Source | Scenarios |\n|---|---|---|---|---|---|';
const ROWS = {
  'open-export': '| open-export | button | desktop, mobile | in scope | [Q1] | inventory/orders-export :: Export starts |',
  'bulk-delete': '| bulk-delete | button | desktop | out of scope | [Q1] | — |',
  'share-button': '| share-button | button | desktop, mobile | mock | [Q2] | inventory/orders-export :: Share is not available yet |',
  'logout-button': '| logout-button | button | desktop, mobile | existing | — | — |',
  'export-button': '| export-button | button | — | in scope | [desc] | inventory/orders-export :: Successful export; inventory/orders-export :: Empty period |',
  'promo-banner-link': '| promo-banner-link | link | | decoration | [Q1] | — |',
};

/** The inventory text for the given screenshot rows ([tag, file, fingerprint]) and element rows. */
function inventoryText(shotRows, rows = ROWS, screens = null) {
  const s = screens || {
    'orders-list': { shots: 'U1 (desktop), U2 (mobile)', elements: ['open-export', 'bulk-delete', 'share-button', 'logout-button'] },
    'export-modal': { shots: 'U4', elements: ['export-button', 'promo-banner-link'] },
  };
  const out = ['# UI Inventory', '', '## Screenshots', '', '| Tag | File | Fingerprint |', '|---|---|---|'];
  for (const [tag, file, fp] of shotRows) out.push(`| ${tag} | ${file} | ${fp} |`);
  for (const [name, screen] of Object.entries(s)) {
    out.push('', `## Screen: ${name}`, '', `Screenshots: ${screen.shots}`, '', ELEMENT_HEADER);
    for (const e of screen.elements) out.push(rows[e]);
  }
  return out.join('\n') + '\n';
}

/**
 * A temp project with one change: screenshots in sources/ui/, clarifications.md (clarify family) and a
 * complete inventory whose fingerprints match the files. Returns { root, dir, fingerprints }.
 */
function project({ schema = 'clarify', shots = SHOTS, inventory = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-ui-'));
  const dir = join(root, C);
  mkdirSync(join(dir, 'sources', 'ui'), { recursive: true });
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
  writeFileSync(join(dir, '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-10-26\n`);
  writeFileSync(join(dir, 'sources', 'D1.md'), 'Client request\n');
  const fingerprints = {};
  for (const [, file] of shots) {
    const buf = image(file);
    writeFileSync(join(dir, 'sources', 'ui', file), buf);
    fingerprints[file] = sha256(buf);
  }
  if (schema !== 'lean') writeFileSync(join(dir, 'clarifications.md'), CLARIFICATIONS(shots));
  if (inventory) {
    const rows = schema === 'lean' ? Object.fromEntries(Object.entries(ROWS).map(([k, v]) => [k, v.replace(/\| \[(?:Q\d+|desc)\] \|/, '| — |')])) : ROWS;
    writeFileSync(join(dir, 'ui-inventory.md'), inventoryText(shots.map(([t, f]) => [t, f, fingerprints[f]]), rows));
  }
  return { root, dir, fingerprints };
}

/** Replaces `from` with `to` in a change file; fails loudly if `from` is not there. */
function plant(dir, file, from, to) {
  const p = join(dir, file);
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(from), `${file} does not contain: ${from}`);
  writeFileSync(p, s.replace(from, to));
}

const ui = (root, extra = {}) => checkUi({ root, change: CHANGE, ...extra });
const errors = (r) => r.findings.filter((f) => f.level === 'error');
const messages = (r) => JSON.stringify(errors(r).map((f) => f.message));
function assertCaught(report, pattern) {
  assert.equal(report.ok, false, `expected a failure, got: ${JSON.stringify(report.findings)}`);
  assert.ok(errors(report).some((f) => pattern.test(f.message)), `no error matching ${pattern}: ${messages(report)}`);
}
function assertClean(report) {
  assert.equal(report.ok, true, messages(report));
  assert.deepEqual(errors(report), []);
}
const noErrorAbout = (report, name) => assert.ok(!errors(report).some((f) => f.message.includes(name)), `unexpected error about ${name}: ${messages(report)}`);

describe('good changes pass the base stage', () => {
  test('clarify change with a complete inventory', () => assertClean(ui(project().root)));
  test('lean change with a complete inventory', () => assertClean(ui(project({ schema: 'lean' }).root)));
  test('the stages are ordered for the later groups', () => {
    assert.deepEqual(UI_STAGES, ['base', 'design', 'plan', 'tasks', 'archive']);
    assert.throws(() => ui(project().root, { stage: 'nope' }), /stage/);
  });
});

describe('inventory parser (design D1)', () => {
  test('screenshots table, screens, variants and elements', () => {
    const inv = parseInventory(inventoryText(SHOTS.map(([t, f]) => [t, f, 'a'.repeat(64)])));
    assert.deepEqual(inv.problems, []);
    assert.deepEqual(inv.screenshots.map((s) => [s.tag, s.file, s.fingerprint]), SHOTS.map(([t, f]) => [t, f, 'a'.repeat(64)]));
    assert.deepEqual(inv.screens.map((s) => s.name), ['orders-list', 'export-modal']);
    const list = inv.screens[0];
    assert.deepEqual(list.shots, [{ tag: 'U1', variant: 'desktop' }, { tag: 'U2', variant: 'mobile' }]);
    const exp = list.elements.find((e) => e.name === 'open-export');
    assert.deepEqual(exp.variants, ['desktop', 'mobile']);
    assert.equal(exp.decision, 'in scope');
    assert.deepEqual(exp.sources, ['Q1']);
    assert.deepEqual(exp.scenarios, [{ capability: 'inventory/orders-export', scenario: 'Export starts' }]);
    const modal = inv.screens[1].elements.find((e) => e.name === 'export-button');
    assert.deepEqual(modal.variants, []);
    assert.equal(modal.scenarios.length, 2);
    assert.deepEqual(inv.screens[0].elements.find((e) => e.name === 'logout-button').sources, []);
  });

  test('a bad scenario reference and a missing column are format problems', () => {
    const text = inventoryText(SHOTS.map(([t, f]) => [t, f, 'a'.repeat(64)]), { ...ROWS, 'open-export': '| open-export | button | desktop, mobile | in scope | [Q1] | Export starts |' });
    assert.ok(parseInventory(text).problems.some((p) => /open-export/.test(p.message) && /Export starts/.test(p.message)));
    const noCol = text.replace(ELEMENT_HEADER, '| Element | Type | Decision | Source | Scenarios |\n|---|---|---|---|---|');
    assert.ok(parseInventory(noCol).problems.some((p) => /Variants/.test(p.message)));
  });
});

describe('UI mode and formats (design D3)', () => {
  test('the notes file alone keeps the mode off; one screenshot turns it on', () => {
    const { dir } = project({ shots: [] , inventory: false });
    writeFileSync(join(dir, 'sources', 'ui', 'screens.md'), '# Notes\n');
    let scan = scanUiFolder(dir);
    assert.equal(isUiMode(scan), false);
    assert.deepEqual(scan.invalid, []);
    writeFileSync(join(dir, 'sources', 'ui', '01-orders-list.png'), image('01-orders-list.png'));
    scan = scanUiFolder(dir);
    assert.equal(isUiMode(scan), true);
    assert.deepEqual(scan.screenshots, ['01-orders-list.png']);
  });

  test('a change without sources/ui/ is not in UI mode and the check has nothing to say', () => {
    const { root, dir } = project({ shots: [], inventory: false });
    rmSync(join(dir, 'sources', 'ui'), { recursive: true });
    assert.equal(isUiMode(scanUiFolder(dir)), false);
    assertClean(ui(root));
  });

  test('an SVG next to a screenshot, an SVG alone and a subfolder are format errors', () => {
    const { root, dir } = project();
    writeFileSync(join(dir, 'sources', 'ui', '03-export-modal.svg'), '<svg/>');
    let r = ui(root);
    assertCaught(r, /03-export-modal\.svg.*export it as PNG/);
    mkdirSync(join(dir, 'sources', 'ui', 'old'));
    r = ui(root);
    assertCaught(r, /`old`.*folder/);

    const only = project({ shots: [], inventory: false });
    writeFileSync(join(only.dir, 'sources', 'ui', '03-export-modal.svg'), '<svg/>');
    assert.equal(isUiMode(scanUiFolder(only.dir)), false);
    assertCaught(ui(only.root), /03-export-modal\.svg.*export it as PNG/);
  });

  test('a missing inventory is reported while a screenshot exists', () => {
    const { root } = project({ inventory: false });
    assertCaught(ui(root), /UI inventory is missing/);
  });

  test('with every screenshot deleted the mode is off and the inventory is ignored', () => {
    const { root, dir } = project();
    for (const [, file] of SHOTS) rmSync(join(dir, 'sources', 'ui', file));
    plant(dir, 'ui-inventory.md', ROWS['bulk-delete'], ROWS['bulk-delete'].replace('out of scope', 'not yet defined'));
    assertClean(ui(root));
  });

  // @scenario ui-sources/screenshots :: Upper-case extensions are accepted
  test('upper-case and WebP extensions are accepted', () => {
    const shots = [['U1', '01-list.JPG'], ['U2', '02-list-empty.webp']];
    const { root, dir, fingerprints } = project({ shots, inventory: false });
    const rows = { a: '| export-button | button | list, empty | in scope | [desc] | — |' };
    writeFileSync(join(dir, 'ui-inventory.md'), inventoryText(shots.map(([t, f]) => [t, f, fingerprints[f].toUpperCase()]), rows, { list: { shots: 'U1 (list), U2 (empty)', elements: ['a'] } }));
    const r = ui(root);
    assert.deepEqual(scanUiFolder(dir).invalid, []);
    assertClean(r);
  });

  // @scenario ui-sources/screenshots :: Hidden system files are ignored
  test('.DS_Store next to a screenshot is neither a format error nor a screenshot', () => {
    const { root, dir } = project();
    writeFileSync(join(dir, 'sources', 'ui', '.DS_Store'), Buffer.from([0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31]));
    const scan = scanUiFolder(dir);
    assert.deepEqual(scan.invalid, []);
    assert.ok(!scan.screenshots.includes('.DS_Store'));
    assert.ok(scan.screenshots.includes('01-orders-list.png'));
    const r = ui(root);
    assertClean(r);
    noErrorAbout(r, '.DS_Store');
  });
});

describe('registration and fingerprints', () => {
  // @scenario ui-sources/screenshots :: Unregistered screenshot is reported
  test('a screenshot missing from "## Sources" is reported by name', () => {
    const { root, dir } = project();
    plant(dir, 'clarifications.md', '- [U2] Screenshot — `sources/ui/02-orders-list-mobile.png`\n', '');
    const r = ui(root);
    assertCaught(r, /`02-orders-list-mobile\.png` is not registered/);
    assert.ok(!errors(r).some((f) => /01-orders-list\.png/.test(f.message)), messages(r));
  });

  // @scenario ui-sources/screenshots :: Lean screenshots are registered in the inventory
  test('lean: the inventory screenshots table is the register', () => {
    const { root, dir } = project({ schema: 'lean' });
    const r = ui(root);
    assertClean(r);
    assert.ok(!errors(r).some((f) => /registered/.test(f.message)));
    // and an unlisted screenshot is reported
    writeFileSync(join(dir, 'sources', 'ui', '05-export-done.png'), image('05-export-done.png'));
    assertCaught(ui(root), /`05-export-done\.png` is missing from the inventory/);
  });

  test('a new screenshot is reported as missing from the inventory', () => {
    const { root, dir } = project();
    writeFileSync(join(dir, 'sources', 'ui', '05-export-done.png'), image('05-export-done.png'));
    plant(dir, 'clarifications.md', '## Main round', '- [U5] Screenshot — `sources/ui/05-export-done.png`\n\n## Main round');
    assertCaught(ui(root), /`05-export-done\.png` is missing from the inventory/);
  });

  // @scenario ui-sources/screenshots :: Replaced screenshot is caught by its fingerprint
  test('a replaced file is reported by name, without printing a hash', () => {
    const { root, dir, fingerprints } = project();
    const replaced = image('01-orders-list.png', ' v2');
    writeFileSync(join(dir, 'sources', 'ui', '01-orders-list.png'), replaced);
    const r = ui(root);
    assertCaught(r, /`01-orders-list\.png` has changed since the inventory was written/);
    const all = JSON.stringify(r.findings);
    assert.ok(!all.includes(sha256(replaced)), 'the new fingerprint must not be printed');
    assert.ok(!all.includes(fingerprints['01-orders-list.png']), 'the old fingerprint must not be printed');
    assert.ok(!/[0-9a-f]{64}/i.test(all));
  });

  test('a deleted screenshot still listed in the inventory is reported as missing', () => {
    const { root, dir } = project();
    rmSync(join(dir, 'sources', 'ui', '02-orders-list-mobile.png'));
    assertCaught(ui(root), /`02-orders-list-mobile\.png` is listed in the inventory but missing/);
  });

  // @scenario ui-sources/screenshots :: Elements moved to another screenshot pass
  test('deleted screenshot whose elements moved to a registered replacement passes', () => {
    const { root, dir, fingerprints } = project();
    rmSync(join(dir, 'sources', 'ui', '02-orders-list-mobile.png'));
    assertCaught(ui(root), /02-orders-list-mobile\.png/);
    const v2 = image('06-orders-list-mobile-v2.png');
    writeFileSync(join(dir, 'sources', 'ui', '06-orders-list-mobile-v2.png'), v2);
    plant(dir, 'clarifications.md', '- [U2] Screenshot — `sources/ui/02-orders-list-mobile.png`', '- [U6] Screenshot — `sources/ui/06-orders-list-mobile-v2.png`');
    plant(dir, 'ui-inventory.md', `| U2 | 02-orders-list-mobile.png | ${fingerprints['02-orders-list-mobile.png']} |`, `| U6 | 06-orders-list-mobile-v2.png | ${sha256(v2)} |`);
    plant(dir, 'ui-inventory.md', 'Screenshots: U1 (desktop), U2 (mobile)', 'Screenshots: U1 (desktop), U6 (mobile)');
    const r = ui(root);
    assertClean(r);
    noErrorAbout(r, '02-orders-list-mobile.png');
  });
});

describe('screen variants', () => {
  // @scenario ui-sources/inventory :: Desktop and mobile screenshots form one screen
  test('two screenshots of one screen with elements marked in both variants pass', () => {
    const p = project();
    const r = ui(p.root);
    assertClean(r);
    noErrorAbout(r, 'orders-list');
    const inv = parseInventory(readFileSync(join(p.dir, 'ui-inventory.md'), 'utf8'));
    const list = inv.screens.find((s) => s.name === 'orders-list');
    assert.deepEqual(list.shots.map((s) => s.variant), ['desktop', 'mobile']);
    assert.deepEqual(list.elements.find((e) => e.name === 'open-export').variants, ['desktop', 'mobile']);
  });

  // @scenario ui-sources/inventory :: Element without a variant is reported
  test('an element of a two-variant screen that names no variant is reported', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['open-export'], ROWS['open-export'].replace('desktop, mobile', '—'));
    assertCaught(ui(root), /"open-export".*variant/);
  });

  test('an unknown variant and an unregistered screenshot tag on a screen are reported', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['bulk-delete'], ROWS['bulk-delete'].replace('| desktop |', '| tablet |'));
    plant(dir, 'ui-inventory.md', 'Screenshots: U4', 'Screenshots: U4, U9');
    const r = ui(root);
    assertCaught(r, /"bulk-delete".*"tablet"/);
    assertCaught(r, /U9/);
  });
});

describe('decisions and their sources', () => {
  test('an unknown decision names the element and lists the allowed ones', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['export-button'], ROWS['export-button'].replace('in scope', 'not yet defined'));
    assertCaught(ui(root), /"export-button".*"not yet defined".*in scope, mock, out of scope, decoration, existing/);
    plant(dir, 'ui-inventory.md', '| not yet defined |', '| |');
    assertCaught(ui(root), /"export-button".*has no decision.*in scope, mock, out of scope, decoration, existing/);
  });

  // @scenario ui-sources/inventory :: Out of scope without an answer is reported
  test('out of scope with no question cited', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['bulk-delete'], ROWS['bulk-delete'].replace('[Q1]', '—'));
    assertCaught(ui(root), /"bulk-delete".*answered question/);
  });

  // @scenario ui-sources/inventory :: Decoration citing an unanswered question is reported
  test('decoration citing a blank answer', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['promo-banner-link'], ROWS['promo-banner-link'].replace('[Q1]', '[Q4]'));
    assertCaught(ui(root), /"promo-banner-link".*Q4.*not answered/);
  });

  // @scenario ui-sources/inventory :: Decision citing a question that does not exist is reported
  test('out of scope citing Q99', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['bulk-delete'], ROWS['bulk-delete'].replace('[Q1]', '[Q99]'));
    assertCaught(ui(root), /"bulk-delete".*Q99.*does not exist/);
  });

  // @scenario ui-sources/inventory :: Mock citing an unconfirmed round is reported
  test('mock citing an answered question of an unconfirmed round', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['share-button'], ROWS['share-button'].replace('[Q2]', '[Q3]'));
    assertCaught(ui(root), /"share-button".*Q3.*Specs round.*not confirmed/);
  });

  // @scenario ui-sources/inventory :: In scope backed only by a screenshot is reported
  test('in scope citing only [U1]', () => {
    const { root, dir } = project();
    plant(dir, 'ui-inventory.md', ROWS['open-export'], ROWS['open-export'].replace('[Q1]', '[U1]'));
    assertCaught(ui(root), /"open-export".*screenshot alone/);
  });

  // @scenario ui-sources/inventory :: Mock backed by an answer passes
  test('mock citing a confirmed answered question', () => {
    const r = ui(project().root);
    assertClean(r);
    noErrorAbout(r, 'share-button');
  });

  // @scenario ui-sources/inventory :: Existing element needs no citation
  test('existing with no citation', () => {
    const r = ui(project().root);
    assertClean(r);
    noErrorAbout(r, 'logout-button');
  });

  // @scenario ui-sources/inventory :: Lean decisions need no citation
  test('lean: out of scope with no citation', () => {
    const { root, dir } = project({ schema: 'lean' });
    assert.ok(readFileSync(join(dir, 'ui-inventory.md'), 'utf8').includes('| bulk-delete | button | desktop | out of scope | — |'));
    const r = ui(root);
    assertClean(r);
    noErrorAbout(r, 'bulk-delete');
  });
});

describe('citations and the lean proposal', () => {
  // @scenario ui-sources/screenshots :: Citation of an element not on that screenshot is reported
  test('[U1] export-button while export-button is only on U4', () => {
    const { root, dir } = project();
    writeFileSync(join(dir, 'tasks.md'), '# Tasks\n\n- [ ] 1.1 Build the export dialog of [U4] export-button\n- [ ] 1.2 Wire [U1] export-button to the list\n');
    const r = ui(root);
    assertCaught(r, /\[U1\] export-button/);
    assert.equal(errors(r).length, 1, messages(r));
    assert.equal(errors(r)[0].line, 4);
  });

  test('an element on a variant screenshot that does not show it is reported', () => {
    const { root, dir } = project();
    writeFileSync(join(dir, 'tasks.md'), '# Tasks\n\n- [ ] 1.1 Hide [U2] bulk-delete on mobile\n');
    assertCaught(ui(root), /\[U2\] bulk-delete/);
  });

  test('lean: an unregistered tag is reported by check-ui', () => {
    const { root, dir } = project({ schema: 'lean' });
    writeFileSync(join(dir, 'tasks.md'), '# Tasks\n\n- [ ] 1.1 Build the dialog [U7]\n');
    assertCaught(ui(root), /\[U7\]/);
  });

  test('lean: the proposal names every element', () => {
    const { root, dir } = project({ schema: 'lean' });
    const names = Object.keys(ROWS);
    writeFileSync(join(dir, 'proposal.md'), `## Why\n\nExport.\n\n## UI decisions\n\n${names.map((n) => `- ${n}: decided`).join('\n')}\n`);
    assertClean(ui(root));
    plant(dir, 'proposal.md', '- bulk-delete: decided\n', '');
    assertCaught(ui(root), /"bulk-delete".*missing from the proposal/);
  });
});

describe('the mockups question (check-answers, design D8)', () => {
  const MOCKUPS = /\(UI mockups\)/;
  const forProposal = (root) => checkAnswers({ root, change: CHANGE, artifact: 'proposal' });
  const mockupsErrors = (r) => errors(r).filter((f) => MOCKUPS.test(f.message));
  /** The project() change with every screenshot and the inventory removed: a change without mockups. */
  function noMockups() {
    const p = project();
    for (const [, f] of SHOTS) rmSync(join(p.dir, 'sources', 'ui', f));
    rmSync(join(p.dir, 'ui-inventory.md'));
    return p;
  }

  test('a change with no screenshot, no inventory and no question gets the error (baseline)', () => {
    const r = forProposal(noMockups().root);
    assert.equal(mockupsErrors(r).length, 1, messages(r));
  });

  // @scenario ui-sources/screenshots :: Screenshots in the folder need no mockups question
  test('a registered screenshot replaces the question, with no inventory yet', () => {
    const { root, dir } = project({ shots: [['U1', '01-orders-list.png']], inventory: false });
    assert.equal(existsSync(join(dir, 'ui-inventory.md')), false);
    assert.deepEqual(mockupsErrors(forProposal(root)), []);
  });

  // @scenario ui-sources/screenshots :: Inventory left after deleting screenshots needs no mockups question
  test('an inventory left after every screenshot is deleted replaces the question', () => {
    const { root, dir } = project();
    for (const [, f] of SHOTS) rmSync(join(dir, 'sources', 'ui', f));
    assert.deepEqual(mockupsErrors(forProposal(root)), []);
  });

  // @scenario ui-sources/screenshots :: Change past the proposal is not checked
  test('an existing proposal.md turns the rule off', () => {
    const { root, dir } = noMockups();
    writeFileSync(join(dir, 'proposal.md'), '## Why\n\nExport orders.\n');
    assert.deepEqual(mockupsErrors(forProposal(root)), []);
  });

  test('the mark counts only in a Main round question heading', () => {
    const { root, dir } = noMockups();
    plant(dir, 'clarifications.md', '### Q3. Is the promo banner link clickable?', '### Q3. Is the promo banner link clickable? (UI mockups)');
    assert.equal(mockupsErrors(forProposal(root)).length, 1, 'a Specs round question does not count');
    plant(dir, 'clarifications.md', '### Q1. Is bulk delete part of this change?', '### Q1. Is bulk delete part of this change? (UI mockups)');
    assert.deepEqual(mockupsErrors(forProposal(root)), []);
  });

  test('lean changes are not checked', () => {
    const { root, dir } = project({ schema: 'lean' });
    for (const [, f] of SHOTS) rmSync(join(dir, 'sources', 'ui', f));
    rmSync(join(dir, 'ui-inventory.md'));
    assert.equal(forProposal(root).skipped, true);
  });
});

describe('check-grounding accepts [U<n>] (design D5)', () => {
  const GC = 'add-sales-export';
  function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-ui-grounding-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
    const dir = join(root, 'openspec', 'changes', GC);
    mkdirSync(join(dir, 'sources', 'ui'), { recursive: true });
    for (const f of ['01-orders-list.png', '02-orders-list-empty.png']) writeFileSync(join(dir, 'sources', 'ui', f), image(f));
    plant(dir, 'clarifications.md', '- [D1] Client request — `sources/D1.md`', '- [D1] Client request — `sources/D1.md`\n- [U1] Screenshot — `sources/ui/01-orders-list.png`\n- [U2] Screenshot — `sources/ui/02-orders-list-empty.png`');
    return { root, dir };
  }
  const grounding = (root) => checkGrounding({ root, change: GC });

  test('registered tags are accepted', () => {
    const { root, dir } = fixture();
    plant(dir, 'proposal.md', '[D1][desc].', '[D1][desc][U1][U2].');
    assertClean(grounding(root));
  });

  // @scenario ui-sources/screenshots :: Unknown screenshot tag is reported
  test('[U3] while only [U1] and [U2] are registered', () => {
    const { root, dir } = fixture();
    plant(dir, 'proposal.md', '[D1][desc].', '[D1][desc][U3].');
    const r = grounding(root);
    assertCaught(r, /\[U3\] is not registered/);
    assert.equal(errors(r).length, 1, messages(r));
  });

  test('a registered tag whose file is gone is reported', () => {
    const { root, dir } = fixture();
    plant(dir, 'proposal.md', '[D1][desc].', '[D1][desc][U2].');
    rmSync(join(dir, 'sources', 'ui', '02-orders-list-empty.png'));
    assertCaught(grounding(root), /\[U2\].*02-orders-list-empty\.png.*missing/);
  });
});

describe('command line', () => {
  test('check-ui runs as a CLI and fails on an error', () => {
    const { root, dir } = project();
    const bin = join(REPO, 'kit', 'openspec', 'tooling', 'checks', 'check-ui.mjs');
    const ok = execFileSync('node', [bin, '--change', CHANGE, '--root', root], { encoding: 'utf8' });
    assert.match(ok, /check-ui: OK/);
    rmSync(join(dir, 'ui-inventory.md'));
    let failed = null;
    try {
      execFileSync('node', [bin, '--change', CHANGE, '--root', root, '--json'], { encoding: 'utf8' });
    } catch (e) {
      failed = e;
    }
    assert.ok(failed, 'expected a non-zero exit');
    assert.equal(JSON.parse(failed.stdout).ok, false);
  });
});

// --- later stages: coverage, design screens, task links (design D3) and e2e labels (D5) -----------

const SCENARIOS = ['Export starts', 'Share is not available yet', 'Successful export', 'Empty period'];
/** Writes the delta spec inventory/orders-export with the given scenario names. */
function withSpecs(dir, names = SCENARIOS) {
  const d = join(dir, 'specs', 'inventory', 'orders-export');
  mkdirSync(d, { recursive: true });
  const scenarios = names.map((n) => `#### Scenario: ${n}\n- **WHEN** the accountant uses the orders list\n- **THEN** the screen shows the result\n`).join('\n');
  writeFileSync(join(d, 'spec.md'), `# Spec Delta\n\n## ADDED Requirements\n\n### Requirement: Orders export\nThe accountant SHALL export the orders list.\n\n${scenarios}`);
}
/** Writes design.md with a `## Screens` row for each given screen. */
function withDesign(dir, screens = ['orders-list', 'export-modal']) {
  const rows = screens.map((s) => `| ${s} | \`src/pages/${s}.tsx\` |`).join('\n');
  writeFileSync(join(dir, 'design.md'), `# Design\n\n## Context\n\nExport.\n\n## Screens\n\n| Screen | Pages and components |\n|---|---|\n${rows}\n`);
}
const GOOD_TASKS = '# Tasks\n\n## 1. Screens\n\n- [x] 1.1 Build the `orders-list` screen (sources/ui/01-orders-list.png, sources/ui/02-orders-list-mobile.png)\n- [x] 1.2 Build the `export-modal` dialog ([U4](sources/ui/04-export-modal.png))\n';
/** A clarify change ready for the archive stage: specs, design screens, tasks with screenshot links. */
function fullProject(opts) {
  const p = project(opts);
  withSpecs(p.dir);
  if (!opts || opts.schema !== 'lean') withDesign(p.dir);
  writeFileSync(join(p.dir, 'tasks.md'), GOOD_TASKS);
  return p;
}
/** Rewrites the inventory with other screens (fingerprints from the project). */
function rescreen({ dir, fingerprints }, screens) {
  writeFileSync(join(dir, 'ui-inventory.md'), inventoryText(SHOTS.map(([t, f]) => [t, f, fingerprints[f]]), ROWS, screens));
}

describe('stage for each artifact (for the hooks)', () => {
  const ARTIFACTS = ['clarifications', 'proposal', 'specs', 'test-cases', 'design', 'verification-plan', 'tasks'];
  test('clarify family: base up to the test cases, then design, plan, tasks', () => {
    for (const schema of ['clarify', 'clarify-ai-qa', 'clarify-qa']) {
      const tc = schema === 'clarify' ? null : 'base';
      assert.deepEqual(ARTIFACTS.map((a) => uiStageFor(schema, a)), [null, 'base', 'base', tc, 'design', 'plan', 'tasks'], schema);
    }
  });
  test('lean: coverage from the verification plan, no design', () => {
    assert.deepEqual(ARTIFACTS.map((a) => uiStageFor('lean', a)), [null, 'base', 'base', null, null, 'design', 'tasks']);
  });
  test('other schemas have no UI stage', () => {
    assert.equal(uiStageFor('spec-driven', 'proposal'), null);
    assert.equal(uiStageFor(null, 'design'), null);
  });
});

describe('every built element names existing scenarios', () => {
  test('a complete change passes every stage, clarify and lean', () => {
    for (const schema of ['clarify', 'lean']) {
      const { root } = fullProject({ schema });
      for (const stage of UI_STAGES) assertClean(ui(root, { stage }));
    }
  });

  test('scenarios are not checked at the base stage', () => {
    const { root } = project();
    assertClean(ui(root));
    assertCaught(ui(root, { stage: 'design' }), /"open-export".*"Export starts"/);
  });

  // @scenario ui-sources/coverage :: Element names a scenario that does not exist
  test('an element naming a scenario missing from the delta spec', () => {
    const { root, dir } = project();
    withSpecs(dir, SCENARIOS.filter((n) => n !== 'Export starts'));
    const r = ui(root, { stage: 'design' });
    assertCaught(r, /element "open-export".*"Export starts".*not in the change's delta specs/);
    assert.equal(errors(r).length, 1, messages(r));
  });

  test('a scenario of a capability the change has no delta spec for is reported', () => {
    const { root, dir } = project();
    withSpecs(dir);
    plant(dir, 'ui-inventory.md', 'inventory/orders-export :: Export starts', 'billing/invoices :: Export starts');
    assertCaught(ui(root, { stage: 'design' }), /"open-export".*"Export starts".*billing\/invoices/);
  });

  test('an in-scope and a mock element without a scenario are reported by name', () => {
    const { root, dir } = project();
    withSpecs(dir);
    plant(dir, 'ui-inventory.md', ROWS['open-export'], ROWS['open-export'].replace('inventory/orders-export :: Export starts', '—'));
    plant(dir, 'ui-inventory.md', ROWS['share-button'], ROWS['share-button'].replace('inventory/orders-export :: Share is not available yet', ''));
    assertClean(ui(root));
    const r = ui(root, { stage: 'design' });
    assertCaught(r, /"open-export".*names no scenario/);
    assertCaught(r, /"share-button".*names no scenario/);
    assert.equal(errors(r).length, 2, messages(r));
  });

  // @scenario ui-sources/coverage :: Elements that are not built need no scenario
  test('out of scope, decoration and existing elements need no scenario', () => {
    const { root, dir } = project();
    withSpecs(dir);
    const r = ui(root, { stage: 'design' });
    assertClean(r);
    for (const name of ['bulk-delete', 'promo-banner-link', 'logout-button']) noErrorAbout(r, name);
  });

  test('lean: an element without a scenario is reported from the design stage', () => {
    const { root, dir } = project({ schema: 'lean' });
    withSpecs(dir);
    plant(dir, 'ui-inventory.md', 'inventory/orders-export :: Export starts', '—');
    assertClean(ui(root));
    assertCaught(ui(root, { stage: uiStageFor('lean', 'verification-plan') }), /"open-export".*names no scenario/);
  });
});

describe('the design maps screens to pages and components', () => {
  test('a screen without its row is reported from the plan stage', () => {
    const { root, dir } = project();
    withSpecs(dir);
    withDesign(dir, ['orders-list']);
    assertClean(ui(root, { stage: 'design' }));
    for (const stage of ['plan', 'tasks', 'archive']) assertCaught(ui(root, { stage }), /screen "export-modal".*"## Screens"/);
  });

  test('a design without "## Screens" names every screen with a built element', () => {
    const { root, dir } = project();
    withSpecs(dir);
    writeFileSync(join(dir, 'design.md'), '# Design\n\n## Context\n\nExport.\n');
    const r = ui(root, { stage: 'plan' });
    assertCaught(r, /screen "orders-list"/);
    assertCaught(r, /screen "export-modal"/);
  });

  test('a row with no pages and components is reported', () => {
    const { root, dir } = project();
    withSpecs(dir);
    withDesign(dir);
    plant(dir, 'design.md', '| export-modal | `src/pages/export-modal.tsx` |', '| `Export-Modal` | — |');
    assertCaught(ui(root, { stage: 'plan' }), /screen "export-modal".*no pages or components/);
  });

  // @scenario ui-sources/implementation :: Screen with only a mock element needs a design row
  test('a screen whose only built element is a mock needs a row', () => {
    const p = project();
    withSpecs(p.dir);
    rescreen(p, {
      'orders-list': { shots: 'U1 (desktop), U2 (mobile)', elements: ['open-export', 'bulk-delete', 'logout-button'] },
      'share-dialog': { shots: 'U4', elements: ['share-button', 'promo-banner-link'] },
    });
    withDesign(p.dir, ['orders-list']);
    assertClean(ui(p.root, { stage: 'design' }));
    const r = ui(p.root, { stage: uiStageFor('clarify', 'verification-plan') });
    assertCaught(r, /screen "share-dialog"/);
    assert.equal(errors(r).length, 1, messages(r));
  });

  // @scenario ui-sources/implementation :: Screen with nothing to build needs no row
  test('a screen of existing and out-of-scope elements needs no row', () => {
    const p = project();
    withSpecs(p.dir);
    const rows = { ...ROWS, 'open-export': ROWS['open-export'].replace('desktop, mobile', '—'), 'share-button': ROWS['share-button'].replace('desktop, mobile', '—') };
    writeFileSync(join(p.dir, 'ui-inventory.md'), inventoryText(SHOTS.map(([t, f]) => [t, f, p.fingerprints[f]]), rows, {
      'orders-list': { shots: 'U1', elements: ['open-export', 'share-button'] },
      settings: { shots: 'U2', elements: ['bulk-delete', 'logout-button'] },
      'export-modal': { shots: 'U4', elements: ['export-button', 'promo-banner-link'] },
    }));
    withDesign(p.dir, ['orders-list', 'export-modal']);
    const r = ui(p.root, { stage: 'plan' });
    assertClean(r);
    noErrorAbout(r, 'settings');
  });

  test('lean has no design and no "## Screens" check', () => {
    const { root } = fullProject({ schema: 'lean' });
    assertClean(ui(root, { stage: 'tasks' }));
  });
});

describe('UI tasks link their screenshots (archive)', () => {
  const TASK = '- [ ] 2.1 Build the `export-modal` dialog';
  function withTask(dir, line) {
    writeFileSync(join(dir, 'tasks.md'), `${GOOD_TASKS}\n## 2. Export\n\n${line}\n- [ ] 2.2 Write \`npm test\` results to the log\n`);
  }

  // @scenario ui-sources/implementation :: UI task without a screenshot is reported
  test('a task naming a screen without a link', () => {
    const { root, dir } = fullProject();
    withTask(dir, TASK);
    const r = ui(root, { stage: 'archive' });
    assertCaught(r, /task "2\.1 Build the `export-modal` dialog" names the screen "export-modal".*links no screenshot/);
    assert.equal(errors(r).length, 1, messages(r));
    assert.equal(errors(r)[0].line, 10);
  });

  test('task links are checked only in the archive stage', () => {
    const { root, dir } = fullProject();
    withTask(dir, TASK);
    assertClean(ui(root, { stage: 'tasks' }));
  });

  // @scenario ui-sources/implementation :: UI task linking another screen's screenshot is reported
  test('a task linking only a screenshot of another screen', () => {
    const { root, dir } = fullProject();
    withTask(dir, `${TASK} (sources/ui/01-orders-list.png)`);
    const r = ui(root, { stage: 'archive' });
    assertCaught(r, /task "2\.1 Build the `export-modal` dialog.*" names the screen "export-modal".*links no screenshot/);
    assert.equal(errors(r).length, 1, messages(r));
  });

  // @scenario ui-sources/implementation :: UI task with its screenshot passes
  test('a task linking a screenshot of its screen', () => {
    const { root, dir } = fullProject();
    withTask(dir, `${TASK} ([screenshot](sources/ui/04-export-modal.png))`);
    const r = ui(root, { stage: 'archive' });
    assertClean(r);
    noErrorAbout(r, '2.1');
  });

  test('a link on an indented line under the task counts', () => {
    const { root, dir } = fullProject();
    withTask(dir, `${TASK}\n  Screenshot: \`sources/ui/04-export-modal.png\``);
    assertClean(ui(root, { stage: 'archive' }));
  });
});

describe('UI test cases carry the e2e label (check-test-cases)', () => {
  const CASES = { 'Export starts': 'Click export', 'Share is not available yet': 'Share shows coming soon', 'Successful export': 'Export of two orders', 'Empty period': 'Export of an empty period', 'Totals are rounded': 'Total 0.005 rounds up' };
  /** A clarify-ai-qa change with delta specs and a test-cases.md with one case per scenario. */
  function tcProject(labels = {}) {
    const p = project({ schema: 'clarify-ai-qa' });
    withSpecs(p.dir, Object.keys(CASES));
    const sections = Object.entries(CASES).map(([sc, name]) => `### Scenario: ${sc}\n\n#### Case: ${name}\nLabels: ${labels[name] || 'automated, e2e'}\n- **Given** two paid orders in March 2026\n- **When** the accountant opens the orders list\n- **Then** the screen shows the expected result\n`);
    writeFileSync(join(p.dir, 'test-cases.md'), `# Test Cases\n\n## inventory/orders-export\n\n${sections.join('\n')}\n## General remarks\n\nNone.\n\n## Spec changes during test-case review\n\nNone.\n\n## Stage result\n\n[Answer]:\n`);
    return p;
  }
  const tc = (root) => checkTestCases({ root, change: CHANGE });

  // @scenario ui-sources/coverage :: UI case without e2e is reported
  test('a case labelled only automated under a scenario of a built element', () => {
    const { root } = tcProject({ 'Click export': 'automated' });
    const r = tc(root);
    assertCaught(r, /test case "Click export".*"open-export".*`e2e` label is required/);
    assert.equal(errors(r).length, 1, messages(r));
  });

  // @scenario ui-sources/coverage :: UI case with automated and e2e passes
  test('a case labelled automated, e2e', () => {
    const r = tc(tcProject().root);
    assertClean(r);
    assert.ok(!errors(r).some((f) => /e2e/.test(f.message)));
  });

  test('a mock element needs e2e too; a scenario no built element names does not', () => {
    const { root } = tcProject({ 'Share shows coming soon': 'manual', 'Total 0.005 rounds up': 'automated' });
    const r = tc(root);
    assertCaught(r, /test case "Share shows coming soon".*"share-button".*`e2e` label is required/);
    noErrorAbout(r, 'Total 0.005 rounds up');
  });

  test('without screenshots the label is not required', () => {
    const { root, dir } = tcProject({ 'Click export': 'automated' });
    for (const [, file] of SHOTS) rmSync(join(dir, 'sources', 'ui', file));
    assertClean(tc(root));
  });
});
