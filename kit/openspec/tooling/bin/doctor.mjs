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

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, ...opts, env: { ...process.env, OPENSPEC_TELEMETRY: '0', ...(opts.env || {}) } });
const has = (cmd) => run('sh', ['-c', `command -v ${cmd}`]).status === 0;

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

  if (run('git', ['rev-parse', '--git-dir'], { cwd: root }).status !== 0) add('warning', 'git', 'not a git repository: test markers are found through git, CI needs it', 'git init');

  const manifestFile = join(root, 'openspec', 'tooling', 'kit-manifest.json');
  if (existsSync(manifestFile)) {
    const m = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const bad = Object.entries(m.files).filter(([rel, hash]) => !existsSync(join(root, rel)) || createHash('sha256').update(readFileSync(join(root, rel))).digest('hex') !== hash);
    if (bad.length) add('warning', 'kit files', `${bad.length} kit file(s) edited or missing: ${bad.slice(0, 5).map(([r]) => r).join(', ')}${bad.length > 5 ? ', …' : ''}`, 'kit updates will not touch them; restore with: npx github:<org>/sdd-kit update --force (backups are kept)');
    else add('ok', 'kit files', `${Object.keys(m.files).length} kit files unchanged`);
  }

  const settings = join(root, '.claude', 'settings.json');
  const st = existsSync(settings) ? readFileSync(settings, 'utf8') : '';
  const hooks = ['session-start', 'answers-gate', 'archive-gate', 'artifact-feedback'].filter((h) => !st.includes(`openspec/tooling/hooks/${h}.mjs`));
  if (hooks.length) add('error', 'hooks', `kit hooks missing in .claude/settings.json: ${hooks.join(', ')}`, 'npx github:<org>/sdd-kit update');
  else add('ok', 'hooks', 'kit hooks registered in .claude/settings.json');

  const skills = join(root, '.claude', 'skills');
  const names = existsSync(skills) ? readdirSync(skills) : [];
  if (names.includes('openspec-propose') || !names.includes('openspec-continue-change')) {
    add('warning', 'skills', 'OpenSpec skills differ from the kit profile (propose installed or continue missing)', 'node openspec/tooling/bin/openspec.mjs update');
  } else add('ok', 'skills', 'OpenSpec skills follow the kit profile');

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
