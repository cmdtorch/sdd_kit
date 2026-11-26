// Text tests for the E2E stage protocol (change faster-test-stage): the reuse of a running application, the
// worker limit, and which tests run while failing tests are fixed. These tests read the kit text of
// openspec/protocols/e2e.md and check that each rule is stated in the section where the agent reads it.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = readFileSync(join(REPO, 'kit', 'openspec', 'protocols', 'e2e.md'), 'utf8');
// collapse line breaks so phrases may wrap
const flat = (s) => s.replace(/\s+/g, ' ');
/** The section `## <n>. <title>` up to the next `## <n>.` heading, fenced examples included. */
const section = (n, title) => {
  const m = RAW.match(new RegExp(`\\n## ${n}\\. ${title}\\n([\\s\\S]*?)(?=\\n## \\d+\\. |$)`));
  assert.ok(m, `section "${n}. ${title}" not found in e2e.md`);
  return flat(m[1]);
};

describe('e2e protocol: a running application is reused', () => {
  // @scenario e2e/tests :: Protocol config reuses the running application
  test('the webServer entry of the Playwright configuration example has reuseExistingServer: true', () => {
    const s = section(3, 'Playwright');
    const web = s.match(/webServer: [^\n]*?\{([^}]*)\}/);
    assert.ok(web, 'the config example has a webServer entry');
    assert.match(web[1], /reuseExistingServer: true/);
    assert.doesNotMatch(s, /reuseExistingServer: false/);
    // the worker limit of the runner is named where the config is described
    assert.match(s, /`e2e-run\.mjs` runs Playwright with two workers, or with the number in the environment variable `E2E_WORKERS`/);
  });

  // @scenario e2e/tests :: Protocol forbids E2E beside another suite
  test('the E2E tests never run at the same time as another test suite', () => {
    assert.match(section(7, 'Running the tests'), /The E2E tests never run at the same time as another test suite/);
  });
});

describe('e2e protocol: reruns while tests are fixed', () => {
  // @scenario e2e/tests :: Protocol limits reruns to the failing tests
  test('while tests are fixed only the failing tests run again, by file or by title, then one full run', () => {
    const s = section(8, 'Failing tests');
    assert.match(s, /while tests are fixed, run only the failing tests again, by file or by title/);
    assert.match(s, /When they pass, make one full run/);
    // the section on running the tests no longer lets a single rerun stand in for the full run
    assert.doesNotMatch(section(7, 'Running the tests'), /A rerun of only the fixed test is enough/);
  });
});
