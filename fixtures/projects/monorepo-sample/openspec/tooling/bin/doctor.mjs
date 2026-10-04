#!/usr/bin/env node
// sdd-kit: managed file. Do not edit; local changes are overwritten on kit update.
// One command that tells a developer whether this machine and this repository are ready for sdd-kit work,
// and how to fix what is not. Read-only.
//   node openspec/tooling/bin/doctor.mjs [--json]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { findRoot } from '../lib/project.mjs';
import { parseArgs, isMain } from '../lib/report.mjs';
import { loadVerifyConfig } from '../lib/verify-config.mjs';
import { referencedStores, storeRoot, checkoutStatus } from '../lib/stores.mjs';

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, ...opts, env: { ...process.env, OPENSPEC_TELEMETRY: '0', ...(opts.env || {}) } });
const has = (cmd) => run('sh', ['-c', `command -v ${cmd}`]).status === 0;

/** Leading executables of a shell command line ("A=1 cd x && uv run y | z" → ["uv", "z"]). */
export function commandsOf(line) {
  return line
    .replace(/'[^']*'|"[^"]*"/g, 'Q') // quoted values (e.g. PYTEST_ADDOPTS='-p x') are not commands
    .split(/&&|\|\||;|\|/)
    .map((part) => part.trim().split(/\s+/).filter((w) => !/^[A-Z_][A-Z0-9_]*=/.test(w))[0])
    .filter((w) => w && !['cd', 'test', '['].includes(w) && !w.startsWith('{'));
}

export function doctor(root) {
  const items = []; // {level: ok|warning|error, check, message, fix?}
  const add = (level, check, message, fix) => items.push({ level, check, message, ...(fix ? { fix } : {}) });

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) add('ok', 'node', `Node ${process.versions.node}`);
  else add('error', 'node', `Node ${process.versions.node} is too old`, 'install Node 20 or newer');

  const kitFile = join(root, 'openspec', 'tooling', 'kit.json');
  const kit = existsSync(kitFile) ? JSON.parse(readFileSync(kitFile, 'utf8')) : null;
  if (!kit) {
    add('error', 'kit', 'sdd-kit is not installed in this repository', 'npx github:<org>/sdd-kit install (see the kit README)');
    return items;
  }
  add('ok', 'kit', `sdd-kit ${kit.kitVersion}`);

  const os = run(process.env.OPENSPEC_BIN || 'openspec', ['--version']);
  if (os.status !== 0) add('error', 'openspec', 'the openspec CLI was not found', `npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
  else if (os.stdout.trim() !== kit.openspecVersion) add('error', 'openspec', `openspec ${os.stdout.trim()} is installed, the kit needs ${kit.openspecVersion}`, `npm i -g @fission-ai/openspec@${kit.openspecVersion}`);
  else add('ok', 'openspec', `openspec ${kit.openspecVersion}`);

  if (has('claude')) add('ok', 'claude', `Claude Code ${run('claude', ['--version']).stdout.trim().split(' ')[0]}`);
  else add('warning', 'claude', 'Claude Code was not found on PATH', 'install Claude Code: https://code.claude.com');

  if (run('git', ['rev-parse', '--git-dir'], { cwd: root }).status !== 0) add('warning', 'git', 'not a git repository: verification freshness and CI checks need git', 'git init');

  const manifestFile = join(root, 'openspec', 'tooling', 'kit-manifest.json');
  if (existsSync(manifestFile)) {
    const m = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const bad = Object.entries(m.files).filter(([rel, hash]) => !existsSync(join(root, rel)) || createHash('sha256').update(readFileSync(join(root, rel))).digest('hex') !== hash);
    if (bad.length) add('warning', 'kit files', `${bad.length} kit file(s) edited or missing: ${bad.slice(0, 5).map(([r]) => r).join(', ')}${bad.length > 5 ? ', …' : ''}`, 'kit updates will not touch them; restore with: npx github:<org>/sdd-kit update --force (backups are kept)');
    else add('ok', 'kit files', `${Object.keys(m.files).length} kit files unchanged`);
  }

  const settings = join(root, '.claude', 'settings.json');
  const st = existsSync(settings) ? readFileSync(settings, 'utf8') : '';
  const hooks = ['session-start', 'answers-gate', 'archive-gate', 'artifact-feedback', 'test-gate'].filter((h) => !st.includes(`openspec/tooling/hooks/${h}.mjs`));
  if (hooks.length) add('error', 'hooks', `kit hooks missing in .claude/settings.json: ${hooks.join(', ')}`, 'npx github:<org>/sdd-kit update');
  else add('ok', 'hooks', 'kit hooks registered in .claude/settings.json');

  const skills = join(root, '.claude', 'skills');
  const names = existsSync(skills) ? readdirSync(skills) : [];
  if (names.includes('openspec-propose') || !names.includes('openspec-continue-change')) {
    add('warning', 'skills', 'OpenSpec skills differ from the kit profile (propose installed or continue missing)', 'node openspec/tooling/bin/openspec.mjs update');
  } else add('ok', 'skills', 'OpenSpec skills follow the kit profile');

  let cfg = null;
  try {
    cfg = loadVerifyConfig(root);
  } catch (e) {
    add('error', 'verify.yaml', e.message, 'fix openspec/tooling/verify.yaml (see openspec/tooling/lib/verify-config.mjs for the format)');
  }
  if (cfg === null && !items.some((i) => i.check === 'verify.yaml')) {
    add('warning', 'verify.yaml', 'no openspec/tooling/verify.yaml: tests cannot be run by the kit', 'npx github:<org>/sdd-kit update --preset <django,playwright>');
  } else if (cfg) {
    const cmds = new Set();
    for (const l of Object.values(cfg.levels)) for (const k of ['collect', 'scoped', 'full', 'gate']) if (l[k]) commandsOf(l[k]).forEach((c) => cmds.add(c));
    if (cfg.api?.export) commandsOf(cfg.api.export).forEach((c) => cmds.add(c));
    const missing = [...cmds].filter((c) => !has(c));
    if (missing.length) add('warning', 'test tools', `commands used by verify.yaml are not on PATH: ${missing.join(', ')}`, 'install them (e.g. uv: https://docs.astral.sh/uv/)');
    else add('ok', 'test tools', `verify.yaml commands available: ${[...cmds].join(', ')}`);
    if (cfg.api && !existsSync(join(root, cfg.api.snapshot))) add('warning', 'API baseline', `no ${cfg.api.snapshot}`, 'on the main branch: node openspec/tooling/bin/api.mjs snapshot && commit it');
  }

  for (const id of referencedStores(root)) {
    const p = storeRoot(id);
    if (!p) {
      add('error', `store ${id}`, `the referenced backend store "${id}" is not registered on this machine`, `clone the backend and run: node openspec/tooling/bin/openspec.mjs store register <path-to-backend> --id ${id} --yes`);
      continue;
    }
    const s = checkoutStatus(p);
    if (s?.behind) add('warning', `store ${id}`, `${p} is ${s.behind} commit(s) behind its upstream`, `git -C ${p} pull`);
    else add('ok', `store ${id}`, `backend checkout at ${p}`);
  }
  return items;
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), ['json', 'help']);
  if (args.help) {
    console.log('Usage: doctor.mjs [--json] [--root <dir>]');
    process.exit(0);
  }
  const root = args.root || findRoot();
  if (!root) {
    console.error('sdd-kit doctor: no openspec/ directory found — run it inside a repository that has the kit installed');
    process.exit(1);
  }
  const items = doctor(root);
  const errors = items.filter((i) => i.level === 'error').length;
  if (args.json) console.log(JSON.stringify({ ok: !errors, items }, null, 2));
  else {
    const mark = { ok: '✓', warning: '!', error: '✗' };
    for (const i of items) {
      console.log(`${mark[i.level]} ${i.check}: ${i.message}`);
      if (i.fix) console.log(`    fix: ${i.fix}`);
    }
    console.log(errors ? `\n${errors} problem(s) to fix before working with sdd-kit.` : '\nReady.');
  }
  process.exit(errors ? 1 : 0);
}
