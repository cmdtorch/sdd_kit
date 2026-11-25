#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// planning-prompt — UserPromptSubmit hook. Never blocks. A message of the developer ends a wait the agent marked
// (bin/planning.mjs wait: a question asked in the chat, a check that still fails after two fix attempts) and starts
// the loop guard of planning-continue again (lib/session-state.mjs). A pause stays until
// `planning.mjs resume`; while it holds, the agent is reminded that planning of the change is paused
// (openspec/protocols/planning.md).
import { resolve } from 'node:path';
import { runHook, hookRoot, addContext } from '../lib/hook-io.mjs';
import { readSession, writeSession } from '../lib/session-state.mjs';
import { isMain } from '../lib/report.mjs';

/** Clears the wait of the session; returns the reminder for a paused change, or null. */
export function onPrompt(input) {
  const state = readSession(input.session_id);
  if (!state || typeof state.change !== 'string') return null;
  const root = hookRoot(input);
  if (!root || resolve(String(state.root)) !== resolve(root)) return null;
  writeSession(input.session_id, { ...state, wait: null, continuations: 0, next: null });
  if (!state.pause) return null;
  return `sdd-kit: planning of change "${state.change}" is paused by the developer (openspec/protocols/planning.md). Answer the developer and write no artifact of the change. When they tell you to go on, run \`node openspec/tooling/bin/planning.mjs resume --change ${state.change}\` and continue with its next artifact.`;
}

if (isMain(import.meta.url)) {
  runHook('planning-prompt', (input) => {
    const text = onPrompt(input);
    if (text) addContext('UserPromptSubmit', text);
  });
}
