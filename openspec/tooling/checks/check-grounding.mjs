#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// check-grounding — every substantive block of proposal.md / design.md carries a source tag
// (openspec/protocols/grounding.md): [Q<n>] (answered + confirmed), [D<n>] (registered), [desc],
// or [assumption] (only inside "## Assumptions & Open Questions").
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { toLines, fenceMask, stripComments } from '../lib/markdown.mjs';
import { parseClarifications, roundStatus, isBlankAnswer } from '../lib/clarifications.mjs';
import { changeDir, changeSchema, readChangeFile } from '../lib/project.mjs';
import { makeReport, skippedReport, findingsFor, runCli, isMain, UsageError } from '../lib/report.mjs';

const CHECK = 'check-grounding';
const USAGE = `Usage: check-grounding --change <name> [--file proposal.md|design.md] [--root <dir>] [--json]

Checks source tags in proposal.md and design.md of a clarify-schema change.`;

export const FILES = ['proposal.md', 'design.md'];
const TAG = /\[(Q\d+|D\d+|desc|assumption)\]/g;
const ASSUMPTIONS_HEADING = /^##\s+Assumptions\s*&\s*Open Questions\s*$/i;
const EXEMPT = [/^none\.?$/i, /^n\/a\.?$/i, /^\*\*[^*]+:\*\*$/, /^\*\*[^*]+\*\*:$/];

/**
 * Splits markdown into substantive blocks: paragraphs, list items, table data rows.
 * Returns [{text, line (1-based), section (nearest ## heading title)}].
 */
export function substantiveBlocks(content) {
  const raw = toLines(content);
  const fences = fenceMask(raw);
  const lines = stripComments(raw, fences);
  const blocks = [];
  let section = null;
  let cur = null;
  const flush = () => {
    if (cur && cur.text.trim()) blocks.push(cur);
    cur = null;
  };
  for (let i = 0; i < lines.length; i++) {
    if (fences[i]) {
      flush();
      continue;
    }
    const line = lines[i];
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flush();
      if (h[1].length <= 2) section = h[2].trim();
      continue;
    }
    if (t.startsWith('|')) {
      flush();
      const next = lines[i + 1] ? lines[i + 1].trim() : '';
      const isHeader = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(next);
      const isSeparator = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(t);
      if (!isHeader && !isSeparator) blocks.push({ text: t, line: i + 1, section, kind: 'row' });
      continue;
    }
    if (/^([-*+]|\d+[.)])\s+/.test(t)) {
      flush();
      cur = { text: t, line: i + 1, section, kind: 'item' };
      continue;
    }
    if (cur) cur.text += ' ' + t;
    else cur = { text: t, line: i + 1, section, kind: 'paragraph' };
  }
  flush();
  return blocks;
}

/** Runs the check. Options: { root, change, file? }. */
export function checkGrounding({ root, change, file }) {
  if (!change) throw new UsageError('--change is required');
  const dir = changeDir(root, change);
  if (!existsSync(dir)) throw new UsageError(`change "${change}" not found at ${dir}`);
  const schema = changeSchema(root, change);
  if (schema !== 'clarify') return skippedReport(CHECK, `change "${change}" uses schema "${schema}" (grounding applies to "clarify")`);
  if (file && !FILES.includes(file)) throw new UsageError(`--file must be one of ${FILES.join(', ')}`);

  const f = findingsFor(root);
  const clarFile = join(dir, 'clarifications.md');
  const clarContent = readChangeFile(root, change, 'clarifications.md');
  const parsed = clarContent ? parseClarifications(clarContent) : null;
  if (!parsed) f.error(clarFile, null, 'clarifications.md does not exist, so no [Q<n>] or [D<n>] tag can be resolved');

  const confirmedRounds = new Set(parsed ? parsed.rounds.filter((r) => roundStatus(parsed, r.name).confirmed).map((r) => r.name) : []);

  const checkTag = (path, line, tag) => {
    if (tag === 'desc') {
      if (parsed && !parsed.sources.desc) f.error(path, line, `[desc] is used but "## Sources" has no [desc] entry`);
      return;
    }
    if (tag === 'assumption') return;
    if (!parsed) return;
    if (tag.startsWith('D')) {
      if (!parsed.sources.docs.has(tag)) f.error(path, line, `[${tag}] is not registered under "## Sources" in clarifications.md`);
      return;
    }
    const q = parsed.questions.get(Number(tag.slice(1)));
    if (!q) f.error(path, line, `[${tag}] does not exist in clarifications.md`);
    else if (q.answerLine === null || isBlankAnswer(q.answer)) f.error(path, line, `[${tag}] is not answered yet`);
    else if (!confirmedRounds.has(q.round)) f.error(path, line, `[${tag}] belongs to the ${q.round} round, which is not confirmed ("Looks correct")`);
  };

  for (const name of file ? [file] : FILES) {
    const content = readChangeFile(root, change, name);
    if (content === null) continue;
    const path = join(dir, name);
    const blocks = substantiveBlocks(content);
    const hasAssumptions = toLines(content).some((l) => ASSUMPTIONS_HEADING.test(l.trim()));
    if (!hasAssumptions) f.error(path, null, `"## Assumptions & Open Questions" section is missing`, 'add it; write "None." when there are no assumptions');
    let assumptionBlocks = 0;
    for (const b of blocks) {
      const inAssumptions = b.section && /^Assumptions\s*&\s*Open Questions$/i.test(b.section);
      const plain = b.text.replace(/^([-*+]|\d+[.)])\s+/, '').trim();
      const tags = [...b.text.matchAll(TAG)].map((m) => m[1]);
      if (inAssumptions) {
        assumptionBlocks++;
        if (EXEMPT.some((r) => r.test(plain))) continue;
        if (!tags.includes('assumption')) f.error(path, b.line, `entry in "Assumptions & Open Questions" is not tagged [assumption]`);
        continue;
      }
      if (tags.includes('assumption')) {
        f.error(path, b.line, `[assumption] used outside "## Assumptions & Open Questions"`, 'move the statement into that section, or ground it with an answer');
      }
      for (const t of new Set(tags)) checkTag(path, b.line, t);
      if (EXEMPT.some((r) => r.test(plain))) continue;
      if (!tags.length) {
        const preview = plain.length > 70 ? plain.slice(0, 67) + '...' : plain;
        f.error(path, b.line, `untagged statement: "${preview}"`, 'end it with [Q<n>], [D<n>] or [desc]; if no source supports it, move it to Assumptions or ask a follow-up');
      }
    }
    if (hasAssumptions && assumptionBlocks === 0) {
      f.error(path, null, `"## Assumptions & Open Questions" is empty`, 'write "None." when there are no assumptions');
    }
  }
  return makeReport(CHECK, f.list, { change });
}

if (isMain(import.meta.url)) {
  runCli(CHECK, USAGE, (args, root) => checkGrounding({ root, change: args.change, file: args.file }));
}
