#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Runs the OpenSpec CLI with the kit's workflow profile (decision D20):
//   node openspec/tooling/bin/openspec.mjs update        ← use this instead of a plain `openspec update`
//   node openspec/tooling/bin/openspec.mjs init --tools claude    ← `--scope project` is added when no scope is named
// It points XDG_CONFIG_HOME at openspec/tooling/xdg for this one process, so the committed profile
// (new, continue, verify, explore, apply, update, sync, archive — no propose) is used and the
// developer's own global OpenSpec config is neither used nor rewritten (docs/openspec-facts.md W4–W6).
// Telemetry is off. Warns when the CLI version differs from the pinned one (openspec/tooling/kit.json).
// The OpenSpec skills stay in the project (.agents/skills/, linked from .claude/skills/): an `init` without
// `--scope` would install them machine-wide, so the wrapper adds `--scope project`; `update` keeps the project
// scope through `skillsScope: project` in openspec/config.yaml, which the installer writes.
// OpenSpec runs with HOME set to an empty temporary folder, removed afterwards (`runOpenspec` in lib/project.mjs):
// OpenSpec 2.x `update` would otherwise refresh the skills in ~/.agents/skills/ and write ~/.local/share/openspec/.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runOpenspec } from '../lib/project.mjs';

const tooling = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.OPENSPEC_BIN || 'openspec';
const xdg = join(tooling, 'xdg');

const kitFile = join(tooling, 'kit.json');
if (existsSync(kitFile)) {
  const pinned = JSON.parse(readFileSync(kitFile, 'utf8')).openspecVersion;
  const v = runOpenspec(bin, ['--version'], { xdg, encoding: 'utf8' });
  if (v.error || v.status !== 0) {
    console.error(`sdd-kit: openspec CLI not found. Install it: npm i -g @fission-ai/openspec@${pinned}`);
    process.exit(1);
  }
  if (pinned && v.stdout.trim() !== pinned) {
    console.error(`sdd-kit WARNING: openspec ${v.stdout.trim()} is installed, the kit is pinned to ${pinned} (npm i -g @fission-ai/openspec@${pinned}).`);
  }
}
const args = process.argv.slice(2);
if (args[0] === 'init' && !args.some((a) => a === '--scope' || a.startsWith('--scope='))) args.push('--scope', 'project');
const r = runOpenspec(bin, args, { xdg, stdio: 'inherit' });
process.exit(r.status ?? 1);
