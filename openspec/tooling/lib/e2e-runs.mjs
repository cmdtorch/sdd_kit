// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// The E2E runs of a change: `e2e-runs.json`, written only by openspec/tooling/bin/e2e-run.mjs and read by
// check-e2e (format of the stage: openspec/protocols/e2e.md).
//
//   { "runs": [ {
//       "at": "2026-10-26T10:00:00.000Z",
//       "retries": 0,                                  the largest `retries` of the Playwright projects
//       "tests": [ { "file": "e2e/export.spec.ts",     project-relative
//                    "title": "export › two sales", "line": 12,
//                    "refs": { "cases": [{capability, name}], "scenarios": [{capability, scenario}] },
//                    "status": "passed" | "failed" | "skipped" } ],
//       "appState": "<sha256>",                        the project files outside openspec/ and the test folder
//       "testFiles": { "e2e/export.spec.ts": "<sha256>", ... }   every file of the test folder
//   } ] }
//
// The file list is the markers library's (files git tracks or would track, openspec/ excluded). Inside the
// test folder, Playwright's own output (test-results/, playwright-report/, blob-report/) and node_modules/
// are not fingerprinted.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, isAbsolute } from 'node:path';
import { listProjectFiles, isUnder, refsAbove } from './markers.mjs';
import { changeDir } from './project.mjs';

export const RUNS_FILE = 'e2e-runs.json';
export const STATE_ID_LENGTH = 8;
export const RUN_STATUSES = ['passed', 'failed', 'skipped'];
const OUTPUT_DIRS = ['test-results', 'playwright-report', 'blob-report', 'node_modules'];

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const posix = (p) => p.split('\\').join('/');

/** The project-relative test folder of a `Tests:` value: `./e2e/` → `e2e`. */
export function normFolder(tests) {
  return posix(String(tests ?? '').trim())
    .replace(/^(\.\/)+/, '')
    .replace(/\/+$/, '');
}

/** The state id of an app state: its first 8 hex digits. */
export const stateId = (appState) => String(appState ?? '').slice(0, STATE_ID_LENGTH);

/**
 * Fingerprints of the project now: { appState, testFiles: {path: sha256} }. `folder` is the project-relative
 * test folder (normFolder). appState is one SHA-256 over the path and content hash of every project file
 * outside the folder.
 */
export function projectState(root, folder) {
  const app = createHash('sha256');
  const testFiles = {};
  const output = OUTPUT_DIRS.map((d) => `${folder}/${d}`);
  for (const file of [...listProjectFiles(root)].sort()) {
    const p = join(root, file);
    let content;
    try {
      if (!statSync(p).isFile()) continue;
      content = readFileSync(p);
    } catch {
      continue; // deleted but still in the git index
    }
    if (isUnder(file, folder)) {
      if (!output.some((o) => isUnder(file, o))) testFiles[file] = sha256(content);
    } else {
      app.update(`${file}\0${sha256(content)}\n`);
    }
  }
  return { appState: app.digest('hex'), testFiles };
}

/** The recorded runs of a change: { runs, error } (error: a message when the file is not valid JSON). */
export function readRuns(root, change) {
  const p = join(changeDir(root, change), RUNS_FILE);
  if (!existsSync(p)) return { runs: [], error: null, file: p };
  try {
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const runs = Array.isArray(data?.runs) ? data.runs : null;
    if (!runs) return { runs: [], error: `${RUNS_FILE} has no "runs" list`, file: p };
    return { runs, error: null, file: p };
  } catch (e) {
    return { runs: [], error: `${RUNS_FILE} is not valid JSON (${e.message})`, file: p };
  }
}

/** Appends one run to the change's e2e-runs.json; returns the file path. */
export function appendRun(root, change, run) {
  const { runs, error, file } = readRuns(root, change);
  if (error) throw new Error(`${error}; fix or remove it before recording a run`);
  writeFileSync(file, `${JSON.stringify({ runs: [...runs, run] }, null, 2)}\n`);
  return file;
}

/** Status of one Playwright spec from its tests (one per project): failed when any failed or was flaky. */
function specStatus(spec) {
  const statuses = (spec.tests ?? []).map((t) => {
    if (t.status) return t.status;
    const last = (t.results ?? []).at(-1)?.status;
    return last === 'passed' ? 'expected' : last === 'skipped' ? 'skipped' : 'unexpected';
  });
  if (!statuses.length || statuses.every((s) => s === 'skipped')) return 'skipped';
  if (statuses.some((s) => s === 'unexpected' || s === 'flaky')) return 'failed';
  return 'passed';
}

/**
 * Reads a Playwright JSON report (`--reporter=json`). `cwd` is the folder Playwright ran in. Returns
 * { retries (null when the report names no project), tests: [{file (project-relative), title, line, status}] }.
 */
export function parsePlaywrightReport(report, { root, cwd }) {
  const config = report?.config ?? {};
  const base = config.rootDir ? resolve(cwd, config.rootDir) : cwd;
  const projects = Array.isArray(config.projects) ? config.projects : [];
  const retries = projects.length ? Math.max(...projects.map((p) => Number(p.retries) || 0)) : null;
  const tests = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      const file = spec.file ?? suite.file ?? '';
      const abs = isAbsolute(file) ? file : resolve(base, file);
      tests.push({
        file: posix(relative(root, abs)),
        title: [...titles, spec.title].filter(Boolean).join(' › '),
        line: Number(spec.line) || 0,
        status: specStatus(spec),
      });
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title]);
  };
  for (const top of report?.suites ?? []) walk(top, []); // the top-level suite is the file
  return { retries, tests };
}

/** Adds the @case / @scenario references read above each test's line in its file. */
export function withRefs(root, tests) {
  const contents = new Map();
  return tests.map((t) => {
    if (!contents.has(t.file)) {
      try {
        contents.set(t.file, readFileSync(join(root, t.file), 'utf8'));
      } catch {
        contents.set(t.file, null);
      }
    }
    const content = contents.get(t.file);
    const refs = content === null || !t.line ? { cases: [], scenarios: [] } : refsAbove(content, t.line);
    return { file: t.file, title: t.title, line: t.line, refs, status: t.status };
  });
}
