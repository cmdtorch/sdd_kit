// The test-cases stage hooks: the AI QA reviewer run limit and the schema starter.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { cliSkipReason } from './helpers/openspec.mjs';
import * as runLimitHook from '../kit/openspec/tooling/hooks/test-cases-run-limit.mjs';
import { gate as starter, starterMessage } from '../kit/openspec/tooling/hooks/schema-starter.mjs';

const { gate: runLimit, RUNS_FILE, MAX_RUNS, SPEC_RUNS_FILE, MAX_SPEC_RUNS, specsLockEntry } = runLimitHook;

// The gates resolve the project from CLAUDE_PROJECT_DIR first; tests pass the project as cwd instead.
delete process.env.CLAUDE_PROJECT_DIR;

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGE = 'add-sale-export';
const C = `openspec/changes/${CHANGE}`;
const CONFIRMED = '[Answer]: Looks correct';
const NOT_READY = [
  '# Test-case review — add-sale-export',
  '',
  'Verdict: NOT-READY',
  '',
  '| ID | Severity | Case | Scenario | Finding | Suggested fix |',
  '|---|---|---|---|---|---|',
  '| F1 | major | — | Successful export | No error case for export | add a case for an unavailable export service |',
  '| F2 | major | — | Empty period | No case for a 256-character name | add the boundary cases 255 and 256 |',
  '| F3 | minor | Export of an empty period | Empty period | Wording of the Then | say "the file has only the header row" |',
  '',
].join('\n');

function project(fixture = 'ai-qa-good') {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-qa-hooks-'));
  cpSync(join(REPO, 'fixtures', 'projects', fixture), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  return root;
}
function setConfirmation(root, answer) {
  const p = join(root, C, 'test-cases.md');
  const s = readFileSync(p, 'utf8');
  assert.ok(s.includes(CONFIRMED), 'fixture test-cases.md is not confirmed');
  writeFileSync(p, s.replace(CONFIRMED, answer));
}
const writeReview = (root, text) => writeFileSync(join(root, C, 'reviews', 'test-cases-review.md'), text);
const reviewerCall = (root, tool_name = 'Agent', subagent_type = 'test-cases-reviewer') =>
  runLimit({ hook_event_name: 'PreToolUse', cwd: root, tool_name, tool_input: { subagent_type, description: 'Review test cases', prompt: `Review the test cases of the change ${CHANGE}.` } });

describe('test-cases-run-limit (PreToolUse on the subagent tool)', () => {
  test('counts reviewer runs in reviews/test-cases-runs.json', () => {
    const root = project();
    setConfirmation(root, '[Answer]:');
    assert.equal(MAX_RUNS, 3);
    assert.equal(reviewerCall(root), null);
    const runs = JSON.parse(readFileSync(join(root, C, RUNS_FILE), 'utf8'));
    assert.equal(RUNS_FILE, 'reviews/test-cases-runs.json');
    assert.equal(runs.runs, 1);
    assert.equal(runs.loop, 1);
  });

  // @scenario test-cases/review :: Developer decides after the third run
  test('a fourth run in the same loop is blocked and the remaining major findings are named', () => {
    const root = project();
    setConfirmation(root, '[Answer]:');
    for (let i = 1; i <= 3; i++) {
      assert.equal(reviewerCall(root, i === 2 ? 'Task' : 'Agent'), null, `run ${i} must be allowed`);
      writeReview(root, NOT_READY);
    }
    const message = reviewerCall(root);
    assert.ok(message, 'the fourth run must be blocked');
    assert.match(message, /test-cases-reviewer has already run 3 times/);
    assert.match(message, /No error case for export/);
    assert.match(message, /No case for a 256-character name/);
    assert.doesNotMatch(message, /Wording of the Then/, 'minor findings are not listed');
    assert.match(message, /ask the developer to fix or accept each/i);
    assert.equal(JSON.parse(readFileSync(join(root, C, RUNS_FILE), 'utf8')).runs, 3, 'a blocked run is not counted');
  });

  // @scenario test-cases/review :: Late review loop has its own limit
  test('after the stage is confirmed a late scenario starts a new loop of three runs', () => {
    const root = project();
    setConfirmation(root, '[Answer]:');
    for (let i = 1; i <= 3; i++) assert.equal(reviewerCall(root), null);
    assert.ok(reviewerCall(root), 'the stage loop is exhausted');
    // the developer settles the findings and confirms the stage
    const p = join(root, C, 'test-cases.md');
    writeFileSync(p, readFileSync(p, 'utf8').replace(/^\[Answer\]:$/m, CONFIRMED));
    // later, during implementation, a scenario is added to the delta spec
    const spec = join(root, C, 'specs', 'inventory', 'sale-export', 'spec.md');
    const before = readFileSync(spec, 'utf8');
    writeFileSync(spec, before.trimEnd() + '\n\n#### Scenario: Export of a cancelled sale\n- **WHEN** a cancelled sale falls in the period\n- **THEN** the sale is not in the file\n');
    assert.match(readFileSync(spec, 'utf8'), /Scenario: Export of a cancelled sale/);
    for (let i = 1; i <= 3; i++) {
      assert.equal(reviewerCall(root), null, `late run ${i} must be allowed`);
      writeReview(root, NOT_READY);
    }
    const runs = JSON.parse(readFileSync(join(root, C, RUNS_FILE), 'utf8'));
    assert.equal(runs.loop, 2);
    assert.equal(runs.runs, 3);
    const message = reviewerCall(root);
    assert.ok(message, 'the fourth run of the late loop must be blocked');
    assert.match(message, /No error case for export/);
  });

  test('a further late loop starts once the latest review is settled', () => {
    const root = project();
    for (let i = 1; i <= 3; i++) {
      assert.equal(reviewerCall(root), null);
      writeReview(root, NOT_READY);
    }
    assert.ok(reviewerCall(root));
    const p = join(root, C, 'test-cases.md');
    writeFileSync(p, readFileSync(p, 'utf8').replace('- (none)', '- No error case for export: accepted, export has no external service\n- No case for a 256-character name: accepted, names are not limited'));
    assert.equal(reviewerCall(root), null, 'settled findings and a confirmed stage start a new loop');
    assert.equal(JSON.parse(readFileSync(join(root, C, RUNS_FILE), 'utf8')).loop, 2);
  });

  test('other subagents, other tools and schemas without test cases are not counted', () => {
    const root = project();
    assert.equal(reviewerCall(root, 'Agent', 'spec-reviewer'), null);
    assert.equal(runLimit({ cwd: root, tool_name: 'Bash', tool_input: { command: 'ls' } }), null);
    assert.equal(existsSync(join(root, C, RUNS_FILE)), false);
    const clarify = mkdtempSync(join(tmpdir(), 'sdd-kit-qa-hooks-clarify-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), clarify, { recursive: true });
    cpSync(join(REPO, 'kit', 'openspec'), join(clarify, 'openspec'), { recursive: true });
    for (let i = 0; i < 5; i++) {
      assert.equal(runLimit({ cwd: clarify, tool_name: 'Agent', tool_input: { subagent_type: 'test-cases-reviewer', prompt: 'Review add-sales-export' } }), null);
    }
  });
});

describe('spec-reviewer run limit of a new-rules change (the hook run as a process)', () => {
  const NEW = 'add-sales-export';
  const NC = `openspec/changes/${NEW}`;
  const HOOK = join(REPO, 'kit', 'openspec', 'tooling', 'hooks', 'test-cases-run-limit.mjs');
  const HASH_A = 'a'.repeat(64);
  const HASH_B = 'b'.repeat(64);

  function newRulesProject({ stamp = '0.6.0', schema = 'clarify', lock = HASH_A } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-spec-runs-'));
    cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
    cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
    const meta = [`schema: ${schema}`, 'created: 2026-10-03', stamp ? `x-sdd-kit: ${stamp}` : null].filter(Boolean).join('\n') + '\n';
    writeFileSync(join(root, NC, '.openspec.yaml'), meta);
    if (lock) setSpecsLock(root, lock);
    return root;
  }
  function setSpecsLock(root, hash) {
    const lock = { proposal: { round: 'Main', hash: 'c'.repeat(64) }, specs: { round: 'Technical', hash } };
    writeFileSync(join(root, NC, 'answers-lock.json'), JSON.stringify(lock, null, 2) + '\n');
  }
  function specReview(root, rows) {
    const verdict = rows.some((r) => /\| (blocker|major) \|/.test(r)) ? 'NOT-READY' : 'READY';
    const text = [`# Spec review — ${NEW}`, '', `Verdict: ${verdict}`, '', '| ID | Severity | Where | Finding | Evidence | Suggested action |', '|---|---|---|---|---|---|', ...rows, ''].join('\n');
    writeFileSync(join(root, NC, 'reviews', 'spec-review.md'), text);
  }
  function fixSpecs(root) {
    const spec = join(root, NC, 'specs', 'inventory', 'sale-export', 'spec.md');
    if (existsSync(spec)) writeFileSync(spec, readFileSync(spec, 'utf8') + '\n');
  }
  function reviewer(root, subagent_type = 'spec-reviewer') {
    const r = spawnSync('node', [HOOK], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: root, tool_name: 'Agent', tool_input: { subagent_type, description: 'Review specs', prompt: `Review the specs of the change ${NEW}.` } }),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: '' },
    });
    return { blocked: r.status === 2, status: r.status, message: r.stderr };
  }
  const runsOf = (root) => JSON.parse(readFileSync(join(root, NC, SPEC_RUNS_FILE), 'utf8'));
  const TWO_FINDINGS = [
    '| S1 | major | inventory/sale-export › "Successful export" | THEN says "the file is correct" | spec.md:14 | state the columns |',
    '| S2 | minor | inventory/sale-export › "Empty period" | Scenario name says "works" | spec.md:20 | rename the scenario |',
  ];
  const ONE_WORDING = ['| S1 | minor | inventory/sale-export › "Empty period" | Scenario name says "works" | spec.md:20 | rename the scenario |'];

  // @scenario workflow/planning-flow :: Second run after fixes
  test('after the first review reported findings and the agent fixed them, a second run is allowed', () => {
    const root = newRulesProject();
    assert.equal(SPEC_RUNS_FILE, 'reviews/spec-review-runs.json');
    assert.equal(MAX_SPEC_RUNS, 2);
    assert.equal(reviewer(root).status, 0, 'first run');
    specReview(root, TWO_FINDINGS);
    fixSpecs(root);
    const second = reviewer(root);
    assert.equal(second.status, 0, `second run must be allowed: ${second.message}`);
    assert.equal(runsOf(root).runs, 2);
  });

  // @scenario workflow/planning-flow :: No third run
  test('a third run for the same specs is blocked and the agent is told to go on', () => {
    const root = newRulesProject();
    assert.equal(reviewer(root).status, 0);
    specReview(root, TWO_FINDINGS);
    fixSpecs(root);
    assert.equal(reviewer(root).status, 0);
    specReview(root, ONE_WORDING);
    const third = reviewer(root);
    assert.ok(third.blocked, 'the third run must be blocked');
    assert.match(third.message, /spec-reviewer has already run 2 times/);
    assert.match(third.message, new RegExp(NEW));
    assert.match(third.message, /do not run it again/i);
    assert.match(third.message, /fix the remaining findings yourself/i);
    assert.match(third.message, /digest/);
    assert.match(third.message, /next artifact/i);
    assert.equal(runsOf(root).runs, 2, 'a blocked run is not counted');
  });

  // @scenario workflow/planning-flow :: First review without findings
  test('after a first review without findings a second run is blocked', () => {
    const root = newRulesProject();
    specReview(root, ['| S1 | minor | x | stale review of an earlier draft | spec.md:1 | y |']);
    assert.equal(reviewer(root).status, 0, 'first run');
    specReview(root, []);
    const second = reviewer(root);
    assert.ok(second.blocked, 'no second run after a review without findings');
    assert.match(second.message, /reported no finding/);
    assert.match(second.message, /do not run it again/i);
    assert.equal(runsOf(root).runs, 1);
  });

  test('a review left from before the first run does not count as its result', () => {
    const root = newRulesProject();
    specReview(root, []);
    assert.equal(reviewer(root).status, 0, 'first run');
    // the reviewer has not written its report yet (the call was refused or failed): a retry is allowed
    assert.equal(reviewer(root).status, 0, 'second run');
    assert.ok(reviewer(root).blocked, 'third run');
  });

  // @scenario workflow/planning-flow :: Specs rewritten after a changed answer
  test('after the specs lock entry is rewritten, one more run is allowed and then none', () => {
    const root = newRulesProject();
    assert.equal(reviewer(root).status, 0);
    specReview(root, TWO_FINDINGS);
    assert.equal(reviewer(root).status, 0);
    specReview(root, ONE_WORDING);
    assert.ok(reviewer(root).blocked, 'the two runs of the first specs are used up');
    // the developer changed a Technical answer and asked for the update; the rewritten specs get a new lock entry
    setSpecsLock(root, HASH_B);
    fixSpecs(root);
    const again = reviewer(root);
    assert.equal(again.status, 0, `one run on the rewritten specs: ${again.message}`);
    specReview(root, ONE_WORDING);
    fixSpecs(root);
    const after = reviewer(root);
    assert.ok(after.blocked, 'not started again after the agent fixed the findings');
    assert.match(after.message, /already run once on the rewritten specs/);
    assert.equal(runsOf(root).specsLock, HASH_B);
  });

  test('the same lock entry does not reset the count, and a lock written after the first run is not a rewrite', () => {
    const root = newRulesProject({ lock: null });
    assert.equal(reviewer(root).status, 0);
    specReview(root, TWO_FINDINGS);
    setSpecsLock(root, HASH_A);
    assert.equal(reviewer(root).status, 0);
    specReview(root, ONE_WORDING);
    assert.ok(reviewer(root).blocked);
    setSpecsLock(root, HASH_A);
    assert.ok(reviewer(root).blocked);
  });

  test('older, unstamped, test-case and lean changes are not counted for the spec reviewer', () => {
    for (const opts of [{ stamp: '0.5.0' }, { stamp: null }, { schema: 'clarify-qa' }, { schema: 'clarify-ai-qa' }, { schema: 'lean' }]) {
      const root = newRulesProject(opts);
      for (let i = 0; i < 4; i++) {
        assert.equal(reviewer(root).status, 0, JSON.stringify(opts));
        specReview(root, []);
      }
      assert.equal(existsSync(join(root, NC, SPEC_RUNS_FILE)), false, JSON.stringify(opts));
    }
  });

  test('a change stamped with a pre-release of 0.6.0 or a later version is counted', () => {
    for (const opts of [{ stamp: '0.6.0-beta.1' }, { stamp: '0.7.0' }]) {
      const root = newRulesProject(opts);
      assert.equal(reviewer(root).status, 0);
      specReview(root, TWO_FINDINGS);
      assert.equal(reviewer(root).status, 0);
      assert.ok(reviewer(root).blocked, JSON.stringify(opts));
    }
  });

  test('the specs lock entry is read from the shapes the lock may take', () => {
    const root = newRulesProject({ lock: null });
    const write = (obj) => writeFileSync(join(root, NC, 'answers-lock.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
    assert.equal(specsLockEntry(root, NEW), null, 'no lock');
    write({ specs: HASH_A });
    assert.equal(specsLockEntry(root, NEW), HASH_A);
    write({ specs: { hash: HASH_B, round: 'Technical' } });
    assert.equal(specsLockEntry(root, NEW), HASH_B);
    write({ artifacts: { specs: { sha256: HASH_A } } });
    assert.equal(specsLockEntry(root, NEW), HASH_A);
    write({ proposal: HASH_A });
    assert.equal(specsLockEntry(root, NEW), null, 'no specs entry');
    write('{ not json');
    assert.equal(specsLockEntry(root, NEW), null, 'unreadable lock');
  });
});

describe('schema-starter (PreToolUse on Bash)', () => {
  const bash = (command, cwd = REPO) => starter({ hook_event_name: 'PreToolUse', cwd, tool_name: 'Bash', tool_input: { command } });

  // @scenario workflow/schema-starter :: Unnamed schema is blocked
  test('openspec new change without a schema is blocked with the depth menu', () => {
    const message = bash('openspec new change "add-export"');
    assert.ok(message);
    assert.match(message, /AskUserQuestion/);
    assert.match(message, /starter menu/i);
    for (const level of ['low', 'medium', 'high']) assert.match(message, new RegExp(`^\\s+- \`${level}\``, 'm'), `level ${level} is a choice`);
    assert.match(message, /dismiss/i);
    assert.match(message, /free text/i);
    assert.ok(message.split('\n').length <= 12, 'the block message stays short');
  });

  // @scenario workflow/schema-starter :: Medium is marked as recommended
  test('the menu marks medium, and only medium, as recommended', () => {
    const choices = starterMessage().split('\n').filter((l) => /^\s+- `/.test(l));
    assert.deepEqual(choices.map((l) => l.match(/`([^`]+)`/)[1]), ['low', 'medium', 'high']);
    assert.deepEqual(choices.filter((l) => /recommended/i.test(l)).map((l) => l.match(/`([^`]+)`/)[1]), ['medium']);
  });

  // @scenario workflow/schema-starter :: Only depth levels are offered
  test('the menu names neither a test-case schema nor lean', () => {
    const message = starterMessage();
    assert.doesNotMatch(message, /clarify-ai-qa/);
    assert.doesNotMatch(message, /clarify-qa/);
    assert.doesNotMatch(message, /\blean\b/);
    assert.doesNotMatch(message, /--schema <chosen>/);
  });

  // @scenario workflow/schema-starter :: Choosing the high level
  test('after the choice the change is created on clarify and the level is written as the Depth line', () => {
    const message = starterMessage();
    assert.match(message, /rerun the same command with `--schema clarify`/);
    assert.match(message, /`Depth: <level>`/);
    assert.match(message, /`Depth: high`/);
    assert.match(message, /clarifications\.md/);
    assert.equal(bash('openspec new change "add-export" --schema clarify'), null, 'the rerun is not blocked');
  });

  // @scenario workflow/schema-starter :: Test-case schema named explicitly
  test('a change named on clarify-qa is not blocked and is created on clarify-qa', (t) => {
    assert.equal(bash('openspec new change "add-export" --schema clarify-qa'), null);
    assert.equal(bash('node openspec/tooling/bin/openspec.mjs new change add-export --schema clarify-ai-qa'), null);
    const skip = cliSkipReason();
    if (skip) return t.skip(`OpenSpec half: ${skip}`);
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-named-qa-'));
    mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
    mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
    cpSync(join(REPO, 'kit', 'openspec', 'schemas'), join(root, 'openspec', 'schemas'), { recursive: true });
    writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: clarify\n');
    execFileSync(process.env.OPENSPEC_BIN || 'openspec', ['new', 'change', 'add-export', '--schema', 'clarify-qa'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, XDG_CONFIG_HOME: join(root, '.xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    });
    const meta = readFileSync(join(root, 'openspec', 'changes', 'add-export', '.openspec.yaml'), 'utf8');
    assert.match(meta, /^schema: clarify-qa$/m);
  });

  // @scenario workflow/schema-starter :: Unnamed schema through the wrapper is blocked
  test('the kit wrapper without a schema is blocked with the same message', () => {
    assert.equal(bash('node openspec/tooling/bin/openspec.mjs new change "add-export"'), starterMessage());
    assert.equal(bash('cd /tmp/p && node ./openspec/tooling/bin/openspec.mjs new change add-export --description "x"'), starterMessage());
    assert.equal(bash('openspec new change "add-export"'), starterMessage());
  });

  // @scenario workflow/schema-starter :: Schema named with a space is not blocked
  test('--schema <name> is not blocked', () => {
    assert.equal(bash('openspec new change "add-export" --schema lean'), null);
    assert.equal(bash('node openspec/tooling/bin/openspec.mjs new change add-export --schema clarify-qa'), null);
  });

  // @scenario workflow/schema-starter :: Schema named with an equals sign is not blocked
  test('--schema=<name> is not blocked', () => {
    assert.equal(bash('openspec new change "add-export" --schema=clarify-qa'), null);
  });

  // @scenario workflow/schema-starter :: Unknown schema is passed through
  test('an unknown schema name is left to OpenSpec, which reports it itself', (t) => {
    assert.equal(bash('openspec new change "add-export" --schema foo'), null);
    const skip = cliSkipReason();
    if (skip) return t.skip(`OpenSpec half: ${skip}`);
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-unknown-schema-'));
    mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
    mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
    cpSync(join(REPO, 'kit', 'openspec', 'schemas'), join(root, 'openspec', 'schemas'), { recursive: true });
    writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: clarify\n');
    const r = spawnSync(process.env.OPENSPEC_BIN || 'openspec', ['new', 'change', 'add-export', '--schema', 'foo'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, XDG_CONFIG_HOME: join(root, '.xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    });
    assert.notEqual(r.status, 0, 'OpenSpec must reject an unknown schema');
    assert.match(r.stdout + r.stderr, /Schema 'foo' not found/);
    assert.equal(existsSync(join(root, 'openspec', 'changes', 'add-export')), false, 'no change is created');
  });

  // @scenario workflow/schema-starter :: Default schema in settings still starts the menu
  test('a default schema in openspec/config.yaml does not count as a choice', () => {
    const root = project();
    assert.match(readFileSync(join(root, 'openspec', 'config.yaml'), 'utf8'), /^schema: clarify$/m);
    assert.equal(bash('openspec new change "add-export"', root), starterMessage());
  });

  test('other commands are not blocked', () => {
    for (const cmd of ['openspec status --change add-export --json', 'openspec list --json', 'ls openspec/changes', 'echo done && openspec new change x --schema clarify', 'openspec new change a --schema clarify; openspec status --change a']) {
      assert.equal(bash(cmd), null, cmd);
    }
    assert.equal(bash('openspec new change a --schema clarify && openspec new change b'), starterMessage(), 'each command is checked on its own');
    assert.equal(bash('openspec new change a --schema'), starterMessage(), 'a flag without a value names no schema');
    assert.equal(starter({ cwd: REPO, tool_name: 'Write', tool_input: { file_path: 'x', content: 'openspec new change a' } }), null);
  });
});

describe('a change created in a terminal', () => {
  let skip = false;
  before(() => {
    skip = cliSkipReason();
  });

  // @scenario workflow/schema-starter :: Change created in a terminal
  test('openspec new change without a schema gets the project default schema', (t) => {
    if (skip) return t.skip(skip);
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-terminal-'));
    mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
    mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
    cpSync(join(REPO, 'kit', 'openspec', 'schemas'), join(root, 'openspec', 'schemas'), { recursive: true });
    writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: clarify\n');
    execFileSync(process.env.OPENSPEC_BIN || 'openspec', ['new', 'change', 'add-export'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, XDG_CONFIG_HOME: join(root, '.xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    });
    const meta = readFileSync(join(root, 'openspec', 'changes', 'add-export', '.openspec.yaml'), 'utf8');
    assert.match(meta, /^schema: clarify$/m);
  });
});

describe('registration in the settings fragment', () => {
  const FRAGMENT = JSON.parse(readFileSync(join(REPO, 'kit', 'claude-settings.fragment.json'), 'utf8'));
  const matcherOf = (name) => FRAGMENT.hooks.PreToolUse.find((g) => g.hooks.some((h) => h.command.includes(`openspec/tooling/hooks/${name}.mjs`)))?.matcher;

  test('both hooks are PreToolUse hooks on the right tools', () => {
    assert.equal(matcherOf('schema-starter'), 'Bash');
    assert.deepEqual(matcherOf('test-cases-run-limit').split('|').sort(), ['Agent', 'Task']);
  });

  test('the schema starter blocks as a process (exit 2, message on stderr)', () => {
    const r = spawnSync('node', [join(REPO, 'kit', 'openspec', 'tooling', 'hooks', 'schema-starter.mjs')], {
      input: JSON.stringify({ hook_event_name: 'PreToolUse', cwd: REPO, tool_name: 'Bash', tool_input: { command: 'openspec new change add-export' } }),
      encoding: 'utf8',
    });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /AskUserQuestion/);
  });
});
