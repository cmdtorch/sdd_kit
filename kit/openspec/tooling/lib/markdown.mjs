// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Small markdown helpers shared by the kit checks. Fence handling mirrors OpenSpec 1.13.0
// (dist/core/parsers/code-fence.js) so that both read the same structure.

/** Normalises line endings, strips a BOM, splits into lines. */
export function toLines(content) {
  return content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
}

/** Per-line mask: true for lines inside a fenced code block (fence lines included). */
export function fenceMask(lines) {
  const mask = new Array(lines.length).fill(false);
  let active = null;
  for (let i = 0; i < lines.length; i++) {
    if (!active) {
      const m = lines[i].match(/^\s*(`{3,}|~{3,})/);
      if (m) {
        active = { marker: m[1][0], length: m[1].length };
        mask[i] = true;
      }
      continue;
    }
    mask[i] = true;
    const close = lines[i].match(/^\s*(`{3,}|~{3,})\s*$/);
    if (close && close[1][0] === active.marker && close[1].length >= active.length) active = null;
  }
  return mask;
}

/**
 * Removes HTML comments (also multi-line) while keeping the line count, so line numbers stay valid.
 * Comments inside fenced code are kept.
 */
export function stripComments(lines, fences = fenceMask(lines)) {
  const out = [];
  let inComment = false;
  for (let i = 0; i < lines.length; i++) {
    if (fences[i]) {
      out.push(lines[i]);
      continue;
    }
    let line = lines[i];
    let result = '';
    while (line.length) {
      if (inComment) {
        const end = line.indexOf('-->');
        if (end === -1) {
          line = '';
        } else {
          line = line.slice(end + 3);
          inComment = false;
        }
      } else {
        const start = line.indexOf('<!--');
        if (start === -1) {
          result += line;
          line = '';
        } else {
          result += line.slice(0, start);
          line = line.slice(start + 4);
          inComment = true;
        }
      }
    }
    out.push(result);
  }
  return out;
}

/** Heading info for a line, or null. Lines inside fences are never headings. */
export function headingAt(lines, fences, i) {
  if (fences[i]) return null;
  const m = lines[i].match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
  return m ? { level: m[1].length, title: m[2].trim(), line: i } : null;
}

/** All headings of the document: [{level, title, line}] (0-based line). */
export function headings(lines, fences = fenceMask(lines)) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const h = headingAt(lines, fences, i);
    if (h) out.push(h);
  }
  return out;
}

/**
 * Line range [start, end) of the body of the first heading matching `predicate`.
 * The body ends at the next heading of the same or a higher level.
 */
export function sectionRange(lines, predicate, fences = fenceMask(lines)) {
  const hs = headings(lines, fences);
  const idx = hs.findIndex(predicate);
  if (idx === -1) return null;
  const h = hs[idx];
  const next = hs.slice(idx + 1).find((x) => x.level <= h.level);
  return { start: h.line + 1, end: next ? next.line : lines.length, heading: h };
}

/** Splits a markdown table row into trimmed cells. Escaped pipes (`\|`) stay inside cells. */
export function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += s[i];
    }
  }
  cells.push(cur.trim());
  return cells;
}

const SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/**
 * First markdown table in lines[start, end). Returns {header, rows:[{cells, line}]} or null.
 * Comment-only lines must already be stripped by the caller if needed.
 */
export function firstTable(lines, start, end) {
  for (let i = start; i < end - 1; i++) {
    if (lines[i].trim().startsWith('|') && SEPARATOR.test(lines[i + 1])) {
      const header = splitRow(lines[i]);
      const rows = [];
      let j = i + 2;
      for (; j < end && lines[j].trim().startsWith('|'); j++) {
        rows.push({ cells: splitRow(lines[j]), line: j });
      }
      return { header, rows, line: i };
    }
  }
  return null;
}

/** Case/space-insensitive key for matching names written by people (table cells vs headers). */
export function fold(s) {
  return String(s).replace(/`/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}
