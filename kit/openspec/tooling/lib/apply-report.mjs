// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Reader for the implementation report `apply-report.md` (format: openspec/protocols/apply.md), written by
// the AI in the change root at the end of the tasks, updated after the E2E stage and the consent list.
//
//   # Apply Report
//   ## Manual checks                            for QA after the archive; dangerous checks first
//   ### <capability-path> :: <scenario or case> — required before release   (the mark: dangerous only)
//   Reason: cannot be automated: <why>          or `dangerous: <why>`
//   Steps: <what to do>
//   Expected: <the outcome>
//   ## Not verified automatically               checks that should have been automated but did not run
//   ### <capability-path> :: <scenario or case>
//   Reason: <why it was not verified>
//   Consent: "<the developer's words>" (developer, <date>)
//   ## Weakened tests                           only with the developer's consent
//   ### <test file> :: <test name>              or `<file> :: lint rule <rule>`
//   Change: <what was weakened>
//   Reason: <why>
//   Consent: "<the developer's words>" (developer, <date>)
// An empty section says "None.". Fenced code and HTML comments are ignored. The parser only reads;
// check-apply-report judges the values.
import { toLines, fenceMask, stripComments, fold } from './markdown.mjs';
import { normName } from './spec-parser.mjs';

export const APPLY_REPORT = 'apply-report.md';
export const REQUIRED_MARK = 'required before release';
/** Section title -> key. */
export const REPORT_SECTIONS = { 'manual checks': 'manual', 'not verified automatically': 'unverified', 'weakened tests': 'weakened' };
export const SECTION_TITLES = { manual: 'Manual checks', unverified: 'Not verified automatically', weakened: 'Weakened tests' };

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FIELD = /^\s*(?:[-*+]\s+)?\**(Reason|Steps|Expected|Consent|Change)\**\s*:\s*(.*)$/i;
const NONE = /^\(?\s*none\s*\.?\s*\)?$/i;
const REF = /^(\S+)\s*::\s*(.+)$/;
const MARK = new RegExp(`\\s*[—–-]\\s*${REQUIRED_MARK}\\s*$`, 'i');

/**
 * Parses apply-report.md: {
 *   sections: { manual|unverified|weakened: { line, none: boolean, other: boolean } | null },
 *   entries: { manual: [entry], unverified: [entry], weakened: [entry] },
 *   problems: [{ line, message }]
 * }; entry = { capability, name, required, reason, steps, expected, consent, change, line } ('' when absent).
 */
export function parseApplyReport(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences);
  const doc = { sections: { manual: null, unverified: null, weakened: null }, entries: { manual: [], unverified: [], weakened: [] }, problems: [] };
  let section = null;
  let entry = null;
  for (let i = 0; i < lines.length; i++) {
    if (fences[i]) continue;
    const line = lines[i];
    const n = i + 1;
    const h = line.match(HEADING);
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      if (level === 1) continue;
      if (level === 2) {
        entry = null;
        section = REPORT_SECTIONS[fold(title)] || null;
        if (!section) continue;
        if (doc.sections[section]) doc.problems.push({ line: n, message: `section "## ${SECTION_TITLES[section]}" appears twice` });
        else doc.sections[section] = { line: n, none: false, other: false };
        continue;
      }
      if (level === 3 && section) {
        const required = MARK.test(title);
        const ref = title.replace(MARK, '').replace(/`/g, '').match(REF);
        if (!ref) {
          entry = null;
          doc.problems.push({ line: n, message: `entry "### ${title}" under "${SECTION_TITLES[section]}" is not "### <capability-path> :: <name>"` });
          continue;
        }
        entry = { capability: ref[1], name: normName(ref[2]), required, reason: '', steps: '', expected: '', consent: '', change: '', line: n };
        doc.entries[section].push(entry);
      }
      continue;
    }
    if (!section || !line.trim()) continue;
    const f = line.match(FIELD);
    if (f && entry) {
      entry[f[1].toLowerCase()] = f[2].trim();
      continue;
    }
    if (!entry && NONE.test(line.trim())) doc.sections[section].none = true;
    else if (!entry) doc.sections[section].other = true;
  }
  return doc;
}

export const entryKey = (e) => `${e.capability} :: ${e.name}`;
