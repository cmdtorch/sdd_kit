// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Reader for test-cases.md and the AI QA review (format: openspec/protocols/test-cases.md).
//
//   # Test Cases
//   ## <capability-path>                         one section per capability of the delta specs
//   ### Scenario: <exact scenario name>          one section per spec scenario
//   #### Case: <case name>                       one or more cases per scenario
//   Labels: automated, e2e                       automated | e2e | manual
//   - **Given** / **When** / **Then** / **And** / **But** <step>
//   > **Remark** [open|closed|reopened]: <text>  under a case, or under "## General remarks"
//   > **Answer:** <how it was handled>
//   ## General remarks
//   ## Spec changes during test-case review
//   ## Stage result                              accepted / fixed-by-hand findings as list items,
//                                                the line "Handed over to QA", the "[Answer]:" confirmation
// Everything inside fenced code and HTML comments is ignored.
import { toLines, fenceMask, stripComments, firstTable, fold } from './markdown.mjs';
import { normName } from './spec-parser.mjs';

export const TEST_CASES_FILE = 'test-cases.md';
export const CASE_REVIEW = 'reviews/test-cases-review.md';
export const LABELS = ['automated', 'e2e', 'manual'];
export const REMARK_STATUSES = ['open', 'closed', 'reopened'];
export const HANDED_OVER = 'Handed over to QA';

const SPECIAL = {
  'general remarks': 'general',
  'spec changes during test-case review': 'specChanges',
  'stage result': 'stageResult',
};
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const SCENARIO = /^Scenario:\s*(.+)$/i;
const CASE = /^Case:\s*(.+)$/i;
const LABELS_LINE = /^\s*Labels\s*:\s*(.*)$/i;
const STEP = /^\s*[-*+]\s*\*\*(Given|When|Then|And|But)\*\*/i;
const REMARK = /^\s*>\s*\*\*Remark\*\*\s*(?:\[([^\]]*)\])?\s*:?\s*(.*)$/i;
const ANSWER = /^\s*\[Answer\]:\s*(.*)$/;
const LIST_ITEM = /^\s*[-*+]\s+(.*)$/;
const NONE_ITEM = /^\(?\s*none\s*\.?\s*\)?$/i;

/** Parses test-cases.md. Line numbers are 1-based. */
export function parseTestCases(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences);
  const doc = {
    capabilities: [],
    remarks: [],
    sections: { general: null, specChanges: null, stageResult: null },
    stage: { listed: [], handedOver: false, answer: null, answerLine: null },
    problems: [],
  };
  let section = null; // { kind: 'capability', cap } | { kind: 'general' | 'specChanges' | 'stageResult' } | { kind: 'other' }
  let scenario = null;
  let kase = null;
  let lastStep = null;

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
        scenario = kase = null;
        const special = SPECIAL[fold(title)];
        if (special) {
          section = { kind: special };
          if (doc.sections[special]) doc.problems.push({ line: n, message: `section "## ${title}" appears twice` });
          else doc.sections[special] = { line: n };
        } else {
          const name = normName(title);
          let cap = doc.capabilities.find((c) => c.name === name);
          if (cap) doc.problems.push({ line: n, message: `capability section "## ${name}" appears twice` });
          else doc.capabilities.push((cap = { name, line: n, scenarios: [] }));
          section = { kind: 'capability', cap };
        }
        continue;
      }
      if (level === 3) {
        kase = null;
        const m = title.match(SCENARIO);
        if (section?.kind !== 'capability') {
          scenario = null;
          if (m) doc.problems.push({ line: n, message: `scenario "${normName(m[1])}" is not inside a capability section ("## <capability-path>")` });
          continue;
        }
        if (!m) {
          scenario = null;
          doc.problems.push({ line: n, message: `heading "### ${title}" is not "### Scenario: <exact scenario name>"` });
          continue;
        }
        const name = normName(m[1]);
        scenario = section.cap.scenarios.find((s) => s.name === name);
        if (scenario) doc.problems.push({ line: n, message: `scenario "${name}" appears twice in ${section.cap.name}` });
        else section.cap.scenarios.push((scenario = { name, line: n, cases: [] }));
        continue;
      }
      if (level === 4) {
        const m = title.match(CASE);
        if (!m) {
          kase = null;
          if (section?.kind === 'capability') doc.problems.push({ line: n, message: `heading "#### ${title}" is not "#### Case: <case name>"` });
          continue;
        }
        const name = normName(m[1]);
        if (!scenario) {
          kase = null;
          doc.problems.push({ line: n, message: `test case "${name}" is not inside a scenario section ("### Scenario: <name>")` });
          continue;
        }
        kase = { name, line: n, labels: null, labelsLine: null, steps: { given: 0, when: 0, then: 0 }, remarks: [] };
        lastStep = null;
        scenario.cases.push(kase);
        continue;
      }
      continue;
    }

    const remark = line.match(REMARK);
    if (remark) {
      const r = { status: (remark[1] ?? '').trim().toLowerCase(), text: remark[2].trim(), line: n, case: kase ? kase.name : null };
      if (section?.kind === 'capability' && section.cap) r.capability = section.cap.name;
      doc.remarks.push(r);
      if (kase) kase.remarks.push(r);
      continue;
    }

    if (section?.kind === 'stageResult') {
      const a = line.match(ANSWER);
      if (a) {
        doc.stage.answer = a[1].trim();
        doc.stage.answerLine = n;
        continue;
      }
      const item = line.match(LIST_ITEM);
      const text = (item ? item[1] : line).trim();
      if (fold(text) === fold(HANDED_OVER)) {
        doc.stage.handedOver = true;
        continue;
      }
      if (item && !NONE_ITEM.test(text)) doc.stage.listed.push({ text, line: n });
      continue;
    }

    if (kase) {
      const l = line.match(LABELS_LINE);
      if (l) {
        kase.labels = l[1].split(',').map((x) => x.replace(/`/g, '').trim().toLowerCase()).filter(Boolean);
        kase.labelsLine = n;
        continue;
      }
      const s = line.match(STEP);
      if (s) {
        const k = s[1].toLowerCase();
        // And / But continue the previous step kind
        const kind = k === 'and' || k === 'but' ? lastStep : k;
        if (kind) kase.steps[kind]++;
        if (kind) lastStep = kind;
      }
    }
  }
  return doc;
}

/** Remarks that keep the stage open: open, reopened, or any status that is not closed (unknown counts as open). */
export function openRemarks(doc) {
  return doc.remarks.filter((r) => r.status !== 'closed');
}

/**
 * Parses reviews/test-cases-review.md: { verdict: 'READY'|'NOT-READY'|null, findings: [{id, severity, finding, case, scenario, line}] }.
 * Findings come from the first table whose header has a "Severity" column; placeholder rows ("—", "None.") are skipped.
 */
export function parseCaseReview(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences);
  const verdictLine = lines.find((l, i) => !fences[i] && /^\s*Verdict:/i.test(l));
  const m = verdictLine && verdictLine.match(/^\s*Verdict:\s*\**\s*(READY|NOT-READY)(?![\w-])/i);
  const verdict = m ? m[1].toUpperCase() : null;
  const findings = [];
  let start = 0;
  while (start < lines.length) {
    const t = firstTable(lines, start, lines.length);
    if (!t) break;
    const keys = t.header.map(fold);
    const col = (name) => keys.indexOf(name);
    if (col('severity') !== -1) {
      for (const r of t.rows) {
        const cell = (name) => (col(name) === -1 ? '' : (r.cells[col(name)] ?? '').trim());
        const o = { id: cell('id'), severity: cell('severity').toLowerCase(), finding: cell('finding'), case: cell('case'), scenario: cell('scenario'), line: r.line + 1 };
        if (/^(|—|–|-)$/.test(o.severity) && /^(|—|–|-|none\.?)$/i.test(o.finding)) continue;
        findings.push(o);
      }
      break;
    }
    start = t.line + t.rows.length + 2;
  }
  return { verdict, findings };
}

/** True when a review finding is listed in "Stage result" (the list item quotes the finding text). */
export function isListed(doc, finding) {
  const text = fold(finding.finding);
  if (!text) return false;
  return doc.stage.listed.some((item) => fold(item.text).includes(text));
}
