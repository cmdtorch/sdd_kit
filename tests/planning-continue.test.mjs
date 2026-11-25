// Tests for the automatic continuation of planning (openspec/protocols/planning.md): the Stop hook
// planning-continue, the UserPromptSubmit hook planning-prompt, the session state written by artifact-feedback and
// the command planning.mjs (wait, pause, resume). Hooks run as real processes with Claude Code-shaped stdin in a
// temporary project with a prepared change; the next artifact comes from the pinned OpenSpec CLI. TMPDIR points
// into the temporary project, so the session state never touches the real temporary folder.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { cliSkipReason } from './helpers/openspec.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAGMENT = JSON.parse(readFileSync(join(REPO, 'kit', 'claude-settings.fragment.json'), 'utf8'));
const SESSION = 'sess-1';
const CHANGE = 'add-sales-export';

const question = (n, title, answer, options = ['Yes', 'No']) =>
  `### Q${n}. ${title}\nWhy this is asked: it decides a rule of the export.\n${options.map((o, i) => `- ${String.fromCharCode(65 + i)}. ${o}`).join('\n')}\n- X. Other (please specify)\n\n[Answer]: ${answer}\n`;
const MOCKUPS = (answer) => question(1, 'Are there UI mockups for this change? (UI mockups)', answer, ['Yes, I will export them as screenshots', 'No, there will be no mockups', 'Not yet defined']);

/** A new-rules clarifications file; `technical: null` leaves the Technical round out, `'none'` has no questions. */
function clar({ mockups = 'B', q2 = 'A', technical = 'A' } = {}) {
  let text = `# Clarifications\n\nDepth: medium\nAnswer mode: file\n\n## Sources\n\n- [desc] Developer description: "Sales export"\n\n## Main round\n\n${MOCKUPS(mockups)}\n${question(2, 'Do accountants download the export?', q2)}`;
  if (technical === 'none') text += '\n## Technical round\n\nNo questions.\n';
  else if (technical !== null) text += `\n## Technical round\n\n${question(3, 'Is an empty period a file with the header row only?', technical)}`;
  return text;
}

function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-planning-'));
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: clarify\n');
  mkdirSync(join(root, '.tmp'));
  return root;
}
const rel = (name, file) => `openspec/changes/${name}/${file}`;
/** A change folder with its `.openspec.yaml`; `stamp: null` leaves the kit version stamp out. */
function change(root, { name = CHANGE, schema = 'clarify', stamp = '0.6.0', files = {} } = {}) {
  const dir = join(root, 'openspec', 'changes', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-11-25\n${stamp ? `x-sdd-kit: ${stamp}\n` : ''}`);
  for (const [file, content] of Object.entries(files)) put(root, rel(name, file), content);
  return name;
}
function put(root, file, content) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}
const env = (root) => ({ ...process.env, CLAUDE_PROJECT_DIR: root, TMPDIR: join(root, '.tmp'), TMP: join(root, '.tmp'), TEMP: join(root, '.tmp') });

/** Runs a kit hook of the project like Claude Code does. */
function hook(name, root, input) {
  const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'hooks', name)], {
    cwd: root,
    input: JSON.stringify({ session_id: SESSION, cwd: root, permission_mode: 'default', ...input }),
    encoding: 'utf8',
    env: env(root),
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
/** The artifact-feedback hook after `file` was written (the file is already in place). */
const written = (root, file) => {
  const r = hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, file), content: '' } });
  assert.equal(r.code, 0, r.stderr);
  return r;
};
/** The agent tries to end its turn: { code, decision, reason }. */
function stop(root, { active = false } = {}) {
  const r = hook('planning-continue.mjs', root, { hook_event_name: 'Stop', stop_hook_active: active, last_assistant_message: 'done', transcript_path: join(root, 't.jsonl') });
  let out = {};
  if (r.stdout.trim()) out = JSON.parse(r.stdout);
  return { code: r.code, decision: out.decision ?? null, reason: out.reason ?? '', stdout: r.stdout, stderr: r.stderr };
}
const prompt = (root, text) => hook('planning-prompt.mjs', root, { hook_event_name: 'UserPromptSubmit', prompt: text });
function planning(root, ...args) {
  const r = spawnSync('node', [join(root, 'openspec', 'tooling', 'bin', 'planning.mjs'), ...args], { cwd: root, encoding: 'utf8', env: env(root) });
  return { code: r.status, out: r.stdout + r.stderr };
}
/** Records `name` as the change of the session without an artifact write (a session that touched it before). */
function touch(root, name) {
  const lib = pathToFileURL(join(root, 'openspec', 'tooling', 'lib', 'session-state.mjs')).href;
  const r = spawnSync('node', ['--input-type=module', '-e', `import { recordChange } from ${JSON.stringify(lib)}; recordChange(${JSON.stringify(SESSION)}, ${JSON.stringify(root)}, ${JSON.stringify(name)});`], { encoding: 'utf8', env: env(root) });
  assert.equal(r.status, 0, r.stderr);
}
const goesOn = (r) => {
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.decision, 'block', `the turn should not end: ${r.stdout}${r.stderr}`);
};
const ends = (r) => {
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.decision, null, `the turn should end: ${r.stdout}`);
};

/** A `clarify` change stamped 0.6.0 whose proposal the agent has just written in this session. */
function proposalWritten(root, opts = {}) {
  const { clarifications = clar(), ...rest } = opts;
  const name = change(root, { ...rest, files: { 'clarifications.md': clarifications, 'proposal.md': '# Proposal\n\n## Why\n\nx\n' } });
  written(root, rel(name, 'proposal.md'));
  return name;
}

describe('planning goes on without a command', { skip: cliSkipReason() }, () => {
  // @scenario workflow/planning-flow :: Next artifact is written without a command
  test('after the proposal of a new-rules clarify change the turn goes on with the specs', () => {
    const root = project();
    proposalWritten(root);
    const r = stop(root);
    goesOn(r);
    assert.match(r.reason, new RegExp(`"${CHANGE}"`));
    assert.match(r.reason, /next artifact: specs/);
    assert.match(r.reason, /openspec\/protocols\/planning\.md/);
    assert.match(r.reason, /Do not ask the developer to run \/opsx:continue/);
  });

  test('a Technical round without questions is closed: the specs come next', () => {
    const root = project();
    proposalWritten(root, { clarifications: clar({ technical: 'none' }) });
    const r = stop(root);
    goesOn(r);
    assert.match(r.reason, /next artifact: specs/);
  });

  // @scenario workflow/planning-flow :: Technical round is prepared next
  test('without a Technical round section the agent is told to run the Technical round, not to write the specs', () => {
    const root = project();
    proposalWritten(root, { clarifications: clar({ technical: null }) });
    const r = stop(root);
    goesOn(r);
    assert.match(r.reason, /Technical round/);
    assert.match(r.reason, /clarifications\.md/);
    assert.doesNotMatch(r.reason, /next artifact: specs/);
  });

  // @scenario workflow/planning-flow :: Lean change goes on
  test('after the proposal of a lean change stamped 0.6.0 the turn goes on with the specs', () => {
    const root = project();
    const name = change(root, { schema: 'lean', files: { 'proposal.md': '# Proposal\n\n## Why\n\nx\n' } });
    written(root, rel(name, 'proposal.md'));
    const r = stop(root);
    goesOn(r);
    assert.match(r.reason, /next artifact: specs/);
    assert.match(r.reason, new RegExp(`"${name}"`));
  });

  // @scenario workflow/planning-flow :: Change not touched in this session is left alone
  test('only the change of this session is continued; a complete one lets the turn end', () => {
    const root = project();
    const full = { 'clarifications.md': clar(), 'proposal.md': '# P\n', 'specs/inventory/x/spec.md': '# S\n', 'design.md': '# D\n', 'verification-plan.md': '# V\n', 'tasks.md': '# Tasks\n\n- [ ] 1.1 x\n' };
    const first = change(root, { name: 'add-first', files: full });
    change(root, { name: 'add-second', files: { 'clarifications.md': clar(), 'proposal.md': '# P\n' } });
    written(root, rel(first, 'tasks.md'));
    const r = stop(root);
    ends(r);
    assert.doesNotMatch(r.stdout + r.stderr, /add-second/);
  });

  test('a change only written in another session is not continued', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar(), 'proposal.md': '# P\n' } });
    const other = hook('artifact-feedback.mjs', root, { session_id: 'other-session', hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, rel(name, 'proposal.md')), content: '' } });
    assert.equal(other.code, 0, other.stderr);
    ends(stop(root));
  });

  // @scenario workflow/planning-flow :: Change on a test-case schema is not continued
  test('a clarify-qa change is not continued', () => {
    const root = project();
    proposalWritten(root, { schema: 'clarify-qa' });
    ends(stop(root));
  });

  // @scenario workflow/planning-flow :: Older change is not continued
  test('a change stamped 0.5.0 is not continued', () => {
    const root = project();
    proposalWritten(root, { stamp: '0.5.0' });
    ends(stop(root));
  });

  // @scenario workflow/planning-flow :: Unstamped change is not continued
  test('a change without a kit version stamp is not continued', () => {
    const root = project();
    proposalWritten(root, { stamp: null });
    ends(stop(root));
    assert.doesNotMatch(readFileSync(join(root, rel(CHANGE, '.openspec.yaml')), 'utf8'), /x-sdd-kit/, 'the proposal does not stamp a change that already has clarifications');
  });
});

describe('the turn ends where a human is needed', { skip: cliSkipReason() }, () => {
  // @scenario workflow/planning-flow :: Unanswered question ends the turn
  test('a blank answer in the Main round ends the turn; answered, the proposal comes next', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar({ q2: '', technical: null }) } });
    written(root, rel(name, 'clarifications.md'));
    ends(stop(root));
    put(root, rel(name, 'clarifications.md'), clar({ technical: null }));
    written(root, rel(name, 'clarifications.md'));
    const r = stop(root);
    goesOn(r);
    assert.match(r.reason, /next artifact: proposal/);
  });

  // @scenario workflow/planning-flow :: Question asked in the chat ends the turn
  test('a lean change whose agent asked about mockups in the chat and marked the wait lets the turn end', () => {
    const root = project();
    const name = change(root, { schema: 'lean' });
    touch(root, name);
    goesOn(stop(root));
    const w = planning(root, 'wait', '--change', name, '--reason', 'asked in the chat whether the change has UI mockups');
    assert.equal(w.code, 0, w.out);
    ends(stop(root));
    ends(stop(root, { active: true }));
  });

  // @scenario workflow/planning-flow :: Waiting for screenshots ends the turn
  test('mockups answered "yes" with an empty screenshot folder ends the turn; answered "no", the proposal comes next', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar({ mockups: 'A', technical: null }) } });
    mkdirSync(join(root, rel(name, 'sources/ui')), { recursive: true });
    written(root, rel(name, 'clarifications.md'));
    ends(stop(root));
    put(root, rel(name, 'clarifications.md'), clar({ mockups: 'B', technical: null }));
    goesOn(stop(root));
  });

  test('mockups answered "yes" go on once a screenshot is in the folder', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar({ mockups: 'A', technical: null }) } });
    put(root, rel(name, 'sources/ui/01-list.png'), 'png');
    written(root, rel(name, 'clarifications.md'));
    goesOn(stop(root));
  });

  test('an answered follow-up of the mockups question ("continue without mockups") lets planning go on', () => {
    const root = project();
    const followUp = question(4, 'Wait for the screenshots or continue without mockups? (follow-up to Q1)', 'B', ['Wait for the screenshots', 'Continue without mockups']);
    const name = change(root, { files: { 'clarifications.md': clar({ mockups: 'A', technical: null }).replace('### Q2.', `${followUp}\n### Q2.`) } });
    mkdirSync(join(root, rel(name, 'sources/ui')), { recursive: true });
    written(root, rel(name, 'clarifications.md'));
    goesOn(stop(root));
  });

  // @scenario workflow/planning-flow :: Lean change waits for screenshots
  test('a lean change with an empty screenshot folder before its proposal ends the turn', () => {
    const root = project();
    const name = change(root, { schema: 'lean' });
    mkdirSync(join(root, rel(name, 'sources/ui')), { recursive: true });
    touch(root, name);
    ends(stop(root));
    put(root, rel(name, 'sources/ui/01-list.png'), 'png');
    const r = stop(root);
    goesOn(r);
    assert.match(r.reason, /next artifact: proposal/);
  });

  // @scenario workflow/planning-flow :: Changed answer ends the turn
  test('an answer changed after the proposal was written ends the turn', () => {
    const root = project();
    const name = proposalWritten(root);
    goesOn(stop(root));
    put(root, rel(name, 'clarifications.md'), clar({ q2: 'B' }));
    ends(stop(root, { active: true }));
  });

  // @scenario workflow/planning-flow :: Write blocked by an open question is a wait
  test('a proposal write blocked by a blank answer lets the turn end, and the block names the question', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar({ q2: '', technical: null }) } });
    written(root, rel(name, 'clarifications.md'));
    const gate = hook('answers-gate.mjs', root, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(root, rel(name, 'proposal.md')), content: '# P\n' } });
    assert.equal(gate.code, 2);
    assert.match(gate.stderr, /Q2/);
    const r = stop(root);
    ends(r);
    // the wait is not a fix attempt: once answered, the proposal comes next at once
    put(root, rel(name, 'clarifications.md'), clar({ technical: null }));
    prompt(root, 'answered');
    goesOn(stop(root));
  });
});

describe('the developer pauses and resumes planning', { skip: cliSkipReason() }, () => {
  // @scenario workflow/planning-flow :: Developer pauses
  test('after "stop" and planning.mjs pause the turn ends, also after the next message', () => {
    const root = project();
    const name = proposalWritten(root);
    assert.equal(prompt(root, 'stop, I want to think about the scope').code, 0);
    const p = planning(root, 'pause', '--change', name);
    assert.equal(p.code, 0, p.out);
    ends(stop(root));
    assert.equal(existsSync(join(root, rel(name, 'specs'))), false);
    const q = prompt(root, 'why is the export in scope?');
    assert.equal(q.code, 0, q.stderr);
    assert.match(q.stdout, /paused/);
    ends(stop(root));
  });

  // @scenario workflow/planning-flow :: Developer resumes
  test('after "go on" and planning.mjs resume the next artifact is asked for again', () => {
    const root = project();
    const name = proposalWritten(root);
    planning(root, 'pause', '--change', name);
    ends(stop(root));
    assert.equal(prompt(root, 'go on').code, 0);
    const r = planning(root, 'resume', '--change', name);
    assert.equal(r.code, 0, r.out);
    const s = stop(root);
    goesOn(s);
    assert.match(s.reason, /next artifact: specs/);
  });

  test('a pause recorded in one session holds when another session writes an artifact of the change', () => {
    const root = project();
    const name = proposalWritten(root);
    planning(root, 'pause', '--change', name);
    const other = hook('artifact-feedback.mjs', root, { session_id: 'sess-2', hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, rel(name, 'proposal.md')), content: '' } });
    assert.equal(other.code, 0, other.stderr);
    const r = hook('planning-continue.mjs', root, { session_id: 'sess-2', hook_event_name: 'Stop', stop_hook_active: false });
    assert.equal(r.stdout.trim(), '');
  });
});

describe('a failing check stops planning', { skip: cliSkipReason() }, () => {
  // @scenario workflow/planning-flow :: Check still fails after two attempts
  test('a wait marked after the second fix attempt ends the turn, and the next message clears it', () => {
    const root = project();
    const name = proposalWritten(root);
    const w = planning(root, 'wait', '--change', name, '--reason', 'check-grounding still reports 1 error after two fix attempts');
    assert.equal(w.code, 0, w.out);
    ends(stop(root));
    ends(stop(root, { active: true }));
    prompt(root, 'I fixed the source, go on');
    goesOn(stop(root));
  });

  test('loop guard: two continuations without a new artifact, then the turn ends', () => {
    const root = project();
    proposalWritten(root);
    goesOn(stop(root));
    goesOn(stop(root, { active: true }));
    ends(stop(root, { active: true }));
    ends(stop(root, { active: true }));
    // a new message starts the count again
    prompt(root, 'go on');
    goesOn(stop(root));
  });

  test('a newly written artifact counts as progress for the loop guard', () => {
    const root = project();
    const name = proposalWritten(root);
    goesOn(stop(root));
    goesOn(stop(root, { active: true }));
    put(root, rel(name, 'specs/inventory/x/spec.md'), '# S\n');
    written(root, rel(name, 'specs/inventory/x/spec.md'));
    const r = stop(root, { active: true });
    goesOn(r);
    assert.match(r.reason, /next artifact: design/);
  });
});

describe('planning state is safe', { skip: cliSkipReason() }, () => {
  test('planning is complete: the turn ends', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar(), 'proposal.md': '# P\n', 'specs/inventory/x/spec.md': '# S\n', 'design.md': '# D\n', 'verification-plan.md': '# V\n', 'tasks.md': '# T\n\n- [ ] 1.1 x\n' } });
    written(root, rel(name, 'tasks.md'));
    ends(stop(root));
  });

  test('the session state lives in the temporary folder, never in the change; a broken state file fails open', () => {
    const root = project();
    const name = proposalWritten(root);
    const dir = join(root, '.tmp', 'sdd-kit-planning');
    const files = readdirSync(dir);
    assert.equal(files.length, 1, files.join(', '));
    assert.equal(JSON.parse(readFileSync(join(dir, files[0]), 'utf8')).change, name);
    assert.deepEqual(readdirSync(join(root, rel(name, ''))).sort(), ['.openspec.yaml', 'answers-lock.json', 'clarifications.md', 'proposal.md']);
    writeFileSync(join(dir, files[0]), '{not json');
    ends(stop(root));
  });

  test('a session id with path characters stays inside the state folder', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar(), 'proposal.md': '# P\n' } });
    const r = hook('artifact-feedback.mjs', root, { session_id: '../../evil', hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, rel(name, 'proposal.md')), content: '' } });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(existsSync(join(root, 'evil.json')), false);
    assert.equal(readdirSync(join(root, '.tmp', 'sdd-kit-planning')).length, 1);
  });

  test('no session id: nothing is recorded and the turn ends', () => {
    const root = project();
    const name = change(root, { files: { 'clarifications.md': clar(), 'proposal.md': '# P\n' } });
    const r = hook('artifact-feedback.mjs', root, { session_id: undefined, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, rel(name, 'proposal.md')), content: '' } });
    assert.equal(r.code, 0, r.stderr);
    const s = hook('planning-continue.mjs', root, { session_id: undefined, hook_event_name: 'Stop', stop_hook_active: false });
    assert.equal(s.code, 0, s.stderr);
    assert.equal(s.stdout.trim(), '');
  });

  test('without the OpenSpec CLI the hook fails open', () => {
    const root = project();
    proposalWritten(root);
    const r = spawnSync('node', [join(root, 'openspec/tooling/hooks/planning-continue.mjs')], {
      cwd: root,
      input: JSON.stringify({ session_id: SESSION, cwd: root, hook_event_name: 'Stop', stop_hook_active: false }),
      encoding: 'utf8',
      env: { ...env(root), OPENSPEC_BIN: join(root, 'no-such-openspec') },
    });
    assert.notEqual(r.status, 2);
    assert.equal(r.stdout.trim(), '');
  });
});

describe('planning.mjs', () => {
  test('usage errors and an unknown change are reported', () => {
    const root = project();
    assert.notEqual(planning(root).code, 0);
    assert.notEqual(planning(root, 'jump', '--change', CHANGE).code, 0);
    const r = planning(root, 'pause', '--change', 'no-such-change');
    assert.notEqual(r.code, 0);
    assert.match(r.out, /no-such-change/);
  });
});

describe('registration', () => {
  test('the fragment registers the Stop and UserPromptSubmit hooks and allows planning.mjs; no Notification hook', () => {
    const cmd = (event) => JSON.stringify(FRAGMENT.hooks[event] || []);
    assert.match(cmd('Stop'), /openspec\/tooling\/hooks\/planning-continue\.mjs/);
    assert.match(cmd('UserPromptSubmit'), /openspec\/tooling\/hooks\/planning-prompt\.mjs/);
    assert.equal(FRAGMENT.hooks.Notification, undefined);
    assert.ok(FRAGMENT.permissions.allow.includes('Bash(node openspec/tooling/bin/planning.mjs *)'));
  });
});
