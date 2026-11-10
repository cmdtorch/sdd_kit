// The test-cases stage hooks: the AI QA reviewer run limit and the schema starter.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { cliSkipReason } from './helpers/openspec.mjs';
import { gate as runLimit, RUNS_FILE, MAX_RUNS } from '../kit/openspec/tooling/hooks/test-cases-run-limit.mjs';
import { gate as starter, starterMessage } from '../kit/openspec/tooling/hooks/schema-starter.mjs';

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

describe('schema-starter (PreToolUse on Bash)', () => {
  const bash = (command, cwd = REPO) => starter({ hook_event_name: 'PreToolUse', cwd, tool_name: 'Bash', tool_input: { command } });

  // @scenario workflow/schema-starter :: Unnamed schema is blocked
  test('openspec new change without a schema is blocked with the three-choice menu', () => {
    const message = bash('openspec new change "add-export"');
    assert.ok(message);
    assert.match(message, /AskUserQuestion/);
    assert.match(message, /`clarify`/);
    assert.match(message, /`clarify-ai-qa`/);
    assert.match(message, /`clarify-qa`/);
    assert.match(message, /--schema <chosen>/);
    assert.match(message, /dismiss/i);
    assert.match(message, /free text/i);
    assert.ok(message.split('\n').length <= 12, 'the block message stays short');
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

  // @scenario workflow/schema-starter :: Lean is not offered
  test('the menu lists the three clarify schemas and not lean', () => {
    const message = starterMessage();
    for (const s of ['clarify', 'clarify-ai-qa', 'clarify-qa']) assert.match(message, new RegExp(`\`${s}\``));
    assert.doesNotMatch(message, /lean/);
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
