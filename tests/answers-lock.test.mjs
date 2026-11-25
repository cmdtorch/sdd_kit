// Tests for the answers lock (lib/answers-lock.mjs): artifact-feedback records the answers an artifact was written
// from, answers-gate blocks later artifacts and task check-offs while an answer differs, check-answers reports it.
// The hooks and the check run as real processes in a temporary project with a prepared change.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { LOCK_FILE, lockDifferences } from '../kit/openspec/tooling/lib/answers-lock.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(REPO, 'kit', 'openspec', 'tooling', 'hooks');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;
const CLAR = `${C}/clarifications.md`;
const SPEC = `${C}/specs/inventory/sales-export/spec.md`;

const question = (n, title, answer) =>
  `### Q${n}. ${title}\nWhy this is asked: it decides a rule of the export.\n- A. Yes\n- B. No\n- C. Not yet defined\n- X. Other (please specify)\n\n[Answer]: ${answer}\n`;
/** A new-rules clarifications file: Main Q1–Q3 (Q3 answered `q3`), Technical Q4 (answered `q4`). */
const clar = ({ q3 = 'B', q4 = 'A' } = {}) => `# Clarifications — ${CHANGE}

Depth: medium
Answer mode: file

## Sources

- [desc] Developer description: "Sales export to Excel for accountants"
- [D1] Client request — \`sources/D1.md\`

## Main round

${question(1, 'Are there UI mockups for this change? (UI mockups)', 'B')}
${question(2, 'Do accountants download the export?', 'A')}
${question(3, 'Is the monthly email part of this change?', q3)}
## Technical round

${question(4, 'Is an empty period a file with the header row only?', q4)}`;

function project({ stamp = '0.6.0', schema = 'clarify' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-lock-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'openspec'), join(root, 'openspec'), { recursive: true });
  writeFileSync(join(root, C, '.openspec.yaml'), `schema: ${schema}\ncreated: 2026-10-03\nx-sdd-kit: ${stamp}\n`);
  writeFileSync(join(root, CLAR), clar());
  return root;
}
const setAnswers = (root, answers) => writeFileSync(join(root, CLAR), clar(answers));

function hook(name, root, input) {
  const r = spawnSync('node', [join(HOOKS, name)], {
    cwd: root,
    input: JSON.stringify({ session_id: 's', cwd: root, permission_mode: 'default', ...input }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}
/** The artifact-feedback hook after `file` was written (the file itself is already in place). */
const written = (root, file) => hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, file), content: '' } });
const pre = (root, tool_name, tool_input) => hook('answers-gate.mjs', root, { hook_event_name: 'PreToolUse', tool_name, tool_input });
const writeSpec = (root) => pre(root, 'Write', { file_path: join(root, SPEC), content: readFileSync(join(root, SPEC), 'utf8') });
/** Checks off task 2.2 (planted open first). */
function checkOff(root) {
  const tasks = join(root, C, 'tasks.md');
  writeFileSync(tasks, readFileSync(tasks, 'utf8').replace('- [x] 2.2', '- [ ] 2.2'));
  return pre(root, 'Edit', { file_path: tasks, old_string: '- [ ] 2.2', new_string: '- [x] 2.2' });
}
function checkAnswers(root) {
  const r = spawnSync('node', [join(root, 'openspec/tooling/checks/check-answers.mjs'), '--change', CHANGE], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}
const ALL = [`${C}/proposal.md`, SPEC, `${C}/design.md`, `${C}/verification-plan.md`, `${C}/tasks.md`];
const writeAll = (root) => {
  for (const f of ALL) assert.equal(written(root, f).code, 0, f);
};

describe('answers lock: written artifacts record their answers', () => {
  test('artifact-feedback writes one entry per artifact of a new-rules change; the round hashes are SHA-256', () => {
    const root = project();
    writeAll(root);
    const lock = JSON.parse(readFileSync(join(root, C, LOCK_FILE), 'utf8'));
    assert.deepEqual(Object.keys(lock.artifacts).sort(), ['design', 'proposal', 'specs', 'tasks', 'verification-plan']);
    assert.deepEqual(Object.keys(lock.artifacts.proposal.rounds), ['Main']);
    assert.deepEqual(Object.keys(lock.artifacts.tasks.rounds).sort(), ['Main', 'Technical']);
    assert.match(lock.artifacts.proposal.rounds.Main, /^[0-9a-f]{64}$/);
    assert.deepEqual(lockDifferences(root, CHANGE), []);
  });

  test('no lock for a change stamped 0.5.0, a test-case schema or lean', () => {
    for (const opts of [{ stamp: '0.5.0' }, { schema: 'clarify-qa' }, { schema: 'lean' }]) {
      const root = project(opts);
      writeAll(root);
      assert.equal(existsSync(join(root, C, LOCK_FILE)), false, JSON.stringify(opts));
    }
  });

  test('a rewrite after a changed answer refreshes the entry and counts a revision', () => {
    const root = project();
    writeAll(root);
    setAnswers(root, { q4: 'B' });
    written(root, SPEC);
    const lock = JSON.parse(readFileSync(join(root, C, LOCK_FILE), 'utf8'));
    assert.equal(lock.artifacts.specs.revision, 2);
    assert.equal(lock.artifacts.design.revision, 1);
  });
});

describe('answers lock: a changed answer stops planning and apply', () => {
  // @scenario questions/rounds :: Answer changed after the proposal
  test('a Main answer changed after the proposal blocks the specs, naming the question and the proposal', () => {
    const root = project();
    assert.equal(written(root, `${C}/proposal.md`).code, 0);
    setAnswers(root, { q3: 'C' });
    const r = writeSpec(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /specs of change "add-sales-export" cannot be written yet/);
    assert.match(r.stderr, /Q3 \(Main round\): proposal/);
    assert.doesNotMatch(r.stderr, /Q[124]\b/);
    // the update itself, rewriting the proposal, is not blocked
    assert.equal(pre(root, 'Write', { file_path: join(root, C, 'proposal.md'), content: readFileSync(join(root, C, 'proposal.md'), 'utf8') }).code, 0);
  });

  // @scenario questions/rounds :: Technical round answer changed after the tasks
  test('a Technical answer changed after the tasks names the specs, the design, the plan and the tasks, not the proposal', () => {
    const root = project();
    writeAll(root);
    setAnswers(root, { q4: 'B' });
    const r = checkOff(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /Q4 \(Technical round\): specs, design, verification-plan, tasks/);
    assert.doesNotMatch(r.stderr, /proposal/);
    const ci = checkAnswers(root);
    assert.equal(ci.code, 1);
    assert.match(ci.out, /Q4 changed after specs, design, verification-plan, tasks were written from the earlier answer/);
    assert.doesNotMatch(ci.out, /proposal/);
  });

  // @scenario questions/rounds :: Earlier answer restored
  test('restoring the earlier answer lets the specs be written again', () => {
    const root = project();
    written(root, `${C}/proposal.md`);
    setAnswers(root, { q3: 'C' });
    assert.equal(writeSpec(root).code, 2);
    setAnswers(root, { q3: 'B' });
    const r = writeSpec(root);
    assert.equal(r.code, 0, r.stderr);
  });

  // @scenario questions/rounds :: Added spaces are not a change
  test('spaces added at the ends of an answer are not a change', () => {
    const root = project();
    written(root, `${C}/proposal.md`);
    setAnswers(root, { q3: '  B   ' });
    const r = writeSpec(root);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(lockDifferences(root, CHANGE), []);
  });

  // @scenario questions/rounds :: Answer changed before any artifact
  test('an answer changed before any artifact was written is no change: the proposal is written from it', () => {
    const root = project();
    setAnswers(root, { q3: 'C' });
    const r = pre(root, 'Write', { file_path: join(root, C, 'proposal.md'), content: readFileSync(join(root, C, 'proposal.md'), 'utf8') });
    assert.equal(r.code, 0, r.stderr);
    written(root, `${C}/proposal.md`);
    assert.equal(writeSpec(root).code, 0);
    assert.deepEqual(lockDifferences(root, CHANGE), []);
  });

  // @scenario questions/rounds :: Answer changed before apply
  test('with complete planning a changed Main answer stops apply: check-answers fails and no task is checked off', () => {
    const root = project();
    writeAll(root);
    setAnswers(root, { q3: 'C' });
    const ci = checkAnswers(root);
    assert.equal(ci.code, 1);
    assert.match(ci.out, /Q3 changed after proposal, specs, design, verification-plan, tasks were written from the earlier answer/);
    const r = checkOff(root);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /tasks of change "add-sales-export" cannot be checked off yet/);
    assert.match(r.stderr, /Q3 \(Main round\): proposal, specs, design, verification-plan, tasks/);
  });
});

describe('answers lock: session start', () => {
  test('a new-rules change is reported with its open questions and a changed answer, without "Looks correct"', () => {
    const root = project();
    written(root, `${C}/proposal.md`);
    setAnswers(root, { q3: 'C', q4: '' });
    const r = hook('session-start.mjs', root, { hook_event_name: 'SessionStart', source: 'startup' });
    assert.equal(r.code, 0, r.stderr);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Technical round: 1 unanswered \(Q4\)/);
    assert.match(ctx, /changed answer: Q3 \(proposal written from the earlier answer\)/);
    assert.doesNotMatch(ctx, /Looks correct|summary/);
  });
});
