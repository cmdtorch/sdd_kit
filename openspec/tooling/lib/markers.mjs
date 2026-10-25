// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Scenario markers in test files (openspec/protocols/testing.md §3). Stack-agnostic: a marker is plain
// text, usually a line comment above the test, in any language:
//   # @scenario inventory/sales-export :: Successful export
//   // @scenario inventory/sales-export :: Successful export
// The marker starts its line: only indentation and a comment opener may come before it, so prose and
// string literals that mention a marker are not counted.
// The kit only reads files; it never runs tests. Files come from git (tracked + untracked, .gitignore
// respected); outside git the tree is walked with the usual dependency/build directories skipped.
// Paths listed in openspec/markers-ignore (the project's file, one pattern per line) are not scanned.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normName } from './spec-parser.mjs';

// indentation, then at most a short comment opener (#, //, /*, *, <!--, --, ;, %, {#, <%--, {{!--)
const MARKER = /^\s*[^\w\s]{0,5}\s*@scenario\s+(\S+)\s+::\s+(.+)$/;
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

/** Markers in one file's content: [{capability, scenario, line}]. */
export function parseMarkers(content) {
  const found = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((l, idx) => {
    const m = l.match(MARKER);
    if (!m) return;
    const scenario = normName(m[2].replace(TRAILER, ''));
    if (scenario) found.push({ capability: m[1], scenario, line: idx + 1 });
  });
  return found;
}

/** Every marker in the project: [{capability, scenario, file, line}]. */
export function collectMarkers(root) {
  const markers = [];
  for (const file of listProjectFiles(root)) {
    const p = join(root, file);
    let content;
    try {
      if (!existsSync(p) || statSync(p).size > MAX_BYTES) continue;
      content = readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    if (!content.includes('@scenario') || content.includes('\0')) continue;
    for (const m of parseMarkers(content)) markers.push({ ...m, file });
  }
  return markers;
}
