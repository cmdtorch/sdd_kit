// check-specs rules that mirror `openspec validate` 2.2.0 (checks/delta-specs): every scenario has a trigger step
// (WHEN/GIVEN) and an outcome step (THEN), and a MODIFIED requirement may not grow past 500 characters. Both are
// errors on a change stamped 0.8.0 or later and warnings before.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkSpecs } from '../kit/openspec/tooling/checks/check-specs.mjs';
import { feedback } from '../kit/openspec/tooling/hooks/artifact-feedback.mjs';

const CHECK_SPECS = join(dirname(fileURLToPath(import.meta.url)), '..', 'kit', 'openspec', 'tooling', 'checks', 'check-specs.mjs');
const CHANGE = 'add-export';
const CAP = 'inventory/export';
const C = `openspec/changes/${CHANGE}`;

function put(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

/** A project with one clarify change stamped `stamp` (null: no stamp) and the given delta and main spec. */
function project({ stamp = '0.8.0', delta, main = null }) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-delta-specs-'));
  put(root, `${C}/.openspec.yaml`, `schema: clarify\ncreated: 2026-11-26\n${stamp ? `x-sdd-kit: ${stamp}\n` : ''}`);
  put(root, `${C}/specs/${CAP}/spec.md`, delta);
  if (main) put(root, `openspec/specs/${CAP}/spec.md`, main);
  return root;
}

/** A new-capability delta with one requirement whose single scenario has `body`. */
function stepsDelta(scenario, body) {
  return [
    '# Spec Delta',
    '',
    '## Purpose',
    '',
    'Exporting the sales of a period to a file the accountant can open.',
    '',
    '## ADDED Requirements',
    '',
    '### Requirement: Sales export',
    'The system SHALL export the sales of a period.',
    '',
    `#### Scenario: ${scenario}`,
    body,
    '',
  ].join('\n');
}

/** Requirement text of exactly `n` characters; `fill` changes the wording, not the length. */
function text(n, fill = 'x') {
  const head = 'The system SHALL ';
  return head + fill.repeat(n - head.length);
}

function requirement(name, body) {
  return [`### Requirement: ${name}`, body, '', '#### Scenario: Export runs', '- **WHEN** the user exports', '- **THEN** a file is created', ''].join('\n');
}

const mainSpec = (len) => ['# inventory/export', '', '## Purpose', '', 'Exporting the sales of a period to a file the accountant can open.', '', '## Requirements', '', requirement('Sales export', text(len))].join('\n');
const modifiedDelta = (len, fill) => ['# Spec Delta', '', '## MODIFIED Requirements', '', requirement('Sales export', text(len, fill))].join('\n');

const run = (root) => checkSpecs({ root, change: CHANGE });
const errors = (r) => r.findings.filter((f) => f.level === 'error');
const warnings = (r) => r.findings.filter((f) => f.level === 'warning');
const about = (list, re) => list.filter((f) => re.test(f.message));
const NO_TRIGGER = /scenario "[^"]+" has no WHEN or GIVEN step/;
const NO_OUTCOME = /scenario "[^"]+" has no THEN step/;
const STEPS = /has no (WHEN or GIVEN|THEN) step/;
const LENGTH = /requirement "Sales export" text is \d+ characters/;

describe('Every scenario has a trigger step and an outcome step', () => {
  // @scenario checks/delta-specs :: A scenario without WHEN or GIVEN is an error
  test('A scenario without WHEN or GIVEN is an error', () => {
    const r = run(project({ delta: stepsDelta('Export file', '- **THEN** the export file is created') }));
    assert.equal(r.ok, false);
    const found = about(errors(r), NO_TRIGGER);
    assert.equal(found.length, 1, JSON.stringify(r.findings));
    assert.match(found[0].message, /scenario "Export file"/);
    assert.deepEqual(about(r.findings, NO_OUTCOME), []);
  });

  // @scenario checks/delta-specs :: A scenario without WHEN or GIVEN is an error
  test('the check-specs command reports the missing WHEN/GIVEN step and exits with status 1', () => {
    const root = project({ delta: stepsDelta('Export file', '- **THEN** the export file is created') });
    const r = spawnSync(process.execPath, [CHECK_SPECS, '--change', CHANGE, '--json'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 1, `${r.stdout}\n${r.stderr}`);
    const report = JSON.parse(r.stdout);
    assert.equal(report.ok, false);
    const found = about(errors(report), NO_TRIGGER);
    assert.equal(found.length, 1, r.stdout);
    assert.match(found[0].message, /scenario "Export file"/);
    const plain = spawnSync(process.execPath, [CHECK_SPECS, '--change', CHANGE], { cwd: root, encoding: 'utf8' });
    assert.equal(plain.status, 1, `${plain.stdout}\n${plain.stderr}`);
    assert.match(plain.stdout, /scenario "Export file" has no WHEN or GIVEN step/);
  });

  // @scenario checks/delta-specs :: A scenario without THEN is an error
  test('A scenario without THEN is an error', () => {
    const r = run(project({ delta: stepsDelta('Export starts', '- **WHEN** the user exports') }));
    assert.equal(r.ok, false);
    const found = about(errors(r), NO_OUTCOME);
    assert.equal(found.length, 1, JSON.stringify(r.findings));
    assert.match(found[0].message, /scenario "Export starts"/);
    assert.deepEqual(about(r.findings, NO_TRIGGER), []);
  });

  // @scenario checks/delta-specs :: GIVEN counts as the trigger step
  test('GIVEN counts as the trigger step', () => {
    const r = run(project({ delta: stepsDelta('Empty cart', '- **GIVEN** an empty cart\n- **THEN** the total is 0') }));
    assert.deepEqual(r.findings, []);
    assert.equal(r.ok, true);
  });

  test('bold steps in any case, with a colon or with underscores, count', () => {
    const r = run(project({ delta: stepsDelta('Mixed case', '- **Given:** an empty cart\n- __when__ the user pays\n- **then:** the total is 0') }));
    assert.deepEqual(r.findings, []);
  });

  // @scenario checks/delta-specs :: A keyword only in the name or in a fence does not count
  test('A keyword only in the name or in a fence does not count', () => {
    const body = ['- **THEN** an error is shown', '', '```', 'WHEN x', '```'].join('\n');
    const r = run(project({ delta: stepsDelta('What happens WHEN it fails', body) }));
    assert.equal(r.ok, false);
    assert.equal(about(errors(r), NO_TRIGGER).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: A bare upper-case keyword inside a line counts
  test('A bare upper-case keyword inside a line counts', () => {
    const r = run(project({ delta: stepsDelta('Empty file', '- **THEN** the import fails WHEN the file is empty') }));
    assert.deepEqual(r.findings, []);
    assert.equal(r.ok, true);
  });

  // @scenario checks/delta-specs :: A lower-case bare keyword does not count
  test('A lower-case bare keyword does not count', () => {
    const r = run(project({ delta: stepsDelta('Lower case', '- when the user exports\n- **THEN** a file is created') }));
    assert.equal(r.ok, false);
    assert.equal(about(errors(r), NO_TRIGGER).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: An earlier change only gets a warning
  test('An earlier change only gets a warning', () => {
    const r = run(project({ stamp: '0.7.0', delta: stepsDelta('Export file', '- **THEN** the export file is created') }));
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(about(errors(r), STEPS), []);
    assert.equal(about(warnings(r), NO_TRIGGER).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: An unstamped change only gets a warning
  test('An unstamped change only gets a warning', () => {
    const r = run(project({ stamp: null, delta: stepsDelta('Export starts', '- **WHEN** the user exports') }));
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(about(errors(r), STEPS), []);
    assert.equal(about(warnings(r), NO_OUTCOME).length, 1, JSON.stringify(r.findings));
  });

  test('a pre-release of 0.8.0 gets the error', () => {
    const r = run(project({ stamp: '0.8.0-beta.1', delta: stepsDelta('Export file', '- **THEN** the export file is created') }));
    assert.equal(about(errors(r), NO_TRIGGER).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: The error blocks the next artifact
  test('The error blocks the next artifact', () => {
    const root = project({ delta: stepsDelta('Export file', '- **THEN** the export file is created') });
    put(root, `${C}/design.md`, '# Design\n');
    const out = feedback({ hook_event_name: 'PostToolUse', tool_name: 'Write', cwd: root, tool_input: { file_path: join(root, C, 'design.md'), content: '' } });
    assert.ok(out, 'artifact feedback reported nothing');
    assert.match(out, /sdd-kit check-specs found \d+ problem\(s\)/);
    assert.match(out, /scenario "Export file" has no WHEN or GIVEN step/);
    assert.match(out, /Fix these now/);
  });
});

describe('A MODIFIED requirement may not grow past 500 characters', () => {
  // @scenario checks/delta-specs :: Crossing the limit is an error
  test('Crossing the limit is an error', () => {
    const r = run(project({ main: mainSpec(480), delta: modifiedDelta(520) }));
    assert.equal(r.ok, false);
    const found = about(errors(r), LENGTH);
    assert.equal(found.length, 1, JSON.stringify(r.findings));
    assert.match(found[0].message, /520 characters/);
  });

  // @scenario checks/delta-specs :: An already long requirement that grows is an error
  test('An already long requirement that grows is an error', () => {
    const r = run(project({ main: mainSpec(600), delta: modifiedDelta(610) }));
    assert.equal(r.ok, false);
    const found = about(errors(r), LENGTH);
    assert.equal(found.length, 1, JSON.stringify(r.findings));
    assert.match(found[0].message, /610 characters/);
  });

  // @scenario checks/delta-specs :: An already long requirement that does not grow only warns
  test('An already long requirement that does not grow only warns', () => {
    const r = run(project({ main: mainSpec(600), delta: modifiedDelta(590) }));
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(errors(r), []);
    assert.equal(about(warnings(r), LENGTH).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: Exactly 500 characters passes
  test('Exactly 500 characters passes', () => {
    const r = run(project({ main: mainSpec(480), delta: modifiedDelta(500) }));
    assert.deepEqual(r.findings, []);
    assert.equal(r.ok, true);
  });

  // @scenario checks/delta-specs :: An earlier change that grows past the limit only warns
  test('An earlier change that grows past the limit only warns', () => {
    const r = run(project({ stamp: '0.7.0', main: mainSpec(480), delta: modifiedDelta(520) }));
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(errors(r), []);
    assert.equal(about(warnings(r), LENGTH).length, 1, JSON.stringify(r.findings));
  });

  test('an unstamped change that grows past the limit only warns', () => {
    const r = run(project({ stamp: null, main: mainSpec(480), delta: modifiedDelta(520) }));
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.equal(about(warnings(r), LENGTH).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: An already long requirement of the same length only warns
  test('An already long requirement of the same length only warns', () => {
    const r = run(project({ main: mainSpec(600), delta: modifiedDelta(600, 'y') }));
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(errors(r), []);
    assert.equal(about(warnings(r), LENGTH).length, 1, JSON.stringify(r.findings));
  });

  // @scenario checks/delta-specs :: One character over the limit is an error
  test('One character over the limit is an error', () => {
    const r = run(project({ main: mainSpec(480), delta: modifiedDelta(501) }));
    assert.equal(r.ok, false);
    const found = about(errors(r), LENGTH);
    assert.equal(found.length, 1, JSON.stringify(r.findings));
    assert.match(found[0].message, /501 characters/);
  });

  // @scenario checks/delta-specs :: A requirement missing from the main spec only warns
  test('A requirement missing from the main spec only warns', () => {
    const other = mainSpec(480).replace('### Requirement: Sales export', '### Requirement: Sales import').replace('Scenario: Export runs', 'Scenario: Import runs');
    const r = run(project({ main: other, delta: modifiedDelta(520) }));
    assert.deepEqual(errors(r), [], JSON.stringify(r.findings));
    assert.equal(about(warnings(r), LENGTH).length, 1, JSON.stringify(r.findings));
  });

  test('an ADDED requirement over 500 characters stays an error on any change', () => {
    const delta = stepsDelta('Export runs', '- **WHEN** the user exports\n- **THEN** a file is created').replace('The system SHALL export the sales of a period.', text(520));
    const r = run(project({ stamp: '0.7.0', delta }));
    assert.equal(about(errors(r), LENGTH).length, 1, JSON.stringify(r.findings));
  });
});
