#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Marks where the automatic continuation of planning stops (openspec/protocols/planning.md, lib/session-state.mjs):
//   node openspec/tooling/bin/planning.mjs wait   --change <name> [--reason <text>]
//       the agent waits for the developer (a question asked in the chat, a check that still fails after two fix
//       attempts); the developer's next message ends the wait
//   node openspec/tooling/bin/planning.mjs pause  --change <name> [--reason <text>]
//       the developer asked to stop or pause planning; it stays paused until resume
//   node openspec/tooling/bin/planning.mjs resume --change <name>
//       the developer said to go on: the pause and the wait end
// It marks every session of this project that works on the change (the session state of the Stop hook
// planning-continue, in the system temporary folder). Nothing is written into the change.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from '../lib/report.mjs';
import { findRoot, changeDir } from '../lib/project.mjs';
import { updateChange } from '../lib/session-state.mjs';

const USAGE = 'Usage: planning.mjs wait|pause|resume --change <name> [--reason <text>]';
const ACTIONS = {
  wait: (reason) => (s) => ({ ...s, wait: { reason: reason || null, at: new Date().toISOString() } }),
  pause: (reason) => (s) => ({ ...s, pause: { reason: reason || null, at: new Date().toISOString() } }),
  resume: () => (s) => ({ ...s, pause: null, wait: null, continuations: 0, next: null }),
};
const DONE = {
  wait: 'waits for the developer: end your turn; their next message ends the wait',
  pause: 'is paused: end your turn, answer the developer and write no artifact until they tell you to go on (then run resume)',
  resume: 'goes on: write its next artifact',
};

const args = parseArgs(process.argv.slice(2), ['help']);
const action = args._[0];
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!ACTIONS[action] || typeof args.change !== 'string' || !args.change) {
  console.error(USAGE);
  process.exit(1);
}
const root = args.root || findRoot();
if (!root || !existsSync(join(changeDir(root, args.change), '.openspec.yaml'))) {
  console.error(`sdd-kit planning: change "${args.change}" not found`);
  process.exit(1);
}
const n = updateChange(root, args.change, ACTIONS[action](typeof args.reason === 'string' ? args.reason : null));
const note = n ? '' : ' (no session has written an artifact of this change yet, so nothing continues it automatically anyway)';
console.log(`sdd-kit planning: change "${args.change}" ${DONE[action]}${note}.`);
