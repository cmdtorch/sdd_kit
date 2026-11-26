// Tests for the test-run-guard hook (PreToolUse Bash), run as a real process with Claude Code-shaped stdin in a
// temporary project with a prepared `openspec/test-commands.md`. The subagent field `agent_type` is the one
// verified in docs/openspec-facts.md §9 (K19); `run_in_background` is K20.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOK = join(REPO, 'kit', 'openspec', 'tooling', 'hooks', 'test-run-guard.mjs');
const FRAGMENT = JSON.parse(readFileSync(join(REPO, 'kit', 'claude-settings.fragment.json'), 'utf8'));

const MAKE = '# Test commands\n\n- One file: `make test FILE=<file>`\n- Full suite: `make test`\n';
const MAKE_12 = '# Test commands\n\n- One file: `make test FILE=<file>` — 1 min\n- Full suite: `make test` — 12 min\n';
const MAKE_1 = '# Test commands\n\n- One file: `make test FILE=<file>`\n- Full suite: `make test` — 1 min\n';
const META = [
  '# Test commands',
  '',
  '## Repository: backend',
  '',
  '- One file: `mise run test:backend -- <file>`',
  '- Full suite: `mise run test:backend` — 12 min',
  '',
  '## Repository: frontend',
  '',
  '- One file: `mise run test:frontend -- <file>`',
  '- Full suite: `mise run test:frontend` — 1 min',
  '',
].join('\n');

/** A temporary project; `commands` is the content of openspec/test-commands.md, or null for no file. */
function project(commands, { stamp } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-test-run-guard-'));
  mkdirSync(join(root, 'openspec', 'changes'), { recursive: true });
  if (commands !== null) writeFileSync(join(root, 'openspec', 'test-commands.md'), commands);
  if (stamp) {
    const dir = join(root, 'openspec', 'changes', 'add-orders');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.openspec.yaml'), `schema: clarify\ncreated: 2026-11-26\nx-sdd-kit: ${stamp}\n`);
  }
  return root;
}

const SUBAGENT = { agent_id: 'a1', agent_type: 'task-implementer' };

/** Runs the hook like Claude Code: JSON on stdin, CLAUDE_PROJECT_DIR set, cwd = project. */
function run(root, command, { agent = null, background = false, tool = 'Bash' } = {}) {
  const tool_input = { command, description: 'run' };
  if (background) tool_input.run_in_background = true;
  const r = spawnSync('node', [HOOK], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', hook_event_name: 'PreToolUse', tool_name: tool, tool_input, ...(agent || {}) }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
const blocked = (r, msg) => {
  assert.equal(r.code, 2, `expected a block, got ${r.code}: ${r.stderr}`);
  if (msg) assert.match(r.stderr, msg);
};
const passes = (r) => assert.deepEqual([r.code, r.stderr], [0, ''], r.stderr);

describe('test-run-guard: the full suite inside a task-implementer subagent', () => {
  // @scenario workflow/test-runs :: Subagent runs the full suite
  test('the full suite of the file is blocked inside a task-implementer, naming the rule and the one-file command', () => {
    const r = run(project(MAKE_12), 'make test', { agent: SUBAGENT, background: true });
    blocked(r, /only its own test files/);
    assert.ok(r.stderr.includes('`make test FILE=<file>`'), r.stderr);
    assert.match(r.stderr, /openspec\/test-commands\.md/);
  });

  // @scenario workflow/test-runs :: Fix subagent at the end of apply
  test('a task-implementer fixing a full-suite failure is blocked the same way, in the foreground too', () => {
    blocked(run(project(MAKE), 'make test', { agent: SUBAGENT }), /only its own test files/);
  });

  // @scenario workflow/test-runs :: Another kind of subagent
  test('a subagent that is not a task-implementer may run the full suite in the background', () => {
    passes(run(project(MAKE), 'make test', { agent: { agent_id: 'b2', agent_type: 'Explore' }, background: true }));
  });

  // @scenario workflow/test-runs :: Change stamped 0.6.1
  test('the block does not depend on the stamp of the change', () => {
    for (const stamp of ['0.6.1', '0.7.0']) blocked(run(project(MAKE, { stamp }), 'make test', { agent: SUBAGENT, background: true }), /only its own test files/);
  });

  // @scenario workflow/test-runs :: Section of a meta-repository
  test('in a meta-repository every section full suite is blocked and the message names that section one-file command', () => {
    const root = project(META);
    const front = run(root, 'mise run test:frontend', { agent: SUBAGENT, background: true });
    blocked(front, /only its own test files/);
    assert.ok(front.stderr.includes('`mise run test:frontend -- <file>`'), front.stderr);
    assert.ok(!front.stderr.includes('test:backend'), front.stderr);
    const back = run(root, 'mise run test:backend', { agent: SUBAGENT, background: true });
    blocked(back);
    assert.ok(back.stderr.includes('`mise run test:backend -- <file>`'), back.stderr);
  });

  // @scenario workflow/test-runs :: Main agent runs the full suite
  test('the main agent may run the full suite in the background', () => {
    passes(run(project(MAKE), 'make test', { background: true }));
    passes(run(project(MAKE_12), 'make test', { background: true }));
  });

  // @scenario workflow/test-runs :: No commands file
  test('without the file, with `none` or without a full-suite item nothing is blocked', () => {
    passes(run(project(null), 'make test', { agent: SUBAGENT }));
    passes(run(project('none\n'), 'make test', { agent: SUBAGENT }));
    passes(run(project('# Test commands\n\n- One file: `make test FILE=<file>`\n'), 'make test', { agent: SUBAGENT }));
    passes(run(project('Full suite is make test, ask Bob\n'), 'make test', { agent: SUBAGENT }));
  });

  test('a call that is not Bash, an empty input or an unreadable file never blocks (fail open)', () => {
    const root = project(MAKE);
    passes(run(root, 'make test', { agent: SUBAGENT, tool: 'Write' }));
    const empty = spawnSync('node', [HOOK], { cwd: root, input: '', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.notEqual(empty.status, 2, empty.stderr);
    const broken = spawnSync('node', [HOOK], { cwd: root, input: '{not json', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.notEqual(broken.status, 2, broken.stderr);
    const dirFile = project(null);
    mkdirSync(join(dirFile, 'openspec', 'test-commands.md'));
    assert.notEqual(run(dirFile, 'make test', { agent: SUBAGENT }).code, 2);
  });
});

describe('test-run-guard: matching a command line with the full-suite command', () => {
  // @scenario workflow/test-runs :: One-file command passes
  test('the one-file command and other commands that start with the full suite pass', () => {
    const root = project(MAKE);
    for (const c of ['make test FILE=api/tests/test_orders.py', 'make test-failed', 'make tests', 'make lint && make build', 'git status']) passes(run(root, c, { agent: SUBAGENT }));
  });

  // @scenario workflow/test-runs :: Full suite inside a longer command line
  test('the full suite as one part of a longer command line is blocked', () => {
    const root = project(MAKE);
    for (const c of ['cd api && make test', 'make lint; make test', 'false || make test', 'git status\nmake test']) blocked(run(root, c, { agent: SUBAGENT }), /only its own test files/);
  });

  // @scenario workflow/test-runs :: Full suite wrapped in another program
  test('leading variables and the wrappers env, nohup, time, nice and timeout are dropped', () => {
    const root = project(MAKE);
    for (const c of ['CI=1 timeout 900 make test', 'env CI=1 make test', 'nohup make test', 'time make test', 'nice -n 10 make test', 'timeout 15m make test']) blocked(run(root, c, { agent: SUBAGENT }), /only its own test files/);
  });

  // @scenario workflow/test-runs :: Full suite inside a quoted shell string
  test('the full suite inside a quoted shell string is not matched', () => {
    const root = project(MAKE);
    for (const c of ['bash -c "make test"', "sh -c 'make test'", 'bash -c "cd api && make test"', 'echo "make test"']) passes(run(root, c, { agent: SUBAGENT }));
  });

  // @scenario workflow/test-runs :: Extra spaces
  test('runs of spaces count as one', () => {
    const root = project(MAKE);
    blocked(run(root, 'make  test', { agent: SUBAGENT }), /only its own test files/);
    blocked(run(root, '  make \t test  ', { agent: SUBAGENT }), /only its own test files/);
    blocked(run(project('- Full suite: `make   test`\n'), 'make test', { agent: SUBAGENT }), /only its own test files/);
  });

  // @scenario workflow/test-runs :: Full suite with its output piped
  test('the full suite followed only by redirections or piped into another program is blocked', () => {
    const root = project(MAKE);
    for (const c of ['make test 2>&1 | tail -20', 'make test > out.log', 'make test >out.log 2>&1', 'make test &> out.log', 'make test 2>/dev/null | grep FAIL']) blocked(run(root, c, { agent: SUBAGENT }), /only its own test files/);
    passes(run(root, 'make test > out.log extra', { agent: SUBAGENT }));
  });
});

describe('test-run-guard: a long full suite in the foreground', () => {
  // @scenario workflow/test-runs :: Foreground full suite of 12 minutes
  test('a foreground full suite of 12 minutes is blocked with the message to run it in the background', () => {
    const r = run(project(MAKE_12), 'make test');
    blocked(r, /in the background/);
    assert.match(r.stderr, /run_in_background/);
    assert.match(r.stderr, /12 min/);
  });

  // @scenario workflow/test-runs :: Full suite without a duration
  test('a foreground full suite without a duration is blocked', () => {
    blocked(run(project(MAKE), 'make test'), /in the background/);
    blocked(run(project(MAKE), 'cd api && make test | tail -5'), /in the background/);
  });

  // @scenario workflow/test-runs :: Background full suite passes
  test('the same full suite started in the background passes', () => {
    passes(run(project(MAKE_12), 'make test', { background: true }));
    passes(run(project(MAKE), 'make test 2>&1 | tail -20', { background: true }));
  });

  // @scenario workflow/test-runs :: Two sections with different durations
  test('each section full suite is judged by its own duration', () => {
    const root = project(META);
    blocked(run(root, 'mise run test:backend'), /in the background/);
    passes(run(root, 'mise run test:frontend'));
  });

  // @scenario workflow/test-runs :: Short full suite in the foreground
  test('a full suite written as shorter than 2 minutes passes in the foreground', () => {
    passes(run(project(MAKE_1), 'make test'));
    passes(run(project('- Full suite: `make test` — 2 min\n'), 'make test FILE=a.py'));
    blocked(run(project('- Full suite: `make test` — 2 min\n'), 'make test'), /in the background/);
  });

  test('a foreground one-file run is never blocked by the hook', () => {
    passes(run(project(MAKE_12.replace('— 1 min', '— 3 min')), 'make test FILE=a.py'));
  });
});

describe('test-run-guard: no test tool in the kit code', () => {
  // @scenario workflow/test-runs :: Kit runs in a project of any stack
  test('two projects with different full suites are blocked by the same rule from their own file', () => {
    const a = run(project(MAKE), 'make test', { agent: SUBAGENT, background: true });
    const b = run(project('- One file: `npm test -- <file>`\n- Full suite: `npm test`\n'), 'npm test', { agent: SUBAGENT, background: true });
    blocked(a, /only its own test files/);
    blocked(b, /only its own test files/);
    assert.equal(a.stderr.replace('make test FILE=<file>', 'X').replace(/make test/g, 'Y'), b.stderr.replace('npm test -- <file>', 'X').replace(/npm test/g, 'Y'));
    // the same command passes in a project whose file names another full suite
    passes(run(project('- Full suite: `npm test`\n'), 'make test', { agent: SUBAGENT }));
    for (const f of ['hooks/test-run-guard.mjs', 'lib/command-line.mjs', 'lib/test-commands.mjs']) {
      const src = readFileSync(join(REPO, 'kit', 'openspec', 'tooling', f), 'utf8');
      assert.doesNotMatch(src, /\b(make|npm|pnpm|yarn|npx|bun|pytest|jest|vitest|mocha|cargo|gradle|mvn|rspec|phpunit|tox|nox|mise|go test|dotnet)\b/, f);
    }
  });
});

describe('test-run-guard: registration and earlier changes', () => {
  // @scenario workflow/test-commands :: Change stamped 0.6.1
  test('a change stamped 0.6.1 without the file: the hook blocks nothing and writes no file', () => {
    const root = project(null, { stamp: '0.6.1' });
    passes(run(root, 'make test', { agent: SUBAGENT }));
    passes(run(root, 'make test'));
    assert.equal(existsSync(join(root, 'openspec', 'test-commands.md')), false);
  });

  test('the settings fragment runs the hook before Bash', () => {
    const group = FRAGMENT.hooks.PreToolUse.find((g) => g.hooks.some((h) => h.command.includes('openspec/tooling/hooks/test-run-guard.mjs')));
    assert.ok(group, 'test-run-guard is not registered');
    assert.equal(group.matcher, 'Bash');
  });
});
