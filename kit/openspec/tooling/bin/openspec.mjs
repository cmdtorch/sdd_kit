#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Runs the OpenSpec CLI with the kit's workflow profile (decision D20):
//   node openspec/tooling/bin/openspec.mjs update        ← use this instead of a plain `openspec update`
//   node openspec/tooling/bin/openspec.mjs init --tools claude
// It points XDG_CONFIG_HOME at openspec/tooling/xdg for this one process, so the committed profile
// (new, continue, verify, explore, apply, update, sync, archive — no propose) is used and the
// developer's own global OpenSpec config is neither used nor rewritten (docs/openspec-facts.md W4–W6).
// Telemetry is off. Warns when the CLI version differs from the pinned one (openspec/tooling/kit.json).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tooling = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.OPENSPEC_BIN || 'openspec';
const env = { ...process.env, XDG_CONFIG_HOME: join(tooling, 'xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' };

const kitFile = join(tooling, 'kit.json');
if (existsSync(kitFile)) {
  const pinned = JSON.parse(readFileSync(kitFile, 'utf8')).openspecVersion;
  const v = spawnSync(bin, ['--version'], { encoding: 'utf8', env });
  if (v.error || v.status !== 0) {
    console.error(`sdd-kit: openspec CLI not found. Install it: npm i -g @fission-ai/openspec@${pinned}`);
    process.exit(1);
  }
  if (pinned && v.stdout.trim() !== pinned) {
    console.error(`sdd-kit WARNING: openspec ${v.stdout.trim()} is installed, the kit is pinned to ${pinned} (npm i -g @fission-ai/openspec@${pinned}).`);
  }
}
const r = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit', env });
process.exit(r.status ?? 1);
