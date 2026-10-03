// Unit tests for the kit's shared libraries (yaml, markdown, spec parser, clarifications parser).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml, YamlError } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { toLines, fenceMask, stripComments, firstTable, splitRow } from '../kit/core/openspec/tooling/lib/markdown.mjs';
import { parseDeltaSpec, parseMainSpec } from '../kit/core/openspec/tooling/lib/spec-parser.mjs';
import { parseClarifications, roundStatus, answerLetters, isBlankAnswer } from '../kit/core/openspec/tooling/lib/clarifications.mjs';
import { cliSkipReason, makeProject, openspecJson } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMAS = join(REPO, 'kit', 'core', 'openspec', 'schemas');

describe('yaml', () => {
  test('mappings, sequences, scalars, flow collections', () => {
    const { value, positions } = parseYaml(
      [
        'name: demo # comment',
        'version: 1',
        'enabled: true',
        'nothing: ~',
        'quoted: "a: b # not a comment"',
        "single: 'it''s'",
        'list: [a, "b, c", 3]',
        'map: {x: 1, y: two}',
        'items:',
        '  - id: one',
        '    requires: []',
        '  - id: two',
        '    requires:',
        '      - one',
        'plain:',
        '- a',
        '- b',
      ].join('\n'),
    );
    assert.deepEqual(value, {
      name: 'demo',
      version: 1,
      enabled: true,
      nothing: null,
      quoted: 'a: b # not a comment',
      single: "it's",
      list: ['a', 'b, c', 3],
      map: { x: 1, y: 'two' },
      items: [
        { id: 'one', requires: [] },
        { id: 'two', requires: ['one'] },
      ],
      plain: ['a', 'b'],
    });
    assert.equal(positions['items.1.requires'], 13);
    assert.equal(positions['plain'], 15);
  });

  test('block scalars keep "#" lines and chomp correctly', () => {
    const { value } = parseYaml('a: |\n  # not a comment\n  line two\n\nb: |-\n  x\n  y\nc: >\n  folded\n  text\n\n  para\nd: x\n');
    assert.equal(value.a, '# not a comment\nline two\n');
    assert.equal(value.b, 'x\ny');
    assert.equal(value.c, 'folded text\npara\n');
    assert.equal(value.d, 'x');
  });

  test('errors carry line numbers', () => {
    assert.throws(() => parseYaml('a: 1\na: 2\n'), (e) => e instanceof YamlError && e.line === 2 && /duplicate key/.test(e.message));
    assert.throws(() => parseYaml('a:\n\tb: 1\n'), /tabs/);
    assert.throws(() => parseYaml('a: [1, 2\n'), /unterminated/);
    assert.throws(() => parseYaml('a: &x 1\n'), /anchors/);
    assert.throws(() => parseYaml('a: 1\n  b: 2\n'), /unexpected indentation/);
  });

  test('parses the kit schemas', () => {
    for (const s of ['clarify', 'lean']) {
      const { value } = parseYaml(readFileSync(join(SCHEMAS, s, 'schema.yaml'), 'utf8'));
      assert.equal(value.name, s);
      assert.ok(Array.isArray(value.artifacts) && value.artifacts.length >= 4);
      assert.ok(value.apply.instruction.startsWith('Read context files'));
    }
  });
});

describe('yaml against the OpenSpec CLI', { skip: cliSkipReason() }, () => {
  test('artifact instructions read by the kit equal what the CLI serves', () => {
    const project = makeProject({ clarify: join(SCHEMAS, 'clarify') });
    openspecJson(project, ['new', 'change', 'c1', '--schema', 'clarify']);
    const { value } = parseYaml(readFileSync(join(SCHEMAS, 'clarify', 'schema.yaml'), 'utf8'));
    for (const a of value.artifacts) {
      const cli = openspecJson(project, ['instructions', a.id, '--change', 'c1']).instruction;
      assert.equal(a.instruction.trim(), cli.trim(), `instruction of ${a.id}`);
    }
  });
});

describe('markdown', () => {
  test('fence mask and comment stripping keep line numbers', () => {
    const lines = toLines('a\n```\n## not heading\n```\nb <!-- c\nd --> e\n<!-- x -->');
    const mask = fenceMask(lines);
    assert.deepEqual(mask, [false, true, true, true, false, false, false]);
    assert.deepEqual(stripComments(lines, mask), ['a', '```', '## not heading', '```', 'b ', ' e', '']);
  });

  test('tables', () => {
    const t = firstTable(['text', '| a | b |', '|---|:-:|', '| 1 | x \\| y |', '', '| no |'], 0, 6);
    assert.deepEqual(t.header, ['a', 'b']);
    assert.deepEqual(t.rows.map((r) => r.cells), [['1', 'x | y']]);
    assert.deepEqual(splitRow('|a||c|'), ['a', '', 'c']);
  });
});

describe('spec parser', () => {
  const delta = [
    '## Purpose',
    '',
    'Lets accountants take sales data out of the system as a spreadsheet.',
    '',
    '## ADDED Requirements',
    '',
    '### Requirement: Accountant exports sales',
    'The system SHALL let accountants download sales.',
    '',
    '#### Scenario: Successful export',
    '- **WHEN** an accountant exports',
    '- **THEN** a file is downloaded',
    '',
    '```markdown',
    '#### Scenario: Inside a fence',
    '```',
    '',
    '#### Edge case without keyword',
    '- **WHEN** x',
    '',
    '### Not a requirement header',
    '',
    '## MODIFIED Requirements',
    '',
    '### requirement:   Staff can record a sale  ',
    'The system SHALL allow it.',
    '',
    '#### Scenario:  Teacher   cannot record a sale',
    '- **THEN** 403',
    '',
    '## REMOVED Requirements',
    '',
    '### Requirement: Old thing',
    '**Reason**: gone',
    '',
    '## RENAMED Requirements',
    '',
    '- FROM: `### Requirement: A`',
    '- TO: `### Requirement: B`',
  ].join('\n');

  test('delta: requirements, scenarios, fences, skipped headers', () => {
    const d = parseDeltaSpec(delta);
    assert.equal(d.purpose.text, 'Lets accountants take sales data out of the system as a spreadsheet.');
    assert.equal(d.added.length, 1);
    const r = d.added[0];
    assert.equal(r.name, 'Accountant exports sales');
    assert.equal(r.text, 'The system SHALL let accountants download sales.');
    assert.deepEqual(r.scenarios.map((s) => [s.name, s.wellFormed]), [
      ['Successful export', true],
      ['Edge case without keyword', false],
    ]);
    assert.equal(r.scenarios[0].line, 10);
    assert.deepEqual(d.skipped.map((s) => s.header), ['Not a requirement header']);
    assert.equal(d.modified[0].name, 'Staff can record a sale');
    assert.equal(d.modified[0].scenarios[0].name, 'Teacher cannot record a sale');
    assert.deepEqual(d.removed.map((x) => x.name), ['Old thing']);
    assert.deepEqual(d.renamed.map((x) => [x.from, x.to]), [['A', 'B']]);
  });

  test('main spec', () => {
    const m = parseMainSpec(readFileSync(join(REPO, 'fixtures/projects/school-api/openspec/specs/inventory/student-sales/spec.md'), 'utf8'));
    assert.equal(m.requirements.length, 1);
    assert.deepEqual(m.requirements[0].scenarios.map((s) => s.name), ['Accountant records a sale', 'Teacher cannot record a sale']);
  });
});

describe('spec parser against the OpenSpec CLI', { skip: cliSkipReason() }, () => {
  test('requirement texts and scenario bodies match `openspec show --json`', () => {
    const project = makeProject();
    const dir = join(project, 'openspec', 'changes', 'c1', 'specs', 'demo', 'cap');
    openspecJson(project, ['new', 'change', 'c1']);
    const content = [
      '## ADDED Requirements',
      '',
      '### Requirement: One',
      'The system SHALL do one.',
      'Second line of text.',
      '',
      '#### Scenario: First',
      '- **WHEN** a',
      '- **THEN** b',
      '',
      '```',
      '#### Scenario: fenced',
      '```',
      '',
      '#### Scenario: Second',
      '- **WHEN** c',
      '- **THEN** d',
      '',
      '### Requirement: Two',
      '**ID**: meta',
      'The system MUST do two.',
      '',
      '#### Scenario: Third',
      '- **THEN** e',
    ].join('\n');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'spec.md'), content);
    // `show` refuses a change without proposal.md (fact J8)
    writeFileSync(join(project, 'openspec', 'changes', 'c1', 'proposal.md'), '## Why\nTest.\n\n## What Changes\n- test\n');
    const shown = openspecJson(project, ['show', 'c1', '--type', 'change']);
    const ours = parseDeltaSpec(content);
    const cliReqs = shown.deltas.flatMap((d) => d.requirements);
    assert.equal(ours.added.length, cliReqs.length);
    ours.added.forEach((r, k) => {
      assert.equal(r.text, cliReqs[k].text);
      assert.deepEqual(
        r.scenarios.filter((s) => s.body).map((s) => s.body),
        cliReqs[k].scenarios.map((s) => s.rawText.trim()),
      );
    });
  });
});

describe('clarifications parser', () => {
  const md = [
    '# Clarifications — x',
    '',
    'Depth: Standard',
    '',
    '## Sources',
    '',
    '- [desc] Developer description: "export"',
    '- [D1] Client mail — `sources/D1.md`',
    '',
    '## Main round',
    '',
    '### Q1. Who may export?',
    'For: PO/PM',
    'Why this is asked: permissions.',
    '- A. Accountants',
    '- B. Everyone',
    '- C. Not yet defined',
    '- X. Other (please specify)',
    '',
    '[Answer]: A',
    '',
    '### Q2. Which format?',
    'For: Dev',
    '- A. CSV',
    '- X. Other (please specify)',
    '',
    '[Answer]:',
    'xlsx please',
    '',
    '### Q3. Something (follow-up to Q1)',
    '[Answer]: ___',
    '',
    '<!-- ### Q9. commented out -->',
    '### Summary confirmation — Main round',
    '- bullets',
    '',
    '- Looks correct',
    '- Request changes',
    '',
    '[Answer]: Looks correct',
    '',
    '## Specs round',
    '',
    '### Q4. Edge?',
    '[Answer]: B — only paid',
  ].join('\n');

  test('structure and answers', () => {
    const p = parseClarifications(md);
    assert.equal(p.depth, 'Standard');
    assert.equal(p.sources.desc, true);
    assert.deepEqual([...p.sources.docs], ['D1']);
    assert.deepEqual(p.rounds.map((r) => r.name), ['Main', 'Specs']);
    assert.deepEqual([...p.questions.keys()], [1, 2, 3, 4]);
    assert.equal(p.questions.get(1).answer, 'A');
    assert.equal(p.questions.get(1).for, 'PO/PM');
    assert.deepEqual(p.questions.get(1).options.map((o) => o.key), ['A', 'B', 'C', 'X']);
    assert.equal(p.questions.get(2).answer, 'xlsx please');
    assert.deepEqual(p.questions.get(3).followUpOf, [1]);
    assert.equal(p.rounds[0].summary.answer, 'Looks correct');
    const main = roundStatus(p, 'Main');
    assert.deepEqual(main.unanswered.map((q) => q.n), [3]);
    assert.equal(main.confirmed, false);
    assert.equal(roundStatus(p, 'Design').exists, false);
  });

  test('answer helpers', () => {
    assert.deepEqual(answerLetters('A, C'), ['A', 'C']);
    assert.deepEqual(answerLetters('X — custom'), ['X']);
    assert.deepEqual(answerLetters('B (user accepted the recommendation)'), ['B']);
    assert.deepEqual(answerLetters('Accountants only'), []);
    assert.equal(isBlankAnswer('  '), true);
    assert.equal(isBlankAnswer('___'), true);
    assert.equal(isBlankAnswer('A'), false);
  });

  test('real dry-run output: 14 blank questions, no summary', () => {
    const p = parseClarifications(readFileSync(join(REPO, 'fixtures/dry-runs/phase1-add-sales-export/clarifications.md'), 'utf8'));
    assert.equal(p.questions.size, 14);
    assert.deepEqual(p.problems, []);
    const s = roundStatus(p, 'Main');
    assert.equal(s.unanswered.length, 14);
    assert.equal(s.round.summary, null);
    assert.ok([...p.questions.values()].every((q) => q.for && q.why));
  });
});
