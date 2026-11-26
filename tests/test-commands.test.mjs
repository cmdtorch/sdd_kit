// The project's test-commands file (`openspec/test-commands.md`): its parser and the 0.7.0 version gate.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTestCommands, readTestCommands, oneFileCommand, TEST_COMMANDS_FILE } from '../kit/openspec/tooling/lib/test-commands.mjs';
import { usesTestCommands, TEST_RUNS_VERSION } from '../kit/openspec/tooling/lib/project.mjs';

const lines = (...l) => l.join('\n') + '\n';

describe('test-commands file parser', () => {
  // @scenario workflow/test-commands :: File with three commands
  test('three command items give the commands by label, with their durations', () => {
    const parsed = parseTestCommands(lines('- One file: `make test FILE=<file>` — 1 min', '- Failed only: `make test-failed`', '- Full suite: `make test` — 12 min'));
    assert.equal(parsed.none, false);
    const section = parsed.sections[''];
    assert.deepEqual(section['One file'], { command: 'make test FILE=<file>', minutes: 1 });
    assert.deepEqual(section['Failed only'], { command: 'make test-failed', minutes: null });
    assert.deepEqual(section['Full suite'], { command: 'make test', minutes: 12 });
    assert.equal(oneFileCommand(parsed, null, 'tests/orders.test'), 'make test FILE=tests/orders.test');
  });

  // @scenario workflow/test-commands :: Line that is not a command item
  test('headings, notes and an item without backticks are ignored', () => {
    const parsed = parseTestCommands(lines('# Test commands', '', 'The suite needs a running database.', '- Full suite: make test'));
    assert.equal(parsed.none, false);
    assert.equal(parsed.sections['']?.['Full suite'], undefined);
    assert.deepEqual(Object.keys(parsed.sections[''] ?? {}), []);
  });

  // @scenario workflow/test-commands :: Duration in another form
  test('a duration that is not whole minutes leaves the command without a duration', () => {
    const parsed = parseTestCommands(lines('- Full suite: `make test` — 90 s'));
    assert.deepEqual(parsed.sections['']['Full suite'], { command: 'make test', minutes: null });
    for (const rest of ['— 1.5 min', '— about 12 min', '(slow)', '— 12 minutes']) {
      assert.deepEqual(parseTestCommands(`- Full suite: \`make test\` ${rest}\n`).sections['']['Full suite'], { command: 'make test', minutes: null }, rest);
    }
  });

  // @scenario workflow/test-commands :: Same label twice
  test('the first item of a label counts', () => {
    const parsed = parseTestCommands(lines('- Full suite: `make test` — 12 min', '- Full suite: `make test-all` — 30 min'));
    assert.deepEqual(parsed.sections['']['Full suite'], { command: 'make test', minutes: 12 });
  });

  // @scenario workflow/test-commands :: Group uses its repository's section
  test('a group uses the one-file command of its repository section, with the file in place of the placeholder', () => {
    const parsed = parseTestCommands(
      lines(
        '# Test commands',
        '',
        '## Repository: backend',
        '- One file: `mise run test:backend -- <file>`',
        '- Full suite: `mise run test:backend` — 8 min',
        '',
        '## Repository: frontend',
        '- One file: `mise run test:frontend -- <file>`',
      ),
    );
    assert.deepEqual(Object.keys(parsed.sections).sort(), ['backend', 'frontend']);
    assert.equal(oneFileCommand(parsed, 'backend', 'orders/tests/test_api.py'), 'mise run test:backend -- orders/tests/test_api.py');
    assert.equal(oneFileCommand(parsed, 'frontend', 'src/cart.test.ts'), 'mise run test:frontend -- src/cart.test.ts');
    assert.equal(oneFileCommand(parsed, 'root', 'x'), null, 'a repository without a section has no command');
    assert.equal(parsed.sections.frontend['Full suite'], undefined);
  });

  test('items before the first repository heading belong to the unnamed section; the same label counts once per section', () => {
    const parsed = parseTestCommands(lines('- Full suite: `make all`', '## Repository: root', '- Full suite: `make test`', '- Full suite: `make other`'));
    assert.equal(parsed.sections['']['Full suite'].command, 'make all');
    assert.equal(parsed.sections.root['Full suite'].command, 'make test');
  });

  test('the single line `none` yields no commands', () => {
    for (const content of ['none\n', 'none', '  none  \n\n']) {
      const parsed = parseTestCommands(content);
      assert.equal(parsed.none, true, JSON.stringify(content));
      assert.deepEqual(parsed.sections, {});
    }
    assert.equal(parseTestCommands('').none, false);
    assert.deepEqual(parseTestCommands('').sections, {});
  });

  test('a one-file command without the placeholder, or a missing one, gives no one-file command', () => {
    assert.equal(oneFileCommand(parseTestCommands('- Full suite: `make test`\n'), null, 'a.test'), null);
    assert.equal(oneFileCommand(null, null, 'a.test'), null);
  });

  test('readTestCommands reads openspec/test-commands.md, or returns null without it', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-test-commands-'));
    mkdirSync(join(root, 'openspec'));
    assert.equal(TEST_COMMANDS_FILE, 'openspec/test-commands.md');
    assert.equal(readTestCommands(root), null);
    writeFileSync(join(root, TEST_COMMANDS_FILE), '- Full suite: `npm test` — 3 min\n');
    assert.deepEqual(readTestCommands(root).sections[''], { 'Full suite': { command: 'npm test', minutes: 3 } });
  });
});

describe('version gate of the test-command rules (usesTestCommands)', () => {
  /** A project with one change `c1` on `schema`, stamped `stamp` (null: no stamp). */
  function changeOn(schema, stamp) {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-test-runs-gate-'));
    mkdirSync(join(root, 'openspec', 'changes', 'c1'), { recursive: true });
    writeFileSync(join(root, 'openspec', 'changes', 'c1', '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-11-26\n${stamp ? `x-sdd-kit: ${stamp}\n` : ''}`);
    return root;
  }
  const uses = (schema, stamp) => usesTestCommands(changeOn(schema, stamp), 'c1');

  test('the gate is 0.7.0', () => assert.equal(TEST_RUNS_VERSION, '0.7.0'));

  test('a change stamped 0.7.0 or later follows the rules; a pre-release counts as its base version', () => {
    for (const schema of ['clarify', 'lean', 'clarify-qa']) {
      for (const stamp of ['0.7.0', '0.7.0-beta.1', '0.7.3', '1.0.0']) assert.equal(uses(schema, stamp), true, `${schema} ${stamp}`);
    }
  });

  test('a change stamped below 0.7.0 or without a stamp keeps the earlier rules', () => {
    for (const schema of ['clarify', 'lean']) {
      for (const stamp of ['0.6.1', '0.6.0', '0.5.0', null]) assert.equal(uses(schema, stamp), false, `${schema} ${stamp}`);
    }
  });
});
