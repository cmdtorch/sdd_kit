// Phase 11: release hygiene — one version everywhere, documentation that matches the code, doctor.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { commandsOf, doctor } from '../kit/core/openspec/tooling/bin/doctor.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(REPO, f), 'utf8');

describe('versioning', () => {
  test('package.json, kit.json and the CHANGELOG agree', () => {
    const v = JSON.parse(read('package.json')).version;
    assert.equal(JSON.parse(read('kit/core/openspec/tooling/kit.json')).kitVersion, v);
    assert.match(read('CHANGELOG.md'), new RegExp(`^## ${v.replace(/\./g, '\\.')} — `, 'm'));
  });
});

describe('documentation matches the code', () => {
  const docs = ['README.md', ...readdirSync(join(REPO, 'docs', 'guide')).map((f) => `docs/guide/${f}`)];
  test('every tool and protocol the docs mention exists in the kit', () => {
    for (const d of docs) {
      for (const m of read(d).matchAll(/openspec\/(tooling\/(?:bin|checks|hooks)\/[\w-]+\.mjs|protocols\/[\w-]+\.md)/g)) {
        assert.ok(existsSync(join(REPO, 'kit/core/openspec', m[1])), `${d} mentions missing ${m[0]}`);
      }
    }
  });
  test('relative links resolve', () => {
    for (const d of docs) {
      for (const m of read(d).matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)/g)) {
        assert.ok(existsSync(resolve(REPO, dirname(d), m[1])), `${d} links to missing ${m[1]}`);
      }
    }
  });
  test('every installer option is documented', () => {
    const usage = read('installer/sdd-kit.mjs').match(/const USAGE = `([\s\S]*?)`;/)[1];
    const install = read('docs/guide/install.md');
    for (const opt of usage.match(/--[a-z-]+/g)) assert.ok(install.includes(opt), `docs/guide/install.md does not mention ${opt}`);
  });
});

describe('doctor', () => {
  test('finds the executables of verify.yaml commands', () => {
    assert.deepEqual(commandsOf("PYTHONPATH={root}/x PYTEST_ADDOPTS='-p sdd_kit_pytest' make test FILE='{files}'"), ['make']);
    assert.deepEqual(commandsOf('cd backend && uv run python manage.py spectacular --file {out}'), ['uv']);
    assert.deepEqual(commandsOf('make lint && make typecheck'), ['make', 'make']);
  });

  test('reports a wrong OpenSpec version and a missing verify.yaml, and how to fix them', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-doctor-'));
    await install({ target: root, skipOpenspec: true, yes: true, json: true });
    const bin = join(mkdtempSync(join(tmpdir(), 'bin-')), 'openspec');
    writeFileSync(bin, '#!/bin/sh\necho 1.12.0\n');
    chmodSync(bin, 0o755);
    const saved = process.env.OPENSPEC_BIN;
    process.env.OPENSPEC_BIN = bin;
    try {
      const items = doctor(root);
      const by = (c) => items.find((i) => i.check === c);
      assert.equal(by('openspec').level, 'error');
      assert.match(by('openspec').fix, /npm i -g @fission-ai\/openspec@1\.13\.0/);
      assert.equal(by('hooks').level, 'ok');
      assert.equal(by('verify.yaml').level, 'warning');
    } finally {
      if (saved === undefined) delete process.env.OPENSPEC_BIN;
      else process.env.OPENSPEC_BIN = saved;
    }
    const cli = spawnSync('node', [join(root, 'openspec/tooling/bin/doctor.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENSPEC_BIN: bin } });
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /✗ openspec: openspec 1\.12\.0 is installed, the kit needs 1\.13\.0/);
  });

  test('a repository without the kit', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-doctor-none-'));
    writeFileSync(join(root, 'x'), '');
    assert.equal(doctor(root).find((i) => i.check === 'kit').level, 'error');
  });
});
