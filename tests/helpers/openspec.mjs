// Helpers for running the pinned OpenSpec CLI in throwaway projects.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PINNED_VERSION = '1.13.0';
const BIN = process.env.OPENSPEC_BIN || 'openspec';

/** Returns the CLI version, or null when the binary is missing. */
export function openspecVersion() {
  try {
    return execFileSync(BIN, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** Reason to skip CLI-backed tests, or false when the pinned CLI is available. */
export function cliSkipReason() {
  const v = openspecVersion();
  if (v === null) return `openspec CLI not found (set OPENSPEC_BIN)`;
  if (v !== PINNED_VERSION) return `openspec ${v} found, tests need ${PINNED_VERSION}`;
  return false;
}

/** Creates an isolated project dir with an openspec/ root and the given schema dirs copied in. */
export function makeProject(schemaDirs = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-test-'));
  mkdirSync(join(root, 'openspec', 'changes', 'archive'), { recursive: true });
  mkdirSync(join(root, 'openspec', 'specs'), { recursive: true });
  writeFileSync(join(root, 'openspec', 'config.yaml'), 'schema: spec-driven\n');
  for (const [name, dir] of Object.entries(schemaDirs)) {
    cpSync(dir, join(root, 'openspec', 'schemas', name), { recursive: true });
  }
  return root;
}

/** Runs the CLI in `cwd` with an isolated config dir and telemetry off; parses JSON output. */
export function openspecJson(cwd, args, { allowFail = false } = {}) {
  let out;
  try {
    out = execFileSync(BIN, [...args, '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, XDG_CONFIG_HOME: join(cwd, '.xdg'), OPENSPEC_TELEMETRY: '0', DO_NOT_TRACK: '1' },
    });
  } catch (e) {
    if (!allowFail) throw new Error(`openspec ${args.join(' ')} failed:\n${e.stdout}\n${e.stderr}`);
    out = e.stdout;
  }
  return JSON.parse(out.slice(out.search(/[[{]/)));
}
