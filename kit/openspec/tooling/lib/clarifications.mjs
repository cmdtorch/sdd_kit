// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Parser for `clarifications.md` (format: openspec/protocols/questions.md).
import { toLines, fenceMask, stripComments } from './markdown.mjs';

/** Round each artifact depends on (clarify-family schemas). */
export const ROUND_FOR_ARTIFACT = {
  proposal: 'Main',
  specs: 'Specs',
  design: 'Design',
  'verification-plan': 'Verification',
};
export const KNOWN_ROUNDS = ['Main', 'Specs', 'Design', 'Verification', 'Apply'];

/** Round each artifact depends on for a change under the new planning rules (`usesNewPlanning`). */
export const NEW_ROUND_FOR_ARTIFACT = {
  proposal: 'Main',
  specs: 'Technical',
  design: 'Technical',
  'verification-plan': 'Technical',
};
export const NEW_ROUNDS = ['Main', 'Technical', 'Apply'];
/** Values of the header lines of a new-rules file. */
export const DEPTH_LEVELS = ['low', 'medium', 'high'];
export const ANSWER_MODES = ['chat', 'file', 'discussion'];

/** Round map and round names for a change under the new planning rules (`newPlanning`) or the earlier ones. */
export function roundsFor(newPlanning) {
  return newPlanning ? { forArtifact: NEW_ROUND_FOR_ARTIFACT, known: NEW_ROUNDS } : { forArtifact: ROUND_FOR_ARTIFACT, known: KNOWN_ROUNDS };
}

const ROUND_HEADING = /^##\s+(.+?)\s+round\s*$/i;
const QUESTION_HEADING = /^###\s+Q(\d+)\.\s*(.*?)\s*$/;
const SUMMARY_HEADING = /^###\s+Summary confirmation\s*[—–-]\s*(.+?)(?:\s+round)?\s*$/i;
const CHANGES_HEADING = /^###\s+Requested changes\s*[—–-]\s*(.+?)(?:\s+round)?\s*(?:#\s*(\d+))?\s*$/i;
const ANSWER = /^\s*\[Answer\]:(.*)$/;
const OPTION = /^\s*[-*]\s+([A-Z])\.\s+(.*)$/;
const RECOMMENDED = /^\s*Recommended:\s*(.*?)\s*$/;
const NO_QUESTIONS = /^\s*No questions\.?\s*$/i;
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

function canonicalRound(name, newPlanning) {
  const n = name.trim().replace(/\s+round$/i, '');
  const known = (newPlanning ? NEW_ROUNDS : KNOWN_ROUNDS).find((r) => r.toLowerCase() === n.toLowerCase());
  return known || n;
}

/**
 * Reads the answer that belongs to the `[Answer]:` tag on line i: the rest of that line, or, when
 * empty, the following non-blank lines up to a blank line or a heading.
 */
function readAnswer(lines, i, newPlanning) {
  const first = lines[i].match(ANSWER)[1].trim();
  if (first) return first;
  const more = [];
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t || /^#{1,6}\s/.test(t)) break;
    if (newPlanning && RECOMMENDED.test(t)) break;
    more.push(t);
  }
  return more.join(' ').trim();
}

/** Reads the text of a `Recommended:` line: { letters, reason } (letters [] / reason null when missing). */
function readRecommendation(text) {
  const m = text.match(/^([A-Z](?:\s*,\s*[A-Z])*)(?:\s+[—–-]\s*(.*))?$/);
  if (!m) return { letters: [], reason: null };
  const reason = (m[2] || '').trim();
  return { letters: m[1].split(/\s*,\s*/), reason: reason || null };
}

/**
 * Parses clarifications.md.
 * Options: { newPlanning } — the file of a change under the new planning rules (`usesNewPlanning`): the header
 * line `Answer mode:`, `Recommended: <letters> — <reason>` lines under a question (never read as its answer) and
 * the line `No questions.` in a round are read, and roundStatus() reports a closed round as confirmed.
 * Returns { newPlanning, depth, depthLine, answerMode, answerModeLine, sources:{desc, docs:Set, ui:Map(tag -> {file, line})}, rounds:[...], questions: Map(n -> question),
 * problems:[{line, message}] }. A round has { name, line, questions, summary, changes, noQuestions,
 * noQuestionsLine }; a question has `recommendations: [{line, letters, reason, text}]` (new rules only). `sources.ui` holds the screenshot registrations `- [U<n>] ... sources/ui/<file>`
 * (file: the first image file name on the line, or null).
 * Lines are 1-based. HTML comments and fenced code are ignored.
 */
export function parseClarifications(content, { newPlanning = false } = {}) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences).map((l, i) => (fences[i] ? '' : l));
  const result = { newPlanning, depth: null, depthLine: null, answerMode: null, answerModeLine: null, sources: { desc: false, docs: new Set(), ui: new Map() }, rounds: [], questions: new Map(), problems: [] };

  let section = null; // 'sources' | round object | null
  let item = null; // current question / summary / changes entry
  const closeItem = () => {
    item = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1;

    const depth = line.match(/^Depth:\s*(\S+)/);
    if (depth && !section) {
      result.depth = depth[1];
      result.depthLine = ln;
    }
    const mode = newPlanning && !section && line.match(/^Answer mode:\s*(.*?)\s*$/);
    if (mode) {
      result.answerMode = mode[1];
      result.answerModeLine = ln;
    }

    if (/^##\s+Sources\s*$/i.test(line)) {
      section = 'sources';
      closeItem();
      continue;
    }
    const rh = line.match(ROUND_HEADING);
    if (rh && !line.startsWith('###')) {
      section = { name: canonicalRound(rh[1], newPlanning), line: ln, questions: [], summary: null, changes: [], noQuestions: false, noQuestionsLine: null };
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
      const u = line.match(/^\s*[-*]\s+\[U(\d+)\]/);
      if (u) {
        const file = line.match(/([^\s`/\\()\[\]]+\.(?:png|jpe?g|webp))(?![\w.])/i);
        const tag = `U${Number(u[1])}`;
        if (result.sources.ui.has(tag)) result.problems.push({ line: ln, message: `[${tag}] is registered twice under "## Sources"` });
        else result.sources.ui.set(tag, { file: file ? file[1] : null, line: ln });
      }
      continue;
    }
    if (!section) continue;

    if (newPlanning && NO_QUESTIONS.test(line)) {
      section.noQuestions = true;
      section.noQuestionsLine = ln;
      closeItem();
      continue;
    }

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
        why: false,
        options: [],
        answer: null,
        answerLine: null,
        recommendations: [],
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
      item = { kind: 'summary', round: canonicalRound(sh[1], newPlanning), line: ln, answer: null, answerLine: null };
      if (item.round !== section.name) {
        result.problems.push({ line: ln, message: `summary for "${item.round}" round is inside the "${section.name}" round section` });
      }
      if (section.summary) result.problems.push({ line: ln, message: `"${section.name}" round has more than one summary confirmation` });
      section.summary = item;
      continue;
    }
    const ch = line.match(CHANGES_HEADING);
    if (ch) {
      item = { kind: 'changes', round: canonicalRound(ch[1], newPlanning), k: ch[2] ? Number(ch[2]) : null, line: ln, answer: null, answerLine: null };
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
      const rec = newPlanning && line.match(RECOMMENDED);
      if (rec) {
        item.recommendations.push({ line: ln, ...readRecommendation(rec[1]), text: rec[1] });
        continue;
      }
      if (/^Why this is asked:\s*\S/.test(line)) item.why = true;
      const o = line.match(OPTION);
      if (o && item.answerLine === null) item.options.push({ key: o[1], text: o[2].trim() });
    }
    if (ANSWER.test(line)) {
      if (item.answerLine !== null) {
        result.problems.push({ line: ln, message: `${describe(item)} has more than one [Answer]: tag` });
      } else {
        item.answer = readAnswer(lines, i, newPlanning);
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

/**
 * Status of a round: { exists, unanswered:[items], confirmed, summaryAnswer }. Under the earlier rules a round is
 * confirmed by "Looks correct" on its summary with every entry answered. Under the new planning rules (a file
 * parsed with `newPlanning`) a round is closed, and reported as confirmed, when it holds a question or the line
 * "No questions." and none of its answers is blank; no summary is needed.
 */
export function roundStatus(parsed, roundName) {
  const round = parsed.rounds.find((r) => r.name === roundName);
  if (!round) return { exists: false, unanswered: [], confirmed: false, summaryAnswer: null };
  const entries = [...round.questions, ...round.changes];
  const unanswered = entries.filter((e) => e.answerLine === null || isBlankAnswer(e.answer));
  const summaryAnswer = round.summary && round.summary.answerLine !== null ? round.summary.answer : null;
  const confirmed = parsed.newPlanning
    ? unanswered.length === 0 && (round.questions.length > 0 || round.noQuestions)
    : summaryAnswer === 'Looks correct' && unanswered.length === 0;
  return { exists: true, round, unanswered, confirmed, summaryAnswer };
}
