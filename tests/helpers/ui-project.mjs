// Shared builders of UI-mode projects for the hook tests (ui-hooks, e2e-hooks): a copy of the checks-good
// fixture (a complete `clarify` change) plus the kit's openspec/, with generated screenshots, their
// registration, a complete UI inventory, a "## Screens" table in design.md and a UI task.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CHANGE = 'add-sales-export';
export const C = `openspec/changes/${CHANGE}`;
export const LEAN = 'add-orders-list';
export const L = `openspec/changes/${LEAN}`;

// A few bytes per image: a real PNG signature plus content that differs per file.
export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const image = (name, seed = '') => Buffer.concat([PNG, Buffer.from(`${name}${seed}`)]);
export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export const SHOTS = [
  ['U1', '01-orders-list.png'],
  ['U2', '02-orders-list-empty.png'],
  ['U3', '06-export-modal.png'],
];
export const HEADER = '| Element | Type | Variants | Decision | Source | Scenarios |\n|---|---|---|---|---|---|';
export const ROWS = {
  'open-export': '| open-export | button | filled, empty | in scope | [Q1] | inventory/sales-export :: Successful export |',
  'bulk-delete': '| bulk-delete | button | filled | out of scope | [Q3] | — |',
  'empty-state': '| empty-state | state | empty | in scope | [Q4] | inventory/sales-export :: Empty period |',
  'logout-button': '| logout-button | button | filled, empty | existing | — | — |',
  'export-button': '| export-button | button | — | in scope | [desc] | inventory/sales-export :: Successful export |',
  'share-button': '| share-button | button | — | mock | [Q3] | inventory/sales-export :: Teacher cannot export |',
};
export const SCREENS = {
  'orders-list': { shots: 'U1 (filled), U2 (empty)', elements: ['open-export', 'bulk-delete', 'empty-state', 'logout-button'] },
  'export-modal': { shots: 'U3', elements: ['export-button', 'share-button'] },
};
export const UI_TASK = '- [x] 1.4 Build the `export-modal` dialog from [its screenshot](sources/ui/06-export-modal.png)';

export function inventoryText(shotRows, rows = ROWS, screens = SCREENS) {
  const out = ['# UI Inventory', '', '## Screenshots', '', '| Tag | File | Fingerprint |', '|---|---|---|'];
  for (const [tag, file, fp] of shotRows) out.push(`| ${tag} | ${file} | ${fp} |`);
  for (const [name, screen] of Object.entries(screens)) {
    out.push('', `## Screen: ${name}`, '', `Screenshots: ${screen.shots}`, '', HEADER);
    for (const e of screen.elements) out.push(rows[e]);
  }
  return out.join('\n') + '\n';
}
export function writeShots(dir, shots) {
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
export function baseProject(fixture = 'checks-good') {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-ui-hooks-'));
  cpSync(join(REPO, 'fixtures', 'projects', fixture), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  return root;
}
export function plant(root, file, from, to) {
  const p = join(root, file);
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(from), `${file} does not contain: ${from}`);
  writeFileSync(p, s.replace(from, to));
}
export const register = (root, shots) => plant(root, `${C}/clarifications.md`, "- [D1] Client request — `sources/D1.md`\n", `- [D1] Client request — \`sources/D1.md\`\n${shots.map(([t, f]) => `- [${t}] Screenshot — \`sources/ui/${f}\``).join('\n')}\n`);

/**
 * The checks-good change in UI mode, complete and ready to archive: registered screenshots, a complete
 * inventory with matching fingerprints (`shots`: [[tag, file]] of U1–U3, default SHOTS), a "## Screens" table in design.md and a UI task linking its screenshot.
 */
export function uiProject({ inventory = true, shots = SHOTS } = {}) {
  const root = baseProject();
  const dir = join(root, C);
  const fps = writeShots(dir, shots);
  register(root, shots);
  if (inventory) writeFileSync(join(dir, 'ui-inventory.md'), inventoryText(shots.map(([t, f]) => [t, f, fps[f]])));
  writeFileSync(join(dir, 'design.md'), `${readFileSync(join(dir, 'design.md'), 'utf8')}\n## Screens\n\n| Screen | Pages and components |\n|---|---|\n| orders-list | SalesListPage [U1] |\n| export-modal | ExportDialog [U3] |\n`);
  plant(root, `${C}/tasks.md`, '- [x] 1.3 Write the integration test', `${UI_TASK}\n- [x] 1.3 Write the integration test`);
  return root;
}

/** A `lean` change in the same project: one screenshot registered in its inventory, a proposal naming every element. */
export function leanProject({ inventory = true, rows = null } = {}) {
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
