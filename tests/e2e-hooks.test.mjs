// The E2E stage in the hooks (openspec/changes/add-e2e-stage, design D4): archive-gate runs check-e2e in
// archive mode on every kit schema, artifact-feedback runs its format check after e2e.md is written.
// Every test copies a fixture project and the kit's openspec/ into a temp git project, adds an app file and
// an E2E test folder e2e/, records runs with the installed e2e-run.mjs and a fake `npx` first on PATH, and
// runs the hooks as processes with Claude Code-shaped stdin.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { playwrightReport, runE2e, fakeEnv } from './helpers/e2e.mjs';
import { REPO, CHANGE as CLARIFY_CHANGE, uiProject, baseProject as clarifyBase } from './helpers/ui-project.mjs';

// `AT` builds the marker keywords at run time, so no line of this file starts with a marker.
const AT = '@';
const QA_CHANGE = 'add-sale-export';
const QA_FIXTURE = { 'clarify-ai-qa': 'ai-qa-good', 'clarify-qa': 'qa-good' };
const CAP = 'inventory/sale-export';
const TWO = 'Export of a month with two sales';
const TEACHER = 'Export button is hidden for a teacher';
const CLARIFY_CAP = 'inventory/sales-export';
const changeRel = (change) => `openspec/changes/${change}`;

function write(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}
/** An E2E spec file whose single test starts on line 5, with `refs` (marker lines) above it. */
function specFile(title, refs) {
  return [`import { test } from '@playwright/test';`, `import { signIn } from './helpers/sign-in';`, '', ...refs, `test('${title}', async ({ page }) => {`, '  await signIn(page);', '});', ''].join('\n');
}
/** The app file and the shared parts of the E2E folder e2e/. */
function appAndHelpers(root) {
  write(root, 'app/src/export.js', 'export const total = (sales) => sales.reduce((a, s) => a + s.amount, 0);\n');
  write(root, 'e2e/helpers/sign-in.ts', 'export async function signIn(page) { await page.goto("/"); }\n');
  write(root, 'e2e/playwright.config.ts', 'export default { retries: 0 };\n');
}
const gitInit = (root) => execFileSync('git', ['init', '-q'], { cwd: root });

/** An e2e.md. */
function e2eMd({ mode = 'real backend', scenarios = [], accepted = [], screens = null, noNewRun = [] } = {}) {
  const items = (title, list) => (list.length ? `\n## ${title}\n${list.map((x) => `- ${x}`).join('\n')}\n` : '');
  const head = mode === 'skipped' ? `# E2E Stage\n\nMode: skipped\n` : `# E2E Stage\n\nMode: ${mode}\nTests: e2e/\nStart: command \`npm run e2e:serve\`\n`;
  const table = screens ? `\n## Screens\n| Screenshot | Result | Differences | Reason |\n|---|---|---|---|\n${screens.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n` : '';
  return `${head}${items('Scenarios', scenarios)}${items('Accepted cases', accepted)}${table}${items('No new run needed', noNewRun)}`;
}

// --- test-case schemas: the complete ai-qa-good / qa-good change with E2E tests of its two e2e cases ------
const QA_SPECS = {
  two: { file: 'two-sales.spec.ts', title: 'exports two sales', line: 5 },
  teacher: { file: 'teacher.spec.ts', title: 'hides the export button for a teacher', line: 5 },
};
/**
 * A complete test-case change (all tasks done) whose e2e cases are "Export of a month with two sales" and
 * "Export button is hidden for a teacher"; e2e.md is `record` (null: no e2e.md). `tests`: the keys of
 * QA_SPECS that get an E2E test.
 */
function qaProject({ schema = 'clarify-ai-qa', record = e2eMd(), tests = ['two', 'teacher'] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-e2e-hooks-'));
  cpSync(join(REPO, 'fixtures', 'projects', QA_FIXTURE[schema]), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  const C = changeRel(QA_CHANGE);
  for (const rel of [`${C}/test-cases.md`, `${C}/verification-plan.md`, 'tests/test_sale_export.py']) {
    const s = readFileSync(join(root, rel), 'utf8');
    assert.ok(s.includes('Export of a month with two paid sales'), `${rel} does not name the case`);
    writeFileSync(join(root, rel), s.replaceAll('Export of a month with two paid sales', TWO));
  }
  rmSync(join(root, C, 'e2e.md'), { force: true });
  if (record !== null) writeFileSync(join(root, C, 'e2e.md'), record);
  appAndHelpers(root);
  const names = { two: TWO, teacher: TEACHER };
  for (const key of tests) write(root, `e2e/${QA_SPECS[key].file}`, specFile(QA_SPECS[key].title, [`// ${AT}case ${CAP} :: ${names[key]}`]));
  gitInit(root);
  return root;
}

// --- clarify / lean: the complete checks-good change, its scenario "Successful export" listed for E2E -----
const CLARIFY_SPECS = { export: { file: 'export.spec.ts', title: 'exports a period', line: 5 } };
const LISTED = `${CLARIFY_CAP} :: Successful export`;
/** The checks-good change (schema `schema`), optionally in UI mode (uiProject, `shots`), with e2e/ and `record`. */
function clarifyProject({ schema = 'clarify', record = e2eMd({ scenarios: [LISTED] }), test: withTest = true, ui = false, shots } = {}) {
  const root = ui ? uiProject(shots ? { shots } : {}) : clarifyBase();
  const C = changeRel(CLARIFY_CHANGE);
  if (schema !== 'clarify') writeFileSync(join(root, C, '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-10-03\n`);
  if (record !== null) writeFileSync(join(root, C, 'e2e.md'), record);
  appAndHelpers(root);
  if (withTest) write(root, 'e2e/export.spec.ts', specFile(CLARIFY_SPECS.export.title, [`// ${AT}scenario ${LISTED}`]));
  gitInit(root);
  return root;
}

/** Runs a kit hook of the project like Claude Code does: JSON on stdin, CLAUDE_PROJECT_DIR set, cwd = project. */
function hook(name, root, input) {
  const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'hooks', name)], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', hook_event_name: 'PreToolUse', ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const archive = (root, change) => hook('archive-gate.mjs', root, { tool_name: 'Bash', tool_input: { command: `openspec archive ${change} --yes` } });
const archiveQa = (root) => archive(root, QA_CHANGE);
const archiveClarify = (root) => archive(root, CLARIFY_CHANGE);

/** Records a run with the project's installed e2e-run.mjs; `results`: {key: status} of `specs`. */
function e2eRun(root, change, specs, results, args = []) {
  const report = playwrightReport(join(root, 'e2e'), Object.entries(results).map(([key, status]) => ({ ...specs[key], status })));
  const r = runE2e(join(root, 'openspec', 'tooling', 'bin', 'e2e-run.mjs'), root, change, report, args);
  assert.ok(existsSync(join(root, changeRel(change), 'e2e-runs.json')), `no run recorded: ${r.err}`);
  return r;
}
const runQa = (root, results, args) => e2eRun(root, QA_CHANGE, QA_SPECS, results, args);
const runClarify = (root, results = { export: 'expected' }) => e2eRun(root, CLARIFY_CHANGE, CLARIFY_SPECS, results);
const stateIdOf = (root, change) => {
  const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'bin', 'e2e-run.mjs'), '--change', change, '--state'], { cwd: root, encoding: 'utf8', env: fakeEnv(root) });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};

function allowed(r, what = 'the archive') {
  assert.equal(r.code, 0, `${what} must not be blocked:\n${r.stderr}`);
  assert.doesNotMatch(r.stderr, /check-e2e/);
}
function blocked(r, ...patterns) {
  assert.equal(r.code, 2, `expected a block, got exit ${r.code}: ${r.stderr}`);
  assert.match(r.stderr, /cannot be archived yet/);
  for (const p of patterns) assert.match(r.stderr, p);
}
/** Only the check-e2e lines of a block message. */
const e2eLines = (r) => r.stderr.split('\n').filter((l) => l.includes('check-e2e: ')).join('\n');

describe('e2e/stage: the stage gates the archive', () => {
  // @scenario e2e/stage :: Archive is blocked before the first E2E run
  test('a change that needs E2E with every task done and no recorded run is blocked', () => {
    const root = qaProject();
    blocked(archiveQa(root), /check-e2e: .*e2e\.md: the E2E stage has not run: no run is recorded in e2e-runs\.json/);
  });

  // @scenario e2e/stage :: Failing case blocks the archive
  test('a failed, not accepted latest result blocks the archive and names the case', () => {
    const root = qaProject();
    runQa(root, { two: 'unexpected', teacher: 'expected' });
    const r = archiveQa(root);
    blocked(r, new RegExp(`check-e2e: .*E2E case "${TWO}" \\(${CAP}\\): the latest E2E result is failed \\(e2e/two-sales\\.spec\\.ts:5`));
    assert.doesNotMatch(e2eLines(r), new RegExp(TEACHER));
  });

  // @scenario e2e/stage :: Green run with an accepted case allows the archive
  test('every case passes except one accepted with a reason: the archive is allowed', () => {
    const root = qaProject();
    runQa(root, { two: 'expected', teacher: 'skipped' });
    blocked(archiveQa(root), new RegExp(`check-e2e: .*"${TEACHER}".*skipped.*not under "## Accepted cases"`));
    writeFileSync(join(root, changeRel(QA_CHANGE), 'e2e.md'), e2eMd({ accepted: [`${CAP} :: ${TEACHER} — the teacher role cannot be created in the test database yet`] }));
    allowed(archiveQa(root));
  });

  // @scenario e2e/stage :: Test-case change without an E2E decision blocks the archive
  test('clarify-qa: every task done and no e2e.md blocks the archive', () => {
    const root = qaProject({ schema: 'clarify-qa', record: null });
    blocked(archiveQa(root), /check-e2e: .*e2e\.md: the E2E decision is missing/);
  });

  // @scenario e2e/stage :: Clarify change without E2E archives as before
  test('clarify: a complete change without e2e.md is archived as before', () => {
    allowed(archiveClarify(clarifyProject({ record: null, test: false })));
    // the same change with E2E listed and not run is held by the gate
    blocked(archiveClarify(clarifyProject()), /check-e2e: .*the E2E stage has not run/);
  });

  // @scenario e2e/stage :: Lean change without E2E archives as before
  test('lean: a complete change without e2e.md is archived as before', () => {
    allowed(archiveClarify(clarifyProject({ schema: 'lean', record: null, test: false })));
    blocked(archiveClarify(clarifyProject({ schema: 'lean' })), /check-e2e: .*the E2E stage has not run/);
  });

  // @scenario e2e/stage :: Skipped E2E does not block the archive
  test('clarify-ai-qa: mode skipped with no note does not block the archive', () => {
    const root = qaProject({ record: '# E2E Stage\n\nMode: skipped\n', tests: [] });
    allowed(archiveQa(root));
    writeFileSync(join(root, changeRel(QA_CHANGE), 'e2e.md'), e2eMd());
    blocked(archiveQa(root), /check-e2e: /);
  });

  // @scenario e2e/stage :: Code changed after the stage blocks the archive
  test('an app file changed after the latest green run blocks the archive', () => {
    const root = qaProject();
    runQa(root, { two: 'expected', teacher: 'expected' });
    allowed(archiveQa(root), 'the complete stage');
    appendFileSync(join(root, 'app/src/export.js'), '// rounding of the total\n');
    blocked(archiveQa(root), /check-e2e: .*project files changed after the latest E2E run/);
  });

  // @scenario e2e/stage :: Developer decides no new run is needed
  test('the recorded no-new-run decision for the current state allows the archive', () => {
    const root = qaProject();
    runQa(root, { two: 'expected', teacher: 'expected' });
    appendFileSync(join(root, 'app/src/export.js'), '// typo fix in a comment\n');
    blocked(archiveQa(root), /project files changed after the latest E2E run/);
    const id = stateIdOf(root, QA_CHANGE);
    writeFileSync(join(root, changeRel(QA_CHANGE), 'e2e.md'), e2eMd({ noNewRun: [`${id} — typo fix in a comment of the export`] }));
    allowed(archiveQa(root));
  });
});

describe('e2e/tests: coverage gates the archive', () => {
  // @scenario e2e/tests :: E2E case without a test blocks the archive
  test('clarify-ai-qa: an e2e case that no E2E test references blocks the archive and is named', () => {
    const root = qaProject({ tests: ['teacher'] });
    runQa(root, { teacher: 'expected' });
    const r = archiveQa(root);
    blocked(r, new RegExp(`check-e2e: .*E2E case "${TWO}" \\(${CAP}\\) has no E2E test`));
    assert.doesNotMatch(e2eLines(r), new RegExp(TEACHER));
  });

  // @scenario e2e/tests :: Listed scenario without a test blocks the archive
  test('clarify: a listed scenario that no E2E test references blocks the archive and is named', () => {
    const root = clarifyProject({ test: false });
    blocked(archiveClarify(root), new RegExp(`check-e2e: .*E2E scenario "Successful export" \\(${CLARIFY_CAP}\\) has no E2E test`));
  });
});

describe('e2e/visual-check: the screens gate the archive', () => {
  const SHOTS = [
    ['U1', '01-orders-list.png'],
    ['U2', '02-orders-list-mobile.png'],
    ['U3', '06-export-modal.png'],
  ];
  /** A complete UI change with a green run and the given screens rows. */
  function uiE2e(screens) {
    const root = clarifyProject({ ui: true, shots: SHOTS, record: e2eMd({ scenarios: [LISTED], screens }) });
    runClarify(root);
    return root;
  }
  const NO_DIFF = (shot) => [shot, 'no differences', '—', '—'];

  // @scenario e2e/visual-check :: Screenshot without a comparison blocks the archive
  test('a screenshot with no screens row blocks the archive and is named', () => {
    const root = uiE2e([NO_DIFF('01-orders-list.png'), NO_DIFF('06-export-modal.png')]);
    const r = archiveClarify(root);
    blocked(r, /check-e2e: .*screenshot `02-orders-list-mobile\.png` has no result under "## Screens"/);
    assert.doesNotMatch(e2eLines(r), /01-orders-list\.png|06-export-modal\.png/);
  });

  // @scenario e2e/visual-check :: Change without screenshots needs no visual check
  test('a change with no sources/ui/ screenshot is archived after a green run', () => {
    const root = clarifyProject();
    assert.equal(existsSync(join(root, changeRel(CLARIFY_CHANGE), 'sources', 'ui')), false);
    blocked(archiveClarify(root), /check-e2e: .*the E2E stage has not run/);
    runClarify(root);
    allowed(archiveClarify(root));
  });

  // @scenario e2e/visual-check :: Open difference blocks the archive
  test('an open difference blocks the archive and names the screenshot and the difference', () => {
    const root = uiE2e([['01-orders-list.png', 'differences', 'Export button missing', '—'], NO_DIFF('02-orders-list-mobile.png'), NO_DIFF('06-export-modal.png')]);
    const r = archiveClarify(root);
    blocked(r, /check-e2e: .*screenshot `01-orders-list\.png` has an open difference: Export button missing/);
    assert.doesNotMatch(e2eLines(r), /02-orders-list-mobile\.png|06-export-modal\.png/);
  });

  // @scenario e2e/visual-check :: Accepted difference allows the archive
  test('the only difference accepted with a reason allows the archive after a green run', () => {
    const others = [NO_DIFF('02-orders-list-mobile.png'), NO_DIFF('06-export-modal.png')];
    const root = uiE2e([['01-orders-list.png', 'accepted', 'header colour differs', 'new brand colours approved by the designer'], ...others]);
    allowed(archiveClarify(root));
  });
});

describe('artifact-feedback runs the format check after e2e.md is written', () => {
  const post = (root, rel) => hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, rel), content: '' } });
  const context = (r) => {
    assert.equal(r.code, 0, r.stderr);
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.additionalContext : '';
  };

  test('a format error is handed back; a good record and the archive checks stay silent', () => {
    const root = qaProject();
    const rel = `${changeRel(QA_CHANGE)}/e2e.md`;
    assert.equal(context(post(root, rel)), '', 'a good record without a run gets no feedback (runs are judged at archive)');
    writeFileSync(join(root, rel), e2eMd({ mode: 'staging server' }));
    const ctx = context(post(root, rel));
    assert.match(ctx, /check-e2e found 1 problem\(s\) after writing e2e\.md \(change "add-sale-export"\)/);
    assert.match(ctx, /unknown E2E mode "staging server"/);
    assert.match(ctx, /Fix these now/);
  });
});
