// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// Scenario markers in test files (openspec/protocols/testing.md §3). Stack-agnostic: a marker is plain
// text, usually a line comment above the test, in any language:
//   # @scenario inventory/sales-export :: Successful export
//   // @scenario inventory/sales-export :: Successful export
// The kit only reads files; it never runs tests. Files come from git (tracked + untracked, .gitignore
// respected); outside git the tree is walked with the usual dependency/build directories skipped.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normName } from './spec-parser.mjs';

const MARKER = /@scenario\s+(\S+)\s+::\s+(.+)$/;
// comment closers and string quotes that may follow the scenario name on the same line
const TRAILER = /\s*(\*\/|-->|--%>|%>|#\}|"""|'''|["'`]\s*[,)]*)\s*$/;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', 'target', '.venv', 'venv', '__pycache__', '.next', '.nuxt', 'coverage']);
const MAX_BYTES = 1024 * 1024;

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
  return files.filter((f) => !f.startsWith('openspec/') && !f.startsWith('.claude/'));
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
