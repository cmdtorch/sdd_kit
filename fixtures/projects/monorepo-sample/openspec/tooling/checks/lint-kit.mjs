#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// lint-kit — catches what OpenSpec 1.13.0 silently ignores (docs/openspec-facts.md S4, S6, C2, C7):
//   - unknown or misspelled fields in openspec/schemas/*/schema.yaml, openspec/config.yaml and
//     changes/*/.openspec.yaml
//   - schema `name` different from its directory, missing templates, broken `requires`, cycles
//   - config `context` over 50 KB (OpenSpec drops it entirely), rules for unknown artifacts,
//     malformed operations, a default schema that does not exist
//   - kit block / questions language missing from config context
//   - openspec/tooling/verify.yaml: unknown fields, bad formats, missing commands
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml, YamlError } from '../lib/yaml.mjs';
import { listChanges, KIT_SCHEMAS } from '../lib/project.mjs';
import { makeReport, findingsFor, runCli, isMain } from '../lib/report.mjs';
import { validateVerifyConfig, VERIFY_FILE } from '../lib/verify-config.mjs';

const CHECK = 'lint-kit';
const USAGE = `Usage: lint-kit [--root <dir>] [--json]

Lints openspec/schemas/*, openspec/config.yaml and every active change's .openspec.yaml for fields
OpenSpec ignores silently.`;

export const SCHEMA_KEYS = ['name', 'version', 'description', 'artifacts', 'apply'];
export const ARTIFACT_KEYS = ['id', 'generates', 'description', 'template', 'instruction', 'requires'];
export const APPLY_KEYS = ['requires', 'tracks', 'instruction'];
export const CONFIG_KEYS = ['schema', 'context', 'rules', 'operations', 'store', 'references', 'githubCopilot'];
export const CHANGE_KEYS = ['schema', 'created', 'goal', 'affected_areas', 'initiative', 'skip_specs', 'retire_capabilities'];
const BUILTIN_SCHEMAS = { 'spec-driven': ['proposal', 'specs', 'design', 'tasks'] };
const MAX_CONTEXT = 50 * 1024;

function closest(word, candidates) {
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  const best = candidates.map((c) => [c, dist(word.toLowerCase(), c.toLowerCase())]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 3 ? best[0] : null;
}

function unknownKeys(f, file, obj, allowed, where, positions, prefix) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
  for (const k of Object.keys(obj)) {
    if (allowed.includes(k)) continue;
    const guess = closest(k, allowed);
    f.error(file, positions[prefix ? `${prefix}.${k}` : k], `unknown field "${k}" in ${where}`, guess ? `did you mean "${guess}"? OpenSpec ignores unknown fields silently` : `allowed: ${allowed.join(', ')}`);
  }
}

function readYaml(f, file) {
  try {
    return parseYaml(readFileSync(file, 'utf8'));
  } catch (e) {
    if (!(e instanceof YamlError)) throw e;
    f.error(file, e.line, `cannot parse YAML: ${e.message.replace(/^line \d+: /, '')}`);
    return null;
  }
}

function lintSchema(f, root, dirName) {
  const dir = join(root, 'openspec', 'schemas', dirName);
  const file = join(dir, 'schema.yaml');
  if (!existsSync(file)) {
    f.error(dir, null, `schema directory "${dirName}" has no schema.yaml`);
    return null;
  }
  const y = readYaml(f, file);
  if (!y) return null;
  const { value: s, positions: pos } = y;
  if (!s || typeof s !== 'object') {
    f.error(file, null, 'schema.yaml is empty or not a mapping');
    return null;
  }
  unknownKeys(f, file, s, SCHEMA_KEYS, 'schema', pos, '');
  if (s.name !== dirName) f.error(file, pos.name, `name "${s.name}" differs from the directory name "${dirName}"`, 'OpenSpec looks schemas up by directory name; keep them equal');
  if (!Number.isInteger(s.version) || s.version < 1) f.error(file, pos.version, 'version must be a positive integer');
  if (!Array.isArray(s.artifacts) || !s.artifacts.length) {
    f.error(file, pos.artifacts, 'artifacts must be a non-empty list');
    return { name: dirName, ids: [] };
  }
  const ids = [];
  s.artifacts.forEach((a, i) => {
    const p = `artifacts.${i}`;
    if (!a || typeof a !== 'object') {
      f.error(file, pos[p], `artifact #${i + 1} is not a mapping`);
      return;
    }
    unknownKeys(f, file, a, ARTIFACT_KEYS, `artifact "${a.id ?? i + 1}"`, pos, p);
    for (const req of ['id', 'generates', 'description', 'template']) {
      if (typeof a[req] !== 'string' || !a[req].trim()) f.error(file, pos[p], `artifact "${a.id ?? i + 1}" has no "${req}"`);
    }
    if (typeof a.instruction !== 'string' || !a.instruction.trim()) {
      f.warning(file, pos[p], `artifact "${a.id}" has no instruction`, 'without it OpenSpec serves no guidance at all for this artifact (no built-in fallback)');
    }
    if (ids.includes(a.id)) f.error(file, pos[`${p}.id`], `duplicate artifact id "${a.id}"`);
    ids.push(a.id);
    if (typeof a.template === 'string' && !existsSync(join(dir, 'templates', a.template))) {
      f.error(file, pos[`${p}.template`], `template "${a.template}" not found in ${dirName}/templates/`);
    }
    if (a.requires !== undefined && a.requires !== null && !Array.isArray(a.requires)) f.error(file, pos[`${p}.requires`], `requires of "${a.id}" must be a list`);
  });
  s.artifacts.forEach((a, i) => {
    for (const r of Array.isArray(a?.requires) ? a.requires : []) {
      if (!ids.includes(r)) f.error(file, pos[`artifacts.${i}.requires`], `artifact "${a.id}" requires unknown artifact "${r}"`);
    }
  });
  // cycles
  const graph = Object.fromEntries(s.artifacts.filter(Boolean).map((a) => [a.id, Array.isArray(a.requires) ? a.requires : []]));
  const state = {};
  const visit = (id, trail) => {
    if (state[id] === 2 || !(id in graph)) return;
    if (state[id] === 1) {
      f.error(file, null, `dependency cycle: ${[...trail, id].join(' → ')}`);
      return;
    }
    state[id] = 1;
    for (const r of graph[id]) visit(r, [...trail, id]);
    state[id] = 2;
  };
  for (const id of Object.keys(graph)) visit(id, []);
  if (s.apply !== undefined) {
    unknownKeys(f, file, s.apply, APPLY_KEYS, 'apply', pos, 'apply');
    if (!Array.isArray(s.apply?.requires)) f.error(file, pos.apply, 'apply.requires must be a list');
    else for (const r of s.apply.requires) if (!ids.includes(r)) f.error(file, pos['apply.requires'], `apply requires unknown artifact "${r}"`);
  }
  return { name: dirName, ids };
}

export function lintKit({ root }) {
  const f = findingsFor(root);
  const schemasDir = join(root, 'openspec', 'schemas');
  const schemas = { ...BUILTIN_SCHEMAS };
  if (existsSync(schemasDir)) {
    for (const d of readdirSync(schemasDir).sort()) {
      if (!statSync(join(schemasDir, d)).isDirectory()) continue;
      const r = lintSchema(f, root, d);
      if (r) schemas[r.name] = r.ids;
    }
  }
  for (const k of KIT_SCHEMAS) if (!(k in schemas)) f.warning(schemasDir, null, `kit schema "${k}" is not installed`);
  const allIds = new Set(Object.values(schemas).flat());

  const cfgFile = join(root, 'openspec', 'config.yaml');
  if (!existsSync(cfgFile)) f.error(cfgFile, null, 'openspec/config.yaml does not exist');
  else {
    const y = readYaml(f, cfgFile);
    const c = y?.value;
    const pos = y?.positions || {};
    if (y && (!c || typeof c !== 'object')) f.error(cfgFile, null, 'config.yaml is empty or not a mapping');
    else if (c) {
      unknownKeys(f, cfgFile, c, CONFIG_KEYS, 'config.yaml', pos, '');
      if (typeof c.schema !== 'string' || !c.schema) f.error(cfgFile, pos.schema, 'schema is required');
      else if (!(c.schema in schemas)) f.error(cfgFile, pos.schema, `default schema "${c.schema}" does not exist`, `available: ${Object.keys(schemas).join(', ')}`);
      if (c.context !== undefined) {
        if (typeof c.context !== 'string') f.error(cfgFile, pos.context, 'context must be a string');
        else {
          const size = Buffer.byteLength(c.context, 'utf8');
          if (size > MAX_CONTEXT) f.error(cfgFile, pos.context, `context is ${(size / 1024).toFixed(1)} KB; OpenSpec drops the whole context above 50 KB`, 'move details into openspec/protocols/ and reference them');
          else if (size > MAX_CONTEXT * 0.8) f.warning(cfgFile, pos.context, `context is ${(size / 1024).toFixed(1)} KB, close to the 50 KB limit`);
          if (!/# >>> sdd-kit >>>[\s\S]*# <<< sdd-kit <<</.test(c.context)) f.warning(cfgFile, pos.context, 'context has no sdd-kit block', 'the installer adds it; kit protocols are not referenced without it');
          else if (!/Questions language:\s*\S/.test(c.context)) f.warning(cfgFile, pos.context, 'context has no "Questions language:" line (D22)');
        }
      }
      if (c.rules !== undefined && c.rules !== null) {
        if (typeof c.rules !== 'object' || Array.isArray(c.rules)) f.error(cfgFile, pos.rules, 'rules must be a mapping of artifact id → list of strings');
        else
          for (const [id, list] of Object.entries(c.rules)) {
            if (!allIds.has(id)) {
              const guess = closest(id, [...allIds]);
              f.error(cfgFile, pos[`rules.${id}`], `rules for unknown artifact "${id}"`, guess ? `did you mean "${guess}"?` : `known artifacts: ${[...allIds].join(', ')}`);
            }
            if (!Array.isArray(list) || list.some((x) => typeof x !== 'string' || !x.trim())) f.error(cfgFile, pos[`rules.${id}`], `rules.${id} must be a list of non-empty strings`);
          }
      }
      if (c.operations !== undefined && c.operations !== null) {
        if (typeof c.operations !== 'object' || Array.isArray(c.operations)) f.error(cfgFile, pos.operations, 'operations must be a mapping');
        else
          for (const [op, v] of Object.entries(c.operations)) {
            if (!['apply', 'archive'].includes(op)) f.error(cfgFile, pos[`operations.${op}`], `unknown operation "${op}" (allowed: apply, archive)`);
            unknownKeys(f, cfgFile, v, ['guidance'], `operations.${op}`, pos, `operations.${op}`);
            if (v && v.guidance !== undefined && (!Array.isArray(v.guidance) || v.guidance.some((x) => typeof x !== 'string' || !x.trim()))) {
              f.error(cfgFile, pos[`operations.${op}.guidance`], `operations.${op}.guidance must be a list of non-empty strings`);
            }
          }
      }
      if (c.store !== undefined && typeof c.store !== 'string') f.error(cfgFile, pos.store, 'store must be a single store id string');
    }
  }

  const verifyFile = join(root, VERIFY_FILE);
  if (existsSync(verifyFile)) {
    const y = readYaml(f, verifyFile);
    if (y) for (const p of validateVerifyConfig(y.value)) f.error(verifyFile, y.positions[p.path], p.message);
  } else {
    f.warning(verifyFile, null, 'verify.yaml does not exist: the test gate, verify.mjs and the archive gate cannot run tests', 'install a preset (sdd-kit install --preset django,playwright) or write it by hand');
  }

  for (const name of listChanges(root)) {
    const file = join(root, 'openspec', 'changes', name, '.openspec.yaml');
    if (!existsSync(file)) continue;
    const y = readYaml(f, file);
    if (!y || !y.value || typeof y.value !== 'object') continue;
    unknownKeys(f, file, y.value, CHANGE_KEYS, `.openspec.yaml of "${name}"`, y.positions, '');
    if (typeof y.value.schema === 'string' && !(y.value.schema in schemas)) {
      f.error(file, y.positions.schema, `change "${name}" uses schema "${y.value.schema}", which does not exist`);
    }
  }
  return makeReport(CHECK, f.list, { schemas: Object.keys(schemas) });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => lintKit({ root }));
}
