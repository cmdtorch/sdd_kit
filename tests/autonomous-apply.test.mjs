// Autonomous apply (change autonomous-after-clarify): manual reasons, the implementation report, the kit version
// stamp and the archive gate under the new rules, the tasks warning, the start check, the command guard and the
// project tool list.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkTraceability } from '../kit/openspec/tooling/checks/check-traceability.mjs';
import { checkTestCases } from '../kit/openspec/tooling/checks/check-test-cases.mjs';
import { checkApplyReport } from '../kit/openspec/tooling/checks/check-apply-report.mjs';
import { handTasks } from '../kit/openspec/tooling/lib/markdown.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(REPO, 'kit', 'openspec', 'tooling', 'hooks');
const KIT_VERSION = JSON.parse(readFileSync(join(REPO, 'kit', 'openspec', 'tooling', 'kit.json'), 'utf8')).kitVersion;
const FIXTURES = { clarify: ['checks-good', 'add-sales-export'], 'clarify-ai-qa': ['ai-qa-good', 'add-sale-export'] };

/** Copy of a fixture project with the kit's openspec/; returns { root, change, C }. */
function project(schema = 'clarify', { stamped = true } = {}) {
  const [fixture, change] = FIXTURES[schema];
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-auto-'));
  cpSync(join(REPO, 'fixtures', 'projects', fixture), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  const C = `openspec/changes/${change}`;
  if (stamped) appendFileSync(join(root, C, '.openspec.yaml'), `x-sdd-kit: ${KIT_VERSION}\n`);
  return { root, change, C };
}
function plant(root, file, from, to) {
  const p = join(root, file);
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(from), `fixture ${file} does not contain: ${from}`);
  writeFileSync(p, s.replace(from, to));
}
/** Runs a hook like Claude Code does: JSON on stdin, CLAUDE_PROJECT_DIR set, cwd = project. */
function hook(name, root, input, env = {}) {
  const r = spawnSync('node', [join(HOOKS, name)], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const errors = (r) => r.findings.filter((f) => f.level === 'error');
const messages = (r) => errors(r).map((f) => f.message);

// --- 1. Manual reasons ----------------------------------------------------------------------------------

const PLAN_HEADER = '| Capability | Requirement | Scenario | Level | Critical | Test data / setup |\n|---|---|---|---|---|---|';
/** Adds the "Manual reason" column to the plan of checks-good and appends rows (7 cells each). */
function planRows(root, C, rows) {
  plant(root, `${C}/verification-plan.md`, PLAN_HEADER, `| Capability | Requirement | Scenario | Level | Critical | Test data / setup | Manual reason |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}`);
}
const EXPORT = 'inventory/sales-export | Staff can export paid sales';

describe('manual reasons in the verification plan (check-traceability)', () => {
  // @scenario workflow/manual-checks :: Manual row with a reason
  test('a manual row with a "cannot be automated:" reason is accepted', () => {
    const { root, change, C } = project();
    planRows(root, C, [`| ${EXPORT} | Empty period | manual | no | — | cannot be automated: a new developer judges whether the README is clear |`]);
    const r = checkTraceability({ root, change, markers: null });
    assert.deepEqual(messages(r), []);
  });

  test('a manual row without a reason is an error that names the scenario; a reason with another prefix too', () => {
    const { root, change, C } = project();
    planRows(root, C, [`| ${EXPORT} | Empty period | manual | no | — | — |`, `| ${EXPORT} | Teacher cannot export | manual | no | — | hard to test |`]);
    const r = checkTraceability({ root, change, markers: null });
    const found = errors(r).filter((f) => f.rule === 'manual-reason');
    assert.equal(found.length, 2, JSON.stringify(r.findings));
    assert.match(found[0].message, /manual row of "Empty period" \(inventory\/sales-export\) has no Manual reason/);
    assert.match(found[1].message, /Manual reason of "Teacher cannot export" .* must start with "cannot be automated:" or "dangerous:"/);
  });

  test('a manual row in a plan without the Manual reason column is an error', () => {
    const { root, change, C } = project();
    plant(root, `${C}/verification-plan.md`, '| Empty period | unit |', '| Empty period | manual |');
    const r = checkTraceability({ root, change, markers: null });
    assert.ok(messages(r).some((m) => /manual row of "Empty period" .* has no Manual reason/.test(m)), JSON.stringify(r.findings));
  });

  // @scenario workflow/manual-checks :: Lean change with a manual row
  test('a lean change gets the same error as a clarify change', () => {
    const clarify = project();
    const lean = project();
    plant(lean.root, `${lean.C}/.openspec.yaml`, 'schema: clarify', 'schema: lean');
    for (const p of [clarify, lean]) planRows(p.root, p.C, [`| ${EXPORT} | Empty period | manual | no | — | — |`]);
    const a = errors(checkTraceability({ root: clarify.root, change: clarify.change, markers: null })).filter((f) => f.rule === 'manual-reason');
    const b = errors(checkTraceability({ root: lean.root, change: lean.change, markers: null })).filter((f) => f.rule === 'manual-reason');
    assert.equal(a.length, 1);
    assert.deepEqual(b, a);
  });

  // @scenario workflow/manual-checks :: Dangerous scenario in the plan
  test('a dangerous scenario needs a unit or integration row (or an E2E test) next to its manual row', () => {
    const ok = project();
    planRows(ok.root, ok.C, [`| ${EXPORT} | Teacher cannot export | manual | yes | — | dangerous: money, many users |`]);
    assert.deepEqual(messages(checkTraceability({ root: ok.root, change: ok.change, markers: null })), []);

    const bad = project();
    plant(bad.root, `${bad.C}/verification-plan.md`, `| ${EXPORT} | Empty period | unit | no | no sales |\n`, '');
    planRows(bad.root, bad.C, [`| ${EXPORT} | Empty period | manual | yes | — | dangerous: money, many users |`]);
    const r = checkTraceability({ root: bad.root, change: bad.change, markers: null });
    const found = errors(r).filter((f) => f.rule === 'manual-reason');
    assert.equal(found.length, 1, JSON.stringify(r.findings));
    assert.match(found[0].message, /dangerous scenario "Empty period" \(inventory\/sales-export\) also needs a unit or integration row or an E2E test/);

    // an E2E test listed in e2e.md (clarify / lean) proves it too
    writeFileSync(join(bad.root, bad.C, 'e2e.md'), '# E2E Stage\n\nMode: real backend\nTests: e2e/\nStart: command `npm run serve`\n\n## Scenarios\n\n- inventory/sales-export :: Empty period\n');
    assert.deepEqual(errors(checkTraceability({ root: bad.root, change: bad.change, markers: null })).filter((f) => f.rule === 'manual-reason'), []);
  });

  test('a change without the kit version stamp keeps the old rules: no reason needed', () => {
    const { root, change, C } = project('clarify', { stamped: false });
    plant(root, `${C}/verification-plan.md`, '| Empty period | unit |', '| Empty period | manual |');
    assert.deepEqual(messages(checkTraceability({ root, change, markers: null })), []);
  });
});

describe('manual reasons gate the next artifact (answers-gate)', () => {
  const write = (root, file) => hook('answers-gate.mjs', root, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: file, content: '# Tasks\n' } });

  // @scenario workflow/manual-checks :: Manual row without a reason
  test('tasks.md cannot be written while a manual row has no reason', () => {
    const { root, C } = project();
    planRows(root, C, [`| ${EXPORT} | Empty period | manual | no | — | — |`]);
    const r = write(root, join(root, C, 'tasks.md'));
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /tasks of change "add-sales-export" cannot be written yet/);
    assert.match(r.stderr, /manual row of "Empty period" \(inventory\/sales-export\) has no Manual reason/);

    plant(root, `${C}/verification-plan.md`, '| manual | no | — | — |', '| manual | no | — | cannot be automated: a person judges the layout |');
    assert.equal(write(root, join(root, C, 'tasks.md')).code, 0);
  });

  // @scenario workflow/manual-checks :: Manual test case without a reason
  test('design.md cannot be written on clarify-ai-qa while a manual test case has no reason', () => {
    const { root, change, C } = project('clarify-ai-qa');
    const r = write(root, join(root, C, 'design.md'));
    assert.equal(r.code, 2, r.stderr);
    assert.match(r.stderr, /test case "Long file name is shown in full" \(inventory\/sale-import\) is labelled manual but has no "Manual reason:" line/);
    assert.ok(errors(checkTestCases({ root, change })).some((f) => f.rule === 'manual-reason'));

    plant(root, `${C}/test-cases.md`, 'Labels: manual\n', 'Labels: manual\nManual reason: cannot be automated: a person judges how the name wraps\n');
    assert.equal(write(root, join(root, C, 'design.md')).code, 0);
  });

  test('without the stamp the fixture design write passes as before', () => {
    const { root, C } = project('clarify-ai-qa', { stamped: false });
    assert.equal(write(root, join(root, C, 'design.md')).code, 0);
  });
});

// --- 2. Implementation report ----------------------------------------------------------------------------

const REPORT_EMPTY = '# Apply Report\n\n## Manual checks\n\nNone.\n\n## Not verified automatically\n\nNone.\n\n## Weakened tests\n\nNone.\n';
const README_CHECK = '### docs/readme :: README is clear\nReason: cannot be automated: a new developer judges whether the README is clear\nSteps: a developer who has not seen the project follows the README from a clean checkout\nExpected: the project runs without asking anyone\n';
const PAYOUT_CHECK = '### payments/payout :: Hourly payout to cards — required before release\nReason: dangerous: money, many users (payouts to every card above 1000 every hour)\nSteps: run the payout job on staging with three test cards\nExpected: each card above 1000 gets exactly one payout\n';
const LIVE_RELOAD = '### dev-environment :: Frontend change is picked up\nReason: tests were not run — Docker does not see the project folders\n';
const CONSENT = 'Consent: "skip live reload, QA will check it" (developer, 2026-10-28)\n';
/** apply-report.md with the given section bodies ('' = "None."). */
const reportOf = ({ manual = '', unverified = '', weakened = '' } = {}) =>
  `# Apply Report\n\n## Manual checks\n\n${manual || 'None.\n'}\n## Not verified automatically\n\n${unverified || 'None.\n'}\n## Weakened tests\n\n${weakened || 'None.\n'}`;
function withReport(content) {
  const p = project();
  writeFileSync(join(p.root, p.C, 'apply-report.md'), content);
  return { ...p, report: () => checkApplyReport({ root: p.root, change: p.change }) };
}

describe('apply-report.md (check-apply-report)', () => {
  // @scenario workflow/manual-checks :: Report after the tasks
  test('the report has the three sections; an empty one says "None."', () => {
    assert.deepEqual(withReport(REPORT_EMPTY).report().findings, []);
    const missing = withReport('# Apply Report\n\n## Manual checks\n\nNone.\n\n## Weakened tests\n\nNone.\n').report();
    assert.ok(messages(missing).some((m) => /section "## Not verified automatically" is missing/.test(m)), JSON.stringify(missing.findings));
    const blank = withReport('# Apply Report\n\n## Manual checks\n\n## Not verified automatically\n\nNone.\n\n## Weakened tests\n\nNone.\n').report();
    assert.ok(messages(blank).some((m) => /"## Manual checks" is empty; write "None\."/.test(m)), JSON.stringify(blank.findings));
    const absent = project();
    assert.ok(messages(checkApplyReport({ root: absent.root, change: absent.change })).some((m) => /apply-report\.md does not exist/.test(m)));
  });

  // @scenario workflow/manual-checks :: Manual check entry
  test('a manual check names its scenario, steps, expected outcome and reason', () => {
    const r = withReport(reportOf({ manual: README_CHECK })).report();
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.entries.manual.map((e) => [e.capability, e.name, e.reason]), [['docs/readme', 'README is clear', 'cannot be automated: a new developer judges whether the README is clear']]);
    const bad = withReport(reportOf({ manual: README_CHECK.replace(/Steps: .*\n/, '').replace(/Reason: .*\n/, '') })).report();
    assert.ok(messages(bad).some((m) => /"README is clear" \(docs\/readme\) under "Manual checks" has no "Steps:" line/.test(m)), JSON.stringify(bad.findings));
    assert.ok(messages(bad).some((m) => /"README is clear" \(docs\/readme\) under "Manual checks" has no "Reason:" line/.test(m)));
  });

  // @scenario workflow/manual-checks :: Check that could not run
  test('a check that could not run is listed with "tests were not run" and the cause; without consent it is reported', () => {
    const r = withReport(reportOf({ unverified: LIVE_RELOAD })).report();
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.equal(r.entries.unverified[0].reason, 'tests were not run — Docker does not see the project folders');
    assert.deepEqual(r.unconsented, ['dev-environment :: Frontend change is picked up']);
    assert.ok(r.findings.some((f) => f.level === 'warning' && /"Frontend change is picked up" .* has no "Consent:" line/.test(f.message)));
    const noReason = withReport(reportOf({ unverified: LIVE_RELOAD.replace(/Reason: .*\n/, '') })).report();
    assert.ok(messages(noReason).some((m) => /"Frontend change is picked up" .* under "Not verified automatically" has no "Reason:" line/.test(m)), JSON.stringify(noReason.findings));
    const agreed = withReport(reportOf({ unverified: LIVE_RELOAD + CONSENT })).report();
    assert.deepEqual(agreed.unconsented, []);
    assert.deepEqual(agreed.findings, []);
  });

  // @scenario workflow/manual-checks :: Two manual checks, one dangerous
  test('dangerous checks come first, marked "required before release"', () => {
    assert.deepEqual(withReport(reportOf({ manual: `${PAYOUT_CHECK}\n${README_CHECK}` })).report().findings, []);
    const late = withReport(reportOf({ manual: `${README_CHECK}\n${PAYOUT_CHECK}` })).report();
    assert.ok(messages(late).some((m) => /dangerous check "Hourly payout to cards" \(payments\/payout\) must come before the other manual checks/.test(m)), JSON.stringify(late.findings));
    const unmarked = withReport(reportOf({ manual: PAYOUT_CHECK.replace(' — required before release', '') })).report();
    assert.ok(messages(unmarked).some((m) => /dangerous check "Hourly payout to cards" \(payments\/payout\) is not marked "required before release"/.test(m)));
  });

  // @scenario workflow/autonomous-apply :: Relaxed assertion with consent
  test('a relaxed assertion is listed with the change, the reason and the consent', () => {
    const entry = '### tests/export.test.mjs :: Export of an empty period\nChange: assertion `rows.length === 1` relaxed to `rows.length <= 1`\nReason: the CSV library adds an empty line on some platforms\nConsent: "ok, relax it" (developer, 2026-10-28)\n';
    const r = withReport(reportOf({ weakened: entry })).report();
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.entries.weakened.map((e) => [e.name, e.change, e.consent]), [['Export of an empty period', 'assertion `rows.length === 1` relaxed to `rows.length <= 1`', '"ok, relax it" (developer, 2026-10-28)']]);
    const without = withReport(reportOf({ weakened: entry.replace(/Consent: .*\n/, '') })).report();
    assert.ok(messages(without).some((m) => /weakened "Export of an empty period" .* has no "Consent:" line/.test(m)), JSON.stringify(without.findings));
  });

  // @scenario workflow/autonomous-apply :: Switched-off quality rule with consent
  test('a switched-off lint rule is listed with the rule, the file, the reason and the consent', () => {
    const entry = '### src/legacy/parser.ts :: lint rule no-explicit-any\nChange: rule switched off for this file\nReason: generated types from the old API\nConsent: "yes, only for that file" (developer, 2026-10-28)\n';
    const r = withReport(reportOf({ weakened: entry })).report();
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.entries.weakened.map((e) => [e.capability, e.name, e.reason]), [['src/legacy/parser.ts', 'lint rule no-explicit-any', 'generated types from the old API']]);
    const noReason = withReport(reportOf({ weakened: entry.replace(/Reason: .*\n/, '') })).report();
    assert.ok(messages(noReason).some((m) => /weakened "lint rule no-explicit-any" .* has no "Reason:" line/.test(m)));
  });
});

test('artifact-feedback runs check-apply-report after apply-report.md is written', () => {
  const { root, C } = withReport(reportOf({ manual: README_CHECK.replace(/Expected: .*\n/, '') }));
  const r = hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, C, 'apply-report.md'), content: '' } });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /check-apply-report found 1 problem\(s\) after writing apply-report\.md/);
  assert.match(r.stdout, /has no \\"Expected:\\" line/);
});

// --- 3. Kit version stamp and the archive gate ------------------------------------------------------------

const archive = (root, change) => hook('archive-gate.mjs', root, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `openspec archive ${change} --yes` } });
const LONG_NAME = '### inventory/sale-import :: Long file name is shown in full\nReason: cannot be automated: a person judges how the name wraps\nSteps: upload "sales-of-the-whole-spring-term-2026-for-all-classes.xlsx"\nExpected: the whole name is shown on two lines\n';
const e2eEntry = (name, reason, consent = true) => `### inventory/sale-export :: ${name}\nReason: ${reason}\n${consent ? 'Consent: "switch E2E off, QA checks the screens" (developer, 2026-10-28)\n' : ''}`;
/** Stamped clarify-ai-qa fixture that passes the archive gate: E2E skipped, both e2e cases agreed in the report. */
function readyAiQa(reason = 'E2E switched off') {
  const p = project('clarify-ai-qa');
  plant(p.root, `${p.C}/test-cases.md`, 'Labels: manual\n', 'Labels: manual\nManual reason: cannot be automated: a person judges how the name wraps\n');
  writeFileSync(join(p.root, p.C, 'apply-report.md'), reportOf({ manual: LONG_NAME, unverified: [e2eEntry('Export of a month with two paid sales', reason), e2eEntry('Export button is hidden for a teacher', reason)].join('\n') }));
  return p;
}

describe('kit version stamp (artifact-feedback)', () => {
  const post = (root, file) => hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: file, content: '' } });

  // @scenario workflow/manual-checks :: New change during apply
  test('the first artifact of a change stamps the kit version; an existing stamp is kept; the new rules apply', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-stamp-'));
    cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
    const dir = join(root, 'openspec', 'changes', 'add-payouts');
    cpSync(join(REPO, 'fixtures', 'projects', 'checks-good', 'openspec', 'changes', 'add-sales-export', '.openspec.yaml'), join(dir, '.openspec.yaml'));
    writeFileSync(join(dir, 'clarifications.md'), '# Clarifications\n');
    assert.equal(post(root, join(dir, 'clarifications.md')).code, 0);
    const meta = readFileSync(join(dir, '.openspec.yaml'), 'utf8');
    assert.equal(meta, `schema: clarify\ncreated: 2026-10-03\nx-sdd-kit: ${KIT_VERSION}\n`);

    writeFileSync(join(dir, '.openspec.yaml'), 'schema: clarify\ncreated: 2026-10-03\nx-sdd-kit: 0.4.0\n');
    post(root, join(dir, 'clarifications.md'));
    assert.match(readFileSync(join(dir, '.openspec.yaml'), 'utf8'), /^x-sdd-kit: 0\.4\.0$/m);

    // apply is still running: no apply-report.md yet, and the archive already asks for it
    const r = archive(root, 'add-payouts');
    assert.equal(r.code, 2);
    assert.match(r.stderr, /apply-report\.md does not exist/);
  });

  test('a change that already has other artifacts is not stamped (it started under the old rules)', () => {
    const { root, C } = project('clarify', { stamped: false });
    assert.equal(post(root, join(root, C, 'tasks.md')).code, 0);
    assert.doesNotMatch(readFileSync(join(root, C, '.openspec.yaml'), 'utf8'), /x-sdd-kit/);
  });
});

describe('archive gate under the new rules', () => {
  test('the stamped fixtures pass the archive gate when the report is complete', () => {
    const plain = project();
    writeFileSync(join(plain.root, plain.C, 'apply-report.md'), REPORT_EMPTY);
    assert.equal(archive(plain.root, plain.change).code, 0, archive(plain.root, plain.change).stderr);
    const aiqa = readyAiQa();
    const r = archive(aiqa.root, aiqa.change);
    assert.equal(r.code, 0, r.stderr);
  });

  // @scenario workflow/manual-checks :: Unverified case with consent
  test('an automated case without a test counts as covered when it is agreed under "Not verified automatically"', () => {
    const { root, change, C } = readyAiQa();
    plant(root, 'tests/test_sale_export.py', '# @case inventory/sale-export :: Export of an empty period\n', '');
    plant(root, 'tests/test_sale_export.py', '# @scenario inventory/sale-export :: Empty period\n', '');
    plant(root, `${C}/apply-report.md`, '## Weakened tests', `### inventory/sale-export :: Export of an empty period\nReason: tests were not run — the test database does not start\nConsent: "skip it, QA checks it" (developer, 2026-10-28)\n\n### inventory/sale-export :: Empty period\nReason: tests were not run — the test database does not start\nConsent: "skip it, QA checks it" (developer, 2026-10-28)\n\n## Weakened tests`);
    const r = archive(root, change);
    assert.equal(r.code, 0, r.stderr);
  });

  // @scenario workflow/manual-checks :: Unverified case without consent
  test('without the consent the case still misses its test and the archive is blocked', () => {
    const { root, change, C } = readyAiQa();
    plant(root, 'tests/test_sale_export.py', '# @case inventory/sale-export :: Export of an empty period\n', '');
    plant(root, `${C}/apply-report.md`, '## Weakened tests', '### inventory/sale-export :: Export of an empty period\nReason: tests were not run — the test database does not start\n\n## Weakened tests');
    const r = archive(root, change);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /no test references the automated test case "Export of an empty period"/);
    assert.match(r.stderr, /"Export of an empty period" \(inventory\/sale-export\) under "Not verified automatically" has no "Consent:" line/);
  });

  // @scenario workflow/manual-checks :: Plan with manual rows
  test('manual rows are no tasks and do not block the archive', () => {
    const { root, change, C } = project();
    planRows(root, C, [
      `| ${EXPORT} | Successful export | manual | yes | — | dangerous: money, many users |`,
      `| ${EXPORT} | Empty period | manual | no | — | cannot be automated: a person reads the exported file |`,
      `| inventory/student-sales | Staff can record a sale | Teacher cannot record a sale | manual | no | — | cannot be automated: a person judges the message |`,
    ]);
    const entry = (cap, name, reason, mark = '') => `### ${cap} :: ${name}${mark}\nReason: ${reason}\nSteps: follow the scenario\nExpected: the scenario outcome\n`;
    writeFileSync(join(root, C, 'apply-report.md'), reportOf({ manual: [
      entry('inventory/sales-export', 'Successful export', 'dangerous: money, many users', ' — required before release'),
      entry('inventory/sales-export', 'Empty period', 'cannot be automated: a person reads the exported file'),
      entry('inventory/student-sales', 'Teacher cannot record a sale', 'cannot be automated: a person judges the message'),
    ].join('\n') }));
    assert.doesNotMatch(readFileSync(join(root, C, 'tasks.md'), 'utf8'), /by hand|manually/i);
    const r = archive(root, change);
    assert.equal(r.code, 0, r.stderr);

    // a manual check missing from the report is reported
    plant(root, `${C}/apply-report.md`, entry('inventory/sales-export', 'Empty period', 'cannot be automated: a person reads the exported file'), '');
    const missing = archive(root, change);
    assert.equal(missing.code, 2);
    assert.match(missing.stderr, /manual check "Empty period" \(inventory\/sales-export\) is not under "Manual checks" in apply-report\.md/);
  });

  // @scenario workflow/manual-checks :: Old change with open manual tasks
  test('an unstamped change with an open "verify by hand" task stays blocked and is not asked for apply-report.md', () => {
    const { root, change, C } = project('clarify', { stamped: false });
    appendFileSync(join(root, C, 'tasks.md'), '\n## 3. Manual\n\n- [ ] 3.1 Verify by hand that the export opens in Excel\n');
    const r = archive(root, change);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /1 task\(s\) in tasks\.md are not done/);
    assert.doesNotMatch(r.stderr, /apply-report/);
  });
});

describe('archive gate after a failed start check', () => {
  // @scenario workflow/environment-check :: Developer switches off E2E
  test('E2E switched off: every e2e case is agreed under "Not verified automatically", otherwise the archive is blocked', () => {
    const ok = readyAiQa('E2E switched off');
    assert.equal(archive(ok.root, ok.change).code, 0);
    assert.match(readFileSync(join(ok.root, ok.C, 'e2e.md'), 'utf8'), /^Mode: skipped$/m);
    const bad = readyAiQa('E2E switched off');
    plant(bad.root, `${bad.C}/apply-report.md`, e2eEntry('Export button is hidden for a teacher', 'E2E switched off'), '');
    const r = archive(bad.root, bad.change);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /E2E is skipped: the e2e case "Export button is hidden for a teacher" \(inventory\/sale-export\) is not agreed under "Not verified automatically"/);
  });

  // @scenario workflow/environment-check :: Developer skips E2E deliberately
  test('E2E skipped deliberately: the cases carry "tests were not run" with the cause and a consent', () => {
    const reason = 'tests were not run — the published ports are refused';
    const ok = readyAiQa(reason);
    assert.equal(archive(ok.root, ok.change).code, 0);
    const bad = readyAiQa(reason);
    plant(bad.root, `${bad.C}/apply-report.md`, e2eEntry('Export button is hidden for a teacher', reason), e2eEntry('Export button is hidden for a teacher', reason, false));
    const r = archive(bad.root, bad.change);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /"Export button is hidden for a teacher" \(inventory\/sale-export\) under "Not verified automatically" has no "Consent:" line/);
  });

  // @scenario workflow/environment-check :: Developer skips the integration checks
  test('integration checks skipped: agreed entries cover the missing tests; the start-check record is required', () => {
    const { root, change, C } = project();
    plant(root, `${C}/verification-plan.md`, '| Teacher cannot record a sale | unit |', '| Teacher cannot record a sale | integration |');
    plant(root, `${C}/verification-plan.md`, '- PostgreSQL test database.', '- PostgreSQL test database.\n- Running application: yes (integration checks through the stack)');
    plant(root, 'tests/test_sales.py', '# @scenario inventory/student-sales :: Teacher cannot record a sale\n', '');
    writeFileSync(join(root, C, 'apply-report.md'), reportOf({ unverified: '### inventory/student-sales :: Teacher cannot record a sale\nReason: tests were not run — the stack ports are refused\nConsent: "skip the integration checks" (developer, 2026-10-28)\n' }));
    const noRecord = archive(root, change);
    assert.equal(noRecord.code, 2);
    assert.match(noRecord.stderr, /the plan needs a running application but there is no start-check\.json/);
    assert.doesNotMatch(noRecord.stderr, /no test carries the marker/);
    writeFileSync(join(root, C, 'start-check.json'), JSON.stringify({ ok: false, url: 'http://localhost:8080/health', start: 'docker compose up -d', at: '2026-10-28T10:00:00Z', status: null, error: 'connection refused' }));
    const r = archive(root, change);
    assert.equal(r.code, 0, r.stderr);
  });
});

// --- 4. Tasks check ---------------------------------------------------------------------------------------

describe('tasks that ask a human to check by hand', () => {
  // @scenario workflow/autonomous-apply :: No task for the developer in the task list
  test('a "verify by hand" task gets a warning after tasks.md is written (stamped changes)', () => {
    assert.deepEqual(handTasks('- [ ] 1.1 Write the tests\n- [ ] 4.3 Verify by hand that the page reloads\n- [ ] 4.4 Manually check the port\n- [ ] 4.5 Add a manual-reason column\n').map((t) => t.line), [2, 3]);
    const { root, C } = project();
    appendFileSync(join(root, C, 'tasks.md'), '\n- [ ] 3.1 Verify by hand that the export opens in Excel\n');
    const r = hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: join(root, C, 'tasks.md'), old_string: 'a', new_string: 'b' } });
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout, /tasks\.md:\d+: task asks a human to check by hand: \\"3\.1 Verify by hand that the export opens in Excel\\"/);
    assert.match(r.stdout, /apply-report\.md/);
  });
});

// --- 5. Start check ---------------------------------------------------------------------------------------

const START_CHECK = join(REPO, 'kit', 'openspec', 'tooling', 'bin', 'start-check.mjs');
/** A port that is free right now. */
async function freePort() {
  const { createServer } = await import('node:net');
  return new Promise((done) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => done(port));
    });
  });
}
/** Start command of a tiny HTTP server that answers every request with `status`. */
const serverCommand = (port, status) => `node -e "require('http').createServer((q,s)=>{s.statusCode=${status};s.end('x')}).listen(${port},'127.0.0.1')"`;
async function startCheck(root, change, args) {
  const { spawn } = await import('node:child_process');
  return new Promise((done) => {
    const p = spawn('node', [START_CHECK, '--change', change, ...args], { cwd: root, env: { ...process.env } });
    let stdout = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stdout += d));
    p.on('close', (code) => done({ code, stdout }));
  });
}
async function answers(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

describe('start-check.mjs', () => {
  // @scenario workflow/environment-check :: Application starts
  test('status 200: the check passes, the application is stopped again and start-check.json records it', async () => {
    const { root, change, C } = project();
    const port = await freePort();
    const r = await startCheck(root, change, ['--start', serverCommand(port, 200), '--url', `http://127.0.0.1:${port}/health`, '--timeout', '20', '--interval', '0.2']);
    assert.equal(r.code, 0, r.stdout);
    assert.match(r.stdout, /start check passed: http:\/\/127\.0\.0\.1:\d+\/health answered 200/);
    const rec = JSON.parse(readFileSync(join(root, C, 'start-check.json'), 'utf8'));
    assert.equal(rec.ok, true);
    assert.equal(rec.status, 200);
    assert.equal(rec.url, `http://127.0.0.1:${port}/health`);
    assert.equal(await answers(port), false, 'the application is still running after the check');
  });

  // @scenario workflow/environment-check :: Application does not answer in time
  test('status 503 or no answer within the wait: the check fails', async () => {
    const { root, change, C } = project();
    const port = await freePort();
    const r = await startCheck(root, change, ['--start', serverCommand(port, 503), '--url', `http://127.0.0.1:${port}/`, '--timeout', '2', '--interval', '0.2']);
    assert.equal(r.code, 1, r.stdout);
    assert.match(r.stdout, /start check failed: .* answered 503/);
    const rec = JSON.parse(readFileSync(join(root, C, 'start-check.json'), 'utf8'));
    assert.deepEqual([rec.ok, rec.status], [false, 503]);
    assert.equal(await answers(port), false);

    const silent = await freePort();
    const none = await startCheck(root, change, ['--start', 'sleep 30', '--url', `http://127.0.0.1:${silent}/`, '--timeout', '1.5', '--interval', '0.2']);
    assert.equal(none.code, 1, none.stdout);
    assert.match(none.stdout, /start check failed: .* did not answer within 1\.5 s/);
    const rec2 = JSON.parse(readFileSync(join(root, C, 'start-check.json'), 'utf8'));
    assert.deepEqual([rec2.ok, rec2.status], [false, null]);
    assert.ok(rec2.error);
  });

  test('a start command that exits with an error fails at once and records its output', async () => {
    const { root, change, C } = project();
    const r = await startCheck(root, change, ['--start', 'echo "port is already allocated" >&2; exit 3', '--url', 'http://127.0.0.1:9/', '--timeout', '20']);
    assert.equal(r.code, 1, r.stdout);
    assert.match(r.stdout, /the start command exited with code 3/);
    const rec = JSON.parse(readFileSync(join(root, C, 'start-check.json'), 'utf8'));
    assert.match(rec.output, /port is already allocated/);
  });
});

// --- 6. Command guard -------------------------------------------------------------------------------------

/** Runs boundary-guard on a Bash command: 'ask' with the reason, or 'pass'. */
function guard(command) {
  const { root } = project();
  const r = hook('boundary-guard.mjs', root, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } });
  assert.equal(r.code, 0, r.stderr);
  if (!r.stdout.trim()) return { decision: 'pass' };
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'PreToolUse');
  return { decision: out.permissionDecision, reason: out.permissionDecisionReason };
}
const asks = (command, what) => {
  const g = guard(command);
  assert.equal(g.decision, 'ask', `expected "ask" for: ${command}`);
  assert.match(g.reason, what);
  assert.match(g.reason, /outside the project/);
};

describe('boundary-guard (PreToolUse Bash)', () => {
  // @scenario workflow/autonomous-apply :: Other application holds a needed port
  test('stopping another program asks the developer', () => {
    for (const c of ['kill 4242', 'pkill -f postgres', 'killall node', 'lsof -ti :5432 | xargs kill -9', 'sudo kill $(lsof -t -i:5432)']) asks(c, /stops a program/);
  });

  // @scenario workflow/autonomous-apply :: Tool missing on the system
  test('installing into the system asks the developer; a local install passes', () => {
    asks('sudo apt-get install -y make', /administrator|system package/);
    asks('brew install make', /system package manager/);
    asks('npm i -g pnpm', /global/);
    asks('pip install --user httpie', /installs a package for the user, outside the project/);
    // allowed: into the project, the agent's temporary folder or a container
    const tmp = mkdtempSync(join(tmpdir(), 'sdd-kit-tools-'));
    for (const c of ['npm i', 'npm install --save-dev vitest', 'pip install -r requirements.txt', 'pnpm add -D eslint', `npm i --prefix ${tmp} pnpm`, `pip install --target ${tmp} httpie`, 'docker run --rm node:20 npm i -g pnpm', 'docker exec api apt-get install -y make']) assert.equal(guard(c).decision, 'pass', c);
  });

  // @scenario workflow/autonomous-apply :: Foreign Docker container in the way
  test('removing or stopping Docker containers, volumes or networks asks; the project compose commands pass', () => {
    for (const c of ['docker stop pg', 'docker rm -f pg', 'docker kill pg', 'docker volume rm data', 'docker network rm web', 'docker system prune -af', 'docker container stop pg', 'cd x && docker rmi postgres:16']) asks(c, /Docker/);
    for (const c of ['docker compose down', 'docker compose up -d', 'docker-compose down -v', 'docker ps', 'docker logs api', 'git status && npm test']) assert.equal(guard(c).decision, 'pass', c);
  });

  test('other tools are ignored', () => {
    const { root } = project();
    const r = hook('boundary-guard.mjs', root, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, 'x'), content: 'kill 1' } });
    assert.deepEqual([r.code, r.stdout], [0, '']);
  });
});

// --- 7. Project tools, doctor and install -----------------------------------------------------------------

/** A PATH with sh, git and the given fake tools only (plus a fake openspec of the pinned version). */
function controlledPath(tools) {
  const bin = mkdtempSync(join(tmpdir(), 'sdd-kit-path-'));
  const which = (c) => spawnSync('sh', ['-c', `command -v ${c}`], { encoding: 'utf8' }).stdout.trim();
  for (const c of ['sh', 'git']) symlinkSync(which(c), join(bin, c));
  const pinned = JSON.parse(readFileSync(join(REPO, 'kit', 'openspec', 'tooling', 'kit.json'), 'utf8')).openspecVersion;
  const fake = (name, body) => {
    writeFileSync(join(bin, name), `#!${which('sh')}\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  fake('openspec', `echo ${pinned}`);
  for (const t of tools) fake(t, 'exit 0');
  return bin;
}
/** A stamped project with the kit hooks registered, and doctor run on it with the controlled PATH. */
function doctorWith(toolList, onPath) {
  const { root } = project();
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'settings.json'), readFileSync(join(REPO, 'kit', 'claude-settings.fragment.json')));
  if (toolList !== null) writeFileSync(join(root, 'openspec', 'project-tools'), toolList);
  const r = spawnSync(process.execPath, [join(root, 'openspec', 'tooling', 'bin', 'doctor.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: controlledPath(onPath) } });
  return { code: r.status, out: r.stdout + r.stderr };
}

describe('project tools in doctor', () => {
  // @scenario workflow/environment-check :: Listed tool missing
  test('a listed tool that is not on the path is a warning naming its checks; doctor still ends with "Ready."', () => {
    const r = doctorWith('docker — stack, E2E\nmake — tests\n', ['make']);
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /! project tools: docker is not on the path — needed for: stack, E2E/);
    assert.doesNotMatch(r.out, /make is not on the path/);
    assert.match(r.out, /\nReady\.\n$/);
  });

  // @scenario workflow/environment-check :: All listed tools present
  test('no warning when every listed tool is on the path', () => {
    const r = doctorWith('docker — stack, E2E\nmake — tests\n', ['docker', 'make']);
    assert.doesNotMatch(r.out, /! project tools/);
    assert.match(r.out, /✓ project tools: docker, make/);
  });

  // @scenario workflow/environment-check :: No tool list
  test('without the file, or with "none", doctor says nothing about project tools', () => {
    assert.doesNotMatch(doctorWith(null, []).out, /project tools/);
    assert.doesNotMatch(doctorWith('none\n', []).out, /project tools/);
  });

  // @scenario workflow/environment-check :: Developer declines the list
  test('a declined list ("none") is a valid tool list that reports nothing', () => {
    const r = doctorWith('none\n', []);
    assert.equal(r.code, 0, r.out);
    const protocol = readFileSync(join(REPO, 'kit', 'openspec', 'protocols', 'apply.md'), 'utf8').replace(/\s+/g, ' ');
    assert.match(protocol, /When the developer declines, write the single line `none` and do not propose a list again/);
    assert.doesNotMatch(r.out, /project tools/);
    assert.match(r.out, /\nReady\.\n$/);
  });
});

describe('install shows the health check', () => {
  // @scenario workflow/environment-check :: Install shows the result
  test('the installer output ends with the doctor result, including a missing project tool', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-install-tools-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'pilot-like'), root, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, 'openspec', 'project-tools'), 'docker — stack, E2E\n');
    const r = spawnSync(process.execPath, [join(REPO, 'installer', 'sdd-kit.mjs'), 'install', '--target', root, '--skip-openspec', '--yes'], { encoding: 'utf8', env: { ...process.env, PATH: controlledPath([]) } });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const tail = r.stdout.slice(r.stdout.lastIndexOf('Health check'));
    assert.match(tail, /^Health check \(node openspec\/tooling\/bin\/doctor\.mjs\):/);
    assert.match(tail, /! project tools: docker is not on the path — needed for: stack, E2E/);
    assert.match(r.stdout, /(Ready\.|problem\(s\) to fix before working with sdd-kit\.)\n$/);
    assert.equal(readFileSync(join(root, 'openspec', 'project-tools'), 'utf8'), 'docker — stack, E2E\n', 'install keeps the project file');
  });
});
