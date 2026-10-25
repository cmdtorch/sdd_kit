#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// schema-starter — PreToolUse hook (Bash).
// Blocks `openspec new change ...` (also through the kit wrapper `node openspec/tooling/bin/openspec.mjs`)
// when the command names no schema (`--schema <name>` or `--schema=<name>`), and tells the agent to ask
// the developer which schema to use. The project's default schema does not count as a choice; any named
// schema, known or not, is passed through to OpenSpec. Commands run in a terminal are not affected.
import { runHook, block } from '../lib/hook-io.mjs';
import { isMain } from '../lib/report.mjs';

// `openspec`, `npx openspec`, `/path/to/openspec`, `node .../openspec.mjs`, followed by `new change`
const NEW_CHANGE = /(?:^|[\s(])(?:[^\s'"]*\/)?openspec(?:\.mjs)?['"]?\s+new\s+change(?=\s|$)/;
const NAMED = /(?:^|\s)--schema(?:=|\s+)(?!-)['"]?[^\s'"=]+/;

/** The block message: the three-choice starter menu. */
export function starterMessage() {
  return [
    'sdd-kit schema-starter: the change names no schema. Do not create it yet.',
    'Ask the developer with AskUserQuestion, one question "Which test cases does this change need?" with three choices:',
    '  - No test cases → `clarify`',
    '  - Test cases reviewed by the AI QA reviewer only → `clarify-ai-qa`',
    '  - Test cases reviewed by the AI QA reviewer, then a human QA → `clarify-qa`',
    'Then rerun the same command with `--schema <chosen>`.',
    'If the menu is dismissed: do not create the change; tell the developer to start again with /opsx:new <name>.',
    'If the answer is free text: explain the three choices and ask again.',
  ].join('\n');
}

/** Single commands of a shell line (split on ;, &&, ||, |, newlines; quoting is not parsed). */
function commands(line) {
  return line.split(/&&|\|\||[;|\n]/);
}

/** True when a Bash command line creates a change without naming a schema. */
export function needsStarter(line) {
  return commands(String(line)).some((c) => NEW_CHANGE.test(c) && !NAMED.test(c));
}

export function gate(input) {
  if (input.tool_name !== 'Bash') return null;
  return needsStarter(input.tool_input?.command ?? '') ? starterMessage() : null;
}

if (isMain(import.meta.url)) {
  runHook('schema-starter', (input) => {
    const message = gate(input);
    if (message) block(message);
  });
}
