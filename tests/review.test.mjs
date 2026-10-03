// Phase 8: weak-test heuristics, review input, test-review status, archive gate, installed agents/command.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { findPythonTest, findTsTest, pythonSignals, tsSignals } from '../kit/core/openspec/tooling/lib/test-smells.mjs';
import { testReviewInput, testReviewProblems } from '../kit/core/openspec/tooling/lib/reviews.mjs';
import { runVerification } from '../kit/core/openspec/tooling/lib/verify-run.mjs';
import { parseYaml } from '../kit/core/openspec/tooling/lib/yaml.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;

function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-review-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), 'fake-runs.log\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'], { cwd: root });
  return root;
}
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const py = (body, id = 'tests/t.py::test_x', then = 1) => pythonSignals(findPythonTest(body, id), then);

describe('weak-test heuristics (pytest)', () => {
  test('locates functions, methods, multi-line signatures and parametrized ids', () => {
    const src = 'import pytest\n\nclass TestA:\n    def test_m(\n        self, client,\n    ):\n        x = 1\n        assert x == 1\n\n@pytest.mark.parametrize("n", [1])\ndef test_p(n):\n    assert n == 1\n\ndef after():\n    pass\n';
    assert.equal(findPythonTest(src, 'tests/t.py::TestA::test_m').line, 4);
    assert.match(findPythonTest(src, 'tests/t.py::TestA::test_m').body, /assert x == 1/);
    const p = findPythonTest(src, 'tests/t.py::test_p[1]');
    assert.equal(p.line, 11);
    assert.doesNotMatch(p.body, /def after/);
    assert.match(p.decorators, /parametrize/);
    assert.equal(findPythonTest(src, 'tests/t.py::test_missing'), null);
  });

  const cases = [
    ['status only', 'def test_x(c):\n    r = c.get("/a")\n    assert r.status_code == 200\n', /only the status code is asserted/],
    ['truthiness only', 'def test_x(c):\n    r = c.get("/a")\n    assert r.json()\n    assert len(r.json()["items"])\n', /only truthiness is asserted/],
    ['mock only', 'def test_x(svc, mailer):\n    svc.run()\n    mailer.send.assert_called_once()\n', /only mock calls are asserted/],
    ['no assertion', 'def test_x(c):\n    c.get("/a")\n', /no assertion/],
    ['skipped', '@pytest.mark.skip(reason="later")\ndef test_x(c):\n    assert c.get("/a").json() == {}\n', /skipped or xfail/],
    ['fewer assertions than THEN clauses', 'def test_x(c):\n    assert c.get("/a").json() == {"a": 1}\n', /3 THEN\/AND clause\(s\), 1 assertion\(s\)/, 3],
  ];
  for (const [name, src, re, then = 1] of cases) {
    test(`flags: ${name}`, () => assert.ok(py(src, 'tests/t.py::test_x', then).some((s) => re.test(s)), JSON.stringify(py(src, 'tests/t.py::test_x', then))));
  }

  test('a strong test raises no signal', () => {
    assert.deepEqual(py('def test_x(c):\n    r = c.get("/a")\n    assert r.status_code == 403\n    assert r.json()["detail"] == "no"\n', 'tests/t.py::test_x', 2), []);
    assert.deepEqual(py('def test_x(c):\n    with pytest.raises(ValueError, match="bad"):\n        c.go()\n'), []);
  });
});

describe('weak-test heuristics (Playwright)', () => {
  const src = "import { test, expect } from '@playwright/test';\n\ntest('a', async ({ page }) => {\n  await page.goto('/');\n  expect(page).toBeTruthy();\n});\n\ntest('b', async ({ page }) => {\n  await expect(page.getByRole('row')).toHaveCount(3);\n  if (x) { y(); }\n});\n\ntest('c', async () => {\n  test.skip(true, 'later');\n});\n";
  test('locates by line and flags weak or skipped tests', () => {
    assert.match(tsSignals(findTsTest(src, 3)).join(), /only truthiness/);
    assert.deepEqual(tsSignals(findTsTest(src, 8)), []);
    assert.match(findTsTest(src, 8).body, /if \(x\) \{ y\(\); \}/, 'nested braces stay inside the body');
    assert.match(tsSignals(findTsTest(src, 13)).join(), /skipped/);
  });
});

describe('review input on the good project', () => {
  test('lists every scenario with THEN clauses, planned levels and located tests, without false signals', () => {
    const root = project();
    const input = testReviewInput(root, join(root, C));
    const s = Object.fromEntries(input.scenarios.map((x) => [x.scenario, x]));
    assert.deepEqual(s['Successful export'].planned.sort(), ['e2e', 'unit']);
    assert.deepEqual(s['Successful export'].tests.map((t) => [t.level, t.line]), [['unit', 6], ['e2e', 4]]);
    assert.ok(input.scenarios.every((x) => x.tests.every((t) => !t.signals.length)), JSON.stringify(input.scenarios.map((x) => x.tests)));
    assert.equal(s['Accountant records a sale'].excluded, true);
  });

  test('weak tests and missing tests show up', () => {
    const root = project();
    writeFileSync(join(root, 'tests/test_export.py'), read(root, 'tests/test_export.py').replace('    assert [row["total"] for row in response.json()["results"]] == ["100.00", "50.00"]\n', ''));
    const t = JSON.parse(read(root, 'fake-tests.json')).filter((x) => x.scenario !== 'Empty period');
    writeFileSync(join(root, 'fake-tests.json'), JSON.stringify(t));
    const s = Object.fromEntries(testReviewInput(root, join(root, C)).scenarios.map((x) => [x.scenario, x]));
    assert.deepEqual(s['Successful export'].tests.find((x) => x.level === 'unit').signals, ['only the status code is asserted']);
    assert.deepEqual(s['Empty period'].missing, ['unit']);
    const cli = spawnSync('node', [join(root, 'openspec/tooling/bin/review-input.mjs'), '--change', CHANGE], { cwd: root, encoding: 'utf8' });
    assert.match(cli.stdout, /signals: only the status code is asserted/);
    assert.match(cli.stdout, /Missing: unit \(planned, no marked test\)/);
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

  test('not required when nothing is planned at unit or e2e level', () => {
    const { root, dir: d } = dir();
    rmSync(join(d, 'reviews/test-review.md'));
    writeFileSync(join(d, 'verification-plan.md'), read(root, `${C}/verification-plan.md`).replace(/\| (unit|e2e) \|/g, '| manual |'));
    assert.deepEqual(testReviewProblems(d), []);
  });

  test('the archive gate refuses a change without a test review', () => {
    const { root, dir: d } = dir();
    rmSync(join(d, 'reviews/test-review.md'));
    runVerification({ root, change: CHANGE });
    const r = spawnSync('node', [join(root, 'openspec/tooling/hooks/archive-gate.mjs')], { cwd: root, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: `openspec archive ${CHANGE}` }, cwd: root }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no test review/);
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
