// The start check right after the Main round and its record (change project-test-commands, design D-7):
// `start-check.mjs --status` reads the change's `start-check.json`, and apply does not repeat a passed check.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { parseYaml } from '../kit/openspec/tooling/lib/yaml.mjs';
import { startCheckPassed } from '../kit/openspec/tooling/lib/start-check.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const START_CHECK = join(REPO, 'kit', 'openspec', 'tooling', 'bin', 'start-check.mjs');
const kit = (...p) => readFileSync(join(REPO, 'kit', ...p), 'utf8');
const flat = (s) => s.replace(/\s+/g, ' ');
const schema = (name) => parseYaml(kit('openspec', 'schemas', name, 'schema.yaml')).value;
const applyInstruction = (name) => flat(schema(name).apply.instruction);
/** The section of a protocol under `## <n>.` up to the next `## `. */
const section = (text, n) => {
  const m = text.match(new RegExp(`\\n## ${n}\\. [^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(m, `section ${n} not found`);
  return flat(m[1]);
};
const APPLY = kit('openspec', 'protocols', 'apply.md');
const PLANNING = kit('openspec', 'protocols', 'planning.md');

/** A temporary project with one change stamped 0.7.0 on `clarify`. */
function project(schemaName = 'clarify') {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-early-'));
  const change = 'add-report';
  const dir = join(root, 'openspec', 'changes', change);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.openspec.yaml'), `schema: ${schemaName}\ncreated: 2026-11-26\nx-sdd-kit: 0.7.0\n`);
  return { root, change, dir };
}
async function freePort() {
  const { createServer } = await import('node:net');
  return new Promise((done) => {
    const s = createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => done(port));
    });
  });
}
const serverCommand = (port, status) => `node -e "require('http').createServer((q,s)=>{s.statusCode=${status};s.end('x')}).listen(${port},'127.0.0.1')"`;
function runCheck(root, change, args) {
  return new Promise((done) => {
    const p = spawn('node', [START_CHECK, '--change', change, ...args], { cwd: root, env: { ...process.env } });
    let stdout = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stdout += d));
    p.on('close', (code) => done({ code, stdout }));
  });
}
function status(root, change) {
  const r = spawnSync('node', [START_CHECK, '--change', change, '--status'], { cwd: root, encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr };
}
async function answers(port) {
  try {
    await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

describe('start-check.mjs --status', () => {
  // @scenario workflow/environment-check :: Application starts during planning
  test('a check that passes during planning writes a passed record and stops the application again', async () => {
    const { root, change, dir } = project();
    assert.equal(status(root, change).out, 'none');
    const port = await freePort();
    const r = await runCheck(root, change, ['--start', serverCommand(port, 200), '--url', `http://127.0.0.1:${port}/`, '--timeout', '20', '--interval', '0.2']);
    assert.equal(r.code, 0, r.stdout);
    assert.equal(await answers(port), false, 'the application is still running after the check');
    const rec = JSON.parse(readFileSync(join(dir, 'start-check.json'), 'utf8'));
    assert.deepEqual([rec.ok, rec.status], [true, 200]);
    const s = status(root, change);
    assert.equal(s.code, 0, s.err);
    assert.equal(s.out, 'passed');
    assert.equal(startCheckPassed(root, change), true);

    // After a passed (or skipped) early check, planning goes on to the proposal in the same turn.
    const s14 = section(PLANNING, 14);
    assert.match(s14, /2\. \*\*The early start check\.\*\* When the project's instructions name both the command that starts the application and an address it serves, run the start check \(`node openspec\/tooling\/bin\/start-check\.mjs --change <name> --start "<command>" --url <address> \[--stop "<command>"\]`/);
    assert.match(s14, /3\. \*\*Passed or skipped:\*\* write the proposal and go on with planning in the same turn\./);
  });

  // @scenario workflow/environment-check :: Early check already passed
  test('a passed record is read as passed; apply does not run the check again', async () => {
    const { root, change, dir } = project();
    const port = await freePort();
    const ok = await runCheck(root, change, ['--start', serverCommand(port, 200), '--url', `http://127.0.0.1:${port}/`, '--timeout', '20', '--interval', '0.2']);
    assert.equal(ok.code, 0, ok.stdout);
    assert.equal(status(root, change).out, 'passed');

    const s4 = section(APPLY, 4);
    assert.match(s4, /start-check\.mjs --change <name> --status/);
    assert.match(s4, /prints `passed`, do not run the start check again: go on with the first task/);
    for (const name of ['clarify']) {
      const a = applyInstruction(name);
      assert.match(a, /--status/, name);
      assert.match(a, /`passed`, do not run it again/, name);
    }
    assert.match(flat(section(APPLY, 1)), /unless the change's start check already passed/);
  });

  test('a failed run reads failed, a missing or unreadable record reads none', async () => {
    const { root, change, dir } = project();
    assert.equal(startCheckPassed(root, change), false);
    assert.equal(status(root, change).out, 'none');
    const port = await freePort();
    const r = await runCheck(root, change, ['--start', serverCommand(port, 503), '--url', `http://127.0.0.1:${port}/`, '--timeout', '1', '--interval', '0.2']);
    assert.equal(r.code, 1, r.stdout);
    assert.equal(status(root, change).out, 'failed');
    assert.equal(startCheckPassed(root, change), false);
    writeFileSync(join(dir, 'start-check.json'), '{ not json');
    assert.equal(status(root, change).out, 'none');
    assert.ok(existsSync(join(dir, 'start-check.json')));
  });

  test('--status needs only --change and rejects an unknown change', () => {
    const { root } = project();
    const r = status(root, 'no-such-change');
    assert.equal(r.code, 1);
    assert.match(r.err, /change "no-such-change" not found/);
  });
});

describe('apply: the start check after an early check', () => {
  // @scenario workflow/environment-check :: Lean change keeps the check at the start of apply
  test('a lean change has no early check and runs the start check before the first task', () => {
    const s4 = section(APPLY, 4);
    assert.match(s4, /Only a `clarify` change stamped 0\.7\.0 or later can have a check from right after the Main round/);
    const a = applyInstruction('lean');
    assert.match(a, /A `lean` change has no early start check: run the start check before the first task/);
    assert.match(a, /start-check\.mjs --change <name> --start "<command>" --url <address>/);
  });

  // @scenario workflow/environment-check :: Early check was skipped
  test('a skipped early check leaves no record, and the check runs at the start of apply as before', () => {
    const s4 = section(APPLY, 4);
    assert.match(s4, /prints `failed` or `none` \(the early check failed, was skipped or never ran\), run the start check as below/);
    assert.match(s4, /ask the developer once and suggest writing the commands and the address into CLAUDE\.md/);
    const a = applyInstruction('clarify');
    assert.match(a, /Otherwise run the start check before the first task/);
  });
});
