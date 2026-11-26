#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// schema-starter — PreToolUse hook (Bash).
// Blocks `openspec new change ...` (also through the kit wrapper `node openspec/tooling/bin/openspec.mjs`)
// when the command names no schema (`--schema <name>` or `--schema=<name>`), and tells the agent to ask
// the developer the depth level of the questions and create the change on `clarify`. The project's default
// schema does not count as a choice; any named schema, known or not (a test-case schema too), is passed
// through to OpenSpec. Commands run in a terminal are not affected.
import { runHook, block } from '../lib/hook-io.mjs';
import { isMain } from '../lib/report.mjs';

// `openspec`, `npx openspec`, `/path/to/openspec`, `node .../openspec.mjs`, followed by `new change`
const NEW_CHANGE = /(?:^|[\s(])(?:[^\s'"]*\/)?openspec(?:\.mjs)?['"]?\s+new\s+change(?=\s|$)/;
const NAMED = /(?:^|\s)--schema(?:=|\s+)(?!-)['"]?[^\s'"=]+/;

/** The block message: the starter menu, which asks the depth level of the questions. */
export function starterMessage() {
  return [
    'sdd-kit schema-starter: the change names no schema. Do not create it yet; show the starter menu first.',
    'Ask the developer with AskUserQuestion, one question "How deep should the questions about this change go?" with three choices:',
    '  - `low` — ask from the sources only and settle what the user does not see',
    '  - `medium` (recommended) — read the touched area of the code first',
    '  - `high` — investigate the affected modules and check the consequences of each answer',
    'Then rerun the same command with `--schema clarify`, and write the chosen level as the line `Depth: <level>` of clarifications.md (e.g. `Depth: high`).',
    'If the menu is dismissed: do not create the change; tell the developer to start again with /openspec-new-change <name>.',
    'If the answer is free text: explain the three levels and ask again.',
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
