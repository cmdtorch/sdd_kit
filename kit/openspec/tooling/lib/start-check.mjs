// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The start-check record `start-check.json` in the change root, written by bin/start-check.mjs
// (openspec/protocols/apply.md): { ok, url, start, stop, status, error, seconds, at }.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changeDir } from './project.mjs';

export const START_CHECK_FILE = 'start-check.json';

/** The state of the change's record: 'passed', 'failed', or 'none' (no record, or one that cannot be read). */
export function startCheckStatus(root, change) {
  const file = join(changeDir(root, change), START_CHECK_FILE);
  if (!existsSync(file)) return 'none';
  try {
    const rec = JSON.parse(readFileSync(file, 'utf8'));
    if (!rec || typeof rec !== 'object') return 'none';
    return rec.ok === true ? 'passed' : 'failed';
  } catch {
    return 'none';
  }
}

/** True when the change's record holds a passed start check (apply does not repeat it). */
export function startCheckPassed(root, change) {
  return startCheckStatus(root, change) === 'passed';
}
