// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// UI screenshots of a change (openspec/protocols/ui-inventory.md): the `sources/ui/` folder and the parser
// for `ui-inventory.md`.
//
// UI mode is on while `sources/ui/` holds at least one accepted screenshot (.png, .jpg, .jpeg, .webp in any
// letter case). Besides screenshots only the notes file `screens.md` may sit there; any other file and any
// subfolder is a format error, reported even when the mode is off. Hidden entries (names starting with `.`,
// such as `.DS_Store`) are ignored.
//
// Inventory format:
//   ## Screenshots            table | Tag | File | Fingerprint |   (tag U<n>, file name in sources/ui/, SHA-256)
//   ## Screen: <name>         one section per screen
//   Screenshots: U1 (desktop), U2 (mobile)      the variant label in parentheses is optional
//   | Element | Type | Variants | Decision | Source | Scenarios |
// Scenarios are `<capability-path> :: <Scenario name>`, several separated by `;`. `—`, `-` or an empty
// cell means none.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { toLines, fenceMask, stripComments, headings, sectionRange, firstTable, fold } from './markdown.mjs';

export const UI_DIR = 'sources/ui';
export const INVENTORY_FILE = 'ui-inventory.md';
export const NOTES_FILE = 'screens.md';
export const SCREENSHOT_EXT = /\.(png|jpe?g|webp)$/i;
export const DECISIONS = ['in scope', 'mock', 'out of scope', 'decoration', 'existing'];
/** Decisions of elements the change builds (they need scenarios). */
export const BUILT_DECISIONS = ['in scope', 'mock'];

const ELEMENT_COLUMNS = ['Element', 'Type', 'Variants', 'Decision', 'Source', 'Scenarios'];
const SHOT_COLUMNS = ['Tag', 'File', 'Fingerprint'];
const SCREEN_HEADING = /^Screen:\s*(.+)$/i;
const SHOTS_LINE = /^Screenshots:\s*(.*)$/i;
const SOURCE_TAG = /\[(Q\d+|D\d+|U\d+|desc)\]/g;

export const isScreenshotName = (name) => SCREENSHOT_EXT.test(name);
/** True for a cell that means "nothing": empty, `—`, `–` or `-`. */
const isNone = (cell) => /^[\s—–-]*$/.test(cell);
/** `U1`, `[U1]` or `u1` → `U1`; null when the text is not a screenshot tag. */
export function normTag(s) {
  const m = String(s).trim().match(/^\[?\s*U(\d+)\s*\]?$/i);
  return m ? `U${Number(m[1])}` : null;
}

/**
 * Lists `sources/ui/` of a change directory, skipping hidden entries (names starting with `.`).
 * Returns { exists, screenshots:[file names, sorted], notes:boolean, invalid:[{name, kind:'file'|'folder'}] }.
 */
export function scanUiFolder(changeDir) {
  const dir = join(changeDir, UI_DIR);
  const scan = { exists: false, screenshots: [], notes: false, invalid: [] };
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return scan;
  scan.exists = true;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue; // hidden system files (.DS_Store) are neither screenshots nor errors
    if (statSync(join(dir, name)).isDirectory()) scan.invalid.push({ name, kind: 'folder' });
    else if (isScreenshotName(name)) scan.screenshots.push(name);
    else if (name === NOTES_FILE) scan.notes = true;
    else scan.invalid.push({ name, kind: 'file' });
  }
  return scan;
}

/** UI mode: at least one accepted screenshot. */
export function isUiMode(scan) {
  return scan.screenshots.length > 0;
}

/** Column index by header name (case-insensitive); -1 when absent. */
const columnIndex = (header, name) => header.findIndex((h) => fold(h) === fold(name));

/** Parses a Scenarios cell into [{capability, scenario}] and a list of malformed parts. */
export function parseScenarioRefs(cell) {
  const refs = [];
  const bad = [];
  if (isNone(cell)) return { refs, bad };
  for (const part of cell.split(';').map((p) => p.replace(/`/g, '').trim()).filter(Boolean)) {
    const m = part.match(/^(\S+)\s*::\s*(.+)$/);
    if (m) refs.push({ capability: m[1], scenario: m[2].trim().replace(/\s+/g, ' ') });
    else bad.push(part);
  }
  return { refs, bad };
}

/**
 * Parses ui-inventory.md.
 * Returns {
 *   screenshots: [{tag, file, fingerprint, line}],
 *   screens: [{name, line, shots:[{tag, variant|null}], shotsLine, elements:[{name, type, variants:[],
 *              decision (lower-case, '' when none), decisionRaw, sources:[tags], scenarios:[{capability, scenario}], line}]}],
 *   problems: [{line, message}]
 * }. Lines are 1-based; HTML comments and fenced code are ignored.
 */
export function parseInventory(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences).map((l, i) => (fences[i] ? '' : l));
  const result = { screenshots: [], screens: [], problems: [] };
  const problem = (line, message) => result.problems.push({ line, message });

  // --- screenshots table -----------------------------------------------------------------------
  const shotsRange = sectionRange(lines, (h) => h.level === 2 && /^Screenshots$/i.test(h.title), fences);
  if (!shotsRange) {
    problem(null, 'section "## Screenshots" is missing');
  } else {
    const table = firstTable(lines, shotsRange.start, shotsRange.end);
    const idx = table ? SHOT_COLUMNS.map((c) => columnIndex(table.header, c)) : [];
    if (!table) problem(shotsRange.heading.line + 1, '"## Screenshots" has no table (columns: Tag, File, Fingerprint)');
    else if (idx.includes(-1)) problem(table.line + 1, `the screenshots table needs the columns ${SHOT_COLUMNS.join(', ')}`);
    else {
      for (const row of table.rows) {
        const [tagCell, fileCell, fpCell] = idx.map((i) => (row.cells[i] ?? '').trim());
        const tag = normTag(tagCell);
        const file = fileCell.replace(/`/g, '').replace(/^.*\//, '').trim();
        if (!tag) {
          problem(row.line + 1, `"${tagCell}" in the screenshots table is not a screenshot tag (U<n>)`);
          continue;
        }
        if (result.screenshots.some((s) => s.tag === tag)) problem(row.line + 1, `${tag} is listed twice in the screenshots table`);
        else if (file && result.screenshots.some((s) => s.file === file)) problem(row.line + 1, `\`${file}\` is listed twice in the screenshots table`);
        result.screenshots.push({ tag, file, fingerprint: fpCell.replace(/`/g, '').trim().toLowerCase(), line: row.line + 1 });
      }
    }
  }

  // --- screens ---------------------------------------------------------------------------------
  for (const h of headings(lines, fences)) {
    const m = h.level === 2 && h.title.match(SCREEN_HEADING);
    if (!m) continue;
    const range = sectionRange(lines, (x) => x.line === h.line, fences);
    const screen = { name: m[1].replace(/`/g, '').trim(), line: h.line + 1, shots: [], shotsLine: null, elements: [] };
    result.screens.push(screen);
    if (result.screens.filter((s) => fold(s.name) === fold(screen.name)).length > 1) problem(screen.line, `screen "${screen.name}" is defined twice`);

    for (let i = range.start; i < range.end; i++) {
      const sl = lines[i].trim().match(SHOTS_LINE);
      if (!sl) continue;
      screen.shotsLine = i + 1;
      for (const part of sl[1].split(',').map((p) => p.trim()).filter(Boolean)) {
        const pm = part.match(/^(\S+?)\s*(?:\((.+)\))?$/);
        const tag = pm && normTag(pm[1]);
        if (!tag) problem(i + 1, `"${part}" on the Screenshots line of screen "${screen.name}" is not a screenshot tag (U<n> or U<n> (variant))`);
        else screen.shots.push({ tag, variant: pm[2] ? pm[2].trim() : null });
      }
      break;
    }
    if (screen.shotsLine === null) problem(screen.line, `screen "${screen.name}" has no "Screenshots:" line`);

    const table = firstTable(lines, range.start, range.end);
    if (!table) {
      problem(screen.line, `screen "${screen.name}" has no element table`);
      continue;
    }
    const idx = ELEMENT_COLUMNS.map((c) => columnIndex(table.header, c));
    const missing = ELEMENT_COLUMNS.filter((_, k) => idx[k] === -1);
    if (missing.length) {
      problem(table.line + 1, `the element table of screen "${screen.name}" lacks the column(s) ${missing.join(', ')} (columns: ${ELEMENT_COLUMNS.join(', ')})`);
      continue;
    }
    for (const row of table.rows) {
      const [name, type, variants, decision, source, scenarios] = idx.map((k) => (row.cells[k] ?? '').trim());
      const el = {
        name: name.replace(/`/g, '').trim(),
        type,
        variants: isNone(variants) ? [] : variants.split(',').map((v) => v.trim()).filter(Boolean),
        decisionRaw: decision,
        decision: isNone(decision) ? '' : fold(decision),
        sources: [...source.matchAll(SOURCE_TAG)].map((x) => x[1]),
        scenarios: [],
        line: row.line + 1,
      };
      if (!el.name) {
        problem(el.line, `an element row of screen "${screen.name}" has no element name`);
        continue;
      }
      if (screen.elements.some((e) => fold(e.name) === fold(el.name))) problem(el.line, `element "${el.name}" is listed twice on screen "${screen.name}"`);
      const sc = parseScenarioRefs(scenarios);
      el.scenarios = sc.refs;
      for (const b of sc.bad) problem(el.line, `element "${el.name}" names the scenario "${b}" without its capability (write \`<capability-path> :: <Scenario name>\`)`);
      screen.elements.push(el);
    }
  }
  return result;
}

/** All elements with their screen: [{screen, element}]. */
export function allElements(inv) {
  return inv.screens.flatMap((screen) => screen.elements.map((element) => ({ screen, element })));
}

/**
 * True when `element` of `screen` is shown on the screenshot `tag`: the screen lists the tag, and on a
 * screen with several screenshots the element's variants name that screenshot (by its label or its tag).
 */
export function elementOnShot(screen, element, tag) {
  const shot = screen.shots.find((s) => s.tag === tag);
  if (!shot) return false;
  if (screen.shots.length < 2) return true;
  const wanted = new Set(element.variants.map((v) => fold(v)));
  return wanted.has(fold(shot.tag)) || (shot.variant !== null && wanted.has(fold(shot.variant)));
}
