// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Skill drift: do the project's OpenSpec skills follow the kit's workflow profile (decision D20)? One check for
// `bin/doctor.mjs` and `hooks/session-start.mjs`.
// - CLI equal to the pinned version (openspec/tooling/kit.json): OpenSpec's own `openspec update --dry-run --json`,
//   run with the kit profile (openspec/tooling/xdg), an empty temporary HOME (`runOpenspec` in lib/project.mjs) and a
//   10 s timeout. Each entry of `changes[]` is a drift path; `notes[]` are not drift. A non-zero exit, a timeout or
//   unreadable JSON is a failed check, which both callers report as a warning.
// - CLI missing or another version: the file check (`openspec-propose` present, `openspec-continue-change` missing in
//   .claude/skills/); the dry run is not run.
// The `openspec` router skill that OpenSpec 2 installs with every profile is never drift.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { runOpenspec } from './project.mjs';

/** The fix for any skill drift. */
export const SKILLS_FIX = 'node openspec/tooling/bin/openspec.mjs update';
/** The command that shows why a failed check failed. */
export const SKILLS_CHECK_COMMAND = 'node openspec/tooling/bin/openspec.mjs update --dry-run --json';
export const DRY_RUN_TIMEOUT = 10000;

/** The OpenSpec CLI to run: `OPENSPEC_BIN`, or `openspec` on the path. */
export function openspecBin() {
  return process.env.OPENSPEC_BIN || 'openspec';
}

/** Version printed by `openspec --version`, or null when the CLI is missing or fails. */
export function openspecCliVersion(bin = openspecBin(), timeout = 8000) {
  const r = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout, env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The file check: what in .claude/skills/ differs from the kit profile, as readable lines. */
export function fileDrift(root) {
  const skills = join(root, '.claude', 'skills');
  const drift = [];
  if (existsSync(join(skills, 'openspec-propose'))) drift.push('openspec-propose is installed (creates all artifacts in one pass, skipping question rounds)');
  if (!existsSync(join(skills, 'openspec-continue-change'))) drift.push('openspec-continue-change is missing');
  return drift;
}

/**
 * Skill drift of the project: `{ method: 'dry-run'|'files', drift: [line], failed: null|reason }`. `kit` is the parsed
 * openspec/tooling/kit.json; `version` the CLI version when the caller already has it (null = missing CLI).
 */
export function skillDrift(root, kit, { bin = openspecBin(), version, timeout = DRY_RUN_TIMEOUT } = {}) {
  const pinned = kit?.openspecVersion;
  const v = !pinned ? null : version === undefined ? openspecCliVersion(bin) : version;
  if (!v || v !== pinned) return { method: 'files', drift: fileDrift(root), failed: null };
  const xdg = join(root, 'openspec', 'tooling', 'xdg');
  const r = runOpenspec(bin, ['update', '--dry-run', '--json'], { xdg, cwd: root, encoding: 'utf8', timeout });
  const dryRun = (failed) => ({ method: 'dry-run', drift: [], failed });
  if (r.error?.code === 'ETIMEDOUT' || r.signal) return dryRun(`openspec update --dry-run did not end within ${Math.round(timeout / 1000)} s`);
  if (r.error || r.status !== 0) return dryRun(`openspec update --dry-run exited with ${r.error ? r.error.code : `status ${r.status}`}`);
  let report;
  try {
    const out = String(r.stdout || '');
    report = JSON.parse(out.slice(out.indexOf('{')));
  } catch {
    report = null;
  }
  if (!report || !Array.isArray(report.changes)) return dryRun('openspec update --dry-run printed no readable JSON');
  const drift = report.changes.map((c) => (c && typeof c.path === 'string' ? `${c.path}${c.action ? ` (${c.action})` : ''}` : JSON.stringify(c)));
  return { method: 'dry-run', drift, failed: null };
}
