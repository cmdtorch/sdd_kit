// Release hygiene — one version everywhere, documentation that matches the code, doctor.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { doctor } from '../kit/openspec/tooling/bin/doctor.mjs';
import { install } from '../installer/sdd-kit.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(REPO, f), 'utf8');

describe('versioning', () => {
  test('package.json, kit.json and the CHANGELOG agree', () => {
    const v = JSON.parse(read('package.json')).version;
    assert.equal(JSON.parse(read('kit/openspec/tooling/kit.json')).kitVersion, v);
    assert.match(read('CHANGELOG.md'), new RegExp(`^## ${v.replace(/\./g, '\\.')} — `, 'm'));
  });
  test('install commands in the docs name the current release tag', () => {
    const v = JSON.parse(read('package.json')).version;
    for (const d of ['README.md', 'docs/guide/install.md']) {
      const tags = [...read(d).matchAll(/github:cmdtorch\/sdd_kit(#v[^\s`]+)?/g)].map((m) => m[1]);
      assert.ok(tags.length, `${d} has no install command`);
      for (const tag of tags) assert.ok(tag === `#v${v}` || tag === '#v<version>', `${d}: install command without the release tag (${tag ?? 'none'})`);
    }
  });
  test('license, package metadata and --version agree', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.license, 'MIT');
    assert.match(read('LICENSE'), /^MIT License/);
    for (const f of ['LICENSE', 'CHANGELOG.md']) assert.ok(pkg.files.includes(f), `package.json files lacks ${f}`);
    const r = spawnSync('node', [join(REPO, 'installer/sdd-kit.mjs'), '--version'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), `sdd-kit ${pkg.version} (OpenSpec ${JSON.parse(read('kit/openspec/tooling/kit.json')).openspecVersion})`);
  });
});

describe('documentation matches the code', () => {
  const docs = ['README.md', 'docs/how-it-works.md', ...readdirSync(join(REPO, 'docs', 'guide')).map((f) => `docs/guide/${f}`)];
  test('every tool and protocol the docs mention exists in the kit', () => {
    for (const d of docs) {
      for (const m of read(d).matchAll(/openspec\/(tooling\/(?:bin|checks|hooks)\/[\w-]+\.mjs|protocols\/[\w-]+\.md)/g)) {
        assert.ok(existsSync(join(REPO, 'kit/openspec', m[1])), `${d} mentions missing ${m[0]}`);
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
  test('docs/how-it-works.md names every kit file (templates by their directory)', () => {
    const doc = read('docs/how-it-works.md');
    const walk = (dir) => readdirSync(join(REPO, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]));
    const installed = (f) => f.replace(/^kit\/openspec\//, 'openspec/').replace(/^kit\/claude\//, '.claude/');
    const files = [...walk('kit'), ...walk('installer')].map((f) => (/\/templates\//.test(f) ? f.replace(/templates\/.*/, 'templates/') : f));
    for (const f of new Set(files)) {
      const name = /^kit\/[^/]+$/.test(f) ? f : installed(f);
      const shown = name.replace(/schemas\/(clarify|lean)\/templates\//, 'schemas/<schema>/templates/');
      assert.ok(doc.includes(name) || doc.includes(shown), `docs/how-it-works.md does not mention ${name}`);
    }
  });
  test('every installer option is documented', () => {
    const usage = read('installer/sdd-kit.mjs').match(/const USAGE = `([\s\S]*?)`;/)[1];
    const install = read('docs/guide/install.md');
    for (const opt of usage.match(/--[a-z-]+/g)) assert.ok(install.includes(opt), `docs/guide/install.md does not mention ${opt}`);
  });
});

describe('doctor', () => {
  test('reports a wrong OpenSpec version and how to fix it', async () => {
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
      assert.match(by('openspec').fix, /npm i -g @fission-ai\/openspec@1\.15\.0/);
      assert.equal(by('hooks').level, 'ok');
    } finally {
      if (saved === undefined) delete process.env.OPENSPEC_BIN;
      else process.env.OPENSPEC_BIN = saved;
    }
    const cli = spawnSync('node', [join(root, 'openspec/tooling/bin/doctor.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENSPEC_BIN: bin } });
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /✗ openspec: openspec 1\.12\.0 is installed, the kit needs 1\.15\.0/);
  });

  test('a repository without the kit', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-doctor-none-'));
    writeFileSync(join(root, 'x'), '');
    assert.equal(doctor(root).find((i) => i.check === 'kit').level, 'error');
  });
});
