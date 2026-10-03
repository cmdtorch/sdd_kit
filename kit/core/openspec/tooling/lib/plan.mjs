// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Readers for verification-plan.md and verification.md (format: openspec/protocols/testing.md).
import { toLines, fenceMask, stripComments, sectionRange, firstTable, fold } from './markdown.mjs';
import { normName } from './spec-parser.mjs';

export const LEVELS = ['unit', 'e2e', 'manual'];
export const VERDICTS = ['Met', 'Not Met', 'Unverified'];

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

/** Parses verification-plan.md. */
export function parsePlan(content) {
  const { lines, fences } = prepare(content);
  const coverage = tableUnder(lines, fences, 'Scenario coverage');
  const exclusions = tableUnder(lines, fences, 'Exclusions');
  const trace = tableUnder(lines, fences, 'Requirement trace');
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
    trace: {
      ...trace,
      rows: trace.rows.map((r) => ({ line: r.line, capability: normName(col(r, 'capability')), requirement: normName(col(r, 'requirement')), sources: col(r, 'sources') })),
    },
  };
}

/** Parses verification.md. */
export function parseVerification(content) {
  const { lines, fences } = prepare(content);
  const matrix = tableUnder(lines, fences, 'Verification matrix');
  const commands = sectionRange(lines, (h) => h.level === 2 && fold(h.title) === 'commands run', fences);
  const commandLines = commands ? lines.slice(commands.start, commands.end).filter((l) => /^\s*[-*]\s+\S/.test(l)) : [];
  return {
    matrix: {
      ...matrix,
      rows: matrix.rows.map((r) => ({
        line: r.line,
        capability: normName(col(r, 'capability')),
        scenario: normName(col(r, 'scenario')),
        level: col(r, 'level').trim().toLowerCase(),
        expected: col(r, 'expected'),
        actual: col(r, 'actual'),
        evidence: col(r, 'evidence'),
        verdict: col(r, 'verdict').replace(/\*\*/g, '').trim(),
      })),
    },
    commands: { present: Boolean(commands), count: commandLines.length, line: commands ? commands.heading.line + 1 : null },
  };
}

export const key = (capability, scenario) => `${capability} :: ${scenario}`;
export const isEmptyCell = (v) => EMPTY.test(String(v).trim());
