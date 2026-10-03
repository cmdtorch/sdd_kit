// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Minimal YAML reader for the files the kit lints (schema.yaml, config.yaml, .openspec.yaml,
// verify.yaml). Zero dependencies (D3). Supported subset:
//   block mappings and sequences (incl. `- key: value` items), plain/quoted scalars,
//   numbers/booleans/null, flow sequences `[a, b]` and flat flow maps `{a: 1}`,
//   block scalars `|` and `>` with chomping (`-`, `+`), comments, a leading `---`.
// Not supported (reported as errors): anchors/aliases, tags, multi-document streams, tabs for indentation.
// Returns { value, positions } where positions maps a path ("artifacts.0.id") to its 1-based line.

export class YamlError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.line = line;
  }
}

const KEY_LINE = /^((?:"(?:[^"\\]|\\.)*")|(?:'(?:[^']|'')*')|(?:[^\s#'"\-?:,[\]{}][^#:]*?|-[^\s#:][^#:]*?))\s*:(?:\s+(.*))?$/;

function stripComment(s) {
  let inS = false;
  let inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS && s[i - 1] !== '\\') inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(s[i - 1]))) return s.slice(0, i).trimEnd();
  }
  return s.trimEnd();
}

function unquote(s, line) {
  if (s.startsWith('"')) {
    if (!s.endsWith('"') || s.length < 2) throw new YamlError(`unterminated double-quoted string`, line);
    try {
      return JSON.parse(s);
    } catch {
      throw new YamlError(`invalid double-quoted string ${s}`, line);
    }
  }
  if (!s.endsWith("'") || s.length < 2) throw new YamlError(`unterminated single-quoted string`, line);
  return s.slice(1, -1).replace(/''/g, "'");
}

function splitFlow(inner, line) {
  const parts = [];
  let depth = 0;
  let cur = '';
  let q = null;
  for (const c of inner) {
    if (q) {
      cur += c;
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") q = c;
    if (c === '[' || c === '{') depth++;
    if (c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (q || depth !== 0) throw new YamlError(`unbalanced flow collection`, line);
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function scalar(raw, line) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (s.startsWith('&') || s.startsWith('*') || s.startsWith('!')) throw new YamlError(`anchors, aliases and tags are not supported`, line);
  if (s.startsWith('"') || s.startsWith("'")) return unquote(s, line);
  if (s.startsWith('[')) {
    if (!s.endsWith(']')) throw new YamlError(`unterminated flow sequence`, line);
    return splitFlow(s.slice(1, -1), line).map((p) => scalar(p, line));
  }
  if (s.startsWith('{')) {
    if (!s.endsWith('}')) throw new YamlError(`unterminated flow mapping`, line);
    const obj = {};
    for (const p of splitFlow(s.slice(1, -1), line)) {
      const m = p.match(/^([^:]+?)\s*:\s*(.*)$/);
      if (!m) throw new YamlError(`invalid flow mapping entry "${p}"`, line);
      obj[scalar(m[1], line)] = scalar(m[2], line);
    }
    return obj;
  }
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^[-+]?\d+$/.test(s)) return Number(s);
  if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return Number(s);
  return s;
}

export function parseYaml(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const positions = {};
  // Working copy: sequence items rewrite their "- " into spaces so that the item content can be
  // parsed as a block at a deeper indent.
  const work = lines.slice();

  const indentOf = (s) => s.match(/^ */)[0].length;
  const meaningful = (i) => {
    const t = work[i];
    if (t === undefined) return false;
    const c = stripComment(t);
    return c.trim() !== '' && c.trim() !== '---';
  };
  const nextMeaningful = (i) => {
    while (i < work.length && !meaningful(i)) i++;
    return i;
  };
  for (let i = 0; i < lines.length; i++) {
    if (/^\t/.test(lines[i]) || /^ *\t/.test(lines[i])) {
      if (meaningful(i)) throw new YamlError(`tabs are not allowed for indentation`, i + 1);
    }
  }
  if (lines.filter((l) => /^---\s*$/.test(l)).length > 1) throw new YamlError(`multiple documents are not supported`);

  function blockScalar(header, i, parentIndent, line) {
    const m = header.match(/^([|>])([+-]?)(\d?)([+-]?)\s*$/);
    if (!m) throw new YamlError(`invalid block scalar header "${header}"`, line);
    const folded = m[1] === '>';
    const chomp = m[2] || m[4];
    const out = [];
    let blockIndent = m[3] ? parentIndent + Number(m[3]) : null;
    let j = i;
    for (; j < work.length; j++) {
      const l = work[j];
      if (l.trim() === '') {
        out.push('');
        continue;
      }
      const ind = indentOf(l);
      if (blockIndent === null) {
        if (ind <= parentIndent) break;
        blockIndent = ind;
      }
      if (ind < blockIndent) break;
      out.push(l.slice(blockIndent));
    }
    // trailing blank lines belong to chomping, not to the next node
    let content = out;
    let trailing = 0;
    while (content.length && content[content.length - 1] === '') {
      content = content.slice(0, -1);
      trailing++;
    }
    let value;
    if (folded) {
      value = '';
      for (let k = 0; k < content.length; k++) {
        const cur = content[k];
        const prev = content[k - 1];
        if (k === 0) value = cur;
        else if (cur === '') value += '\n'; // each empty line is one newline; the break before it is dropped
        else if (prev === '') value += cur;
        else if (/^\s/.test(cur) || /^\s/.test(prev)) value += '\n' + cur; // more-indented lines keep breaks
        else value += ' ' + cur;
      }
    } else value = content.join('\n');
    if (chomp === '-') {
      /* strip */
    } else if (chomp === '+') value += '\n'.repeat(trailing + 1);
    else if (content.length) value += '\n';
    return { value, next: j - trailing };
  }

  // Parses the node that starts at line i with exactly `indent` spaces. Returns {value, next}.
  function block(i, indent, path) {
    i = nextMeaningful(i);
    const first = stripComment(work[i]);
    if (/^ *-( |$)/.test(first)) return sequence(i, indent, path);
    return mapping(i, indent, path);
  }

  function valueAfterKey(rest, i, indent, path, line) {
    // rest = text after "key:" on the same line (comment stripped)
    if (rest && /^[|>]/.test(rest)) return blockScalar(rest, i + 1, indent, line);
    if (rest) return { value: scalar(rest, line), next: i + 1 };
    const j = nextMeaningful(i + 1);
    if (j >= work.length) return { value: null, next: j };
    const ind = indentOf(work[j]);
    const isSeq = /^ *-( |$)/.test(stripComment(work[j]));
    if (ind > indent || (ind === indent && isSeq)) return block(j, ind, path);
    return { value: null, next: i + 1 };
  }

  function mapping(i, indent, path) {
    const obj = {};
    while (true) {
      i = nextMeaningful(i);
      if (i >= work.length) break;
      const raw = stripComment(work[i]);
      const ind = indentOf(raw);
      if (ind < indent) break;
      if (ind > indent) throw new YamlError(`unexpected indentation`, i + 1);
      const content = raw.slice(ind);
      if (/^-( |$)/.test(content)) break; // a sequence at the same indent ends this mapping (parent handles it)
      const m = content.match(KEY_LINE);
      if (!m) throw new YamlError(`expected "key: value", got "${content}"`, i + 1);
      const key = String(scalar(m[1], i + 1));
      if (Object.prototype.hasOwnProperty.call(obj, key)) throw new YamlError(`duplicate key "${key}"`, i + 1);
      const keyPath = path ? `${path}.${key}` : key;
      positions[keyPath] = i + 1;
      const r = valueAfterKey((m[2] || '').trim(), i, indent, keyPath, i + 1);
      obj[key] = r.value;
      i = r.next;
    }
    return { value: obj, next: i };
  }

  function sequence(i, indent, path) {
    const arr = [];
    while (true) {
      i = nextMeaningful(i);
      if (i >= work.length) break;
      const raw = stripComment(work[i]);
      const ind = indentOf(raw);
      if (ind < indent) break;
      if (ind > indent) throw new YamlError(`unexpected indentation`, i + 1);
      const content = raw.slice(ind);
      if (!/^-( |$)/.test(content)) break;
      const itemPath = `${path ? path + '.' : ''}${arr.length}`;
      positions[itemPath] = i + 1;
      const rest = content.slice(1).trim();
      if (!rest) {
        const j = nextMeaningful(i + 1);
        if (j < work.length && indentOf(work[j]) > indent) {
          const r = block(j, indentOf(work[j]), itemPath);
          arr.push(r.value);
          i = r.next;
        } else {
          arr.push(null);
          i++;
        }
        continue;
      }
      if (KEY_LINE.test(rest) && !/^["'[{]/.test(rest.split(':')[0])) {
        // "- key: value": rewrite the dash to a space and parse a mapping at the content column
        const col = ind + content.indexOf(rest);
        work[i] = ' '.repeat(col) + rest;
        const r = mapping(i, col, itemPath);
        arr.push(r.value);
        i = r.next;
        continue;
      }
      if (/^[|>]/.test(rest)) {
        const r = blockScalar(rest, i + 1, indent, i + 1);
        arr.push(r.value);
        i = r.next;
        continue;
      }
      arr.push(scalar(rest, i + 1));
      i++;
    }
    return { value: arr, next: i };
  }

  const start = nextMeaningful(0);
  if (start >= work.length) return { value: null, positions };
  const r = block(start, indentOf(work[start]), '');
  const rest = nextMeaningful(r.next);
  if (rest < work.length) throw new YamlError(`unexpected content`, rest + 1);
  return { value: r.value, positions };
}
