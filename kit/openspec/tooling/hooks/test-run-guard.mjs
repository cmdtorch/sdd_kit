#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// test-run-guard — PreToolUse hook (Bash). Holds the two test-run rules of openspec/protocols/testing.md where the
// project's `openspec/test-commands.md` allows it, from the `Full suite` commands of that file alone:
//   - inside a `task-implementer` subagent (the input's `agent_type`, docs/openspec-facts.md K19) the full suite is
//     blocked: a task group or a fix runs only its own test files, the full suite runs at the end, by the main agent;
//   - anywhere else a long full suite (2 minutes or more, or no duration written) is blocked when it is not started
//     with the Bash tool's background mode (`tool_input.run_in_background`, K20).
// A part of the command line (split at `;`, `&&`, `||`, `|`, `&`, newlines) matches when its words, after leading
// VAR=value, the wrappers and trailing redirections are dropped, equal the words of a full-suite command. A command
// inside a quoted string (`bash -c "…"`) is not looked at. The hook reads no change and no stamp, names no test tool
// and fails open: no file, `none`, no `Full suite` item or any error blocks nothing.
import { runHook, hookRoot, block } from '../lib/hook-io.mjs';
import { isMain } from '../lib/report.mjs';
import { commandParts, words } from '../lib/command-line.mjs';
import { readTestCommands, TEST_COMMANDS_FILE } from '../lib/test-commands.mjs';

export const SUBAGENT = 'task-implementer';
export const LONG_MINUTES = 2;

const QUOTE = '\u0000';
const DUP = '\u0001dup\u0001'; // a complete redirection like `2>&1`, kept as one word

/** A complete redirection word (`>out.log`, `2>/dev/null`, `2>&1`), an operator awaiting its target (`>`), or neither. */
function redirection(word) {
  if (word === DUP || /^\d*(>>?|<)\S+$/.test(word)) return 'complete';
  if (/^\d*(>>?|<)$/.test(word)) return 'operator';
  return null;
}

/** The command words of a part without its trailing redirections, or null when something else follows them. */
function commandWords(part) {
  const w = words(part);
  const k = w.findIndex((x) => redirection(x));
  if (k < 0) return w;
  for (let i = k; i < w.length; i++) {
    const r = redirection(w[i]);
    if (r === 'complete') continue;
    if (r === 'operator' && i + 1 < w.length) {
      i++;
      continue;
    }
    return null;
  }
  return w.slice(0, k);
}

/** The parts of a command line, each as its normalised words; text inside quotes never splits a part. */
export function partWords(command) {
  const quoted = [];
  const masked = String(command)
    .replace(/"(?:[^"\\]|\\.)*"|'[^']*'/g, (q) => {
      quoted.push(q);
      return `${QUOTE}${quoted.length - 1}${QUOTE}`;
    })
    .replace(/\d*>&(\d+|-)/g, ` ${DUP} `)
    .replace(/&>/g, '>');
  const restore = (s) => s.replace(new RegExp(`${QUOTE}(\\d+)${QUOTE}`, 'g'), (_, i) => quoted[Number(i)]);
  return commandParts(masked)
    .map((p) => commandWords(restore(p)))
    .filter((w) => w && w.length);
}

/** The first `Full suite` item the command line runs: { section, command, minutes, oneFile } or null. */
export function fullSuiteRun(parsed, command) {
  if (!parsed || parsed.none) return null;
  const parts = partWords(command).map((w) => w.join(' '));
  for (const [section, items] of Object.entries(parsed.sections || {})) {
    const suite = items['Full suite'];
    if (!suite) continue;
    const target = words(suite.command).join(' ');
    if (target && parts.includes(target)) return { section, command: suite.command, minutes: suite.minutes, oneFile: items['One file']?.command || null };
  }
  return null;
}

/** The block message for a hook input, or null when the call passes. */
export function testRunReason(input, parsed) {
  if (input.tool_name !== 'Bash') return null;
  const run = fullSuiteRun(parsed, input.tool_input?.command || '');
  if (!run) return null;
  const where = `\`${run.command}\` is the project's full-suite command (${TEST_COMMANDS_FILE}${run.section ? `, section \`${run.section}\`` : ''})`;
  if (input.agent_type === SUBAGENT) {
    const oneFile = run.oneFile ? `\`${run.oneFile}\`` : "the project's one-file command";
    return [
      `sdd-kit test-run-guard: ${where}, and a ${SUBAGENT} subagent does not run it.`,
      `A task group, and every fix, runs only its own test files with ${oneFile}, or only the failed tests; the full suite runs once at the end of apply, by the main agent (openspec/protocols/testing.md).`,
    ].join('\n');
  }
  const long = run.minutes === null || run.minutes >= LONG_MINUTES;
  if (long && input.tool_input?.run_in_background !== true) {
    const how = run.minutes === null ? 'has no duration written, so it counts as long' : `takes ${run.minutes} min`;
    return [
      `sdd-kit test-run-guard: ${where} and ${how}.`,
      'Start it in the background (the Bash tool with run_in_background set to true), end your step and wait for the notice that it ended, without sleep-and-check commands (openspec/protocols/testing.md).',
    ].join('\n');
  }
  return null;
}

if (isMain(import.meta.url)) {
  runHook('test-run-guard', (input) => {
    if (input.tool_name !== 'Bash') return;
    const root = hookRoot(input);
    if (!root) return;
    const reason = testRunReason(input, readTestCommands(root));
    if (reason) block(reason);
  });
}
