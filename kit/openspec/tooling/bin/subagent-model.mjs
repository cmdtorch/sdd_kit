#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The model to pass to an implementation subagent (task groups, their replacements and collision fixes;
// openspec/protocols/subagents.md),
// from `x-sdd-kit-subagent-model` at the top level of openspec/config.yaml.
//   node openspec/tooling/bin/subagent-model.mjs [--json] [--root <dir>]
// Prints one line: the model, or `inherit` (no key, `inherit`, or an unknown value) for the main chat's model,
// i.e. no model override. An unknown value also prints a warning on stderr; say it in the chat.
import { findRoot, subagentModel, subagentModelWarning } from '../lib/project.mjs';
import { parseArgs, isMain } from '../lib/report.mjs';

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['json', 'help']);
  if (args.help) {
    console.log('Usage: subagent-model.mjs [--json] [--root <dir>]');
    process.exit(0);
  }
  const root = args.root || findRoot();
  if (!root) {
    console.error('subagent-model: no openspec/ directory found');
    process.exit(1);
  }
  const s = subagentModel(root);
  const warning = s.known ? null : `${subagentModelWarning(s.value)}; implementation subagents run on the main chat's model`;
  if (args.json) console.log(JSON.stringify({ setting: s.value, model: s.model, warning }));
  else {
    if (warning) console.error(`warning: ${warning}`);
    console.log(s.model);
  }
}
