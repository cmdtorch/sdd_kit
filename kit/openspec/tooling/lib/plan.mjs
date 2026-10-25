// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Reader for verification-plan.md (format: openspec/protocols/testing.md).
import { toLines, fenceMask, stripComments, sectionRange, firstTable, fold } from './markdown.mjs';
import { normName } from './spec-parser.mjs';

export const LEVELS = ['unit', 'integration', 'manual'];
/** Levels a test case labelled `automated` may name in "Test case coverage" (test-case schemas). */
export const CASE_LEVELS = ['unit', 'integration'];

const EMPTY = /^(|—|–|-|none\.?|n\/a)$/i;

/** Reads the table under `## <title>` and maps rows to objects by header names (folded). */
function tableUnder(lines, fences, title) {
  const range = sectionRange(lines, (h) => h.level === 2 && fold(h.title) === fold(title), fences);
  if (!range) return { present: false, rows: [], line: null };
  const t = firstTable(lines, range.start, range.end);
  if (!t) return { present: true, rows: [], line: range.heading.line + 1, noTable: true };
  const keys = t.header.map(fold);
  const rows = t.rows
    .map((r) => {
      const o = { line: r.line + 1 };
      keys.forEach((k, idx) => (o[k] = (r.cells[idx] ?? '').trim()));
      return o;
    })
    // a row whose cells are all empty / "—" / "None." is a placeholder, not data
    .filter((o) => !Object.entries(o).every(([k, v]) => k === 'line' || EMPTY.test(v)));
  return { present: true, rows, line: range.heading.line + 1, columns: keys };
}

function prepare(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  return { lines: stripComments(raw, fences), fences };
}

const col = (row, ...names) => {
  for (const n of names) if (row[n] !== undefined) return row[n];
  return '';
};

// "automated, e2e" / "unit + integration" / "—" -> lower-case items, placeholders dropped
const list = (v) =>
  String(v)
    .replace(/`/g, '')
    .split(/[,;/+]|\s+and\s+|\s+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x && !EMPTY.test(x));

/** Parses verification-plan.md. */
export function parsePlan(content) {
  const { lines, fences } = prepare(content);
  const coverage = tableUnder(lines, fences, 'Scenario coverage');
  const exclusions = tableUnder(lines, fences, 'Exclusions');
  const trace = tableUnder(lines, fences, 'Requirement trace');
  const testCases = tableUnder(lines, fences, 'Test case coverage');
  return {
    coverage: {
      ...coverage,
      rows: coverage.rows.map((r) => ({
        line: r.line,
        capability: normName(col(r, 'capability')),
        requirement: normName(col(r, 'requirement')),
        scenario: normName(col(r, 'scenario')),
        level: col(r, 'level').trim().toLowerCase(),
        critical: col(r, 'critical'),
      })),
    },
    exclusions: {
      ...exclusions,
      rows: exclusions.rows.map((r) => ({ line: r.line, capability: normName(col(r, 'capability')), scenario: normName(col(r, 'scenario')), reason: col(r, 'reason') })),
    },
    // test-case schemas only: one row per test case of test-cases.md
    testCases: {
      ...testCases,
      rows: testCases.rows.map((r) => ({
        line: r.line,
        capability: normName(col(r, 'capability')),
        scenario: normName(col(r, 'scenario')),
        name: normName(col(r, 'case', 'test case')),
        labels: list(col(r, 'labels')),
        levels: list(col(r, 'level', 'levels')),
      })),
    },
    trace: {
      ...trace,
      rows: trace.rows.map((r) => ({ line: r.line, capability: normName(col(r, 'capability')), requirement: normName(col(r, 'requirement')), sources: col(r, 'sources') })),
    },
  };
}

export const key = (capability, scenario) => `${capability} :: ${scenario}`;
export const isEmptyCell = (v) => EMPTY.test(String(v).trim());
