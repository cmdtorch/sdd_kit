// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// openspec/tooling/verify.yaml — the project's test commands. The kit never hard-codes a stack; it only
// runs what this file says. The file is owned by the project (generated from presets at install, then
// edited by the team) and is never overwritten by kit updates.
//
// version: 1
// levels:
//   unit | e2e:
//     format: sdd-json | playwright-json   how results/markers are reported
//     collect: <cmd>    list tests with their scenario markers (no run)
//     scoped:  <cmd>    run only the given tests; {files} = space-separated test ids/paths
//     full:    <cmd>    run the whole level
//     gate:    <cmd>    optional quality gate (lint, types) run after `full` (unit only)
//   Placeholders: {out} = a JSON file the command writes; without {out} the JSON is read from stdout.
// gates:
//   stop: full | off               Stop hook: verify when apply claims all tasks done
//   e2e: scoped | full | off       which E2E tests the gate runs
//   stop_block_limit: 3            consecutive blocks before the human decides
// api:                             optional — enables the frontend handoff (D15)
//   export: <cmd>                  writes the current OpenAPI document (JSON) to {out}
//   snapshot: openspec/api/openapi.json   committed baseline the diff is computed against
// timeout_seconds: 1800            per command
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml, YamlError } from './yaml.mjs';

export const VERIFY_FILE = 'openspec/tooling/verify.yaml';
export const LEVEL_KEYS = ['format', 'collect', 'scoped', 'full', 'gate'];
export const FORMATS = ['sdd-json', 'playwright-json'];
export const TOP_KEYS = ['version', 'levels', 'gates', 'api', 'timeout_seconds'];
export const API_KEYS = ['export', 'snapshot'];
export const DEFAULT_SNAPSHOT = 'openspec/api/openapi.json';
export const GATE_KEYS = ['stop', 'e2e', 'stop_block_limit'];

export class VerifyConfigError extends Error {}

const DEFAULTS = { gates: { stop: 'full', e2e: 'scoped', stop_block_limit: 3 }, timeout_seconds: 1800 };

/** Problems in a parsed verify.yaml: [{path, message}] (empty when valid). */
export function validateVerifyConfig(cfg) {
  const p = [];
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return [{ path: '', message: 'verify.yaml must be a mapping' }];
  for (const k of Object.keys(cfg)) if (!TOP_KEYS.includes(k)) p.push({ path: k, message: `unknown field "${k}" (allowed: ${TOP_KEYS.join(', ')})` });
  if (cfg.version !== 1) p.push({ path: 'version', message: 'version must be 1' });
  const levels = cfg.levels ?? {};
  if (typeof levels !== 'object' || Array.isArray(levels)) p.push({ path: 'levels', message: 'levels must be a mapping' });
  else
    for (const [name, l] of Object.entries(levels)) {
      if (!['unit', 'e2e'].includes(name)) p.push({ path: `levels.${name}`, message: `unknown level "${name}" (allowed: unit, e2e)` });
      if (!l || typeof l !== 'object') {
        p.push({ path: `levels.${name}`, message: 'must be a mapping' });
        continue;
      }
      for (const k of Object.keys(l)) if (!LEVEL_KEYS.includes(k)) p.push({ path: `levels.${name}.${k}`, message: `unknown field "${k}" (allowed: ${LEVEL_KEYS.join(', ')})` });
      if (!FORMATS.includes(l.format)) p.push({ path: `levels.${name}.format`, message: `format must be one of ${FORMATS.join(', ')}` });
      for (const k of ['collect', 'full']) if (typeof l[k] !== 'string' || !l[k].trim()) p.push({ path: `levels.${name}.${k}`, message: `"${k}" command is required` });
      for (const k of ['scoped', 'gate']) if (l[k] !== undefined && (typeof l[k] !== 'string' || !l[k].trim())) p.push({ path: `levels.${name}.${k}`, message: `"${k}" must be a command string` });
      if (l.scoped !== undefined && !String(l.scoped).includes('{files}')) p.push({ path: `levels.${name}.scoped`, message: '"scoped" must contain {files}' });
      if (l.gate !== undefined && name !== 'unit') p.push({ path: `levels.${name}.gate`, message: '"gate" is only supported for the unit level' });
    }
  const g = cfg.gates ?? {};
  if (typeof g !== 'object' || Array.isArray(g)) p.push({ path: 'gates', message: 'gates must be a mapping' });
  else {
    for (const k of Object.keys(g)) if (!GATE_KEYS.includes(k)) p.push({ path: `gates.${k}`, message: `unknown field "${k}" (allowed: ${GATE_KEYS.join(', ')})` });
    if (g.stop !== undefined && !['full', 'off'].includes(g.stop)) p.push({ path: 'gates.stop', message: 'stop must be full or off' });
    if (g.e2e !== undefined && !['scoped', 'full', 'off'].includes(g.e2e)) p.push({ path: 'gates.e2e', message: 'e2e must be scoped, full or off' });
    if (g.stop_block_limit !== undefined && !(Number.isInteger(g.stop_block_limit) && g.stop_block_limit >= 1)) p.push({ path: 'gates.stop_block_limit', message: 'stop_block_limit must be a positive integer' });
  }
  if (cfg.api !== undefined) {
    const a = cfg.api;
    if (!a || typeof a !== 'object' || Array.isArray(a)) p.push({ path: 'api', message: 'api must be a mapping' });
    else {
      for (const k of Object.keys(a)) if (!API_KEYS.includes(k)) p.push({ path: `api.${k}`, message: `unknown field "${k}" (allowed: ${API_KEYS.join(', ')})` });
      if (typeof a.export !== 'string' || !a.export.includes('{out}')) p.push({ path: 'api.export', message: 'api.export must be a command that writes the OpenAPI JSON to {out}' });
      if (a.snapshot !== undefined && (typeof a.snapshot !== 'string' || !a.snapshot.endsWith('.json'))) p.push({ path: 'api.snapshot', message: 'api.snapshot must be a .json path' });
    }
  }
  if (cfg.timeout_seconds !== undefined && !(Number.isInteger(cfg.timeout_seconds) && cfg.timeout_seconds > 0)) p.push({ path: 'timeout_seconds', message: 'timeout_seconds must be a positive integer' });
  return p;
}

/** Loads verify.yaml with defaults applied; null when the file does not exist. Throws on invalid content. */
export function loadVerifyConfig(root) {
  const file = join(root, VERIFY_FILE);
  if (!existsSync(file)) return null;
  let parsed;
  try {
    parsed = parseYaml(readFileSync(file, 'utf8'));
  } catch (e) {
    if (e instanceof YamlError) throw new VerifyConfigError(`${VERIFY_FILE}: ${e.message}`);
    throw e;
  }
  const problems = validateVerifyConfig(parsed.value);
  if (problems.length) throw new VerifyConfigError(`${VERIFY_FILE}: ${problems.map((x) => x.message).join('; ')}`);
  const cfg = parsed.value;
  return {
    ...cfg,
    levels: cfg.levels || {},
    gates: { ...DEFAULTS.gates, ...(cfg.gates || {}) },
    api: cfg.api ? { snapshot: DEFAULT_SNAPSHOT, ...cfg.api } : null,
    timeout_seconds: cfg.timeout_seconds || DEFAULTS.timeout_seconds,
    positions: parsed.positions,
  };
}
