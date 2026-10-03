// Planted-defect tests for the kit checks. Each case copies the good fixture project
// (fixtures/projects/checks-good + kit core), plants exactly one defect, and expects it to be caught.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkAnswers } from '../kit/core/openspec/tooling/checks/check-answers.mjs';
import { checkGrounding } from '../kit/core/openspec/tooling/checks/check-grounding.mjs';
import { checkSpecs } from '../kit/core/openspec/tooling/checks/check-specs.mjs';
import { checkTraceability, loadMarkers } from '../kit/core/openspec/tooling/checks/check-traceability.mjs';
import { checkVerification } from '../kit/core/openspec/tooling/checks/check-verification.mjs';
import { lintKit } from '../kit/core/openspec/tooling/checks/lint-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;

/** Fresh copy of the good project with the kit core installed. */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-checks-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  return root;
}

/** Replaces `from` with `to` in a project file; fails loudly if `from` is not there. */
function plant(root, file, from, to) {
  const p = join(root, file);
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(from), `fixture ${file} does not contain: ${from}`);
  writeFileSync(p, s.replace(from, to));
}

const errors = (r) => r.findings.filter((f) => f.level === 'error');
const warnings = (r) => r.findings.filter((f) => f.level === 'warning');
function assertCaught(report, pattern) {
  assert.equal(report.ok, false, `expected a failure, got: ${JSON.stringify(report.findings)}`);
  assert.ok(errors(report).some((f) => pattern.test(f.message)), `no error matching ${pattern}: ${JSON.stringify(errors(report).map((f) => f.message))}`);
}
const markersOf = (root) => loadMarkers(join(root, 'markers.json'));

const run = {
  answers: (root, extra = {}) => checkAnswers({ root, change: CHANGE, ...extra }),
  grounding: (root) => checkGrounding({ root, change: CHANGE }),
  specs: (root) => checkSpecs({ root, change: CHANGE }),
  trace: (root, markers = markersOf(root)) => checkTraceability({ root, change: CHANGE, markers }),
  verification: (root) => checkVerification({ root, change: CHANGE }),
  lint: (root) => lintKit({ root }),
};

describe('good fixture passes every check without findings', () => {
  for (const [name, fn] of Object.entries(run)) {
    test(name, () => {
      const r = fn(project());
      assert.equal(r.ok, true, JSON.stringify(r.findings));
      assert.deepEqual(r.findings, []);
    });
  }
});

// [description, check, plant(root), expected error pattern, extra options]
const CLAR = `${C}/clarifications.md`;
const DEFECTS = [
  // check-answers
  ['blank answer before proposal', 'answers', (r) => plant(r, CLAR, '[Answer]: A\n\n### Q3.', '[Answer]:\n\n### Q3.'), /Q2 is not answered/, { artifact: 'proposal' }],
  ['underscore answer', 'answers', (r) => plant(r, CLAR, '[Answer]: B\n\n### Q2.', '[Answer]: ___\n\n### Q2.'), /Q1 is not answered/],
  ['summary answered with a letter', 'answers', (r) => plantFirstSummary(r, 'A. Looks correct'), /answer "A. Looks correct" must be exactly "Looks correct"/],
  ['summary says Request changes', 'answers', (r) => plantFirstSummary(r, 'Request changes'), /says "Request changes"/],
  ['summary not confirmed', 'answers', (r) => plantFirstSummary(r, ''), /summary is not confirmed/],
  ['round missing although its artifact exists', 'answers', (r) => plant(r, CLAR, '## Specs round', '## Notes'), /"## Specs round" is missing/],
  ['design round unconfirmed while design.md exists', 'answers', (r) => plant(r, CLAR, '- Build the file with openpyxl in a service; no new dependency\n\nAssumptions I will make (not confirmed by an answer):\n- None.\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct', '- Build the file with openpyxl in a service; no new dependency\n\nAssumptions I will make (not confirmed by an answer):\n- None.\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]:'), /"Design" round summary is not confirmed/],
  ['duplicate question number', 'answers', (r) => plant(r, CLAR, '### Q4. What happens', '### Q2. What happens'), /Q2 is defined twice/],
  ['follow-up to a missing question', 'answers', (r) => plant(r, CLAR, '### Q4. What happens when the chosen period has no paid sales?', '### Q4. What happens when the chosen period has no paid sales? (follow-up to Q42)'), /follow-up to Q42, which does not exist/],
  ['requested changes without feedback', 'answers', (r) => plant(r, CLAR, '## Specs round\n', '### Requested changes — Main round #1\n\nWhat should change?\n\n[Answer]:\n\n## Specs round\n'), /requested changes #1 is not answered/],
  // check-grounding
  ['untagged paragraph', 'grounding', (r) => plant(r, `${C}/proposal.md`, '## What Changes\n', '## What Changes\n\nThis will also speed up month-end closing.\n'), /untagged statement/],
  ['unknown question tag', 'grounding', (r) => plant(r, `${C}/proposal.md`, 'may download it [Q1]', 'may download it [Q9]'), /\[Q9\] does not exist/],
  ['unregistered document tag', 'grounding', (r) => plant(r, `${C}/proposal.md`, 'endpoint and service [D1]', 'endpoint and service [D2]'), /\[D2\] is not registered/],
  ['assumption outside its section', 'grounding', (r) => plant(r, `${C}/design.md`, 'there is no export today [desc]', 'there is no export today [assumption]'), /\[assumption\] used outside/],
  ['assumption entry without tag', 'grounding', (r) => plant(r, `${C}/proposal.md`, '- The export period is filtered by the sale date [assumption]', '- The export period is filtered by the sale date'), /not tagged \[assumption\]/],
  ['assumptions section missing', 'grounding', (r) => plant(r, `${C}/design.md`, '## Assumptions & Open Questions\n\nNone.\n', ''), /Assumptions & Open Questions" section is missing/],
  ['tag from an unconfirmed round', 'grounding', (r) => { plant(r, `${C}/design.md`, 'fine for a synchronous response [Q2]', 'fine for a synchronous response [Q4]'); plantSpecsSummary(r, ''); }, /\[Q4\] belongs to the Specs round, which is not confirmed/],
  ['untagged table row', 'grounding', (r) => plant(r, `${C}/proposal.md`, '| `apps/inventory` | new export endpoint and service [D1] |', '| `apps/inventory` | new export endpoint and service [D1] |\n| `frontend` | new button |'), /untagged statement: "\| `frontend`/],
  // check-specs
  ['source tag inside a spec', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, 'as an Excel file.\n\n#### Scenario: Successful', 'as an Excel file [Q1].\n\n#### Scenario: Successful'), /"\[Q1\]" in spec text/],
  ['change-local requirement id inside a spec', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, '### Requirement: Staff can export paid sales', '### Requirement: FR1 Staff can export paid sales'), /"FR1" in spec text/],
  ['short Purpose of a new capability', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, 'Lets accountants and school administrators download paid sales of a period as an Excel file.', 'Sales export.'), /Purpose is 13 characters/],
  ['requirement text over 500 characters', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, 'of a chosen period as an Excel file.\n', `of a chosen period as an Excel file. ${'It also does more things. '.repeat(20)}\n`), /text is \d+ characters \(maximum 500\)/],
  ['scenario header without "Scenario:"', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, '#### Scenario: Empty period', '#### Empty period'), /is not "#### Scenario: <name>"/],
  ['duplicate scenario name in a delta', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, '#### Scenario: Empty period', '#### Scenario: Successful export'), /"Successful export" is already used/],
  ['scenario name taken by the main spec', 'specs', (r) => {
    plant(r, 'openspec/specs/inventory/student-sales/spec.md', '#### Scenario: Teacher cannot record a sale\n', '#### Scenario: Teacher cannot record a sale\n- **THEN** x\n\n### Requirement: Staff can list sales\nThe system SHALL list sales.\n\n#### Scenario: Listing sales\n');
    plant(r, `${C}/specs/inventory/student-sales/spec.md`, '## MODIFIED Requirements', '## ADDED Requirements\n\n### Requirement: Staff can filter sales\nThe system SHALL filter sales.\n\n#### Scenario: Listing sales\n- **THEN** y\n\n## MODIFIED Requirements');
  }, /"Listing sales" is already used by requirement "Staff can list sales" in the main spec/],
  ['### header that OpenSpec skips', 'specs', (r) => plant(r, `${C}/specs/inventory/sales-export/spec.md`, '#### Scenario: Teacher cannot export', '### Notes\n\n#### Scenario: Teacher cannot export'), /"### Notes" in "ADDED Requirements" is not a "### Requirement:" header/],
  // check-traceability
  ['scenario missing from the plan', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '| inventory/sales-export | Staff can export paid sales | Empty period | unit | no | no sales |\n', ''), /"Empty period" \(inventory\/sales-export\) is neither planned nor excluded/],
  ['stale plan row', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '| Empty period | unit |', '| Empty month | unit |'), /planned scenario "Empty month" .* is not in the change's delta specs/],
  ['unknown level', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '| Empty period | unit |', '| Empty period | integration |'), /level "integration"/],
  ['exclusion without reason', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '| behaviour unchanged, covered by test_record_sale |', '| — |'), /exclusion of "Accountant records a sale" has no reason/],
  ['wrong requirement for a scenario', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '| inventory/sales-export | Staff can export paid sales | Empty period |', '| inventory/sales-export | Staff can export sales | Empty period |'), /belongs to requirement "Staff can export paid sales"/],
  ['requirement without trace row', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '| inventory/student-sales | Staff can record a sale | [desc] |\n', ''), /requirement "Staff can record a sale" .* has no row in "Requirement trace"/],
  ['trace cites a missing question', 'trace', (r) => plant(r, `${C}/verification-plan.md`, '[Q1][Q2][Q4][D1]', '[Q1][Q99]'), /\[Q99\] does not exist/],
  ['planned e2e scenario without an e2e test', 'trace', (r) => {
    const m = JSON.parse(readFileSync(join(r, 'markers.json'), 'utf8')).filter((x) => x.level !== 'e2e');
    writeFileSync(join(r, 'markers.json'), JSON.stringify(m));
  }, /no e2e test carries the marker for "Successful export"/],
  ['unit test marker missing', 'trace', (r) => plant(r, 'markers.json', '"scenario": "Empty period"', '"scenario": "Empty  Period"'), /no unit test carries the marker for "Empty period"/],
  // check-verification
  ['Unverified verdict', 'verification', (r) => plant(r, `${C}/verification.md`, 'test_empty_period passed | Met |', 'test_empty_period not run | Unverified |'), /"Empty period" \(unit\) is Unverified/],
  ['Not Met verdict', 'verification', (r) => plant(r, `${C}/verification.md`, 'test_teacher_forbidden passed | Met |', 'test_teacher_forbidden failed | Not Met |'), /is Not Met/],
  ['missing matrix row', 'verification', (r) => plant(r, `${C}/verification.md`, '| inventory/sales-export | Successful export | e2e | file downloaded | file downloaded | e2e/export.spec.ts passed | Met |\n', ''), /planned "Successful export" \(inventory\/sales-export, e2e\) is missing/],
  ['Met without evidence', 'verification', (r) => plant(r, `${C}/verification.md`, '| tests/test_export.py::test_empty_period passed | Met |', '| — | Met |'), /Met without evidence/],
  ['invented verdict', 'verification', (r) => plant(r, `${C}/verification.md`, 'test_empty_period passed | Met |', 'test_empty_period passed | Passed |'), /verdict "Passed"/],
  ['verification.md missing', 'verification', (r) => rmSync(join(r, C, 'verification.md')), /verification\.md does not exist/],
  // lint-kit
  ['misspelled artifact field', 'lint', (r) => plant(r, 'openspec/schemas/clarify/schema.yaml', '    requires:\n      - clarifications\n', '    requries:\n      - clarifications\n'), /unknown field "requries" in artifact "proposal"/],
  ['schema name differs from its directory', 'lint', (r) => plant(r, 'openspec/schemas/lean/schema.yaml', 'name: lean', 'name: lean2'), /name "lean2" differs from the directory name "lean"/],
  ['unknown config key', 'lint', (r) => plant(r, 'openspec/config.yaml', 'schema: clarify\n', 'schema: clarify\nrule:\n  proposal:\n    - x\n'), /unknown field "rule" in config\.yaml/],
  ['rules for an unknown artifact', 'lint', (r) => plant(r, 'openspec/config.yaml', 'schema: clarify\n', 'schema: clarify\nrules:\n  proposals:\n    - keep it short\n'), /rules for unknown artifact "proposals"/],
  ['context over 50 KB', 'lint', (r) => plant(r, 'openspec/config.yaml', '  Backend: Python 3.13', `  ${'x'.repeat(52 * 1024)}\n  Backend: Python 3.13`), /OpenSpec drops the whole context above 50 KB/],
  ['missing template', 'lint', (r) => rmSync(join(r, 'openspec/schemas/clarify/templates/verification-plan.md')), /template "verification-plan\.md" not found/],
  ['change uses a schema that does not exist', 'lint', (r) => plant(r, `${C}/.openspec.yaml`, 'schema: clarify', 'schema: clarifyy'), /uses schema "clarifyy", which does not exist/],
  ['unknown operation', 'lint', (r) => plant(r, 'openspec/config.yaml', 'schema: clarify\n', 'schema: clarify\noperations:\n  verify:\n    guidance:\n      - x\n'), /unknown operation "verify"/],
  ['dependency cycle', 'lint', (r) => plant(r, 'openspec/schemas/lean/schema.yaml', '    requires: []\n', '    requires:\n      - tasks\n'), /dependency cycle/],
  ['broken YAML', 'lint', (r) => plant(r, 'openspec/config.yaml', 'schema: clarify\n', 'schema: clarify\nschema: lean\n'), /cannot parse YAML: duplicate key "schema"/],
];

function plantFirstSummary(root, answer) {
  plant(root, CLAR, '- The monthly email is out of scope [Q3]\n\nAssumptions I will make (not confirmed by an answer):\n- The export period is filtered by the sale date\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct', `- The monthly email is out of scope [Q3]\n\nAssumptions I will make (not confirmed by an answer):\n- The export period is filtered by the sale date\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: ${answer}`);
}
function plantSpecsSummary(root, answer) {
  plant(root, CLAR, '- An empty period gives a file with only the header row [Q4]\n\nAssumptions I will make (not confirmed by an answer):\n- None.\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct', `- An empty period gives a file with only the header row [Q4]\n\nAssumptions I will make (not confirmed by an answer):\n- None.\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: ${answer}`);
}

describe('every planted defect is caught', () => {
  for (const [name, check, doPlant, pattern, extra] of DEFECTS) {
    test(`${check}: ${name}`, () => {
      const root = project();
      doPlant(root);
      assertCaught(check === 'answers' ? run.answers(root, extra) : run[check](root), pattern);
    });
  }
});

describe('non-failing signals', () => {
  test('marker typo for a scenario of this change is reported as a warning', () => {
    const root = project();
    const m = JSON.parse(readFileSync(join(root, 'markers.json'), 'utf8'));
    m.push({ level: 'unit', capability: 'inventory/sales-export', scenario: 'Sucessful export', test: 't' });
    writeFileSync(join(root, 'markers.json'), JSON.stringify(m));
    const r = run.trace(root);
    assert.equal(r.ok, true);
    assert.ok(warnings(r).some((w) => /marks unknown scenario "Sucessful export"/.test(w.message)));
  });

  test('traceability without markers passes with a warning', () => {
    const r = run.trace(project(), null);
    assert.equal(r.ok, true);
    assert.ok(warnings(r).some((w) => /markers were not checked/.test(w.message)));
  });

  test('missing kit block in config context is a warning', () => {
    const root = project();
    plant(root, 'openspec/config.yaml', '  # >>> sdd-kit >>>', '  # sdd-kit');
    const r = run.lint(root);
    assert.equal(r.ok, true);
    assert.ok(warnings(r).some((w) => /no sdd-kit block/.test(w.message)));
  });

  test('changes on non-kit schemas are skipped (D11)', () => {
    const root = project();
    plant(root, `${C}/.openspec.yaml`, 'schema: clarify', 'schema: spec-driven');
    for (const fn of [run.answers, run.grounding, run.specs, run.trace, run.verification]) {
      const r = fn(root);
      assert.equal(r.ok, true);
      assert.equal(r.skipped, true);
    }
  });

  test('check-answers before a round has an artifact only checks format (CI mode)', () => {
    const root = project();
    rmSync(join(root, C, 'verification-plan.md'));
    plant(root, CLAR, '[Answer]: A\n\n### Summary confirmation — Verification round', '[Answer]:\n\n### Summary confirmation — Verification round');
    assert.equal(run.answers(root).ok, true);
    assertCaught(run.answers(root, { artifact: 'verification-plan' }), /Q5 is not answered/);
  });
});

describe('command line', () => {
  const TOOLING = join(REPO, 'kit', 'core', 'openspec', 'tooling', 'checks');
  const cli = (root, script, args) => {
    try {
      return { code: 0, out: execFileSync('node', [join(TOOLING, script), ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) {
      return { code: e.status, out: e.stdout, err: e.stderr };
    }
  };
  const scripts = [
    ['check-answers.mjs', ['--change', CHANGE]],
    ['check-grounding.mjs', ['--change', CHANGE]],
    ['check-specs.mjs', ['--change', CHANGE]],
    ['check-traceability.mjs', ['--change', CHANGE, '--markers', 'markers.json']],
    ['check-verification.mjs', ['--change', CHANGE]],
    ['lint-kit.mjs', []],
  ];
  for (const [script, args] of scripts) {
    test(`${script}: exit 0 and JSON on the good project`, () => {
      const root = project();
      const r = cli(root, script, [...args, '--json']);
      assert.equal(r.code, 0, r.out + r.err);
      const j = JSON.parse(r.out);
      assert.equal(j.ok, true);
      assert.ok(Array.isArray(j.findings));
      assert.match(cli(root, script, args).out, /: OK \(0 error\(s\), 0 warning\(s\)\)/);
    });
  }
  test('exit 1 with readable output on a defect', () => {
    const root = project();
    plantFirstSummary(root, '');
    const r = cli(root, 'check-answers.mjs', ['--change', CHANGE, '--artifact', 'proposal']);
    assert.equal(r.code, 1);
    assert.match(r.out, /ERROR openspec\/changes\/add-sales-export\/clarifications\.md:\d+: "Main" round summary is not confirmed/);
  });
  test('usage errors exit 1', () => {
    const root = project();
    assert.equal(cli(root, 'check-answers.mjs', []).code, 1);
    assert.equal(cli(root, 'check-answers.mjs', ['--change', 'nope']).code, 1);
    const j = cli(root, 'check-specs.mjs', ['--change', 'nope', '--json']);
    assert.equal(j.code, 1);
    assert.match(JSON.parse(j.out).error, /not found/);
  });
  test('--help', () => {
    assert.match(cli(project(), 'lint-kit.mjs', ['--help']).out, /Usage: lint-kit/);
  });
  test('finds the project root from a subdirectory', () => {
    const root = project();
    mkdirSync(join(root, 'apps', 'deep'), { recursive: true });
    const r = execFileSync('node', [join(TOOLING, 'check-specs.mjs'), '--change', CHANGE], { cwd: join(root, 'apps', 'deep'), encoding: 'utf8' });
    assert.match(r, /OK/);
  });
});
