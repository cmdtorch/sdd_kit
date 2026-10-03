#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-traceability — every scenario of the change's delta specs is planned in verification-plan.md
// (with a level, or excluded with a reason), every requirement is traced to its sources, and —
// when test markers are given — every planned unit/e2e scenario has a test carrying its marker.
//
// Markers: a JSON array [{ level: "unit"|"e2e", capability, scenario, test }], produced by the
// project's collectors (openspec/tooling/verify.yaml → collect_scenarios). Pass it with --markers.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChangeDeltas, changeScenarios, normName, parseMainSpec } from '../lib/spec-parser.mjs';
import { parsePlan, LEVELS, key, isEmptyCell } from '../lib/plan.mjs';
import { parseClarifications, isBlankAnswer } from '../lib/clarifications.mjs';
import { changeDir, changeSchema, isKitSchema, readChangeFile } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-traceability';
const USAGE = `Usage: check-traceability --change <name> [--markers <file.json>] [--root <dir>] [--json]

Checks that every scenario of the change is planned in verification-plan.md and, with --markers,
covered by a test that carries its scenario marker at the planned level.`;

const TAG = /\[(Q\d+|D\d+|desc)\]/g;

/** Loads and validates a markers file. */
export function loadMarkers(path) {
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new UsageError(`cannot read markers file ${path}: ${e.message}`);
  }
  if (!Array.isArray(data)) throw new UsageError(`markers file ${path} must contain a JSON array`);
  return data.map((m, i) => {
    if (!m || typeof m.capability !== 'string' || typeof m.scenario !== 'string' || typeof m.level !== 'string') {
      throw new UsageError(`markers file ${path}: entry ${i} needs string fields level, capability, scenario`);
    }
    return { level: m.level.toLowerCase(), capability: normName(m.capability), scenario: normName(m.scenario), test: m.test || '' };
  });
}

export function checkTraceability({ root, change, markers }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (!isKitSchema(schema)) return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (not a kit schema)`);

  const f = findingsFor(root);
  const planPath = join(dir, 'verification-plan.md');
  const deltas = loadChangeDeltas(root, dir);
  const scenarios = changeScenarios(deltas);
  const planContent = readChangeFile(root, change, 'verification-plan.md');
  if (planContent === null) {
    if (scenarios.length) f.error(planPath, null, 'verification-plan.md does not exist', 'every scenario needs a verification level');
    return makeReport(CHECK, f.list, { change });
  }
  const plan = parsePlan(planContent);
  if (!plan.coverage.present) f.error(planPath, null, '"## Scenario coverage" section is missing');
  else if (plan.coverage.noTable) f.error(planPath, plan.coverage.line, '"## Scenario coverage" has no table');
  if (!plan.trace.present) f.error(planPath, null, '"## Requirement trace" section is missing');

  const known = new Map(scenarios.map((s) => [key(s.capability, s.scenario), s]));
  const planned = new Map(); // key -> [rows]
  for (const r of plan.coverage.rows) {
    const k = key(r.capability, r.scenario);
    const s = known.get(k);
    if (!s) {
      f.error(planPath, r.line, `planned scenario "${r.scenario}" (${r.capability}) is not in the change's delta specs`, 'fix the name (exact match), or remove the stale row');
      continue;
    }
    if (r.requirement && r.requirement !== s.requirement) {
      f.error(planPath, r.line, `scenario "${r.scenario}" belongs to requirement "${s.requirement}", not "${r.requirement}"`);
    }
    if (!LEVELS.includes(r.level)) f.error(planPath, r.line, `level "${r.level}" for "${r.scenario}" is not one of ${LEVELS.join(', ')}`);
    if (!planned.has(k)) planned.set(k, []);
    if (planned.get(k).some((x) => x.level === r.level)) f.warning(planPath, r.line, `"${r.scenario}" is planned twice at level ${r.level}`);
    planned.get(k).push(r);
  }
  const excluded = new Set();
  for (const r of plan.exclusions.rows) {
    const k = key(r.capability, r.scenario);
    if (!known.has(k)) {
      f.error(planPath, r.line, `excluded scenario "${r.scenario}" (${r.capability}) is not in the change's delta specs`);
      continue;
    }
    if (isEmptyCell(r.reason)) f.error(planPath, r.line, `exclusion of "${r.scenario}" has no reason`);
    if (planned.has(k)) f.warning(planPath, r.line, `"${r.scenario}" is both planned and excluded`);
    excluded.add(k);
  }
  for (const s of scenarios) {
    const k = key(s.capability, s.scenario);
    if (!planned.has(k) && !excluded.has(k)) {
      f.error(planPath, null, `scenario "${s.scenario}" (${s.capability}) is neither planned nor excluded`, `add a Scenario coverage row (spec: ${s.file.replace(root + '/', '')}:${s.line})`);
    }
  }

  // requirement trace
  const requirements = new Map();
  for (const { capability, delta } of deltas) for (const r of [...delta.added, ...delta.modified]) requirements.set(key(capability, r.name), r);
  const traced = new Set();
  const clar = schema === 'clarify' ? readChangeFile(root, change, 'clarifications.md') : null;
  const parsed = clar ? parseClarifications(clar) : null;
  for (const r of plan.trace.rows) {
    const k = key(r.capability, r.requirement);
    if (!requirements.has(k)) {
      f.error(planPath, r.line, `traced requirement "${r.requirement}" (${r.capability}) is not in the change's delta specs`);
      continue;
    }
    traced.add(k);
    if (isEmptyCell(r.sources)) {
      f.error(planPath, r.line, `requirement "${r.requirement}" has no sources`);
      continue;
    }
    if (schema === 'clarify') {
      const tags = [...r.sources.matchAll(TAG)].map((m) => m[1]);
      if (!tags.length) f.error(planPath, r.line, `sources of "${r.requirement}" contain no [Q<n>], [D<n>] or [desc] tag`);
      for (const t of tags) {
        if (!parsed) break;
        if (t === 'desc' && !parsed.sources.desc) f.error(planPath, r.line, `[desc] is not registered in clarifications.md`);
        if (t.startsWith('D') && !parsed.sources.docs.has(t)) f.error(planPath, r.line, `[${t}] is not registered in clarifications.md`);
        if (t.startsWith('Q')) {
          const q = parsed.questions.get(Number(t.slice(1)));
          if (!q) f.error(planPath, r.line, `[${t}] does not exist in clarifications.md`);
          else if (q.answerLine === null || isBlankAnswer(q.answer)) f.error(planPath, r.line, `[${t}] is not answered`);
        }
      }
    }
  }
  for (const [k, r] of requirements) {
    if (!traced.has(k)) f.error(planPath, null, `requirement "${r.name}" (${k.split(' :: ')[0]}) has no row in "Requirement trace"`);
  }

  // test markers
  if (!markers) {
    f.warning(null, null, 'test markers were not checked', 'pass --markers <file.json> (collected via verify.yaml → collect_scenarios)');
  } else {
    const have = new Set(markers.map((m) => `${m.level}|${key(m.capability, m.scenario)}`));
    for (const [k, rows] of planned) {
      for (const r of rows) {
        if (r.level === 'manual' || !LEVELS.includes(r.level)) continue;
        if (!have.has(`${r.level}|${k}`)) {
          f.error(planPath, r.line, `no ${r.level} test carries the marker for "${r.scenario}" (${r.capability})`, 'see openspec/protocols/testing.md §3 for the marker format');
        }
      }
    }
    // typo detection: markers that name a capability of this change but an unknown scenario
    const caps = new Set(deltas.map((d) => d.capability));
    const mainScenarios = new Set();
    for (const c of caps) {
      const p = join(root, 'openspec', 'specs', ...c.split('/'), 'spec.md');
      if (existsSync(p)) for (const r of parseMainSpec(readFileSync(p, 'utf8')).requirements) for (const s of r.scenarios) mainScenarios.add(key(c, s.name));
    }
    for (const m of markers) {
      const k = key(m.capability, m.scenario);
      if (caps.has(m.capability) && !known.has(k) && !mainScenarios.has(k)) {
        f.warning(null, null, `test ${m.test || '(unnamed)'} marks unknown scenario "${m.scenario}" (${m.capability})`, 'check the spelling: markers must match scenario names exactly');
      }
    }
  }
  return makeReport(CHECK, f.list, { change, scenarios: scenarios.length, markersChecked: Boolean(markers) });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) =>
    checkTraceability({ root, change: args.change, markers: args.markers ? loadMarkers(args.markers) : null }),
  );
}
