// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Claude Code hook plumbing (semantics verified against Claude Code 2.1.288, docs/openspec-facts.md §9):
//   - stdin: JSON with hook_event_name, cwd, tool_name, tool_input, stop_hook_active, ...
//   - PreToolUse: exit 2 blocks the tool call; stderr is shown to Claude
//   - SessionStart / PostToolUse: JSON on stdout with hookSpecificOutput.additionalContext
// Hooks fail open: an unexpected error never blocks the user (exit 1 = non-blocking); CI is the backstop.
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { findRoot } from './project.mjs';

export function readInput() {
  const raw = readFileSync(0, 'utf8');
  return raw.trim() ? JSON.parse(raw) : {};
}

/** Project root for a hook call: $CLAUDE_PROJECT_DIR, else the session cwd, searched upwards for openspec/. */
export function hookRoot(input) {
  return findRoot(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

/** Absolute path of a tool's file argument (relative paths resolve against the session cwd). */
export function absPath(input, p) {
  return isAbsolute(p) ? p : resolve(input.cwd || process.cwd(), p);
}

/** Files a Write / Edit / MultiEdit call touches. */
export function touchedFiles(input) {
  const ti = input.tool_input || {};
  const files = [];
  if (typeof ti.file_path === 'string') files.push(ti.file_path);
  if (Array.isArray(ti.edits)) for (const e of ti.edits) if (e && typeof e.file_path === 'string') files.push(e.file_path);
  return [...new Set(files.map((f) => absPath(input, f)))];
}

/** Blocks a PreToolUse call: the message reaches Claude. Never returns. */
export function block(message) {
  process.stderr.write(message.endsWith('\n') ? message : message + '\n');
  process.exit(2);
}

/** Adds context for Claude (SessionStart, PostToolUse, UserPromptSubmit). */
export function addContext(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }) + '\n');
}

/** Runs a hook body; unexpected errors are reported but never block (fail open). */
export async function runHook(name, body) {
  try {
    await body(readInput());
  } catch (e) {
    process.stderr.write(`sdd-kit ${name}: internal error (not blocking): ${e && e.stack ? e.stack : e}\n`);
    process.exit(1);
  }
}
