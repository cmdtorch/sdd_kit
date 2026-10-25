#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-traceability — every scenario of the change's delta specs is planned in verification-plan.md
// (with a level, or excluded with a reason), every requirement is traced to its sources, and —
// with --markers — every scenario planned as unit or integration has a test carrying its marker.
// On the test-case schemas (clarify-ai-qa, clarify-qa) it also checks the "Test case coverage" table:
// every test case of test-cases.md is listed, a case labelled `automated` names a level unit and/or
// integration, and — with --markers — every `automated` case has a test carrying its case reference
// (`@case <capability> :: <case name>`). A reference that names no case of an active or archived change
// is a warning; one that names a case of an archived change only is silent.
//
// Markers are plain text in test files of any language (`@scenario <capability> :: <Scenario name>`,
// openspec/protocols/testing.md §3); they are collected from the project files, no test is run.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadChangeDeltas, changeScenarios, parseMainSpec } from '../lib/spec-parser.mjs';
import { parsePlan, LEVELS, CASE_LEVELS, key, isEmptyCell } from '../lib/plan.mjs';
import { parseTestCases, TEST_CASES_FILE } from '../lib/test-cases.mjs';
import { parseClarifications, isBlankAnswer } from '../lib/clarifications.mjs';
import { collectMarkers, collectCaseRefs } from '../lib/markers.mjs';
import { changeDir, changeSchema, isKitSchema, isClarifyFamily, hasTestCases, listChanges, readChangeFile } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-traceability';
const USAGE = `Usage: check-traceability --change <name> [--markers] [--root <dir>] [--json]

Checks that every scenario of the change is planned in verification-plan.md and, with --markers,
covered by a test that carries its scenario marker. On the test-case schemas it also checks the
"Test case coverage" table and, with --markers, that every automated test case has a test carrying
its case reference.`;

const TAG = /\[(Q\d+|D\d+|desc)\]/g;

/** Test cases of a test-cases.md: [{capability, scenario, name, labels}]. */
function casesOf(content) {
  const out = [];
  if (content === null) return out;
  for (const c of parseTestCases(content).capabilities) for (const s of c.scenarios) for (const k of s.cases) out.push({ capability: c.name, scenario: s.name, name: k.name, labels: k.labels || [] });
  return out;
}

/** Case keys of every active change and of every archived change. */
function knownCaseKeys(root) {
  const active = new Set();
  for (const n of listChanges(root)) for (const c of casesOf(readChangeFile(root, n, TEST_CASES_FILE))) active.add(key(c.capability, c.name));
  const archived = new Set();
  const dir = join(root, 'openspec', 'changes', 'archive');
  if (existsSync(dir)) {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n, TEST_CASES_FILE);
      if (existsSync(p)) for (const c of casesOf(readFileSync(p, 'utf8'))) archived.add(key(c.capability, c.name));
    }
  }
  return { active, archived };
}

/** "Test case coverage" rows and case references of a test-case-schema change; returns the coverage summary. */
function checkTestCaseCoverage({ root, change, f, plan, planPath, caseRefs }) {
  const content = readChangeFile(root, change, TEST_CASES_FILE);
  const cases = casesOf(content); // a missing or malformed test-cases.md is check-test-cases' finding
  const table = plan.testCases;
  if (!table.present) {
    if (cases.length) f.error(planPath, null, '"## Test case coverage" section is missing', 'list every test case of test-cases.md with its labels and, for automated cases, a level unit or integration');
  } else if (table.noTable) f.error(planPath, table.line, '"## Test case coverage" has no table');

  const byKey = new Map();
  for (const c of cases) if (!byKey.has(key(c.capability, c.name))) byKey.set(key(c.capability, c.name), c);
  const listed = new Map();
  for (const r of table.rows) {
    const k = key(r.capability, r.name);
    const c = byKey.get(k);
    if (!c) {
      f.error(planPath, r.line, `listed test case "${r.name}" (${r.capability}) is not in ${TEST_CASES_FILE}`, 'fix the name (exact match), or remove the stale row');
      continue;
    }
    if (listed.has(k)) f.warning(planPath, r.line, `test case "${r.name}" (${r.capability}) is listed twice`);
    listed.set(k, r);
    if (r.scenario && r.scenario !== c.scenario) f.error(planPath, r.line, `test case "${r.name}" belongs to scenario "${c.scenario}", not "${r.scenario}"`);
    const want = [...c.labels].sort().join(', ');
    if ([...r.labels].sort().join(', ') !== want) f.warning(planPath, r.line, `labels of test case "${r.name}" (${r.capability}) differ from ${TEST_CASES_FILE} (${want || 'none'})`);
    if (c.labels.includes('automated')) {
      const bad = r.levels.filter((l) => !CASE_LEVELS.includes(l));
      if (!r.levels.length || bad.length) {
        f.error(planPath, r.line, `automated test case "${r.name}" (${r.capability}) needs a level unit or integration${bad.length ? `, not "${bad.join(', ')}"` : ''}`);
      }
    }
  }
  for (const c of cases) {
    if (!listed.has(key(c.capability, c.name))) f.error(planPath, null, `test case "${c.name}" (${c.capability}) is not listed in "Test case coverage"`);
  }

  if (!caseRefs) return null;
  const files = new Map();
  for (const m of caseRefs) {
    const k = key(m.capability, m.name);
    if (!files.has(k)) files.set(k, []);
    if (!files.get(k).includes(m.file)) files.get(k).push(m.file);
  }
  for (const c of cases) {
    if (c.labels.includes('automated') && !files.has(key(c.capability, c.name))) {
      const r = listed.get(key(c.capability, c.name));
      f.error(planPath, r ? r.line : null, `no test references the automated test case "${c.name}" (${c.capability})`, `add "@case ${c.capability} :: ${c.name}" above the test (openspec/protocols/testing.md)`);
    }
  }
  // references to no case of this change: silent when an active or archived change has the case
  const strays = caseRefs.filter((m) => !byKey.has(key(m.capability, m.name)));
  if (strays.length) {
    const { active, archived } = knownCaseKeys(root);
    for (const m of strays) {
      const k = key(m.capability, m.name);
      if (!active.has(k) && !archived.has(k)) {
        f.warning(join(root, m.file), m.line, `case reference names unknown test case "${m.name}" (${m.capability})`, 'check the spelling: references must match test case names exactly');
      }
    }
  }
  return cases.map((c) => ({ capability: c.capability, scenario: c.scenario, case: c.name, labels: c.labels, files: files.get(key(c.capability, c.name)) || [] }));
}

export function checkTraceability({ root, change, markers, cases }) {
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
  const clar = isClarifyFamily(schema) ? readChangeFile(root, change, 'clarifications.md') : null;
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
    if (isClarifyFamily(schema)) {
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
    f.warning(null, null, 'test markers were not checked', 'pass --markers to look for tests that carry the scenario markers');
  } else {
    const have = new Set(markers.map((m) => key(m.capability, m.scenario)));
    for (const [k, rows] of planned) {
      const r = rows.find((x) => x.level !== 'manual' && LEVELS.includes(x.level));
      if (r && !have.has(k)) {
        f.error(planPath, r.line, `no test carries the marker for "${r.scenario}" (${r.capability})`, `add "@scenario ${r.capability} :: ${r.scenario}" above the test (openspec/protocols/testing.md §3)`);
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
        f.warning(join(root, m.file), m.line, `marker names unknown scenario "${m.scenario}" (${m.capability})`, 'check the spelling: markers must match scenario names exactly');
      }
    }
  }
  if (hasTestCases(schema)) {
    // with markers, case references are collected too unless the caller passed them
    const caseRefs = markers ? cases ?? collectCaseRefs(root) : null;
    const caseCoverage = checkTestCaseCoverage({ root, change, f, plan, planPath, caseRefs });
    if (caseCoverage) return makeReport(CHECK, f.list, { change, scenarios: scenarios.length, markersChecked: true, caseCoverage });
  }
  return makeReport(CHECK, f.list, { change, scenarios: scenarios.length, markersChecked: Boolean(markers) });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) =>
    checkTraceability({ root, change: args.change, markers: args.markers ? collectMarkers(root) : null, cases: args.markers ? collectCaseRefs(root) : null }),
    ['markers'],
  );
}
