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
import { checkReleaseTag, checkOpenspecVersion, checkCommands } from './helpers/site-checks.mjs';

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

describe('documentation site', () => {
  const INSTALL = 'site/src/content/docs/start/install.md';
  const COMMANDS = 'site/src/content/docs/reference/commands.md';
  const table = (...cells) => ['| Command | What it does |', '|---|---|', ...cells.map((c) => `| \`${c}\` | x |`)].join('\n');

  // @scenario docs-site/kit-sync :: Install page with the current release tag
  test('release tag check: the current tag on every install command', () => {
    const page = ['```bash', 'npx github:cmdtorch/sdd_kit#v0.8.1 install --dry-run', 'npx github:cmdtorch/sdd_kit#v0.8.1 install', '```'].join('\n');
    assert.deepEqual(checkReleaseTag(page, '0.8.1'), []);
  });

  // @scenario docs-site/kit-sync :: Install page with an old release tag
  test('release tag check: an old tag names the page and the tag', () => {
    const problems = checkReleaseTag('npx github:cmdtorch/sdd_kit#v0.8.0 install', '0.8.1');
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(INSTALL));
    assert.match(problems[0], /#v0\.8\.0/);
  });

  // @scenario docs-site/kit-sync :: Install command without a tag
  test('release tag check: a command without a tag', () => {
    const problems = checkReleaseTag('npx github:cmdtorch/sdd_kit install', '0.8.1');
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(INSTALL));
    assert.match(problems[0], /missing/);
  });

  // @scenario docs-site/kit-sync :: Install page without an install command
  test('release tag check: a page without an install command', () => {
    const problems = checkReleaseTag('# Install\n\nNothing to run here.', '0.8.1');
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(INSTALL));
    assert.match(problems[0], /no install command/);
  });

  // @scenario docs-site/kit-sync :: Install page with the pinned OpenSpec version
  test('OpenSpec version check: the pinned version everywhere', () => {
    const page = ['| OpenSpec CLI | 2.2.0 exactly |', '', 'npm i -g @fission-ai/openspec@2.2.0'].join('\n');
    assert.deepEqual(checkOpenspecVersion(page, '2.2.0'), []);
  });

  // @scenario docs-site/kit-sync :: Install command with another OpenSpec version
  test('OpenSpec version check: another version in an install command', () => {
    const problems = checkOpenspecVersion('npm i -g @fission-ai/openspec@2.1.0', '2.2.0');
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(INSTALL));
    assert.match(problems[0], /2\.1\.0/);
  });

  // @scenario docs-site/kit-sync :: Requirements table with another OpenSpec version
  test('OpenSpec version check: another version in the requirements table', () => {
    const problems = checkOpenspecVersion('| OpenSpec CLI | 2.1.0 exactly |', '2.2.0');
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(INSTALL));
    assert.match(problems[0], /2\.1\.0/);
  });

  // @scenario docs-site/kit-sync :: Install page without an OpenSpec version
  test('OpenSpec version check: a page without an OpenSpec version', () => {
    const problems = checkOpenspecVersion('| Node.js | 22.12 or newer |\n\nnpm i -g something', '2.2.0');
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(INSTALL));
    assert.match(problems[0], /names no OpenSpec version/);
  });

  // @scenario docs-site/kit-sync :: The site's Install page agrees with the kit
  test("the site's Install page agrees with the kit", () => {
    const page = read(INSTALL);
    const problems = [
      ...checkReleaseTag(page, JSON.parse(read('package.json')).version),
      ...checkOpenspecVersion(page, JSON.parse(read('kit/openspec/tooling/kit.json')).openspecVersion),
    ];
    assert.deepEqual(problems, []);
  });

  // @scenario docs-site/kit-sync :: Commands of the kit
  test('command check: skills, kit commands and tooling scripts of the kit', () => {
    const page = table('/openspec-new-change <name> --schema lean', '/sdd:clarify', 'node openspec/tooling/bin/doctor.mjs');
    assert.deepEqual(checkCommands(page, REPO), []);
  });

  // @scenario docs-site/kit-sync :: A slash command the kit does not have
  test('command check: a slash command the kit does not have', () => {
    const problems = checkCommands(table('/openspec-propose'), REPO);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /\/openspec-propose/);
  });

  // @scenario docs-site/kit-sync :: A kit command file that does not exist
  test('command check: a kit command file that does not exist', () => {
    const problems = checkCommands(table('/sdd:review'), REPO);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /\/sdd:review/);
  });

  // @scenario docs-site/kit-sync :: A tooling script that does not exist
  test('command check: a tooling script that does not exist', () => {
    const problems = checkCommands(table('node openspec/tooling/bin/missing.mjs --change <name>'), REPO);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /openspec\/tooling\/bin\/missing\.mjs/);
  });

  // @scenario docs-site/kit-sync :: A table cell that is not a known kind of command
  test('command check: a cell that is not a known kind of command', () => {
    const problems = checkCommands(table('openspec update'), REPO);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /unknown command/);
    assert.match(problems[0], /openspec update/);
  });

  // @scenario docs-site/kit-sync :: Commands page without a command
  test('command check: a page whose tables hold no command', () => {
    const problems = checkCommands(['# Commands', '', '| Command | What it does |', '|---|---|'].join('\n'), REPO);
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(COMMANDS));
    assert.match(problems[0], /lists no command/);
  });

  // @scenario docs-site/kit-sync :: The site's Commands page lists only existing commands
  test("the site's Commands page lists only existing commands", () => {
    assert.deepEqual(checkCommands(read(COMMANDS), REPO), []);
  });

  // @scenario docs-site/kit-sync :: Root package without dependencies
  test('the root package declares no dependency and its tests do not touch the site', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.devDependencies, undefined);
    assert.ok(pkg.scripts.test, 'package.json has no test script');
    assert.doesNotMatch(pkg.scripts.test, /site|astro/);
  });
});

describe('site build in CI', () => {
  const SITE = '.github/workflows/site.yml';
  // Workflow files are read as text (the root has no YAML parser).
  const lines = (text) => text.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  const indent = (l) => l.match(/^ */)[0].length;
  // The lines nested under the first `<key>:` line found after `from`.
  const block = (ls, key, from = 0) => {
    const i = ls.findIndex((l, n) => n >= from && l.trim() === `${key}:`);
    if (i < 0) return [];
    const out = [];
    for (const l of ls.slice(i + 1)) {
      if (indent(l) <= indent(ls[i])) break;
      out.push(l);
    }
    return out;
  };
  // A list value under `key`: flow style (`key: [a, b]`) or block style (`- a` lines).
  const list = (ls, key) => {
    const i = ls.findIndex((l) => l.trim().startsWith(`${key}:`));
    if (i < 0) return undefined;
    const unquote = (s) => s.trim().replace(/^['"]|['"]$/g, '');
    const flow = ls[i].trim().slice(key.length + 1).trim();
    if (flow) return flow.replace(/^\[|\]$/g, '').split(',').map(unquote).filter(Boolean);
    const out = [];
    for (const l of ls.slice(i + 1)) {
      if (indent(l) < indent(ls[i]) || !l.trim().startsWith('- ')) break;
      out.push(unquote(l.trim().slice(2)));
    }
    return out;
  };
  const steps = (text) => {
    const body = block(lines(text), 'steps');
    const at = body.length ? indent(body[0]) : 0;
    const out = [];
    for (const l of body) {
      if (indent(l) === at && l.trim().startsWith('- ')) out.push([]);
      out.at(-1)?.push(l.trim().replace(/^- /, ''));
    }
    return out;
  };

  // @scenario docs-site/ci-build :: The site workflow installs and builds in site/
  test('the site workflow runs npm ci, then npm run build, both in site/', () => {
    assert.ok(existsSync(join(REPO, SITE)), `${SITE} does not exist`);
    const all = steps(read(SITE));
    const at = (cmd) => all.findIndex((s) => s.includes(`run: ${cmd}`));
    const ci = at('npm ci');
    const build = at('npm run build');
    assert.ok(ci >= 0, `${SITE} has no npm ci step`);
    assert.ok(build > ci, `${SITE} does not run npm run build after npm ci`);
    for (const i of [ci, build]) assert.ok(all[i].includes('working-directory: site'), `${SITE}: step ${all[i][0]} does not run in site`);
  });

  // @scenario docs-site/ci-build :: The test workflow does not build the site
  test('the test workflow names neither site nor astro', () => {
    assert.doesNotMatch(read('.github/workflows/test.yml'), /site|astro/i);
  });

  // @scenario docs-site/ci-build :: Triggers of the site workflow
  test('the site workflow runs on pull requests and pushes to main for site/** and package.json', () => {
    assert.ok(existsSync(join(REPO, SITE)), `${SITE} does not exist`);
    const on = block(lines(read(SITE)), 'on');
    const triggers = on.filter((l) => indent(l) === indent(on[0])).map((l) => l.trim());
    assert.deepEqual(triggers.sort(), ['pull_request:', 'push:']);
    for (const t of ['pull_request', 'push']) {
      assert.deepEqual(list(block(on, t), 'paths')?.sort(), ['package.json', 'site/**'], `${t} paths`);
    }
    assert.deepEqual(list(block(on, 'push'), 'branches'), ['main']);
    assert.equal(list(block(on, 'pull_request'), 'branches'), undefined);
  });

  // @scenario docs-site/ci-build :: Releasing step lists the Install page
  test('the Releasing step that names README.md also names the site Install page', () => {
    const releasing = read('CONTRIBUTING.md').split(/^## Releasing$/m)[1].split(/^## /m)[0];
    const items = releasing.split(/^(?=\d+\. )/m).filter((s) => /^\d+\. /.test(s));
    const step = items.find((s) => s.includes('`README.md`'));
    assert.ok(step, 'no Releasing step names README.md');
    assert.ok(step.includes('site/src/content/docs/start/install.md'), 'the README.md step does not name the site Install page');
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
    writeFileSync(bin, '#!/bin/sh\necho 1.15.0\n');
    chmodSync(bin, 0o755);
    const saved = process.env.OPENSPEC_BIN;
    process.env.OPENSPEC_BIN = bin;
    try {
      const items = doctor(root);
      const by = (c) => items.find((i) => i.check === c);
      assert.equal(by('openspec').level, 'error');
      assert.match(by('openspec').fix, /npm i -g @fission-ai\/openspec@2\.2\.0/);
      assert.equal(by('hooks').level, 'ok');
    } finally {
      if (saved === undefined) delete process.env.OPENSPEC_BIN;
      else process.env.OPENSPEC_BIN = saved;
    }
    const cli = spawnSync('node', [join(root, 'openspec/tooling/bin/doctor.mjs')], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENSPEC_BIN: bin } });
    assert.equal(cli.status, 1);
    assert.match(cli.stdout, /✗ openspec: openspec 1\.15\.0 is installed, the kit needs 2\.2\.0/);
  });

  test('a repository without the kit', () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-doctor-none-'));
    writeFileSync(join(root, 'x'), '');
    assert.equal(doctor(root).find((i) => i.check === 'kit').level, 'error');
  });

  test('reports the planning continuation hooks missing from .claude/settings.json', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sdd-kit-doctor-hooks-'));
    await install({ target: root, skipOpenspec: true, yes: true, json: true });
    const file = join(root, '.claude', 'settings.json');
    const settings = JSON.parse(readFileSync(file, 'utf8'));
    delete settings.hooks.Stop;
    delete settings.hooks.UserPromptSubmit;
    writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
    const hooks = doctor(root).find((i) => i.check === 'hooks');
    assert.equal(hooks.level, 'error');
    assert.match(hooks.message, /planning-continue/);
    assert.match(hooks.message, /planning-prompt/);
    assert.doesNotMatch(hooks.message, /artifact-feedback/);
  });
});
