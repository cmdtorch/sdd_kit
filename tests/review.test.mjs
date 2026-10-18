// Review input, test-review status, archive gate, installed agents/command.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { testReviewInput, testReviewProblems } from '../kit/openspec/tooling/lib/reviews.mjs';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;

function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-review-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'], { cwd: root });
  return root;
}
const read = (root, f) => readFileSync(join(root, f), 'utf8');

describe('review input on the good project', () => {
  test('lists every scenario with THEN clauses, planned levels and marked tests', () => {
    const root = project();
    const input = testReviewInput(root, join(root, C));
    const s = Object.fromEntries(input.scenarios.map((x) => [x.scenario, x]));
    assert.deepEqual(s['Successful export'].planned.sort(), ['integration', 'unit']);
    assert.deepEqual(s['Successful export'].tests, [{ file: 'tests/test_export.py', line: 5 }]);
    assert.deepEqual(s['Successful export'].then, ['the file contains exactly the two paid sales and their total']);
    assert.equal(s['Accountant records a sale'].excluded, true);
    assert.ok(input.scenarios.filter((x) => !x.excluded).every((x) => !x.missing));
  });

  test('a planned scenario without a marked test shows up as missing', () => {
    const root = project();
    writeFileSync(join(root, 'tests/test_export.py'), read(root, 'tests/test_export.py').replace('# @scenario inventory/sales-export :: Empty period\n', ''));
    const s = Object.fromEntries(testReviewInput(root, join(root, C)).scenarios.map((x) => [x.scenario, x]));
    assert.equal(s['Empty period'].missing, true);
    const cli = spawnSync('node', [join(root, 'openspec/tooling/bin/review-input.mjs'), '--change', CHANGE], { cwd: root, encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /- tests\/test_export\.py:5/);
    assert.match(cli.stdout, /Missing: planned as automated, but no test carries the marker/);
  });
});

describe('test review status (archive requirement)', () => {
  const dir = () => {
    const root = project();
    return { root, dir: join(root, C) };
  };
  test('READY passes; missing, verdict-less and undecided NOT-READY reviews fail; a human decision passes', () => {
    const { dir: d } = dir();
    assert.deepEqual(testReviewProblems(d), []);
    const f = join(d, 'reviews/test-review.md');
    const ready = readFileSync(f, 'utf8');
    writeFileSync(f, ready.replace('Verdict: READY', 'Verdict: NOT-READY'));
    assert.match(testReviewProblems(d)[0], /NOT-READY and "## Human decision" is empty/);
    writeFileSync(f, ready.replace('Verdict: READY', 'Verdict: NOT-READY').replace('<!-- not needed: READY -->', 'T1 accepted: header order is fixed by the template — Aysel (PO), 2026-10-03'));
    assert.deepEqual(testReviewProblems(d), []);
    writeFileSync(f, ready.replace('Verdict: READY', 'Verdict: probably fine'));
    assert.match(testReviewProblems(d)[0], /no "Verdict: READY" or "Verdict: NOT-READY" line/);
    rmSync(f);
    assert.match(testReviewProblems(d)[0], /no test review .* run the test-reviewer subagent/);
  });

  test('not required when nothing automated is planned', () => {
    const { root, dir: d } = dir();
    rmSync(join(d, 'reviews/test-review.md'));
    writeFileSync(join(d, 'verification-plan.md'), read(root, `${C}/verification-plan.md`).replace(/\| (unit|integration) \|/g, '| manual |'));
    assert.deepEqual(testReviewProblems(d), []);
  });

  const gate = (root, command = `openspec archive ${CHANGE}`) =>
    spawnSync('node', [join(root, 'openspec/tooling/hooks/archive-gate.mjs')], { cwd: root, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });

  test('the archive gate lets a finished change through', () => {
    const r = gate(project());
    assert.equal(r.status, 0, r.stderr);
  });

  test('the archive gate refuses a change without a test review', () => {
    const { root, dir: d } = dir();
    rmSync(join(d, 'reviews/test-review.md'));
    const r = gate(root);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no test review/);
  });

  test('the archive gate refuses open tasks and scenarios without a marked test', () => {
    const { root, dir: d } = dir();
    writeFileSync(join(d, 'tasks.md'), read(root, `${C}/tasks.md`).replace('- [x] 2.2', '- [ ] 2.2'));
    writeFileSync(join(root, 'tests/test_export.py'), read(root, 'tests/test_export.py').replace('# @scenario inventory/sales-export :: Empty period\n', ''));
    const r = gate(root);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /1 task\(s\) in tasks\.md are not done/);
    assert.match(r.stderr, /no test carries the marker for "Empty period"/);
  });

  test('the archive gate asks for a change name when kit changes exist', () => {
    const r = gate(project(), 'openspec archive --yes');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /name the change explicitly/);
  });
});

describe('installed agents and command', () => {
  test('install puts thin, valid subagents and /sdd:clarify into .claude/', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-agents-'));
    const r = await install({ target: root, skipOpenspec: true, yes: true, json: true });
    for (const rel of ['.claude/agents/spec-reviewer.md', '.claude/agents/test-reviewer.md', '.claude/commands/sdd/clarify.md']) {
      assert.ok(r.files.some((f) => f.rel === rel && f.op === 'create'), rel);
      const text = read(root, rel);
      const fm = parseYaml(text.split('---\n')[1]).value;
      assert.ok(fm.description && fm.description.length > 40, `${rel} description`);
      if (rel.includes('agents/')) {
        assert.equal(fm.name, rel.split('/').pop().replace('.md', ''));
        assert.deepEqual(fm.tools.split(/,\s*/), ['Read', 'Grep', 'Glob', 'Bash', 'Write']);
      }
      const body = text.split('---\n').slice(2).join('---\n');
      assert.ok(body.split('\n').length < 20, `${rel} stays thin`);
      const proto = body.match(/openspec\/protocols\/[\w-]+\.md/)[0];
      assert.ok(existsSync(join(root, proto)), `${rel} points to an installed protocol (${proto})`);
    }
  });
});
