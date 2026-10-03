// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Parser for `clarifications.md` (format: openspec/protocols/questions.md).
import { toLines, fenceMask, stripComments } from './markdown.mjs';

/** Round each artifact depends on (clarify schema). */
export const ROUND_FOR_ARTIFACT = {
  proposal: 'Main',
  specs: 'Specs',
  design: 'Design',
  'verification-plan': 'Verification',
};
export const KNOWN_ROUNDS = ['Main', 'Specs', 'Design', 'Verification', 'Apply'];

const ROUND_HEADING = /^##\s+(.+?)\s+round\s*$/i;
const QUESTION_HEADING = /^###\s+Q(\d+)\.\s*(.*?)\s*$/;
const SUMMARY_HEADING = /^###\s+Summary confirmation\s*[—–-]\s*(.+?)(?:\s+round)?\s*$/i;
const CHANGES_HEADING = /^###\s+Requested changes\s*[—–-]\s*(.+?)(?:\s+round)?\s*(?:#\s*(\d+))?\s*$/i;
const ANSWER = /^\s*\[Answer\]:(.*)$/;
const OPTION = /^\s*[-*]\s+([A-Z])\.\s+(.*)$/;
const FOLLOW_UP = /\(follow-up to ((?:Q\d+(?:\s*,\s*|\s+and\s+)?)+)\)/i;

/** True when an answer value counts as not answered (blank or only underscores). */
export function isBlankAnswer(value) {
  return value === null || /^_*$/.test(value.trim());
}

/** Option letters an answer refers to ("B", "A, C", "X — text", "B (note)"); [] for free text. */
export function answerLetters(value) {
  const m = (value || '').trim().match(/^([A-Z](?:\s*,\s*[A-Z])*)(?=$|[\s.,:;()\-—–])/);
  return m ? m[1].split(/\s*,\s*/) : [];
}

function canonicalRound(name) {
  const n = name.trim().replace(/\s+round$/i, '');
  const known = KNOWN_ROUNDS.find((r) => r.toLowerCase() === n.toLowerCase());
  return known || n;
}

/**
 * Reads the answer that belongs to the `[Answer]:` tag on line i: the rest of that line, or, when
 * empty, the following non-blank lines up to a blank line or a heading.
 */
function readAnswer(lines, i) {
  const first = lines[i].match(ANSWER)[1].trim();
  if (first) return first;
  const more = [];
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t || /^#{1,6}\s/.test(t)) break;
    more.push(t);
  }
  return more.join(' ').trim();
}

/**
 * Parses clarifications.md.
 * Returns { depth, sources:{desc, docs:Set}, rounds:[...], questions: Map(n -> question), problems:[{line, message}] }.
 * Lines are 1-based. HTML comments and fenced code are ignored.
 */
export function parseClarifications(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences).map((l, i) => (fences[i] ? '' : l));
  const result = { depth: null, sources: { desc: false, docs: new Set() }, rounds: [], questions: new Map(), problems: [] };

  let section = null; // 'sources' | round object | null
  let item = null; // current question / summary / changes entry
  const closeItem = () => {
    item = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1;

    const depth = line.match(/^Depth:\s*(\S+)/);
    if (depth && !section) result.depth = depth[1];

    if (/^##\s+Sources\s*$/i.test(line)) {
      section = 'sources';
      closeItem();
      continue;
    }
    const rh = line.match(ROUND_HEADING);
    if (rh && !line.startsWith('###')) {
      section = { name: canonicalRound(rh[1]), line: ln, questions: [], summary: null, changes: [] };
      result.rounds.push(section);
      closeItem();
      continue;
    }
    if (/^##\s+/.test(line) && !line.startsWith('###')) {
      section = null;
      closeItem();
      continue;
    }

    if (section === 'sources') {
      if (/^\s*[-*]\s+\[desc\]/.test(line)) result.sources.desc = true;
      const d = line.match(/^\s*[-*]\s+\[(D\d+)\]/);
      if (d) result.sources.docs.add(d[1]);
      continue;
    }
    if (!section) continue;

    const qh = line.match(QUESTION_HEADING);
    if (qh) {
      const n = Number(qh[1]);
      const fu = qh[2].match(FOLLOW_UP);
      item = {
        kind: 'question',
        n,
        title: qh[2],
        line: ln,
        round: section.name,
        for: null,
        why: false,
        options: [],
        answer: null,
        answerLine: null,
        followUpOf: fu ? [...fu[1].matchAll(/Q(\d+)/g)].map((m) => Number(m[1])) : [],
      };
      section.questions.push(item);
      if (result.questions.has(n)) {
        result.problems.push({ line: ln, message: `Q${n} is defined twice (also at line ${result.questions.get(n).line})` });
      } else {
        result.questions.set(n, item);
      }
      continue;
    }
    const sh = line.match(SUMMARY_HEADING);
    if (sh) {
      item = { kind: 'summary', round: canonicalRound(sh[1]), line: ln, answer: null, answerLine: null };
      if (item.round !== section.name) {
        result.problems.push({ line: ln, message: `summary for "${item.round}" round is inside the "${section.name}" round section` });
      }
      if (section.summary) result.problems.push({ line: ln, message: `"${section.name}" round has more than one summary confirmation` });
      section.summary = item;
      continue;
    }
    const ch = line.match(CHANGES_HEADING);
    if (ch) {
      item = { kind: 'changes', round: canonicalRound(ch[1]), k: ch[2] ? Number(ch[2]) : null, line: ln, answer: null, answerLine: null };
      section.changes.push(item);
      continue;
    }
    if (/^###\s+/.test(line)) {
      result.problems.push({ line: ln, message: `unrecognised heading inside "${section.name}" round: ${line.trim()}` });
      closeItem();
      continue;
    }
    if (!item) continue;

    if (item.kind === 'question') {
      const f = line.match(/^For:\s*(.*)$/);
      if (f) item.for = f[1].trim();
      if (/^Why this is asked:\s*\S/.test(line)) item.why = true;
      const o = line.match(OPTION);
      if (o && item.answerLine === null) item.options.push({ key: o[1], text: o[2].trim() });
    }
    if (ANSWER.test(line)) {
      if (item.answerLine !== null) {
        result.problems.push({ line: ln, message: `${describe(item)} has more than one [Answer]: tag` });
      } else {
        item.answer = readAnswer(lines, i);
        item.answerLine = ln;
      }
    }
  }
  return result;
}

/** Human label of a parsed entry. */
export function describe(item) {
  if (item.kind === 'question') return `Q${item.n}`;
  if (item.kind === 'summary') return `${item.round} round summary confirmation`;
  return `${item.round} round requested changes${item.k ? ` #${item.k}` : ''}`;
}

/** Status of a round: { exists, unanswered:[items], confirmed, summaryAnswer }. */
export function roundStatus(parsed, roundName) {
  const round = parsed.rounds.find((r) => r.name === roundName);
  if (!round) return { exists: false, unanswered: [], confirmed: false, summaryAnswer: null };
  const entries = [...round.questions, ...round.changes];
  const unanswered = entries.filter((e) => e.answerLine === null || isBlankAnswer(e.answer));
  const summaryAnswer = round.summary && round.summary.answerLine !== null ? round.summary.answer : null;
  return { exists: true, round, unanswered, confirmed: summaryAnswer === 'Looks correct' && unanswered.length === 0, summaryAnswer };
}
