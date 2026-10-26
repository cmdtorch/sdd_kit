// Shared helpers of the E2E stage tests (e2e-stage, e2e-hooks): a fake `npx` first on PATH that answers
// `playwright test --reporter=json` with a prepared report, a builder of such reports, and a runner of
// `e2e-run.mjs` as a process. No browser is needed.
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * A Playwright JSON report (the subset of `--reporter=json` the kit reads, in its real shape) for the test
 * folder `dir`. `tests`: [{file (relative to dir), title, line, status: 'expected'|'unexpected'|'skipped'|'flaky'}];
 * only the listed tests ran.
 */
export function playwrightReport(dir, tests, { retries = 0 } = {}) {
  const suites = tests.map(({ file, title, line, status }, k) => {
    const result = (s, retry) => ({ workerIndex: 0, status: s, duration: 120, errors: [], stdout: [], stderr: [], retry, startTime: '2026-10-26T10:00:00.000Z', attachments: [] });
    const results = status === 'skipped' ? [result('skipped', 0)] : status === 'unexpected' ? [result('failed', 0)] : status === 'flaky' ? [result('failed', 0), result('passed', 1)] : [result('passed', 0)];
    return {
      title: file,
      file,
      line: 0,
      column: 0,
      specs: [{ title, ok: status !== 'unexpected', tags: [], id: `id-${k}`, file, line, column: 1, tests: [{ timeout: 30000, annotations: [], expectedStatus: status === 'skipped' ? 'skipped' : 'passed', projectId: 'chromium', projectName: 'chromium', results, status }] }],
    };
  });
  const count = (s) => tests.filter((t) => t.status === s).length;
  return {
    config: { configFile: join(dir, 'playwright.config.ts'), rootDir: dir, version: '1.48.0', workers: 1, projects: [{ id: 'chromium', name: 'chromium', retries, testDir: dir, outputDir: join(dir, 'test-results'), timeout: 30000 }] },
    suites,
    errors: [],
    stats: { startTime: '2026-10-26T10:00:00.000Z', duration: 900, expected: count('expected'), skipped: count('skipped'), unexpected: count('unexpected'), flaky: count('flaky') },
  };
}

/** A fake `npx` first on PATH: logs its call and prints the report of FAKE_PW_REPORT; exit 1 when a test failed. */
function fakeNpx() {
  const bin = mkdtempSync(join(tmpdir(), 'sdd-kit-fake-npx-'));
  const script = `#!/usr/bin/env node
const fs = require('fs');
fs.appendFileSync(process.env.FAKE_PW_LOG, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2), baseUrl: process.env.E2E_BASE_URL ?? null }) + '\\n');
const report = fs.readFileSync(process.env.FAKE_PW_REPORT, 'utf8');
process.stdout.write(report);
const failed = JSON.parse(report).suites.some((s) => s.specs.some((p) => p.tests.some((t) => t.status === 'unexpected' || t.status === 'flaky')));
process.exit(failed ? 1 : 0);
`;
  writeFileSync(join(bin, 'npx'), script);
  chmodSync(join(bin, 'npx'), 0o755);
  return bin;
}
export const FAKE_BIN = fakeNpx();

/** The environment of a process that finds the fake npx first on PATH. */
export function fakeEnv(root) {
  const base = join(root, '..', root.split('/').pop());
  return { ...process.env, PATH: `${FAKE_BIN}:${process.env.PATH}`, FAKE_PW_REPORT: `${base}-report.json`, FAKE_PW_LOG: `${base}-npx.log` };
}

/**
 * Runs `script` (an e2e-run.mjs) as a process in `root` for `change`; the fake npx prints `report` (an
 * object), if given. Returns { code, out, err, calls } (calls: every logged npx call so far).
 */
export function runE2e(script, root, change, report, args = []) {
  const env = fakeEnv(root);
  if (report) writeFileSync(env.FAKE_PW_REPORT, JSON.stringify(report));
  const res = spawnSync('node', [script, '--change', change, ...args], { cwd: root, encoding: 'utf8', env });
  const calls = existsSync(env.FAKE_PW_LOG) ? readFileSync(env.FAKE_PW_LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  return { code: res.status, out: res.stdout, err: res.stderr, calls };
}
