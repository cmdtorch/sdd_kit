// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Normalises test markers and results from the supported formats into one shape:
//   { level, capability, scenario, test, file?, outcome?: 'passed'|'failed'|'skipped'|'error' }
// Formats (verified against real tools, docs/openspec-facts.md §11):
//   sdd-json        — JSON array written by the kit's pytest plugin (sdd_kit_pytest)
//   playwright-json — `npx playwright test [--list] --reporter=json` (annotation type "scenario",
//                     description "<capability-path> :: <Scenario name>")
import { relative, isAbsolute, join } from 'node:path';
import { normName } from './spec-parser.mjs';

export class ResultsFormatError extends Error {}

function fromSddJson(data, level) {
  if (!Array.isArray(data)) throw new ResultsFormatError('sdd-json: expected a JSON array');
  return data.map((r, i) => {
    if (!r || typeof r.capability !== 'string' || typeof r.scenario !== 'string' || typeof r.test !== 'string') {
      throw new ResultsFormatError(`sdd-json: entry ${i} needs capability, scenario and test`);
    }
    const row = { level: (r.level || level).toLowerCase(), capability: normName(r.capability), scenario: normName(r.scenario), test: r.test, file: r.test.split('::')[0] };
    if (r.outcome) row.outcome = r.outcome;
    return row;
  });
}

const PW_STATUS = { expected: 'passed', unexpected: 'failed', flaky: 'failed', skipped: 'skipped' };

function fromPlaywright(data, level, root) {
  if (!data || !Array.isArray(data.suites)) throw new ResultsFormatError('playwright-json: no "suites" in the report');
  const rootDir = data.config?.rootDir;
  const rows = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const marks = (t.annotations || []).filter((a) => a.type === 'scenario');
        if (!marks.length) continue;
        const loc = marks[0].location?.file;
        let file = loc || (rootDir ? join(rootDir, spec.file) : spec.file);
        if (root && isAbsolute(file)) file = relative(root, file);
        const name = [...titles, spec.title].filter(Boolean).join(' › ');
        const test = `${file}:${spec.line} › ${t.projectName ? `[${t.projectName}] ` : ''}${name}`;
        const ran = (t.results || []).length > 0;
        for (const a of marks) {
          const m = String(a.description || '').match(/^(.+?)\s+::\s+(.+)$/);
          if (!m) throw new ResultsFormatError(`playwright-json: scenario annotation "${a.description}" in ${test} must be "<capability-path> :: <Scenario name>"`);
          const row = { level, capability: normName(m[1]), scenario: normName(m[2]), test, file };
          if (ran) row.outcome = PW_STATUS[t.status] || 'failed';
          rows.push(row);
        }
      }
    }
    for (const child of suite.suites || []) walk(child, [...titles, child.title]);
  };
  // top-level suites are files; their titles are the file names, not describe blocks
  for (const s of data.suites) walk(s, []);
  return rows;
}

/** Parses a tool's JSON output text in the given format. */
export function parseResults(text, format, level, root) {
  let data;
  const start = text.search(/[[{]/);
  try {
    data = JSON.parse(start >= 0 ? text.slice(start) : text);
  } catch (e) {
    throw new ResultsFormatError(`${format}: output is not JSON (${e.message})`);
  }
  if (format === 'sdd-json') return fromSddJson(data, level);
  if (format === 'playwright-json') return fromPlaywright(data, level, root);
  throw new ResultsFormatError(`unknown format "${format}"`);
}
