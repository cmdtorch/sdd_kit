// Test-case schemas (`clarify-ai-qa`, `clarify-qa`): the clarify rules and gates hold on them.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { cliSkipReason } from './helpers/openspec.mjs';
import * as projectLib from '../kit/openspec/tooling/lib/project.mjs';
import { changeLine } from '../kit/openspec/tooling/hooks/session-start.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sale-export';
const C = `openspec/changes/${CHANGE}`;
const FIXTURE = { 'clarify-ai-qa': 'ai-qa-good', 'clarify-qa': 'qa-good' };

/** Copies a fixture project and the kit's openspec/ into a temp dir. */
function project(schema) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-tc-'));
  cpSync(join(REPO, 'fixtures', 'projects', FIXTURE[schema]), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  return root;
}
function plant(root, file, from, to) {
  const p = join(root, file);
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(from), `fixture ${file} does not contain: ${from}`);
  writeFileSync(p, s.replace(from, to));
}
function hook(name, root, input) {
  const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'hooks', name)], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', hook_event_name: 'PreToolUse', ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const MAIN_CONFIRMED = '- The export period is filtered by the sale date\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct';
const unconfirmMain = (root) => plant(root, `${C}/clarifications.md`, MAIN_CONFIRMED, MAIN_CONFIRMED.replace('[Answer]: Looks correct', '[Answer]:'));
const archive = (root) => hook('archive-gate.mjs', root, { tool_name: 'Bash', tool_input: { command: `openspec archive ${CHANGE} --yes` } });

describe('clarify family helpers (D1)', () => {
  test('the clarify family and the test-case schemas', () => {
    const { isClarifyFamily, hasTestCases, KIT_SCHEMAS } = projectLib;
    assert.deepEqual(KIT_SCHEMAS.slice().sort(), ['clarify', 'clarify-ai-qa', 'clarify-qa', 'lean']);
    for (const s of ['clarify', 'clarify-ai-qa', 'clarify-qa']) assert.equal(isClarifyFamily(s), true, s);
    for (const s of ['lean', 'spec-driven', 'clarify-x', null]) assert.equal(isClarifyFamily(s), false, String(s));
    for (const s of ['clarify-ai-qa', 'clarify-qa']) assert.equal(hasTestCases(s), true, s);
    for (const s of ['clarify', 'lean', 'spec-driven', null]) assert.equal(hasTestCases(s), false, String(s));
  });
});

describe('fixture projects on the test-case schemas', () => {
  for (const schema of Object.keys(FIXTURE)) {
    test(`${schema}: the complete fixture change passes the archive gate`, () => {
      const root = project(schema);
      assert.match(readFileSync(join(root, C, '.openspec.yaml'), 'utf8'), new RegExp(`^schema: ${schema}$`, 'm'));
      const r = archive(root);
      assert.equal(r.code, 0, r.stderr);
    });
  }
});

describe('clarify rules hold in the test-case schemas', () => {
  // @scenario workflow/test-case-schemas :: Question gate applies
  test('clarify-ai-qa: writing the proposal is blocked while the Main round summary is unconfirmed', () => {
    const root = project('clarify-ai-qa');
    const write = () => hook('answers-gate.mjs', root, { tool_name: 'Write', tool_input: { file_path: join(root, C, 'proposal.md'), content: '## Why\n' } });
    assert.equal(write().code, 0, 'confirmed Main round must allow the write');
    unconfirmMain(root);
    const r = write();
    assert.equal(r.code, 2);
    assert.match(r.stderr, /proposal of change "add-sale-export" cannot be written yet — the Main round/);
    assert.match(r.stderr, /"Main" round summary is not confirmed/);
  });

  // @scenario test-cases/review :: Stage waits for the answer
  test('clarify-qa: a spec write during the stage says the Specs round was reopened by a follow-up', () => {
    const root = project('clarify-qa');
    const write = () => hook('answers-gate.mjs', root, { tool_name: 'Edit', tool_input: { file_path: join(root, C, 'specs/inventory/sale-export/spec.md') } });
    assert.equal(write().code, 0, 'confirmed Specs round must allow the write');
    plant(root, `${C}/clarifications.md`, 'Request changes\n\n[Answer]: Looks correct\n\n## Design round', 'Request changes\n\n[Answer]:\n\n## Design round');
    const r = write();
    assert.equal(r.code, 2);
    assert.match(r.stderr, /specs of change "add-sale-export" cannot be written yet — the Specs round/);
    assert.match(r.stderr, /test-cases stage reopened the Specs round with a follow-up question/);
  });

  // @scenario workflow/test-case-schemas :: Archive gate applies to scenarios
  test('clarify-qa: a unit scenario without a marked test blocks the archive and is named', () => {
    const root = project('clarify-qa');
    plant(root, 'tests/test_sale_export.py', '# @scenario inventory/sale-export :: Empty period\n', '');
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /change "add-sale-export" cannot be archived yet/);
    assert.match(r.stderr, /Empty period/);
  });

  test('clarify-ai-qa: the archive gate also runs check-answers', () => {
    const root = project('clarify-ai-qa');
    unconfirmMain(root);
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /check-answers: .*"Main" round summary is not confirmed/);
  });
});

describe('session start on the test-case schemas', () => {
  for (const schema of Object.keys(FIXTURE)) {
    test(`${schema}: the next artifact after the specs is test-cases, then design`, () => {
      const root = project(schema);
      for (const f of ['tasks.md', 'verification-plan.md', 'design.md', 'test-cases.md']) rmSync(join(root, C, f));
      assert.match(changeLine(root, CHANGE, schema), new RegExp(`^- ${CHANGE} \\[${schema}\\] — next artifact: test-cases$`));
      writeFileSync(join(root, C, 'test-cases.md'), '# Test Cases\n');
      assert.match(changeLine(root, CHANGE, schema), /next artifact: design$/);
    });
  }
});

// --- test-case document and its check (D3, D4) ------------------------------------------------------
const TC = `${C}/test-cases.md`;
const loadCheck = () => import('../kit/openspec/tooling/checks/check-test-cases.mjs');
const loadParser = () => import('../kit/openspec/tooling/lib/test-cases.mjs');
async function checkTC(root, extra = {}) {
  const { checkTestCases } = await loadCheck();
  return checkTestCases({ root, change: CHANGE, ...extra });
}
const tcErrors = (r) => r.findings.filter((f) => f.level === 'error');
const tcMessages = (r) => tcErrors(r).map((f) => f.message);
/** Removes the text from `from` (inclusive) up to `to` (exclusive) in a project file. */
function cut(root, file, from, to) {
  const p = join(root, file);
  const s = readFileSync(p, 'utf8');
  const a = s.indexOf(from);
  const b = s.indexOf(to, a + from.length);
  assert.ok(a !== -1 && b !== -1, `fixture ${file} does not contain ${from} … ${to}`);
  writeFileSync(p, s.slice(0, a) + s.slice(b));
}
function hasError(r, ...patterns) {
  const hit = tcErrors(r).some((f) => patterns.every((p) => p.test(f.message)));
  assert.ok(hit, `no error matching ${patterns.join(' + ')}: ${JSON.stringify(tcMessages(r))}`);
}

describe('test-case document: structure and coverage', () => {
  // @scenario test-cases/document :: Test cases are grouped by capability and scenario
  test('a clarify-qa change with two capabilities has one test-cases.md, a section per capability and per scenario, no error', async () => {
    const root = project('clarify-qa');
    const { parseTestCases } = await loadParser();
    const doc = parseTestCases(readFileSync(join(root, TC), 'utf8'));
    assert.deepEqual(doc.capabilities.map((c) => c.name), ['inventory/sale-export', 'inventory/sale-import']);
    assert.deepEqual(doc.capabilities[0].scenarios.map((s) => s.name), ['Successful export', 'Empty period', 'Totals are rounded', 'Teacher cannot export']);
    assert.deepEqual(doc.capabilities[1].scenarios.map((s) => s.name), ['Successful import', 'File with a wrong column is rejected']);
    assert.equal(doc.capabilities[0].scenarios[0].cases.length, 2);
    const r = await checkTC(root);
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(r.findings, []);
  });

  // @scenario test-cases/document :: Scenario without a test case is reported
  test('a delta-spec scenario with no test case is an error naming the capability and the scenario', async () => {
    const root = project('clarify-qa');
    cut(root, TC, '### Scenario: Successful export', '### Scenario: Empty period');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /inventory\/sale-export/, /"Successful export"/, /no test case/);
  });

  // @scenario test-cases/document :: Test case under an unknown scenario is reported
  test('a test case under a scenario no delta spec has is an error naming the case and the scenario', async () => {
    const root = project('clarify-qa');
    plant(root, TC, '### Scenario: Teacher cannot export', '### Scenario: Teacher cannot import');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /"Teacher gets 403"/, /unknown scenario "Teacher cannot import"/);
  });

  // @scenario test-cases/document :: Several cases for one scenario pass
  test('two test cases (0.005 and 0.015) under one scenario raise nothing for that scenario', async () => {
    const root = project('clarify-qa');
    const s = readFileSync(join(root, TC), 'utf8');
    assert.match(s, /### Scenario: Totals are rounded\n\n#### Case: Amount 0\.005 rounds up[\s\S]*#### Case: Amount 0\.015 rounds up/);
    const r = await checkTC(root);
    assert.equal(r.ok, true);
    assert.ok(!r.findings.some((f) => /Totals are rounded|0\.0[01]5/.test(f.message)), JSON.stringify(r.findings));
  });

  test('is skipped for a schema without test cases', async () => {
    const root = project('clarify-qa');
    plant(root, `${C}/.openspec.yaml`, 'schema: clarify-qa', 'schema: clarify');
    const r = await checkTC(root, { stage: true });
    assert.equal(r.skipped, true);
    assert.equal(r.ok, true);
  });

  test('a missing test-cases.md is an error', async () => {
    const root = project('clarify-ai-qa');
    rmSync(join(root, TC));
    const r = await checkTC(root);
    hasError(r, /test-cases\.md does not exist/);
  });
});

describe('test-case document: steps, names, labels', () => {
  // @scenario test-cases/document :: Test case without a Then is reported
  test('a case with Given and When but no Then is an error naming the case and the missing Then', async () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, '- **Then** the file has only the header row\n', '');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /"Export of an empty period"/, /no Then step/);
  });

  // @scenario test-cases/document :: Test case without a Given is reported
  test('a case with When and Then but no Given is an error naming the case and the missing Given', async () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, '- **Given** no sales in January 2020\n', '');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /"Export of an empty period"/, /no Given step/);
  });

  // @scenario test-cases/document :: Duplicate test case name is reported
  test('two cases with the same name in one capability are an error naming the capability and the name', async () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, '#### Case: Draft sale is left out', '#### Case: Export of an empty period');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /inventory\/sale-export/, /duplicate test case name "Export of an empty period"/);
  });

  // @scenario test-cases/document :: Same name in different capabilities is allowed
  test('the same case name in two capabilities is no duplicate', async () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, '#### Case: Teacher gets 403', '#### Case: Empty list');
    plant(root, TC, '#### Case: Import of a file with two rows', '#### Case: Empty list');
    const r = await checkTC(root);
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.ok(!r.findings.some((f) => /duplicate/i.test(f.message)));
  });

  // @scenario test-cases/document :: Several labels on one case
  test('a case labelled automated and e2e has no label error', async () => {
    const root = project('clarify-ai-qa');
    assert.match(readFileSync(join(root, TC), 'utf8'), /#### Case: Export of a month with two paid sales\nLabels: automated, e2e\n/);
    const { parseTestCases } = await loadParser();
    const doc = parseTestCases(readFileSync(join(root, TC), 'utf8'));
    assert.deepEqual(doc.capabilities[0].scenarios[0].cases[0].labels, ['automated', 'e2e']);
    const r = await checkTC(root);
    assert.equal(r.ok, true);
    assert.ok(!r.findings.some((f) => /Export of a month with two paid sales/.test(f.message)), JSON.stringify(r.findings));
  });

  // @scenario test-cases/document :: Missing label is reported
  test('a case without labels is an error naming the case and the allowed labels', async () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, '#### Case: Draft sale is left out\nLabels: automated\n', '#### Case: Draft sale is left out\n');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /"Draft sale is left out"/, /no verification label/, /automated, e2e, manual/);
  });

  // @scenario test-cases/document :: Unknown label is reported
  test('a case labelled unit is an error naming the case and the unknown label', async () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, '#### Case: Export button is hidden for a teacher\nLabels: e2e\n', '#### Case: Export button is hidden for a teacher\nLabels: unit\n');
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /"Export button is hidden for a teacher"/, /unknown label "unit"/);
  });
});

const OPEN_REMARK = '\n> **Remark** [open]: the file must also show the shop name\n> **Answer:** added the shop name to the Then step\n';
const ADD_REMARK_AFTER = '- **Then** the file has only the header row\n';
const CONFIRMED = '[Answer]: Looks correct';

describe('test-case document: remarks and stage result', () => {
  // @scenario test-cases/review :: Unknown status is reported
  test('a remark with the status fixed is an error naming the remark and the allowed statuses', async () => {
    const root = project('clarify-qa');
    plant(root, TC, ADD_REMARK_AFTER, ADD_REMARK_AFTER + OPEN_REMARK.replace('[open]', '[fixed]'));
    const r = await checkTC(root);
    assert.equal(r.ok, false);
    hasError(r, /the file must also show the shop name/, /unknown status "fixed"/, /open, closed, reopened/);
  });

  test('an unknown status counts as open for the stage', async () => {
    const root = project('clarify-qa');
    plant(root, TC, ADD_REMARK_AFTER, ADD_REMARK_AFTER + OPEN_REMARK.replace('[open]', '[fixed]'));
    const r = await checkTC(root, { stage: true });
    hasError(r, /1 remark is still open/);
  });

  // @scenario test-cases/review :: Developer confirms on QA's behalf
  test('the developer closing the last remark and entering Looks correct completes the stage', async () => {
    const root = project('clarify-qa');
    plant(root, TC, ADD_REMARK_AFTER, ADD_REMARK_AFTER + OPEN_REMARK);
    plant(root, TC, CONFIRMED, '[Answer]:');
    const before = await checkTC(root, { stage: true });
    assert.equal(before.ok, false);
    hasError(before, /1 remark is still open/);
    // the developer enters QA's decisions: closes the remark, confirms the result
    plant(root, TC, '> **Remark** [open]:', '> **Remark** [closed]:');
    plant(root, TC, '[Answer]:', CONFIRMED);
    const after = await checkTC(root, { stage: true });
    assert.equal(after.ok, true, JSON.stringify(after.findings));
  });

  test('remarks in the general section are parsed with their status', async () => {
    const root = project('clarify-qa');
    plant(root, TC, '## General remarks\n', '## General remarks\n\n> **Remark** [reopened]: no case covers an unavailable export service\n');
    const { parseTestCases } = await loadParser();
    const doc = parseTestCases(readFileSync(join(root, TC), 'utf8'));
    assert.deepEqual(doc.remarks.map((m) => [m.status, m.case]), [['reopened', null]]);
    const r = await checkTC(root, { stage: true });
    hasError(r, /1 remark is still open/);
  });
});

// --- gates for design and archive (D5) ----------------------------------------------------------------
const writeDesign = (root) => hook('answers-gate.mjs', root, { tool_name: 'Write', tool_input: { file_path: join(root, C, 'design.md'), content: '# Design\n' } });
const REVIEW = `${C}/reviews/test-cases-review.md`;
const NOT_READY_REVIEW = `# Test-case review — add-sale-export

Verdict: NOT-READY

| ID | Severity | Case | Scenario | Finding | Suggested fix |
|---|---|---|---|---|---|
| F1 | major | — | Successful export | No error case for export | add a case for a failing export |
| F2 | minor | Draft sale is left out | Successful export | Then could name the row count | say "no rows" |
`;
const ACCEPTED_NONE = 'Accepted findings:\n- (none)\n';

describe('the test-case check gates design.md (answers-gate as a process)', () => {
  // @scenario test-cases/document :: Design is blocked by a coverage error
  test('clarify-ai-qa: writing design.md is blocked while "Successful export" has no test case', () => {
    const root = project('clarify-ai-qa');
    cut(root, TC, '### Scenario: Successful export', '### Scenario: Empty period');
    const r = writeDesign(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /design of change "add-sale-export" cannot be written yet — the test-cases stage is not complete/);
    assert.match(r.stderr, /scenario "Successful export" \(inventory\/sale-export\) has no test case/);
  });

  // @scenario test-cases/review :: Design is blocked before confirmation
  test('clarify-ai-qa: writing design.md is blocked while the stage confirmation is blank', () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, CONFIRMED, '[Answer]:');
    const r = writeDesign(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /the test-cases stage is not confirmed yet/);
  });

  // @scenario test-cases/review :: Unlisted major finding blocks the design
  test('clarify-ai-qa: a NOT-READY major finding missing from "Stage result" blocks design.md and is named', () => {
    const root = project('clarify-ai-qa');
    writeFileSync(join(root, REVIEW), NOT_READY_REVIEW);
    const r = writeDesign(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /AI QA finding "No error case for export" \(major, F1\) is not listed in "Stage result"/);
    assert.doesNotMatch(r.stderr, /Then could name the row count/, 'a minor finding never blocks');
  });

  // @scenario test-cases/review :: Design is allowed after confirmation
  test('clarify-ai-qa: every major finding listed as accepted and "Looks correct" lets design.md be written', () => {
    const root = project('clarify-ai-qa');
    writeFileSync(join(root, REVIEW), NOT_READY_REVIEW);
    plant(root, TC, ACCEPTED_NONE, 'Accepted findings:\n- No error case for export — accepted: the export has no failure path in scope\n');
    const r = writeDesign(root);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stderr, '');
  });

  // @scenario test-cases/review :: Open remark blocks the design
  test('clarify-qa: one open remark blocks design.md', () => {
    const root = project('clarify-qa');
    plant(root, TC, ADD_REMARK_AFTER, ADD_REMARK_AFTER + OPEN_REMARK);
    const r = writeDesign(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /1 remark is still open or reopened/);
  });

  // @scenario test-cases/review :: Confirmation without a hand-over blocks the design
  test('clarify-qa: "Looks correct" without "Handed over to QA" blocks design.md', () => {
    const root = project('clarify-qa');
    plant(root, TC, 'Handed over to QA\n\n', '');
    const r = writeDesign(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /the test cases were not handed over to QA/);
  });

  // @scenario test-cases/review :: Confirmed result allows the design
  test('clarify-qa: hand-over, no open remark and "Looks correct" let design.md be written', () => {
    const root = project('clarify-qa');
    plant(root, TC, ADD_REMARK_AFTER, ADD_REMARK_AFTER + OPEN_REMARK.replace('[open]', '[closed]'));
    const r = writeDesign(root);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.stderr, '');
  });

  test('clarify: design.md is not gated by test cases', () => {
    const root = project('clarify-qa');
    plant(root, `${C}/.openspec.yaml`, 'schema: clarify-qa', 'schema: clarify');
    rmSync(join(root, TC));
    assert.equal(writeDesign(root).code, 0);
  });

  test('Bash: a redirect into design.md is gated too', () => {
    const root = project('clarify-qa');
    plant(root, TC, 'Handed over to QA\n\n', '');
    const r = hook('answers-gate.mjs', root, { tool_name: 'Bash', tool_input: { command: `echo x > ${C}/design.md` } });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /not handed over to QA/);
  });
});

describe('the test-case check gates the archive', () => {
  // @scenario test-cases/document :: Late scenario without a test case blocks the archive
  test('clarify-qa: a scenario added during implementation without a test case blocks the archive and is named', () => {
    const root = project('clarify-qa');
    const spec = `${C}/specs/inventory/sale-export/spec.md`;
    writeFileSync(join(root, spec), readFileSync(join(root, spec), 'utf8') + '\n#### Scenario: Cancelled sale is left out\n- **WHEN** an accountant exports a period with a cancelled sale\n- **THEN** the file has no row for the cancelled sale\n');
    plant(root, `${C}/verification-plan.md`, '| inventory/sale-export | Accountant exports paid sales | Teacher cannot export | unit | yes | teacher user |\n',
      '| inventory/sale-export | Accountant exports paid sales | Teacher cannot export | unit | yes | teacher user |\n| inventory/sale-export | Accountant exports paid sales | Cancelled sale is left out | manual | no | one cancelled sale |\n');
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /change "add-sale-export" cannot be archived yet/);
    assert.match(r.stderr, /check-test-cases: .*scenario "Cancelled sale is left out" \(inventory\/sale-export\) has no test case/);
    const problems = r.stderr.split('\n').filter((l) => /^ {2}- /.test(l));
    assert.equal(problems.length, 1, `only the test-case check should complain: ${r.stderr}`);
  });

  test('clarify-ai-qa: an unknown label blocks the archive', () => {
    const root = project('clarify-ai-qa');
    plant(root, TC, 'Labels: e2e\n', 'Labels: unit\n');
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /check-test-cases: .*unknown label "unit"/);
  });

  // @scenario test-cases/document :: Archive does not merge test cases
  test('clarify-qa: a real openspec archive keeps test-cases.md only in the archived change', { skip: cliSkipReason() }, () => {
    const root = project('clarify-qa');
    assert.equal(archive(root).code, 0, 'the fixture must pass the archive gate');
    execFileSync(process.env.OPENSPEC_BIN || 'openspec', ['archive', CHANGE, '--yes'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, XDG_CONFIG_HOME: join(root, '.xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    });
    assert.equal(existsSync(join(root, C)), false, 'the change left the active changes');
    const archived = readdirSync(join(root, 'openspec', 'changes', 'archive')).filter((n) => n.endsWith(`-${CHANGE}`));
    assert.equal(archived.length, 1);
    assert.match(readFileSync(join(root, 'openspec', 'changes', 'archive', archived[0], 'test-cases.md'), 'utf8'), /#### Case: Export of a month with two paid sales/);
    const specFiles = [];
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(d, e.name));
        else specFiles.push(join(d, e.name));
      }
    };
    walk(join(root, 'openspec', 'specs'));
    const merged = specFiles.filter((p) => p.endsWith('spec.md'));
    assert.equal(merged.length, 2, 'the delta specs were merged into main specs');
    for (const p of specFiles) {
      const s = readFileSync(p, 'utf8');
      assert.doesNotMatch(s, /#### Case:|Labels: |Export of a month with two paid sales|Stage result/, `${p} must not contain test cases`);
      assert.ok(!p.endsWith('test-cases.md'), `${p}`);
    }
  });
});

// ---- Case references and the verification plan (design D8, D9) ----
// `@C` stands for the case keyword, so this repository's own marker scan does not count these lines.
const ref = (s) => s.replaceAll('@C', '@case');
const loadTrace = () => import('../kit/openspec/tooling/checks/check-traceability.mjs');
const loadMarkers = () => import('../kit/openspec/tooling/lib/markers.mjs');
const PLAN = `${C}/verification-plan.md`;
const EXPORT_PY = 'tests/test_sale_export.py';
async function trace(root, { markers = true, change = CHANGE } = {}) {
  const { checkTraceability } = await loadTrace();
  const { collectMarkers, collectCaseRefs } = await loadMarkers();
  return checkTraceability({ root, change, markers: markers ? collectMarkers(root) : null, cases: markers ? collectCaseRefs(root) : null });
}
const warningsOf = (r) => r.findings.filter((f) => f.level === 'warning');
const mentioning = (list, text) => list.filter((f) => f.message.includes(text));

describe('verification plan covers every test case', () => {
  test('the complete fixtures have no traceability findings with markers checked', async () => {
    for (const schema of Object.keys(FIXTURE)) {
      const r = await trace(project(schema));
      assert.deepEqual(r.findings, [], schema);
    }
  });

  // @scenario test-cases/coverage :: Automated case without a level is reported
  test('an automated case listed with no level is an error naming the case and the required level', async () => {
    const root = project('clarify-ai-qa');
    plant(root, PLAN, '| Empty period | Export of an empty period | automated | unit |', '| Empty period | Export of an empty period | automated | — |');
    const r = await trace(root, { markers: false });
    const hits = mentioning(tcErrors(r), '"Export of an empty period"');
    assert.equal(hits.length, 1, JSON.stringify(tcMessages(r)));
    assert.match(hits[0].message, /level unit or integration/);
    assert.equal(hits[0].file, PLAN);
  });

  test('an automated case with an unknown level is an error; unit and integration together are accepted', async () => {
    const root = project('clarify-qa');
    plant(root, PLAN, '| Empty period | Export of an empty period | automated | unit |', '| Empty period | Export of an empty period | automated | e2e |');
    plant(root, PLAN, '| Draft sale is left out | automated | unit |', '| Draft sale is left out | automated | unit, integration |');
    const r = await trace(root, { markers: false });
    assert.match(mentioning(tcErrors(r), '"Export of an empty period"')[0]?.message ?? '', /level unit or integration/);
    assert.deepEqual(mentioning(r.findings, 'Draft sale is left out'), []);
  });

  // @scenario test-cases/coverage :: Test case missing from the plan is reported
  test('a test case the plan does not list is an error naming the capability and the case', async () => {
    const root = project('clarify-qa');
    plant(root, PLAN, '| inventory/sale-import | Successful import | Long file name is shown in full | manual | — |\n', '');
    const r = await trace(root, { markers: false });
    const hits = mentioning(tcErrors(r), '"Long file name is shown in full"');
    assert.equal(hits.length, 1, JSON.stringify(tcMessages(r)));
    assert.match(hits[0].message, /\(inventory\/sale-import\)/);
    assert.match(hits[0].message, /Test case coverage/);
  });

  test('a plan row naming no test case of the change is an error', async () => {
    const root = project('clarify-ai-qa');
    plant(root, PLAN, '| Teacher gets 403 | automated | unit |', '| Teacher gets 404 | automated | unit |');
    const r = await trace(root, { markers: false });
    assert.ok(mentioning(tcErrors(r), '"Teacher gets 404"').length, JSON.stringify(tcMessages(r)));
    assert.ok(mentioning(tcErrors(r), '"Teacher gets 403"').length, 'the real case is now unlisted');
  });

  test('a missing "Test case coverage" section is an error on a test-case schema', async () => {
    const root = project('clarify-ai-qa');
    plant(root, PLAN, '## Test case coverage', '## Something else');
    const r = await trace(root, { markers: false });
    assert.ok(tcMessages(r).some((m) => /"## Test case coverage" section is missing/.test(m)), JSON.stringify(tcMessages(r)));
  });

  // @scenario test-cases/coverage :: Manual case needs no level
  test('manual and e2e-only cases listed without a level have no level error', async () => {
    const root = project('clarify-ai-qa');
    plant(root, PLAN, '| Long file name is shown in full | manual | — |', '| Long file name is shown in full | manual |  |');
    const r = await trace(root, { markers: false });
    assert.deepEqual(mentioning(r.findings, 'Long file name is shown in full'), []);
    assert.deepEqual(mentioning(r.findings, 'Export button is hidden for a teacher'), []);
    assert.deepEqual(tcErrors(r), []);
  });
});

describe('case references in tests', () => {
  test('parseCaseRefs follows the scenario marker placement rules', async () => {
    const { parseCaseRefs, parseMarkers } = await loadMarkers();
    const text = ref([
      '# @C inventory/sale-export :: Export of an empty period',
      '  // @C inventory/sale-export :: Teacher gets 403',
      '/* @C inventory/sale-import :: Import of a file with two rows */',
      'const s = "@C inventory/sale-export :: Draft sale is left out";',
      'see @C without a separator',
    ].join('\n'));
    assert.deepEqual(parseCaseRefs(text), [
      { capability: 'inventory/sale-export', name: 'Export of an empty period', line: 1 },
      { capability: 'inventory/sale-export', name: 'Teacher gets 403', line: 2 },
      { capability: 'inventory/sale-import', name: 'Import of a file with two rows', line: 3 },
    ]);
    assert.deepEqual(parseMarkers(text), [], 'a case reference is not a scenario marker');
  });

  // @scenario test-cases/coverage :: Case reference is found
  test('a // case reference in a test file covers the case and the report names the file', async () => {
    const root = project('clarify-ai-qa');
    plant(root, EXPORT_PY, '# @case inventory/sale-export :: Export of an empty period\n', '');
    writeFileSync(join(root, 'tests', 'empty.test.js'), ref("// @C inventory/sale-export :: Export of an empty period\ntest('empty', () => {});\n"));
    const r = await trace(root);
    assert.deepEqual(mentioning(r.findings, 'Export of an empty period'), []);
    const entry = r.caseCoverage.find((c) => c.capability === 'inventory/sale-export' && c.case === 'Export of an empty period');
    assert.deepEqual(entry.files, ['tests/empty.test.js']);
  });

  // @scenario test-cases/coverage :: Reference inside a string is not counted
  test('a case reference inside a string after other code does not cover the case', async () => {
    const root = project('clarify-ai-qa');
    plant(root, EXPORT_PY, '# @case inventory/sale-export :: Export of an empty period\n', '');
    writeFileSync(join(root, 'tests', 'empty.test.js'), ref('const name = "@C inventory/sale-export :: Export of an empty period";\n'));
    const r = await trace(root);
    const hits = mentioning(tcErrors(r), '"Export of an empty period"');
    assert.equal(hits.length, 1, JSON.stringify(tcMessages(r)));
    assert.match(hits[0].message, /no test references the automated test case/);
    assert.deepEqual(r.caseCoverage.find((c) => c.case === 'Export of an empty period').files, []);
  });

  // @scenario test-cases/coverage :: Same case name in two active changes
  test('one reference covers the same case in two active changes', async () => {
    const root = project('clarify-qa');
    plant(root, `${C}/test-cases.md`, '#### Case: Export of an empty period', '#### Case: Empty list');
    plant(root, `${C}/verification-plan.md`, '| Export of an empty period |', '| Empty list |');
    plant(root, EXPORT_PY, '# @case inventory/sale-export :: Export of an empty period\n', ref('# @C inventory/sale-export :: Empty list\n'));
    cpSync(join(root, C), join(root, 'openspec', 'changes', 'add-sale-export-again'), { recursive: true });
    for (const change of [CHANGE, 'add-sale-export-again']) {
      const r = await trace(root, { change });
      assert.deepEqual(r.findings, [], change);
      assert.deepEqual(r.caseCoverage.find((c) => c.case === 'Empty list').files, [EXPORT_PY], change);
    }
  });

  // @scenario test-cases/coverage :: Reference to an archived case stays silent
  test('a reference to a case of an archived change gives no finding', async () => {
    const root = project('clarify-ai-qa');
    const archived = join(root, 'openspec', 'changes', 'archive', '2026-09-01-add-sale-list');
    cpSync(join(root, C), archived, { recursive: true });
    plant(root, `openspec/changes/archive/2026-09-01-add-sale-list/test-cases.md`, '#### Case: Draft sale is left out', '#### Case: Old list shows drafts greyed out');
    writeFileSync(join(root, 'tests', 'old.test.js'), ref('// @C inventory/sale-export :: Old list shows drafts greyed out\n'));
    const r = await trace(root);
    assert.deepEqual(r.findings, []);
  });

  // @scenario test-cases/coverage :: Reference with a typo is warned
  test('a reference to no active or archived case is a warning naming the reference', async () => {
    const root = project('clarify-ai-qa');
    writeFileSync(join(root, 'tests', 'typo.test.js'), ref('// @C inventory/sale-export :: Export of an emty period\n'));
    const r = await trace(root);
    assert.deepEqual(tcErrors(r), []);
    const hits = mentioning(warningsOf(r), '"Export of an emty period"');
    assert.equal(hits.length, 1, JSON.stringify(r.findings));
    assert.equal(hits[0].file, 'tests/typo.test.js');
    assert.equal(hits[0].line, 1);
  });

  // @scenario test-cases/document :: Renamed case loses its coverage
  test('a renamed automated case whose test keeps the old name is reported as without a test', async () => {
    const root = project('clarify-qa');
    plant(root, EXPORT_PY, '# @case inventory/sale-export :: Export of an empty period\n', ref('# @C inventory/sale-export :: Empty export\n'));
    const r = await trace(root);
    const hits = mentioning(tcErrors(r), '"Export of an empty period"');
    assert.equal(hits.length, 1, JSON.stringify(tcMessages(r)));
    assert.match(hits[0].message, /no test references the automated test case "Export of an empty period" \(inventory\/sale-export\)/);
    assert.equal(mentioning(warningsOf(r), '"Empty export"').length, 1, 'the stale reference is warned');
  });
});

describe('the archive needs a test for every automated case (archive-gate as a process)', () => {
  // @scenario test-cases/coverage :: Uncovered automated case blocks the archive
  test('clarify-ai-qa: an automated case without a reference blocks the archive, naming capability and case', () => {
    const root = project('clarify-ai-qa');
    plant(root, EXPORT_PY, '# @case inventory/sale-export :: Draft sale is left out\n', '');
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /check-traceability: .*no test references the automated test case "Draft sale is left out" \(inventory\/sale-export\)/);
  });

  // @scenario test-cases/coverage :: E2E-only case does not block the archive
  test('clarify-qa: an e2e-only case without a reference does not block the archive', () => {
    const root = project('clarify-qa');
    assert.doesNotMatch(readFileSync(join(root, EXPORT_PY), 'utf8'), /Export button is hidden for a teacher/);
    const r = archive(root);
    assert.equal(r.code, 0, r.stderr);
  });

  // @scenario test-cases/coverage :: Automated and e2e case needs its automated test
  test('clarify-qa: an automated and e2e case without a reference blocks the archive', () => {
    const root = project('clarify-qa');
    plant(root, EXPORT_PY, '# @case inventory/sale-export :: Export of a month with two paid sales\n', '');
    const r = archive(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /no test references the automated test case "Export of a month with two paid sales"/);
  });

  // @scenario test-cases/coverage :: Clarify change without test cases archives as before
  test('clarify: a change without test-cases.md archives, and case references are ignored', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-tc-clarify-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
    cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
    const change = 'add-sales-export';
    assert.equal(existsSync(join(root, 'openspec', 'changes', change, 'test-cases.md')), false);
    writeFileSync(join(root, 'tests', 'stray.test.js'), ref('// @C inventory/sales-export :: Nothing like this\n'));
    const { checkTraceability } = await loadTrace();
    const { collectMarkers, collectCaseRefs } = await loadMarkers();
    const r = checkTraceability({ root, change, markers: collectMarkers(root), cases: collectCaseRefs(root) });
    assert.deepEqual(r.findings, []);
    const gate = hook('archive-gate.mjs', root, { tool_name: 'Bash', tool_input: { command: `openspec archive ${change} --yes` } });
    assert.equal(gate.code, 0, gate.stderr);
  });
});
