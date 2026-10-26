// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Scenario markers in test files (openspec/protocols/testing.md §3). Stack-agnostic: a marker is plain
// text, usually a line comment above the test, in any language:
//   # @scenario inventory/sales-export :: Successful export
//   // @scenario inventory/sales-export :: Successful export
// The marker starts its line: only indentation and a comment opener may come before it, so prose and
// string literals that mention a marker are not counted.
// On the test-case schemas a test also names the test cases it proves, with the same placement rules:
//   # @case inventory/sales-export :: Export of an empty period
// The kit only reads files; it never runs tests. Files come from git (tracked + untracked, .gitignore
// respected); outside git the tree is walked with the usual dependency/build directories skipped.
// Paths listed in openspec/markers-ignore (the project's file, one pattern per line) are not scanned.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normName } from './spec-parser.mjs';

// indentation, then at most a short comment opener (#, //, /*, *, <!--, --, ;, %, {#, <%--, {{!--)
const MARKER = /^\s*[^\w\s]{0,5}\s*@scenario\s+(\S+)\s+::\s+(.+)$/;
const CASE_REF = /^\s*[^\w\s]{0,5}\s*@case\s+(\S+)\s+::\s+(.+)$/;
// comment closers and string quotes that may follow the scenario name on the same line
const TRAILER = /\s*(\*\/|-->|--%>|%>|#\}|"""|'''|["'`]\s*[,)]*)\s*$/;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'target', '.venv', 'venv', '__pycache__', '.next', '.nuxt', 'coverage']);
const MAX_BYTES = 1024 * 1024;
export const IGNORE_FILE = 'openspec/markers-ignore';

/** Project files to scan, relative to root. `openspec/` is excluded: it holds the plan, not tests. */
export function listProjectFiles(root) {
  let files = null;
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
    });
    files = out.split('\0').filter(Boolean);
  } catch {
    files = walk(root, root);
  }
  const ignored = ignoreMatcher(root);
  return files.filter((f) => !f.startsWith('openspec/') && !f.startsWith('.claude/') && !ignored(f));
}

// Patterns from openspec/markers-ignore, relative to the project root: `docs/`, `CHANGELOG.md`,
// `**/examples`. `*` and `?` stay inside one path segment, `**` crosses them; a pattern also covers
// everything below it. Blank lines and `#` comments are skipped.
export function ignoreMatcher(root) {
  const p = join(root, IGNORE_FILE);
  if (!existsSync(p)) return () => false;
  const res = readFileSync(p, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => new RegExp(`^${globSource(l.replace(/^\/+|\/+$/g, ''))}(?:/.*)?$`));
  return (file) => res.some((re) => re.test(file));
}

function globSource(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        out += '(?:.*/)?';
      } else out += '.*';
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return out;
}

function walk(root, dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(root, p));
    else if (st.isFile()) out.push(relative(root, p).split('\\').join('/'));
  }
  return out;
}

/** References matching `re` in one file's content: [{capability, name, line}]. */
function parseRefs(content, re) {
  const found = [];
  content.split(/\r?\n/).forEach((l, idx) => {
    const m = l.match(re);
    if (!m) return;
    const name = normName(m[2].replace(TRAILER, ''));
    if (name) found.push({ capability: m[1], name, line: idx + 1 });
  });
  return found;
}

/** Markers in one file's content: [{capability, scenario, line}]. */
export function parseMarkers(content) {
  return parseRefs(content, MARKER).map(({ capability, name, line }) => ({ capability, scenario: name, line }));
}

/** Case references in one file's content: [{capability, name, line}]. */
export function parseCaseRefs(content) {
  return parseRefs(content, CASE_REF);
}

/** True when the project-relative `file` lies in the folder `under` (any file when `under` is empty). */
export function isUnder(file, under) {
  if (!under) return true;
  return file === under || file.startsWith(`${under}/`);
}

/** Every reference of one keyword in the project, or only in the folder `under`: [{...parsed, file}]. */
function collect(root, keyword, parse, under) {
  const out = [];
  for (const file of listProjectFiles(root)) {
    if (!isUnder(file, under)) continue;
    const p = join(root, file);
    let content;
    try {
      if (!existsSync(p) || statSync(p).size > MAX_BYTES) continue;
      content = readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    if (!content.includes(keyword) || content.includes('\0')) continue;
    for (const m of parse(content)) out.push({ ...m, file });
  }
  return out;
}

/** Every marker in the project (or in the folder `under`): [{capability, scenario, file, line}]. */
export function collectMarkers(root, { under = '' } = {}) {
  return collect(root, '@scenario', parseMarkers, under);
}

/** Every case reference in the project (or in the folder `under`): [{capability, name, file, line}]. */
export function collectCaseRefs(root, { under = '' } = {}) {
  return collect(root, '@case', parseCaseRefs, under);
}

// a blank line or a line that is only a comment (or a decorator) between the markers and their test
const BETWEEN = /^\s*($|\/\/|#|\/\*|\*|<!--|--|;|%|@)/;

/**
 * The references of the test that starts on `line` (1-based) of a file's content: the marker and case
 * lines directly above it, read upwards over blank, comment and decorator lines until the first line of
 * code. Returns { cases: [{capability, name}], scenarios: [{capability, scenario}] } in file order.
 */
export function refsAbove(content, line) {
  const lines = content.split(/\r?\n/);
  const cases = [];
  const scenarios = [];
  for (let i = Math.min(line, lines.length + 1) - 2; i >= 0; i--) {
    const l = lines[i];
    const c = parseCaseRefs(l)[0];
    const s = parseMarkers(l)[0];
    if (c) cases.unshift({ capability: c.capability, name: c.name });
    else if (s) scenarios.unshift({ capability: s.capability, scenario: s.scenario });
    else if (!BETWEEN.test(l)) break;
  }
  return { cases, scenarios };
}
