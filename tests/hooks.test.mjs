// Tests for the kit hooks (run as real processes with Claude Code-shaped stdin) and settings merging.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { mergeSettings, removeKitHooks, isKitHook } from '../kit/core/openspec/tooling/lib/settings-merge.mjs';
import { bashTargets } from '../kit/core/openspec/tooling/hooks/answers-gate.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(REPO, 'kit', 'core', 'openspec', 'tooling', 'hooks');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;
const FRAGMENT = JSON.parse(readFileSync(join(REPO, 'kit', 'core', 'claude-settings.fragment.json'), 'utf8'));

function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-hooks-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  return root;
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
const pre = (root, tool_name, tool_input) => hook('answers-gate.mjs', root, { hook_event_name: 'PreToolUse', tool_name, tool_input });
const unconfirmMain = (root) =>
  plant(root, `${C}/clarifications.md`, '- The export period is filtered by the sale date\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]: Looks correct', '- The export period is filtered by the sale date\n\nDoes this all look correct before I continue?\n\n- Looks correct\n- Request changes\n\n[Answer]:');

describe('answers-gate (PreToolUse)', () => {
  test('allows writing the proposal when the Main round is confirmed', () => {
    const root = project();
    const r = pre(root, 'Write', { file_path: join(root, C, 'proposal.md'), content: '## Why\n' });
    assert.equal(r.code, 0, r.stderr);
  });

  test('blocks Write of the proposal while the Main round is unconfirmed, and says why', () => {
    const root = project();
    unconfirmMain(root);
    const r = pre(root, 'Write', { file_path: join(root, C, 'proposal.md'), content: '## Why\n' });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /proposal of change "add-sales-export" cannot be written yet — the Main round/);
    assert.match(r.stderr, /"Main" round summary is not confirmed/);
    assert.match(r.stderr, /openspec\/protocols\/questions\.md/);
  });

  test('blocks Edit (real Claude Code input shape) of design.md while an answer is blank', () => {
    const root = project();
    rmSync(join(root, C, 'clarifications.md'));
    writeFileSync(join(root, C, 'clarifications.md'), '# Clarifications\n\n## Sources\n\n- [desc] Developer description: "x"\n\n## Main round\n\n### Q1. A?\nFor: Dev\nWhy this is asked: x\n- A. a\n- X. Other (please specify)\n\n[Answer]:\n');
    const r = pre(root, 'Edit', { file_path: join(root, C, 'design.md'), old_string: 'a', new_string: 'b', replace_all: false });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /"## Design round" is missing/);
  });

  test('blocks a spec file when the Specs round is missing; relative paths resolve against cwd', () => {
    const root = project();
    plant(root, `${C}/clarifications.md`, '## Specs round', '## Notes');
    const r = pre(root, 'Write', { file_path: `${C}/specs/inventory/new-cap/spec.md`, content: 'x' });
    assert.equal(r.code, 2);
    assert.match(r.stderr, /specs of change/);
  });

  test('MultiEdit with per-edit file paths is gated', () => {
    const root = project();
    unconfirmMain(root);
    const r = pre(root, 'MultiEdit', { edits: [{ file_path: join(root, 'README.md'), old_string: 'a', new_string: 'b' }, { file_path: join(root, C, 'proposal.md'), old_string: 'a', new_string: 'b' }] });
    assert.equal(r.code, 2);
  });

  test('never blocks clarifications.md, tasks.md, sources, other files, archived or non-kit changes', () => {
    const root = project();
    unconfirmMain(root);
    for (const f of [`${C}/clarifications.md`, `${C}/tasks.md`, `${C}/sources/D2.md`, 'apps/x.py', 'openspec/changes/archive/2026-01-01-old/proposal.md']) {
      assert.equal(pre(root, 'Write', { file_path: join(root, f), content: 'x' }).code, 0, f);
    }
    plant(root, `${C}/.openspec.yaml`, 'schema: clarify', 'schema: spec-driven');
    assert.equal(pre(root, 'Write', { file_path: join(root, C, 'proposal.md'), content: 'x' }).code, 0);
  });

  test('Bash: writing a gated artifact through the shell is blocked, reading is not', () => {
    const root = project();
    unconfirmMain(root);
    assert.equal(pre(root, 'Bash', { command: `cat > ${C}/proposal.md <<'EOF'\n## Why\nEOF` }).code, 2);
    assert.equal(pre(root, 'Bash', { command: `cp /tmp/p.md ${join(root, C, 'proposal.md')}` }).code, 2);
    assert.equal(pre(root, 'Bash', { command: `cat ${C}/proposal.md` }).code, 0);
    assert.equal(pre(root, 'Bash', { command: 'make test 2>&1' }).code, 0);
  });

  test('bashTargets heuristic', () => {
    assert.deepEqual(bashTargets('echo x | tee openspec/changes/a/design.md'), ['openspec/changes/a/design.md']);
    assert.deepEqual(bashTargets("sed -i 's/a/b/' ./openspec/changes/a/specs/x/spec.md"), ['./openspec/changes/a/specs/x/spec.md']);
    assert.deepEqual(bashTargets('grep -n x openspec/changes/a/proposal.md'), []);
    assert.deepEqual(bashTargets('cat openspec/changes/a/tasks.md > /tmp/t'), []);
  });

  test('fails open: malformed input or a project without openspec/ never blocks', () => {
    const root = project();
    const bad = spawnSync('node', [join(HOOKS, 'answers-gate.mjs')], { cwd: root, input: '{not json', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
    assert.notEqual(bad.status, 2);
    assert.match(bad.stderr, /internal error \(not blocking\)/);
    const empty = mkdtempSync(join(tmpdir(), 'sdd-kit-empty-'));
    assert.equal(hook('answers-gate.mjs', empty, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(empty, 'x.md') } }, { CLAUDE_PROJECT_DIR: empty }).code, 0);
  });
});

describe('artifact-feedback (PostToolUse)', () => {
  const post = (root, file) => hook('artifact-feedback.mjs', root, { hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: join(root, file), content: '' } });

  test('silent when the written artifact is clean', () => {
    const root = project();
    for (const f of ['proposal.md', 'design.md', 'specs/inventory/sales-export/spec.md', 'verification-plan.md', 'verification.md', 'clarifications.md']) {
      const r = post(root, `${C}/${f}`);
      assert.equal(r.code, 0);
      assert.equal(r.stdout, '', f);
    }
  });

  test('returns grounding problems of the proposal as additional context', () => {
    const root = project();
    plant(root, `${C}/proposal.md`, '## What Changes\n', '## What Changes\n\nAlso faster closing.\n');
    const r = post(root, `${C}/proposal.md`);
    assert.equal(r.code, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
    assert.match(out.hookSpecificOutput.additionalContext, /check-grounding found 1 problem\(s\) after writing proposal\.md/);
    assert.match(out.hookSpecificOutput.additionalContext, /untagged statement: "Also faster closing\."/);
  });

  test('returns spec problems', () => {
    const root = project();
    plant(root, `${C}/specs/inventory/sales-export/spec.md`, '#### Scenario: Empty period', '#### Scenario: Successful export');
    const out = JSON.parse(post(root, `${C}/specs/inventory/sales-export/spec.md`).stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /check-specs/);
  });
});

describe('session-start', () => {
  const fakeOpenspec = (version) => {
    const dir = mkdtempSync(join(tmpdir(), 'sdd-kit-bin-'));
    const bin = join(dir, 'openspec');
    writeFileSync(bin, `#!/bin/sh\necho ${version}\n`);
    chmodSync(bin, 0o755);
    return bin;
  };
  const start = (root, version = '1.13.0') => hook('session-start.mjs', root, { hook_event_name: 'SessionStart', source: 'startup' }, { OPENSPEC_BIN: fakeOpenspec(version) });

  test('reports where each kit change stands', () => {
    const root = project();
    unconfirmMain(root);
    rmSync(join(root, C, 'verification.md'));
    plant(root, `${C}/tasks.md`, '- [x] 2.1', '- [ ] 2.1');
    mkdirSync(join(root, 'openspec/changes/new-thing'));
    writeFileSync(join(root, 'openspec/changes/new-thing/.openspec.yaml'), 'schema: clarify\n');
    mkdirSync(join(root, 'openspec/changes/legacy'));
    writeFileSync(join(root, 'openspec/changes/legacy/.openspec.yaml'), 'schema: spec-driven\n');
    const r = start(root);
    assert.equal(r.code, 0, r.stderr);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /- add-sales-export \[clarify\] — apply: 3\/4 tasks done; Main round: summary waiting for "Looks correct" \(now: blank\)/);
    assert.match(ctx, /- new-thing \[clarify\] — next artifact: clarifications/);
    assert.match(ctx, /1 other change\(s\) use their own schema/);
    assert.doesNotMatch(ctx, /WARNING/);
  });

  test('lists unanswered questions', () => {
    const root = project();
    plant(root, `${C}/clarifications.md`, '[Answer]: B\n\n### Q2.', '[Answer]:\n\n### Q2.');
    const ctx = JSON.parse(start(root).stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /Main round: 1 unanswered \(Q1\)/);
  });

  test('warns about a CLI version mismatch and about skills drift', () => {
    const root = project();
    writeFileSync(join(root, 'openspec/tooling/kit.json'), JSON.stringify({ kit: 'sdd-kit', openspecVersion: '1.13.0' }));
    mkdirSync(join(root, '.claude/skills/openspec-propose'), { recursive: true });
    const ctx = JSON.parse(start(root, '1.12.0').stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /openspec CLI is 1\.12\.0, the kit is pinned to 1\.13\.0/);
    assert.match(ctx, /openspec-propose is installed/);
    assert.match(ctx, /openspec-continue-change is missing/);
  });

  test('prints nothing in a project without changes', () => {
    const root = project();
    rmSync(join(root, C), { recursive: true });
    assert.equal(start(root).stdout, '');
  });
});

describe('settings merge (D10)', () => {
  const pilot = JSON.parse(readFileSync(join(REPO, 'fixtures', 'claude-settings', 'pilot.json'), 'utf8'));

  test("keeps the project's own hooks (pilot graphify hooks) and adds the kit's after them", () => {
    const merged = mergeSettings(pilot, FRAGMENT);
    assert.deepEqual(merged.hooks.PreToolUse.slice(0, 2), pilot.hooks.PreToolUse);
    assert.equal(merged.hooks.PreToolUse.length, 2 + FRAGMENT.hooks.PreToolUse.length);
    assert.ok(merged.hooks.PreToolUse.slice(2).every((g) => g.hooks.every(isKitHook)));
    assert.ok(merged.hooks.SessionStart && merged.hooks.PostToolUse && merged.hooks.Stop);
  });

  test('idempotent: merging twice equals merging once', () => {
    const once = mergeSettings(pilot, FRAGMENT);
    assert.deepEqual(mergeSettings(once, FRAGMENT), once);
  });

  test('re-run replaces old kit hooks (update), even inside a mixed group', () => {
    const old = mergeSettings(pilot, FRAGMENT);
    old.hooks.PreToolUse[0].hooks.push({ type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/openspec/tooling/hooks/old-hook.mjs"' });
    const merged = mergeSettings(old, FRAGMENT);
    assert.deepEqual(merged.hooks.PreToolUse[0], pilot.hooks.PreToolUse[0]);
    assert.ok(!JSON.stringify(merged).includes('old-hook'));
  });

  test('keeps permissions, plugins and unknown keys; removeKitHooks restores the original', () => {
    const settings = { permissions: { allow: ['Bash(make test)'] }, enabledPlugins: { 'tdd-guard@tdd-guard': true }, custom: 1, ...pilot };
    const merged = mergeSettings(settings, FRAGMENT);
    assert.equal(merged.permissions.allow[0], 'Bash(make test)', 'project permissions first, untouched');
    assert.ok(merged.permissions.allow.includes('Bash(node openspec/tooling/bin/review-input.mjs *)'));
    assert.deepEqual(mergeSettings(merged, FRAGMENT), merged, 'no duplicate permissions on re-run');
    assert.deepEqual(merged.enabledPlugins, settings.enabledPlugins);
    assert.equal(merged.custom, 1);
    assert.deepEqual(removeKitHooks(merged), settings);
  });

  test('empty or missing settings', () => {
    assert.deepEqual(mergeSettings(undefined, FRAGMENT), FRAGMENT);
    assert.deepEqual(removeKitHooks(mergeSettings({}, FRAGMENT)), {});
  });

  test('refuses settings it cannot merge safely', () => {
    assert.throws(() => mergeSettings([], FRAGMENT), /must contain a JSON object/);
    assert.throws(() => mergeSettings({ hooks: [] }, FRAGMENT), /"hooks" must be an object/);
  });
});
