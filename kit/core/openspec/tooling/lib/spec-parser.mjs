// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The kit's only reader of spec markdown (decision D21). OpenSpec 1.13.0 `show --json` drops
// requirement and scenario names, so the kit reads them itself. The header rules mirror
// OpenSpec 1.13.0 (dist/core/parsers/requirement-blocks.js, requirement-text.js):
//   - delta sections: `## ADDED|MODIFIED|REMOVED|RENAMED Requirements` (case-insensitive, may repeat)
//   - main spec: `## Requirements`
//   - requirement: `### Requirement: <name>` (case-insensitive keyword), name trimmed
//   - scenario: ANY `####` header inside a requirement block counts (OpenSpec parity);
//     the kit expects `#### Scenario: <name>` and reports other forms
//   - everything inside fenced code is ignored
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { toLines, fenceMask } from './markdown.mjs';

const REQUIREMENT_HEADER = /^###\s*Requirement:\s*(.+)\s*$/i;
const SCENARIO_HEADER = /^####\s+(.*?)\s*$/;
const SCENARIO_NAME = /^Scenario:\s*(.+)$/i;
const ANY_HEADER = /^#{1,6}\s/;
const METADATA_LINE = /^\*\*[^*]+\*\*:/;

/** Name normalisation used for every comparison: trim + collapse inner whitespace (case-sensitive). */
export function normName(s) {
  return String(s).replace(/`/g, '').trim().replace(/\s+/g, ' ');
}

/** Requirement body text, as OpenSpec extracts it (lines before the first header, fence-aware). */
function requirementText(title, bodyLines, bodyMask) {
  const captured = [];
  const metadata = [];
  for (let i = 0; i < bodyLines.length; i++) {
    if (bodyMask[i]) continue;
    const line = bodyLines[i];
    if (ANY_HEADER.test(line)) break;
    const t = line.trim();
    if (!t) continue;
    if (METADATA_LINE.test(t)) metadata.push(t);
    else captured.push(t);
  }
  return captured.length ? captured.join('\n') : metadata.length ? metadata.join('\n') : title.trim();
}

/** Parses one requirement block: lines[start] is the `### Requirement:` header. */
function parseRequirementBlock(lines, mask, start, end) {
  const name = normName(lines[start].match(REQUIREMENT_HEADER)[1]);
  const bodyLines = lines.slice(start + 1, end);
  const bodyMask = mask.slice(start + 1, end);
  const scenarios = [];
  for (let i = 0; i < bodyLines.length; i++) {
    if (bodyMask[i]) continue;
    const m = bodyLines[i].match(SCENARIO_HEADER);
    if (!m) continue;
    // body: until the next header of level <= 4 (OpenSpec MarkdownParser.getContent)
    let j = i + 1;
    while (j < bodyLines.length && !(!bodyMask[j] && /^#{1,4}\s/.test(bodyLines[j]))) j++;
    const header = m[1];
    const sm = header.match(SCENARIO_NAME);
    scenarios.push({
      name: normName(sm ? sm[1] : header),
      header,
      wellFormed: Boolean(sm),
      line: start + 1 + i + 1, // 1-based
      body: bodyLines.slice(i + 1, j).join('\n').trim(),
    });
  }
  return { name, text: requirementText(name, bodyLines, bodyMask), line: start + 1, scenarios };
}

/** Requirement blocks within lines[start, end); also reports `###` headers that are not requirements. */
function parseBlocks(lines, mask, start, end, sectionTitle, skipped) {
  const isReq = (i) => !mask[i] && REQUIREMENT_HEADER.test(lines[i]);
  const isTop = (i) => !mask[i] && /^##\s+/.test(lines[i]);
  const blocks = [];
  let i = start;
  while (i < end) {
    if (!isReq(i)) {
      if (skipped && !mask[i]) {
        const h3 = lines[i].match(/^###\s+(.+?)\s*$/);
        if (h3) skipped.push({ header: h3[1].trim(), section: sectionTitle, line: i + 1 });
      }
      i++;
      continue;
    }
    let j = i + 1;
    while (j < end && !isReq(j) && !isTop(j)) {
      if (skipped && !mask[j]) {
        const h3 = lines[j].match(/^###\s+(.+?)\s*$/);
        if (h3 && !REQUIREMENT_HEADER.test(lines[j])) skipped.push({ header: h3[1].trim(), section: sectionTitle, line: j + 1 });
      }
      j++;
    }
    blocks.push(parseRequirementBlock(lines, mask, i, j));
    i = j;
  }
  return blocks;
}

/** All `## ` sections: [{title, start (body start index), end, line (1-based header line)}]. */
function topSections(lines, mask) {
  const idx = [];
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue;
    const m = lines[i].match(/^##\s+(.+)$/);
    if (m) idx.push({ title: m[1].trim(), index: i });
  }
  return idx.map((s, k) => ({ title: s.title, start: s.index + 1, end: k + 1 < idx.length ? idx[k + 1].index : lines.length, line: s.index + 1 }));
}

/** Purpose text of a spec (body of `## Purpose`), trimmed, comments excluded; null when absent. */
function purposeOf(lines, mask, sections) {
  const s = sections.find((x) => x.title.toLowerCase() === 'purpose');
  if (!s) return null;
  const text = lines
    .slice(s.start, s.end)
    .filter((_, k) => !mask[s.start + k])
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return { text, line: s.line };
}

/** Parses a delta spec (a change's `specs/<capability>/spec.md`). */
export function parseDeltaSpec(content) {
  const lines = toLines(content);
  const mask = fenceMask(lines);
  const sections = topSections(lines, mask);
  const skipped = [];
  const pick = (title) => sections.filter((s) => s.title.toLowerCase() === title.toLowerCase());
  const reqs = (title) => pick(title).flatMap((s) => parseBlocks(lines, mask, s.start, s.end, s.title, skipped));
  const removed = [];
  for (const s of pick('REMOVED Requirements')) {
    for (let i = s.start; i < s.end; i++) {
      if (mask[i]) continue;
      const m = lines[i].match(REQUIREMENT_HEADER) || lines[i].match(/^\s*[-*+]\s*`?###\s*Requirement:\s*(.+?)`?\s*$/);
      if (m) removed.push({ name: normName(m[1]), line: i + 1 });
    }
  }
  const renamed = [];
  for (const s of pick('RENAMED Requirements')) {
    let from = null;
    for (let i = s.start; i < s.end; i++) {
      if (mask[i]) continue;
      const f = lines[i].match(/^\s*(?:[-*+]\s*)?FROM:\s*`?(?:###\s*Requirement:\s*)?(.+?)`?\s*$/i);
      const t = lines[i].match(/^\s*(?:[-*+]\s*)?TO:\s*`?(?:###\s*Requirement:\s*)?(.+?)`?\s*$/i);
      if (f) from = normName(f[1]);
      else if (t && from) {
        renamed.push({ from, to: normName(t[1]), line: i + 1 });
        from = null;
      }
    }
  }
  return {
    purpose: purposeOf(lines, mask, sections),
    added: reqs('ADDED Requirements'),
    modified: reqs('MODIFIED Requirements'),
    removed,
    renamed,
    skipped,
  };
}

/** Parses a main spec (`openspec/specs/<capability>/spec.md`). */
export function parseMainSpec(content) {
  const lines = toLines(content);
  const mask = fenceMask(lines);
  const sections = topSections(lines, mask);
  const reqSection = sections.find((s) => /^requirements$/i.test(s.title));
  return {
    purpose: purposeOf(lines, mask, sections),
    requirements: reqSection ? parseBlocks(lines, mask, reqSection.start, reqSection.end, reqSection.title, null) : [],
  };
}

/** Finds `spec.md` files under a `specs/` dir: [{capability, file}] (capability uses `/`). */
export function findSpecFiles(specsDir) {
  const out = [];
  if (!existsSync(specsDir)) return out;
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'spec.md') out.push({ capability: relative(specsDir, dir).split(sep).join('/'), file: p });
    }
  };
  walk(specsDir);
  return out;
}

/**
 * Every delta of a change with the scenarios a test must cover.
 * Returns [{capability, file, delta, isNew}] where isNew = no main spec exists yet.
 */
export function loadChangeDeltas(root, changeDir) {
  return findSpecFiles(join(changeDir, 'specs')).map(({ capability, file }) => ({
    capability,
    file,
    delta: parseDeltaSpec(readFileSync(file, 'utf8')),
    isNew: !existsSync(join(root, 'openspec', 'specs', ...capability.split('/'), 'spec.md')),
  }));
}

/** Scenarios to verify for a change: ADDED + MODIFIED requirements. [{capability, requirement, scenario, file, line}] */
export function changeScenarios(deltas) {
  const out = [];
  for (const { capability, file, delta } of deltas) {
    for (const req of [...delta.added, ...delta.modified]) {
      for (const sc of req.scenarios) {
        out.push({ capability, requirement: req.name, scenario: sc.name, file, line: sc.line });
      }
    }
  }
  return out;
}
