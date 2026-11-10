// Shared builders of the meta-repository tests (change metarepo-support): a temporary meta-repository with
// its own git (`repos/*` ignored), the clones `repos/backend` and `repos/frontend` with their own git and
// `.gitignore` (`node_modules/`), the kit's openspec/ and `openspec/clones`, and one change written from a few
// plan rows (delta spec, verification plan, tasks, implementation report, test review).
// Nested git repositories cannot live in fixtures/, so everything is built in a temp folder.
// Marker lines are built at run time (`AT`), so no line of this file starts with a marker.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const KIT_VERSION = JSON.parse(readFileSync(join(REPO, 'kit', 'openspec', 'tooling', 'kit.json'), 'utf8')).kitVersion;
export const CHANGE = 'add-orders';
export const C = `openspec/changes/${CHANGE}`;
export const CAP = 'orders/order-flow';
export const REQ = 'Orders are managed';
export const CLONES = 'backend=repos/backend\nfrontend=repos/frontend\n';

const AT = '@';
/** A marker line of a test file: `// @scenario <cap> :: <name>` (or `#` for Python). */
export const scenarioLine = (name, { cap = CAP, comment = '//' } = {}) => `${comment} ${AT}scenario ${cap} :: ${name}`;
/** A case reference line: `// @case <cap> :: <name>`. */
export const caseLine = (name, { cap = CAP, comment = '//' } = {}) => `${comment} ${AT}case ${cap} :: ${name}`;

const GIT_ID = ['-c', 'user.name=sdd-kit test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];
export const git = (cwd, ...args) => execFileSync('git', [...GIT_ID, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** Commits everything in a repository folder. */
export function commitAll(cwd, message = 'test') {
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '--allow-empty', '-m', message);
}

/** Writes a file relative to `root`, creating its folders. */
export function write(root, rel, content) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), content);
}

/**
 * A test file `rel` with one test per entry of `tests`: [{scenarios: [names], cases: [names]}] or plain
 * scenario names. Python files get `#` comments.
 */
export function writeTest(root, rel, tests) {
  const comment = rel.endsWith('.py') ? '#' : '//';
  const out = [];
  tests.forEach((t, k) => {
    const { scenarios = [], cases = [] } = typeof t === 'string' ? { scenarios: [t] } : t;
    out.push(...scenarios.map((s) => scenarioLine(s, { comment })), ...cases.map((c) => caseLine(c, { comment })));
    out.push(comment === '#' ? `def test_${k}():\n    assert True\n` : `test('t${k}', () => {});\n`);
  });
  write(root, rel, out.join('\n'));
}

/**
 * A temporary meta-repository: root git with `repos/*` ignored, the kit's openspec/, `openspec/clones` with
 * `clones` (null: no list, a single repository), and a git clone with a committed README and `.gitignore`
 * for each name of `create`. `kit: false` leaves out openspec/ (a root the installer has not seen yet). Returns the root.
 */
export function metarepo({ clones = CLONES, create = ['backend', 'frontend'], kit = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-metarepo-'));
  if (kit) {
    cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
    mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
    mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
    writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: clarify\n');
  }
  writeFileSync(join(root, '.gitignore'), 'repos/*\n');
  if (clones !== null) writeFileSync(join(root, 'openspec', 'clones'), `# One clone per line: <path> or <name>=<path>\n${clones}`);
  git(root, 'init', '-q');
  for (const name of create) {
    const dir = join(root, 'repos', name);
    mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q');
    writeFileSync(join(dir, '.gitignore'), 'node_modules/\n');
    writeFileSync(join(dir, 'README.md'), `# ${name}\n`);
    commitAll(dir, 'initial');
  }
  return root;
}

/** Removes a clone folder (a declared clone missing on disk). */
export const removeClone = (root, name) => rmSync(join(root, 'repos', name), { recursive: true, force: true });

const PLAN_HEADER = ['Capability', 'Requirement', 'Scenario', 'Level', 'Critical', 'Test data / setup', 'Manual reason'];
const row = (cells) => `| ${cells.join(' | ')} |`;

/**
 * Writes the change `name` from plan rows: [scenario, level, repository] (repository '' = an empty cell).
 * The delta spec has one requirement with every scenario of the rows (plus `extraScenarios`).
 * Options:
 *   schema        'lean' (default) or a clarify-family schema
 *   marked        writes `x-sdd-kit-metarepo: true` (default true); stamped writes `x-sdd-kit`
 *   column        false drops the Repository column of "Scenario coverage"
 *   tasks         tasks.md content; default: one group per repository of the rows, then the final checks
 *   report        apply-report.md content; default: the three sections and one "## Repository:" section per
 *                 repository of the task groups
 *   cases         test-case schemas: [{scenario, name, labels, level, repository}] for test-cases.md and the
 *                 "Test case coverage" table
 *   e2e           e2e.md content, written when given
 * Returns { root, change, C }.
 */
export function writeChange(root, rows, { name = CHANGE, schema = 'lean', marked = true, stamped = true, column = true, tasks = null, report = null, cases = null, e2e = null, extraScenarios = [] } = {}) {
  const dir = `openspec/changes/${name}`;
  const meta = [`schema: ${schema}`, 'created: 2026-11-10'];
  if (stamped) meta.push(`x-sdd-kit: ${KIT_VERSION}`);
  if (marked) meta.push('x-sdd-kit-metarepo: true');
  write(root, `${dir}/.openspec.yaml`, `${meta.join('\n')}\n`);

  const scenarios = [...new Set([...rows.map((r) => r[0]), ...extraScenarios])];
  const spec = [
    '# Spec Delta',
    '',
    '## Purpose',
    '',
    'Defines how orders are created and listed across the backend and the frontend of the application.',
    '',
    '## ADDED Requirements',
    '',
    `### Requirement: ${REQ}`,
    'The application SHALL create and list orders.',
    '',
    ...scenarios.flatMap((s) => [`#### Scenario: ${s}`, '- **WHEN** the user acts', `- **THEN** ${s.toLowerCase()}`, '']),
  ];
  write(root, `${dir}/specs/${CAP}/spec.md`, spec.join('\n'));
  write(root, `${dir}/proposal.md`, '## Why\n\nOrders.\n\n## What Changes\n\n- Orders are created and listed.\n');

  const header = column ? [...PLAN_HEADER, 'Repository'] : PLAN_HEADER;
  const planRows = rows.map(([scenario, level, repository]) => {
    const reason = level === 'manual' ? 'cannot be automated: a person judges the layout' : '—';
    const cells = [CAP, REQ, scenario, level, 'no', '—', reason];
    if (column) cells.push(repository);
    return row(cells);
  });
  const plan = ['# Verification Plan', '', '## Scenario coverage', '', row(header), row(header.map(() => '---')), ...planRows, ''];
  plan.push('## Exclusions', '', '| Capability | Scenario | Reason |', '|---|---|---|', '| — | — | None. |', '');
  plan.push('## Requirement trace', '', '| Capability | Requirement | Sources |', '|---|---|---|', `| ${CAP} | ${REQ} | [D1] |`, '');
  if (cases) {
    plan.push('## Test case coverage', '', '| Capability | Scenario | Case | Labels | Level | Repository |', '|---|---|---|---|---|---|');
    for (const c of cases) plan.push(row([CAP, c.scenario, c.name, c.labels, c.level ?? '—', c.repository ?? '']));
    plan.push('');
    const byScenario = new Map();
    for (const c of cases) byScenario.set(c.scenario, [...(byScenario.get(c.scenario) || []), c]);
    const tc = ['# Test Cases', '', `## ${CAP}`, ''];
    for (const [s, list] of byScenario) {
      tc.push(`### Scenario: ${s}`, '');
      for (const c of list) tc.push(`#### Case: ${c.name}`, `Labels: ${c.labels}`, '- **Given** an order', '- **When** the user opens the list', '- **Then** the list is right', '');
    }
    write(root, `${dir}/test-cases.md`, tc.join('\n'));
  }
  plan.push('## Environment', '', '- Running application: no', '');
  write(root, `${dir}/verification-plan.md`, plan.join('\n'));

  const repos = [...new Set(rows.map((r) => r[2]).flatMap((r) => String(r).split(',').map((x) => x.trim())).filter(Boolean))];
  const taskText =
    tasks ??
    [
      '# Tasks',
      '',
      ...repos.flatMap((r, k) => [`## ${k + 1}. [${r}] Orders in ${r}`, '', `- [x] ${k + 1}.1 Write the tests and the code`, '']),
      `## ${repos.length + 1}. Final checks`,
      '',
      `- [x] ${repos.length + 1}.1 Run the full suite`,
      '',
    ].join('\n');
  write(root, `${dir}/tasks.md`, taskText);
  const manual = rows.filter((r) => r[1] === 'manual').map((r) => `### ${CAP} :: ${r[0]}\nReason: cannot be automated: a person judges the layout\nSteps: open the page\nExpected: it looks right\n`);
  const reportText =
    report ??
    [
      '# Apply Report',
      '',
      '## Manual checks',
      '',
      manual.length ? manual.join('\n') : 'None.\n',
      '## Not verified automatically',
      '',
      'None.',
      '',
      '## Weakened tests',
      '',
      'None.',
      '',
      ...repos.flatMap((r) => [`## Repository: ${r}`, '', 'Command: npm test', 'Result: 12 passed', '']),
    ].join('\n');
  write(root, `${dir}/apply-report.md`, reportText);
  write(root, `${dir}/reviews/test-review.md`, '# Test Review\n\nVerdict: READY\n');
  if (e2e !== null) write(root, `${dir}/e2e.md`, e2e);
  return { root, change: name, C: dir };
}

/** Runs a kit script of the temp project (`openspec/tooling/...`) in the root: { code, out, err }. */
export function runKit(root, script, args = []) {
  const r = spawnSync(process.execPath, [join(root, 'openspec', 'tooling', script), ...args], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** check-traceability of the temp project as a process, JSON report: { code, report }. */
export function traceability(root, change = CHANGE, { markers = true } = {}) {
  const r = runKit(root, 'checks/check-traceability.mjs', ['--change', change, ...(markers ? ['--markers'] : []), '--json']);
  let report;
  try {
    report = JSON.parse(r.out);
  } catch {
    throw new Error(`check-traceability printed no JSON (exit ${r.code}):\n${r.out}\n${r.err}`);
  }
  return { code: r.code, report };
}

/** Runs a hook of the temp project like Claude Code does: JSON on stdin, CLAUDE_PROJECT_DIR set. */
export function hook(root, name, input) {
  const r = spawnSync(process.execPath, [join(root, 'openspec', 'tooling', 'hooks', name)], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** `openspec archive <change> --yes` through the archive gate: { code, err } (code 2 = blocked). */
export const archive = (root, change = CHANGE) => hook(root, 'archive-gate.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `openspec archive ${change} --yes` } });

/** Error messages of a check report. */
export const errorsOf = (report) => report.findings.filter((f) => f.level === 'error').map((f) => f.message);

/** A PATH with sh and git only, plus a fake `openspec` of the pinned version (the health check passes). */
export function controlledPath(tools = []) {
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

/** The installer as a process in `root` (`--skip-openspec`), with the controlled PATH: { code, out, err }. */
export function installer(root, args) {
  // `--target` first and the temp root as cwd: a misread option can never reach this repository
  const r = spawnSync(process.execPath, [join(REPO, 'installer', 'sdd-kit.mjs'), args[0], '--target', root, '--skip-openspec', ...args.slice(1)], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: controlledPath() } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** The health check of the temp project as a process, with the controlled PATH: { code, out }. */
export function doctorRun(root, args = []) {
  const r = spawnSync(process.execPath, [join(root, 'openspec', 'tooling', 'bin', 'doctor.mjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: controlledPath() } });
  return { code: r.status, out: r.stdout + r.stderr };
}

/** Scripted terminal answers for the installer and the health check: { ask, say, asked, said }. */
export function scripted(answers = []) {
  const queue = [...answers];
  const io = { asked: [], said: [] };
  io.ask = async (question) => {
    io.asked.push(question);
    if (!queue.length) throw new Error(`unexpected question: ${question}`);
    return queue.shift();
  };
  io.say = (text) => io.said.push(text);
  return io;
}

/** `git status --porcelain` of a folder ('' = clean). */
export const gitStatus = (dir) => git(dir, 'status', '--porcelain');
