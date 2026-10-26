// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Reader for the E2E stage record `e2e.md` (format: openspec/protocols/e2e.md), written by the AI in the
// change root.
//
//   # E2E Stage
//   Mode: real backend                      real backend | stubbed backend | skipped
//   Tests: e2e/                             the project folder of the E2E tests (required unless skipped)
//   Start: command `npm run e2e:serve`      or: Start: developer at http://localhost:3000
//   Note: —                                 optional
//   ## Scenarios                            clarify / lean: `- <capability-path> :: <Scenario name>`
//   ## Accepted cases                       `- <capability-path> :: <case or scenario name> — <reason>`
//   ## Screens                              table | Screenshot | Result | Differences | Reason |
//                                           Result: no differences | differences | accepted
//   ## No new run needed                    `- <state id> — <what changed>` (state id from e2e-run.mjs --state)
// `—`, `–`, `-` or an empty value means none. Fenced code and HTML comments are ignored. The parser only
// reads; check-e2e judges the values.
import { toLines, fenceMask, stripComments, sectionRange, firstTable, fold } from './markdown.mjs';
import { normName } from './spec-parser.mjs';

export const E2E_FILE = 'e2e.md';
export const MODES = ['real backend', 'stubbed backend', 'skipped'];
export const SKIPPED = 'skipped';
export const SCREEN_RESULTS = ['no differences', 'differences', 'accepted'];
export const ACCEPTED = 'accepted';
export const DIFFERENCES = 'differences';
export const START_KINDS = ['command', 'developer'];

const HEADER_LINE = /^\s*(Mode|Tests|Start|Note)\s*:\s*(.*)$/i;
const LIST_ITEM = /^\s*[-*+]\s+(.*)$/;
const NONE_ITEM = /^\(?\s*none\s*\.?\s*\)?$/i;
const REF = /^(\S+)\s*::\s*(.+)$/;
const REASON_SEPARATOR = /^(.*?)\s*[—–]\s*(.*)$/;
const NO_RUN_ITEM = /^`?([0-9a-f]{8,64})`?\s*[—–-]\s*(\S.*)$/i;
const SCREEN_COLUMNS = ['Screenshot', 'Result', 'Differences', 'Reason'];
const SECTIONS = {
  scenarios: 'scenarios',
  'accepted cases': 'accepted',
  screens: 'screens',
  'no new run needed': 'noNewRun',
};

/** True for a value that means "nothing": empty, `—`, `–` or `-`. */
const isNone = (s) => /^[\s—–-]*$/.test(s);
const unquote = (s) => s.trim().replace(/^`+|`+$/g, '').trim();

/** Parses a `Start:` value into { kind: 'command'|'developer'|null, command, url, raw }. */
export function parseStart(raw) {
  const value = raw.trim();
  const cmd = value.match(/^command\b\s*(.*)$/i);
  if (cmd) return { kind: 'command', command: isNone(cmd[1]) ? '' : unquote(cmd[1]), url: '', raw: value };
  const dev = value.match(/^developer\b(?:\s+at\b)?\s*(.*)$/i);
  if (dev) return { kind: 'developer', command: '', url: isNone(dev[1]) ? '' : unquote(dev[1]), raw: value };
  return { kind: null, command: '', url: '', raw: value };
}

/**
 * Parses e2e.md. Lines are 1-based. Returns {
 *   mode (lower-case, null when absent or none), modeRaw, modeLine,
 *   tests (folder, null when absent or none), testsLine,
 *   start: {kind, command, url, raw, line} | null, note (null when absent or none),
 *   scenarios: [{capability, scenario, line}],
 *   accepted: [{capability, name, reason ('' when none), line}],
 *   screens: [{screenshot, result (lower-case, '' when none), resultRaw, differences, reason, line}],
 *   noNewRun: [{state (lower-case), what, line}],
 *   sections: {scenarios, accepted, screens, noNewRun: {line} | null},
 *   problems: [{line, message}]
 * }.
 */
export function parseE2eRecord(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences).map((l, i) => (fences[i] ? '' : l));
  const rec = {
    mode: null,
    modeRaw: null,
    modeLine: null,
    tests: null,
    testsLine: null,
    start: null,
    note: null,
    scenarios: [],
    accepted: [],
    screens: [],
    noNewRun: [],
    sections: { scenarios: null, accepted: null, screens: null, noNewRun: null },
    problems: [],
  };
  const problem = (line, message) => rec.problems.push({ line, message });

  // --- header lines (before the first "## " section) -------------------------------------------
  const seen = new Set();
  for (let i = 0; i < lines.length && !/^##\s/.test(lines[i]); i++) {
    const m = lines[i].match(HEADER_LINE);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    const n = i + 1;
    if (seen.has(key)) {
      problem(n, `the "${m[1]}:" line appears twice`);
      continue;
    }
    seen.add(key);
    if (key === 'mode') {
      rec.modeRaw = value;
      rec.modeLine = n;
      rec.mode = isNone(value) ? null : fold(value);
    } else if (key === 'tests') {
      rec.testsLine = n;
      rec.tests = isNone(value) ? null : unquote(value);
    } else if (key === 'start') {
      if (!isNone(value)) rec.start = { ...parseStart(value), line: n };
    } else if (!isNone(value)) {
      rec.note = value;
    }
  }

  // --- sections --------------------------------------------------------------------------------
  for (const [title, key] of Object.entries(SECTIONS)) {
    const range = sectionRange(lines, (h) => h.level === 2 && fold(h.title) === title, fences);
    if (!range) continue;
    rec.sections[key] = { line: range.heading.line + 1 };
    if (key === 'screens') {
      readScreens(lines, range, rec, problem);
      continue;
    }
    for (let i = range.start; i < range.end; i++) {
      const item = lines[i].match(LIST_ITEM);
      if (!item || NONE_ITEM.test(item[1].trim())) continue;
      const text = item[1].trim();
      const n = i + 1;
      if (key === 'scenarios') {
        const m = text.replace(/`/g, '').match(REF);
        if (m) rec.scenarios.push({ capability: m[1], scenario: normName(m[2]), line: n });
        else problem(n, `scenario "${text}" under "## Scenarios" is not \`<capability-path> :: <Scenario name>\``);
      } else if (key === 'accepted') {
        const split = text.match(REASON_SEPARATOR);
        const ref = (split ? split[1] : text).replace(/`/g, '').match(REF);
        if (!ref) {
          problem(n, `accepted case "${text}" is not \`<capability-path> :: <name> — <reason>\``);
          continue;
        }
        const reason = split && !isNone(split[2]) ? split[2].trim() : '';
        rec.accepted.push({ capability: ref[1], name: normName(ref[2]), reason, line: n });
      } else {
        const m = text.match(NO_RUN_ITEM);
        if (m) rec.noNewRun.push({ state: m[1].toLowerCase(), what: m[2].trim(), line: n });
        else problem(n, `"${text}" under "## No new run needed" is not \`<state id> — <what changed>\` (the state id comes from e2e-run.mjs --state)`);
      }
    }
  }
  return rec;
}

function readScreens(lines, range, rec, problem) {
  const table = firstTable(lines, range.start, range.end);
  if (!table) {
    problem(range.heading.line + 1, `"## Screens" has no table (columns: ${SCREEN_COLUMNS.join(', ')})`);
    return;
  }
  const idx = SCREEN_COLUMNS.map((c) => table.header.findIndex((h) => fold(h) === fold(c)));
  const missing = SCREEN_COLUMNS.filter((_, k) => idx[k] === -1);
  if (missing.length) {
    problem(table.line + 1, `the screens table lacks the column(s) ${missing.join(', ')} (columns: ${SCREEN_COLUMNS.join(', ')})`);
    return;
  }
  for (const row of table.rows) {
    const [shot, result, differences, reason] = idx.map((k) => (row.cells[k] ?? '').trim());
    const screenshot = shot.replace(/`/g, '').replace(/^.*\//, '').trim();
    if (!screenshot) {
      problem(row.line + 1, 'a row of the screens table has no screenshot');
      continue;
    }
    rec.screens.push({
      screenshot,
      result: isNone(result) ? '' : fold(result),
      resultRaw: result,
      differences: isNone(differences) ? '' : differences,
      reason: isNone(reason) ? '' : reason,
      line: row.line + 1,
    });
  }
}
