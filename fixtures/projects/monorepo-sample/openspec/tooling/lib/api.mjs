// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// API snapshot and per-change API diff for the frontend handoff (D15, openspec/protocols/handoff.md).
//   snapshot  — export the current OpenAPI document into the committed baseline (verify.yaml → api.snapshot)
//   diff      — export, compare with the baseline, write openspec/changes/<change>/api-changes.json
//   check     — is the baseline equal to the current export? (CI: an API change must update the baseline)
// Freshness is content-based and works in any clone: api-changes.json records the hash of the API it was
// computed for (`currentHash`); the archive gate compares it with the committed baseline and with a fresh
// export (apiArchiveProblems).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadVerifyConfig } from './verify-config.mjs';
import { runCommand, VerifyError } from './verify-run.mjs';
import { diffOpenapi, stableJson } from './openapi-diff.mjs';
import { changeDir } from './project.mjs';
import { createHash } from 'node:crypto';

export const API_CHANGES = 'api-changes.json';
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

function apiConfig(root) {
  const cfg = loadVerifyConfig(root);
  if (!cfg?.api) throw new VerifyError('verify.yaml has no "api" section (api.export) — the frontend handoff is not configured');
  return cfg;
}

/** Runs api.export; returns the parsed OpenAPI document. */
export function exportApi(root) {
  const cfg = apiConfig(root);
  const r = runCommand(root, cfg.api.export, { timeoutSeconds: cfg.timeout_seconds });
  if (r.exitCode !== 0 || !r.output) throw new VerifyError(`api.export failed (exit ${r.exitCode}):\n${(r.stdout + '\n' + r.stderr).trim().split('\n').slice(-30).join('\n')}`);
  try {
    const doc = JSON.parse(r.output);
    if (!doc.paths) throw new Error('no "paths"');
    return { doc, cfg };
  } catch (e) {
    throw new VerifyError(`api.export did not write an OpenAPI JSON document (${e.message})`);
  }
}

export function snapshotApi(root) {
  const { doc, cfg } = exportApi(root);
  const text = stableJson(doc);
  const path = join(root, cfg.api.snapshot);
  const changed = !existsSync(path) || readFileSync(path, 'utf8') !== text;
  mkdirSync(dirname(path), { recursive: true });
  if (changed) writeFileSync(path, text);
  return { path: cfg.api.snapshot, changed };
}

export function checkApi(root) {
  const { doc, cfg } = exportApi(root);
  const path = join(root, cfg.api.snapshot);
  if (!existsSync(path)) return { ok: false, message: `no API snapshot at ${cfg.api.snapshot}` };
  const before = JSON.parse(readFileSync(path, 'utf8'));
  const d = diffOpenapi(before, doc);
  return { ok: d.operations.length === 0 && stableJson(before) === stableJson(doc), operations: d.operations, snapshot: cfg.api.snapshot };
}

export function diffChange(root, change) {
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new VerifyError(`change "${change}" not found`);
  const { doc, cfg } = exportApi(root);
  const base = join(root, cfg.api.snapshot);
  if (!existsSync(base)) throw new VerifyError(`no API baseline at ${cfg.api.snapshot}: run "node openspec/tooling/bin/api.mjs snapshot" on the main branch first and commit it`);
  const baseText = readFileSync(base, 'utf8');
  const result = { generatedBy: 'sdd-kit api.mjs diff', baseline: cfg.api.snapshot, baselineHash: hash(baseText), currentHash: hash(stableJson(doc)), ...diffOpenapi(JSON.parse(baseText), doc) };
  writeFileSync(join(dir, API_CHANGES), JSON.stringify(result, null, 2) + '\n');
  return result;
}

/**
 * Archive-time API checks for a change directory (content-based, clone-independent):
 *   api-changes.json exists; the committed baseline is exactly the API the diff was computed for; the
 *   current export still equals the baseline. Returns { problems, operations }.
 */
export function apiArchiveProblems(root, dir, change) {
  const p = join(dir, API_CHANGES);
  if (!existsSync(p)) return { problems: [`no ${API_CHANGES} — run: node openspec/tooling/bin/api.mjs diff --change ${change}`], operations: 0 };
  let diff;
  try {
    diff = JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    return { problems: [`cannot read ${API_CHANGES}: ${e.message}`], operations: 0 };
  }
  const ops = (diff.operations || []).length;
  const cfg = loadVerifyConfig(root);
  const base = join(root, cfg.api.snapshot);
  if (!existsSync(base)) return { problems: [`no API baseline at ${cfg.api.snapshot}`], operations: ops };
  const baseText = readFileSync(base, 'utf8');
  const problems = [];
  if (ops > 0 && hash(baseText) !== diff.currentHash) {
    problems.push(`the API baseline is not the API this diff describes — after "api.mjs diff --change ${change}" and the handoff, run: node openspec/tooling/bin/api.mjs snapshot`);
  }
  let current;
  try {
    current = stableJson(exportApi(root).doc);
  } catch (e) {
    return { problems: [...problems, `cannot export the API to compare: ${e.message.split('\n')[0]}`], operations: ops };
  }
  if (current !== baseText) problems.push(`the API changed after the baseline was updated — run "api.mjs diff --change ${change}" again, update the handoff, then "api.mjs snapshot"`);
  return { problems, operations: ops };
}
