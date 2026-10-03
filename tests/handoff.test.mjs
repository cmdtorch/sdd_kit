// Phase 6: OpenAPI diff (real drf-spectacular output), api.mjs, check-handoff, archive gate with API,
// and the frontend-side import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { diffOpenapi, operations } from '../kit/core/openspec/tooling/lib/openapi-diff.mjs';
import { diffChange, snapshotApi, checkApi } from '../kit/core/openspec/tooling/lib/api.mjs';
import { checkHandoff } from '../kit/core/openspec/tooling/checks/check-handoff.mjs';
import { runVerification } from '../kit/core/openspec/tooling/lib/verify-run.mjs';
import { importHandoff } from '../kit/core/openspec/tooling/bin/handoff.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = join(REPO, 'fixtures', 'openapi');
const BEFORE = JSON.parse(readFileSync(join(OPENAPI, 'drf-before.json'), 'utf8'));
const AFTER = JSON.parse(readFileSync(join(OPENAPI, 'drf-after.json'), 'utf8'));
const GOOD_HANDOFF = readFileSync(join(REPO, 'fixtures', 'handoff', 'frontend-handoff.md'), 'utf8');
const CHANGE = 'add-sales-export';
const C = `openspec/changes/${CHANGE}`;

/** Good project with the API configured; baseline = drf-before, current export = drf-after. */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'sdd-kit-api-'));
  cpSync(join(REPO, 'fixtures', 'projects', 'checks-good'), root, { recursive: true });
  cpSync(join(REPO, 'kit', 'core', 'openspec'), join(root, 'openspec'), { recursive: true });
  rmSync(join(root, C, 'verification.md'));
  cpSync(join(OPENAPI, 'drf-before.json'), join(root, 'before.json'));
  cpSync(join(OPENAPI, 'drf-after.json'), join(root, 'after.json'));
  writeFileSync(join(root, 'fake-openapi-current.txt'), 'before.json\n');
  appendFileSync(join(root, 'openspec/tooling/verify.yaml'), 'api:\n  export: "node fake-openapi.mjs {out}"\n  snapshot: openspec/api/openapi.json\n');
  writeFileSync(join(root, '.gitignore'), 'fake-runs.log\n');
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'ignore' });
  git('init', '-q');
  snapshotApi(root); // baseline on "main"
  git('add', '-A');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
  writeFileSync(join(root, 'fake-openapi-current.txt'), 'after.json\n'); // the change modifies the API
  return root;
}
const read = (root, f) => readFileSync(join(root, f), 'utf8');
const archive = (root, command) =>
  spawnSync('node', [join(REPO, 'kit/core/openspec/tooling/hooks/archive-gate.mjs')], {
    cwd: root,
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: root }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });

describe('OpenAPI diff on real drf-spectacular output', () => {
  const d = diffOpenapi(BEFORE, AFTER);
  const op = (m, p) => d.operations.find((o) => o.method === m && o.path === p);

  test('finds the added operation with its parameters and response fields', () => {
    const exp = op('GET', '/api/v1/sales/export/');
    assert.equal(exp.change, 'added');
    assert.deepEqual(exp.shape.params['query:date_from'], { type: 'string', required: true });
    assert.ok('results[].total' in exp.shape.responses['200']);
    assert.ok('403' in exp.shape.responses);
  });

  test('marks breaking changes: removed response field, new required request field', () => {
    assert.equal(d.operations.length, 6);
    assert.equal(d.operations.filter((o) => o.breaking).length, 5);
    const post = op('POST', '/api/v1/sales/');
    assert.ok(post.details.some((x) => x.breaking && /new REQUIRED field "currency"/.test(x.text)));
    assert.ok(post.details.some((x) => x.breaking && /response 201: field "note" removed/.test(x.text)));
    assert.ok(!op('PATCH', '/api/v1/sales/{id}/').details.some((x) => /currency/.test(x.text) && x.breaking), 'PATCH: currency optional');
    assert.ok(!post.details.some((x) => /"total"/.test(x.text) && x.where === 'request body'), 'read-only total is not a request field');
  });

  test('no change → no operations', () => {
    assert.deepEqual(diffOpenapi(AFTER, AFTER).operations, []);
  });

  test('removed operation, parameter becoming required, type change, removed 2xx, auth change', () => {
    const base = {
      paths: {
        '/a/': { get: { parameters: [{ in: 'query', name: 'q', schema: { type: 'string' } }], responses: { 200: { content: { 'application/json': { schema: { $ref: '#/components/schemas/A' } } } } } } },
        '/b/': { delete: { responses: { 204: { description: '' } } } },
      },
      components: { schemas: { A: { allOf: [{ $ref: '#/components/schemas/Base' }, { type: 'object', properties: { n: { type: 'integer' } } }] }, Base: { type: 'object', properties: { id: { type: 'integer' }, self: { $ref: '#/components/schemas/Base' } } } } },
    };
    const next = JSON.parse(JSON.stringify(base));
    next.paths['/a/'].get.parameters[0].required = true;
    next.components.schemas.A.allOf[1].properties.n = { type: 'string' };
    next.paths['/a/'].get.responses = { 202: next.paths['/a/'].get.responses[200] };
    next.paths['/a/'].get.security = [{ jwtAuth: [] }];
    delete next.paths['/b/'];
    const r = diffOpenapi(base, next);
    const a = r.operations.find((o) => o.path === '/a/');
    const texts = a.details.map((x) => x.text).join('\n');
    assert.match(texts, /"query:q" is now required/);
    assert.match(texts, /response 200 removed/);
    assert.match(texts, /authentication changed/);
    assert.equal(r.operations.find((o) => o.path === '/b/').change, 'removed');
    assert.ok(r.operations.every((o) => o.breaking));
    assert.ok('self.self' in operations(base)['GET /a/'].responses['200'], 'recursive schemas are bounded, not infinite');
  });
});

describe('api.mjs', () => {
  test('diff writes api-changes.json; snapshot updates the baseline; check compares', () => {
    const root = project();
    assert.equal(checkApi(root).ok, false);
    const r = diffChange(root, CHANGE);
    assert.equal(r.operations.length, 6);
    assert.equal(JSON.parse(read(root, `${C}/api-changes.json`)).operations.length, 6);
    assert.equal(snapshotApi(root).changed, true);
    assert.equal(checkApi(root).ok, true);
    assert.equal(snapshotApi(root).changed, false);
  });

  test('CLI: check exits 1 on drift, diff explains the next step', () => {
    const root = project();
    const cli = (...a) => spawnSync('node', [join(root, 'openspec/tooling/bin/api.mjs'), ...a], { cwd: root, encoding: 'utf8' });
    assert.equal(cli('check').status, 1);
    const d = cli('diff', '--change', CHANGE);
    assert.equal(d.status, 0, d.stderr);
    assert.match(d.stdout, /added +GET \/api\/v1\/sales\/export\//);
    assert.match(d.stdout, /now write frontend-handoff\.md/);
    assert.equal(cli('snapshot').status, 0);
    assert.equal(cli('check').status, 0);
  });

  test('no baseline → a clear instruction', () => {
    const root = project();
    rmSync(join(root, 'openspec/api/openapi.json'));
    assert.throws(() => diffChange(root, CHANGE), /no API baseline .* run "node openspec\/tooling\/bin\/api\.mjs snapshot" on the main branch first/);
  });
});

describe('check-handoff', () => {
  const withDiff = () => {
    const root = project();
    diffChange(root, CHANGE);
    return root;
  };
  test('the good handoff passes; no API change needs no handoff', () => {
    const root = withDiff();
    writeFileSync(join(root, C, 'frontend-handoff.md'), GOOD_HANDOFF);
    const r = checkHandoff({ root, change: CHANGE });
    assert.equal(r.ok, true, JSON.stringify(r.findings));
    assert.deepEqual(r.findings, []);
    writeFileSync(join(root, C, 'api-changes.json'), JSON.stringify({ operations: [] }));
    rmSync(join(root, C, 'frontend-handoff.md'));
    assert.equal(checkHandoff({ root, change: CHANGE }).ok, true);
  });

  const DEFECTS = [
    ['handoff missing', (h) => null, /6 API operation\(s\) changed but frontend-handoff\.md does not exist/],
    ['operation section missing', (h) => h.replace('### GET /api/v1/sales/export/', '### GET /api/v1/sales/exports/'), /no "### GET \/api\/v1\/sales\/export\/" section/],
    ['errors missing', (h) => h.replace(/(### PUT \/api\/v1\/sales\/\{id\}\/[\s\S]*?)- \*\*Errors:\*\*/, '$1- Problems:'), /"PUT \/api\/v1\/sales\/\{id\}\/" has no Errors/],
    ['example missing', (h) => h.replace(/(### GET \/api\/v1\/sales\/export\/[\s\S]*?)- \*\*Example:\*\*/, '$1- Sample:'), /has no Example/],
    ['breaking section missing', (h) => h.replace('## Breaking changes', '## Notes'), /breaking operation\(s\) but no "## Breaking changes" section/],
    ['breaking path not listed (prefix does not count)', (h) => h.replace('- `/api/v1/sales/` — `note` removed from responses; POST needs `currency`.\n', ''), /breaking change of (GET|POST) \/api\/v1\/sales\/ is not listed/],
  ];
  for (const [name, mutate, pattern] of DEFECTS) {
    test(`catches: ${name}`, () => {
      const root = withDiff();
      const h = mutate(GOOD_HANDOFF);
      if (h !== null) writeFileSync(join(root, C, 'frontend-handoff.md'), h);
      const r = checkHandoff({ root, change: CHANGE });
      assert.equal(r.ok, false);
      assert.ok(r.findings.some((f) => f.level === 'error' && pattern.test(f.message)), JSON.stringify(r.findings.map((f) => f.message)));
    });
  }

  test('a section for an operation outside the diff is a warning', () => {
    const root = withDiff();
    writeFileSync(join(root, C, 'frontend-handoff.md'), GOOD_HANDOFF + '\n### DELETE /api/v1/old/\n- x\n');
    const r = checkHandoff({ root, change: CHANGE });
    assert.equal(r.ok, true);
    assert.ok(r.findings.some((f) => f.level === 'warning' && /DELETE \/api\/v1\/old\//.test(f.message)));
  });
});

describe('archive gate with the API configured', () => {
  test('requires a current diff, a complete handoff and an updated baseline', () => {
    const root = project();
    runVerification({ root, change: CHANGE });
    let r = archive(root, `openspec archive ${CHANGE}`);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no api-changes\.json/);
    diffChange(root, CHANGE);
    r = archive(root, `openspec archive ${CHANGE}`);
    assert.match(r.stderr, /check-handoff: .*does not exist/);
    assert.match(r.stderr, /the API baseline is not the API this diff describes/);
    writeFileSync(join(root, C, 'frontend-handoff.md'), GOOD_HANDOFF);
    snapshotApi(root);
    runVerification({ root, change: CHANGE });
    r = archive(root, `openspec archive ${CHANGE}`);
    assert.equal(r.status, 0, r.stderr);
    // a fresh clone (no local kit state) can archive too: everything is content-based
    rmSync(join(root, '.git', 'sdd-kit', 'api-diff-add-sales-export.json'), { force: true });
    r = archive(root, `openspec archive ${CHANGE}`);
    assert.equal(r.status, 0, r.stderr);
    // the API changes again after the baseline was updated
    writeFileSync(join(root, 'fake-openapi-current.txt'), 'before.json\n');
    r = archive(root, `openspec archive ${CHANGE}`);
    assert.match(r.stderr, /the API changed after the baseline was updated/);
  });
});

describe('frontend import (handoff.mjs)', () => {
  async function frontend() {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-fe-'));
    await install({ target: root, skipOpenspec: true, yes: true, json: true });
    return root;
  }
  function backend({ archived = false } = {}) {
    const root = project();
    writeFileSync(join(root, C, 'frontend-handoff.md'), GOOD_HANDOFF);
    if (archived) {
      mkdirSync(join(root, 'openspec/changes/archive'), { recursive: true });
      cpSync(join(root, C), join(root, `openspec/changes/archive/2026-10-01-${CHANGE}`), { recursive: true });
      rmSync(join(root, C), { recursive: true });
    }
    return root;
  }

  test('creates a clarify change with the handoff and backend specs as sources', async () => {
    const fe = await frontend();
    const be = backend();
    const r = importHandoff({ root: fe, from: be, change: CHANGE });
    assert.equal(r.change, `${CHANGE}-ui`);
    const dir = join(fe, 'openspec/changes', r.change);
    assert.match(readFileSync(join(dir, '.openspec.yaml'), 'utf8'), /^schema: clarify$/m);
    assert.match(readFileSync(join(dir, 'sources/D1-backend-handoff.md'), 'utf8'), /### GET \/api\/v1\/sales\/export\//);
    const specs = readFileSync(join(dir, 'sources/D2-backend-specs.md'), 'utf8');
    assert.match(specs, /## Capability: inventory\/sales-export/);
    assert.match(specs, /##### Scenario: Empty period/);
    const status = spawnSync('node', [join(fe, 'openspec/tooling/hooks/session-start.mjs')], { cwd: fe, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: fe }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: fe, OPENSPEC_BIN: 'true' } });
    assert.match(JSON.parse(status.stdout).hookSpecificOutput.additionalContext, /add-sales-export-ui \[clarify\] — next artifact: clarifications/);
  });

  test('finds archived backend changes; refuses missing handoff, duplicates and projects without the kit', async () => {
    const fe = await frontend();
    assert.equal(importHandoff({ root: fe, from: backend({ archived: true }), change: CHANGE, as: 'sales-export-screen' }).change, 'sales-export-screen');
    assert.throws(() => importHandoff({ root: fe, from: backend(), change: CHANGE, as: 'sales-export-screen' }), /already exists/);
    const noHandoff = project();
    assert.throws(() => importHandoff({ root: fe, from: noHandoff, change: CHANGE }), /has no frontend-handoff\.md/);
    assert.throws(() => importHandoff({ root: mkdtempSync(join(tmpdir(), 'bare-')), from: backend(), change: CHANGE }), /install the kit first/);
    assert.throws(() => importHandoff({ root: fe, from: backend(), change: 'nope' }), /not found/);
  });

  test('CLI', async () => {
    const fe = await frontend();
    const be = backend();
    const r = spawnSync('node', [join(fe, 'openspec/tooling/bin/handoff.mjs'), 'import', '--from', be, '--change', CHANGE], { cwd: fe, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Next: run \/opsx:continue add-sales-export-ui/);
    assert.ok(existsSync(join(fe, 'openspec/changes/add-sales-export-ui/sources/D1-backend-handoff.md')));
  });
});
